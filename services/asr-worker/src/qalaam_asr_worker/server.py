"""FastAPI entry point for the ASR worker.

Provider selection is env-gated:
  - default (no env): StubTranscriber returns deterministic perfect-match.
  - QALAAM_ASR_REAL=1: WhisperTranscriber hot-loads tarteel-ai/whisper-base-ar-quran
    via faster-whisper. Per ADR-0005 the audio never leaves the device.

Per ADR-0015: HTTP/JSON v0.1 → gRPC v1.0; transcriber abstraction unchanged.
"""

from __future__ import annotations

import logging
from typing import Final

import structlog
from fastapi import FastAPI, UploadFile

from .models import AsrResult, TranscribeRequest
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

app = FastAPI(
    title="Qalaam ASR Worker",
    version="0.0.1",
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
        "version": "0.0.1",
        "model_id": _TRANSCRIBER.model_id,
        "provider": _TRANSCRIBER.name,
        "privacy_posture": "audio-never-leaves-device",
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


__all__ = ["app", "DEFAULT_MODEL_ID"]
