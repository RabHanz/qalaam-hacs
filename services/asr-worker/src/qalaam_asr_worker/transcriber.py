"""Transcriber providers — env-gated.

Per ADR-0005: on-device only; never ships audio. The default `StubTranscriber`
returns deterministic perfect-match results so the API surface is exercisable
without GPU. The `WhisperTranscriber` hot-loads `tarteel-ai/whisper-base-ar-quran`
via `faster-whisper` when `QALAAM_ASR_REAL=1` is set.

Per ADR-0015: HTTP/JSON v0.1 → gRPC v1.0 — the transcriber abstraction stays
the same across the transport bump.
"""

from __future__ import annotations

import os
import time
from datetime import datetime, timezone
from typing import Any, Final, Protocol

import structlog

from .models import AsrResult, TranscribeRequest, WordResult

_LOG: Final = structlog.get_logger(__name__)

DEFAULT_MODEL_ID: Final = os.environ.get("ASR_MODEL_ID", "tarteel-ai/whisper-base-ar-quran")


class Transcriber(Protocol):
    """Provider contract."""

    name: str
    model_id: str

    async def transcribe(
        self,
        audio_bytes: bytes,
        request: TranscribeRequest,
    ) -> AsrResult: ...


class StubTranscriber:
    """Deterministic perfect-match — used in dev / test / when GPU absent."""

    name = "stub"
    model_id = DEFAULT_MODEL_ID

    async def transcribe(
        self,
        audio_bytes: bytes,  # noqa: ARG002 — discarded immediately per ADR-0005
        request: TranscribeRequest,
    ) -> AsrResult:
        words = request.expected_text_uthmani.split()
        word_results = [
            WordResult(
                word_index=i,
                expected_word=w,
                actual_word=w,
                is_match=True,
                confidence=0.95,
            )
            for i, w in enumerate(words)
        ]
        return AsrResult(
            transcript=request.expected_text_uthmani,
            word_results=word_results,
            expected_verse_key=request.expected_verse_key,
            model_id=self.model_id,
            processed_at=datetime.now(timezone.utc).isoformat(),
        )


class WhisperTranscriber:
    """Hot-loads faster-whisper with the Tarteel-tuned Quran model.

    Lazy import — we only pull faster-whisper when this provider is actually
    selected, so dev images stay slim.
    """

    name = "faster-whisper"

    def __init__(self, model_id: str = DEFAULT_MODEL_ID) -> None:
        self.model_id = model_id
        self._model: Any | None = None

    def _ensure_model(self) -> Any:
        if self._model is not None:
            return self._model
        # Lazy import — never required for the stub path.
        from faster_whisper import WhisperModel  # type: ignore[import-not-found]

        _LOG.info("asr.whisper.load_start", model_id=self.model_id)
        t0 = time.monotonic()
        # Use int8 on CPU (Pi-friendly), float16 on GPU. Caller can override via env.
        device = os.environ.get("ASR_DEVICE", "cpu")
        compute_type = os.environ.get(
            "ASR_COMPUTE_TYPE", "int8" if device == "cpu" else "float16"
        )
        self._model = WhisperModel(self.model_id, device=device, compute_type=compute_type)
        _LOG.info(
            "asr.whisper.load_done",
            model_id=self.model_id,
            device=device,
            compute_type=compute_type,
            elapsed_s=round(time.monotonic() - t0, 2),
        )
        return self._model

    async def transcribe(
        self,
        audio_bytes: bytes,
        request: TranscribeRequest,
    ) -> AsrResult:
        model = self._ensure_model()

        # faster-whisper expects a path or a numpy array. Persist briefly to
        # /tmp under a deterministic name; delete on exit. Per ADR-0005: this
        # /tmp path is on the same device that captured the audio.
        import tempfile
        from pathlib import Path

        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
            f.write(audio_bytes)
            tmp_path = Path(f.name)
        try:
            segments, _ = model.transcribe(
                str(tmp_path),
                language="ar",
                beam_size=2,
                word_timestamps=True,
            )
            transcript_words: list[str] = []
            timings: list[tuple[float, float]] = []
            for segment in segments:
                for w in getattr(segment, "words", []) or []:
                    transcript_words.append(w.word.strip())
                    timings.append((w.start, w.end))

            expected = request.expected_text_uthmani.split()
            word_results: list[WordResult] = []
            for i, ew in enumerate(expected):
                actual = transcript_words[i] if i < len(transcript_words) else ""
                start_end = timings[i] if i < len(timings) else (0.0, 0.0)
                # Naive match: exact-string equality; v1.0 wires phoneme alignment.
                is_match = actual.strip() == ew.strip()
                word_results.append(
                    WordResult(
                        word_index=i,
                        expected_word=ew,
                        actual_word=actual,
                        is_match=is_match,
                        confidence=0.85 if is_match else 0.45,
                        alignment_start_ms=int(start_end[0] * 1000),
                        alignment_end_ms=int(start_end[1] * 1000),
                    )
                )
            return AsrResult(
                transcript=" ".join(transcript_words),
                word_results=word_results,
                expected_verse_key=request.expected_verse_key,
                model_id=self.model_id,
                processed_at=datetime.now(timezone.utc).isoformat(),
            )
        finally:
            try:
                tmp_path.unlink()
            except OSError:
                pass


def select_transcriber() -> Transcriber:
    """Pick the transcriber based on env. Default is stub."""
    real = os.environ.get("QALAAM_ASR_REAL", "").lower() in {"1", "true", "yes"}
    if real:
        _LOG.info("asr.provider.selected", provider="faster-whisper")
        return WhisperTranscriber()
    _LOG.info("asr.provider.selected", provider="stub")
    return StubTranscriber()
