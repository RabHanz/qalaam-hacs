"""FastAPI entry point for the ASR worker.

Provider selection is env-gated:
  - default (no env): StubTranscriber returns deterministic perfect-match.
  - QALAAM_ASR_REAL=1: WhisperTranscriber hot-loads tarteel-ai/whisper-base-ar-quran
    via faster-whisper. Per ADR-0005 the audio never leaves the device.

Per ADR-0015: HTTP/JSON v0.1 → gRPC v1.0; transcriber abstraction unchanged.

Two transports are exposed:
  - POST /v1/transcribe — one-shot HTTP upload, returns final result.
  - WS  /v1/recite/ws  — streaming: init frame → audio chunks → end frame,
    emits `partial` frames every PARTIAL_INTERVAL_S and a `final` on close.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import UTC, datetime
from typing import Final

import structlog
from fastapi import FastAPI, UploadFile, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from .models import (
    AsrResult,
    StreamFinalFrame,
    StreamInitFrame,
    StreamPartialFrame,
    TranscribeRequest,
)
from .transcriber import DEFAULT_MODEL_ID, select_transcriber

logging.basicConfig(level=logging.INFO, format="%(message)s")
structlog.configure(
    processors=[
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ]
)
_LOG: Final = structlog.get_logger("qalaam.asr_worker")

_TRANSCRIBER = select_transcriber()

# Re-run the partial transcribe at most this often. Faster-whisper on CPU
# typically takes ~0.7-1.2s per second of audio; running every 2s keeps the
# worker ahead of the input stream while still feeling near-real-time.
PARTIAL_INTERVAL_S: Final[float] = float(os.environ.get("ASR_PARTIAL_INTERVAL_S", "2.0"))

# Hard cap on a single recitation session — defense against an open WS
# leaking forever if a client never sends `end` (browser tab closed without
# clean disconnect, etc.).
SESSION_MAX_S: Final[float] = float(os.environ.get("ASR_SESSION_MAX_S", "180"))

# Hard cap on buffered audio per session. Webm/opus from MediaRecorder runs
# ~24kbps so 180s ≈ 540KB; 4MB gives 30x headroom for higher-bitrate clients.
MAX_AUDIO_BYTES: Final[int] = int(os.environ.get("ASR_MAX_AUDIO_BYTES", "4194304"))

app = FastAPI(
    title="Qalaam ASR Worker",
    version="0.1.0",
    description=(
        "On-device ASR worker. Per ADR-0005: audio NEVER leaves the device. "
        "Only derived signals (transcript + word-level matches) are returned. "
        "Set QALAAM_ASR_REAL=1 to swap the stub for faster-whisper."
    ),
)


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {
        "status": "ok",
        "version": "0.1.0",
        "model_id": _TRANSCRIBER.model_id,
        "provider": _TRANSCRIBER.name,
        "privacy_posture": "audio-never-leaves-device",
        "transports": "http,ws",
    }


@app.post("/v1/transcribe", response_model=AsrResult)
async def transcribe(
    audio: UploadFile,
    request: TranscribeRequest,
) -> AsrResult:
    """Transcribe an upload + return word-level match results."""
    audio_bytes = await audio.read()
    _LOG.info(
        "asr.transcribe",
        verse_key=request.expected_verse_key,
        provider=_TRANSCRIBER.name,
        bytes=len(audio_bytes),
    )
    return await _TRANSCRIBER.transcribe(audio_bytes, request)


@app.websocket("/v1/recite/ws")
async def recite_ws(ws: WebSocket) -> None:  # noqa: PLR0912, PLR0915 — intrinsic WS state machine; splitting helpers fragments shared closures (init, buffer, partial_task)
    """Streaming recite-and-check endpoint.

    Protocol (JSON for control, binary for audio):
      → init    {type:"init", expected_verse_key, expected_text_uthmani, sample_rate, audio_format}
      → audio   binary chunks (any ffmpeg-decodable format the client said in init)
      → end     {type:"end"}
      ← partial {type:"partial", transcript, word_results} every PARTIAL_INTERVAL_S
      ← final   {type:"final", result: AsrResult}
      ← error   {type:"error", code, message}

    Per ADR-0005: the buffer is held in process memory only; no audio is
    persisted beyond the brief tempfile faster-whisper needs to decode.
    """
    await ws.accept()
    init: StreamInitFrame | None = None
    buffer = bytearray()
    last_partial_at = 0.0
    started_at = asyncio.get_event_loop().time()
    partial_task: asyncio.Task[None] | None = None
    partial_lock = asyncio.Lock()

    async def emit_error(code: str, message: str) -> None:
        try:
            await ws.send_text(json.dumps({"type": "error", "code": code, "message": message}))
        except Exception as exc:
            # Best-effort: client may have closed the socket already; nothing
            # we can do beyond log.
            _LOG.debug("asr.ws.emit_error_failed", code=code, exc=str(exc))

    async def run_partial() -> None:
        # Snapshot the buffer so we transcribe a stable view even if more
        # audio arrives mid-decode.
        if init is None or not buffer:
            return
        snapshot = bytes(buffer)
        try:
            transcript, word_results = await _TRANSCRIBER.partial_match(
                snapshot,
                TranscribeRequest(
                    expected_verse_key=init.expected_verse_key,
                    expected_text_uthmani=init.expected_text_uthmani,
                    sample_rate=init.sample_rate,
                ),
            )
        except Exception as exc:
            _LOG.warning("asr.ws.partial_failed", error=str(exc))
            return
        frame = StreamPartialFrame(transcript=transcript, word_results=word_results)
        try:
            await ws.send_text(frame.model_dump_json())
        except Exception as exc:
            _LOG.debug("asr.ws.partial_send_failed", exc=str(exc))

    try:
        while True:
            # Bound every recv by the session cap so a quiet socket can't camp.
            elapsed = asyncio.get_event_loop().time() - started_at
            remaining = SESSION_MAX_S - elapsed
            if remaining <= 0:
                await emit_error("session_timeout", "Session exceeded SESSION_MAX_S")
                break
            try:
                message = await asyncio.wait_for(ws.receive(), timeout=remaining)
            except TimeoutError:
                await emit_error("session_timeout", "No data within SESSION_MAX_S")
                break

            if message.get("type") == "websocket.disconnect":
                break

            text = message.get("text")
            data = message.get("bytes")

            if text is not None:
                # Control frame — init or end.
                try:
                    payload = json.loads(text)
                    frame_type = payload.get("type")
                except json.JSONDecodeError:
                    await emit_error("bad_json", "Control frames must be JSON")
                    continue

                if frame_type == "init":
                    if init is not None:
                        await emit_error("already_initialized", "init already received")
                        continue
                    try:
                        init = StreamInitFrame.model_validate(payload)
                    except ValidationError as ve:
                        await emit_error("bad_init", ve.json())
                        continue
                    _LOG.info(
                        "asr.ws.init",
                        verse_key=init.expected_verse_key,
                        sample_rate=init.sample_rate,
                        audio_format=init.audio_format,
                        provider=_TRANSCRIBER.name,
                    )
                elif frame_type == "end":
                    break
                else:
                    await emit_error("unknown_frame", f"Unknown control frame type: {frame_type!r}")
                continue

            if data is not None:
                if init is None:
                    await emit_error("not_initialized", "send init before audio")
                    continue
                if len(buffer) + len(data) > MAX_AUDIO_BYTES:
                    await emit_error("buffer_overflow", "audio buffer cap exceeded")
                    break
                buffer.extend(data)

                # Schedule a partial transcribe on a cadence — never more
                # than one outstanding at a time (the lock serializes them).
                now = asyncio.get_event_loop().time()
                if now - last_partial_at >= PARTIAL_INTERVAL_S and (
                    partial_task is None or partial_task.done()
                ):
                    last_partial_at = now

                    async def _runner() -> None:
                        async with partial_lock:
                            await run_partial()

                    partial_task = asyncio.create_task(_runner())

        if partial_task is not None and not partial_task.done():
            try:
                await asyncio.wait_for(partial_task, timeout=5.0)
            except TimeoutError:
                partial_task.cancel()

        if init is not None and buffer:
            try:
                final = await _TRANSCRIBER.transcribe(
                    bytes(buffer),
                    TranscribeRequest(
                        expected_verse_key=init.expected_verse_key,
                        expected_text_uthmani=init.expected_text_uthmani,
                        sample_rate=init.sample_rate,
                    ),
                )
                final_frame = StreamFinalFrame(result=final)
                await ws.send_text(final_frame.model_dump_json())
            except Exception as exc:
                _LOG.error("asr.ws.final_failed", error=str(exc))
                await emit_error("final_failed", str(exc))
        elif init is not None and not buffer:
            # Client opened + closed without sending audio — emit empty final
            # so the UI can clear its "listening…" state cleanly.
            empty = AsrResult(
                transcript="",
                word_results=[],
                expected_verse_key=init.expected_verse_key,
                model_id=_TRANSCRIBER.model_id,
                processed_at=datetime.now(UTC).isoformat(),
            )
            await ws.send_text(StreamFinalFrame(result=empty).model_dump_json())
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        _LOG.error("asr.ws.error", error=str(exc))
        await emit_error("internal", str(exc))
    finally:
        try:
            await ws.close()
        except Exception as exc:
            # Already closed (e.g., client dropped); log for telemetry.
            _LOG.debug("asr.ws.close_failed", exc=str(exc))


__all__ = ["DEFAULT_MODEL_ID", "app"]
