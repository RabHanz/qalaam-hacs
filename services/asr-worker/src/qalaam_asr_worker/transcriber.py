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
import tempfile
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Final, Protocol

import structlog

from .aligner import AlignOp, align, tokenize
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

    async def partial_match(
        self,
        audio_bytes: bytes,
        request: TranscribeRequest,
    ) -> tuple[str, list[WordResult]]:
        """Re-transcribe the rolling buffer + return (transcript, word_results).

        Used by the WS streaming endpoint. Implementations may degrade to a
        cheaper beam (e.g., greedy) for partials and full-quality for the
        final pass — the contract only requires the alignment to be stable
        enough that the UI doesn't flicker between calls.
        """
        ...


class StubTranscriber:
    """Deterministic perfect-match — used in dev / test / when GPU absent.

    For streaming, we reveal the expected words progressively so the WS
    contract is exercisable end-to-end without a model loaded: ~1 word per
    100 bytes of audio, capped at the full verse.
    """

    name = "stub"
    model_id = DEFAULT_MODEL_ID

    async def transcribe(
        self,
        audio_bytes: bytes,
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
            processed_at=datetime.now(UTC).isoformat(),
        )

    async def partial_match(
        self,
        audio_bytes: bytes,
        request: TranscribeRequest,
    ) -> tuple[str, list[WordResult]]:
        words = request.expected_text_uthmani.split()
        # Reveal one word per ~3kb of audio buffered (webm/opus @ ~24kbps).
        n = min(len(words), max(0, len(audio_bytes) // 3000))
        partial = [
            WordResult(
                word_index=i,
                expected_word=w,
                actual_word=w,
                is_match=True,
                confidence=0.95,
            )
            for i, w in enumerate(words[:n])
        ]
        return " ".join(words[:n]), partial


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
        # Lazy import — never required for the stub path; deferred so dev
        # images can skip the heavy ML wheel until QALAAM_ASR_REAL=1 selects
        # this provider.
        from faster_whisper import WhisperModel  # type: ignore[import-not-found]  # noqa: PLC0415

        _LOG.info("asr.whisper.load_start", model_id=self.model_id)
        t0 = time.monotonic()
        # Use int8 on CPU (Pi-friendly), float16 on GPU. Caller can override via env.
        device = os.environ.get("ASR_DEVICE", "cpu")
        compute_type = os.environ.get("ASR_COMPUTE_TYPE", "int8" if device == "cpu" else "float16")
        self._model = WhisperModel(self.model_id, device=device, compute_type=compute_type)
        _LOG.info(
            "asr.whisper.load_done",
            model_id=self.model_id,
            device=device,
            compute_type=compute_type,
            elapsed_s=round(time.monotonic() - t0, 2),
        )
        return self._model

    def _run_whisper(
        self,
        audio_bytes: bytes,
        request: TranscribeRequest,
        *,
        beam_size: int,
        suffix: str,
    ) -> tuple[str, list[WordResult]]:
        """Run faster-whisper on the buffer + return (transcript, word_results).

        Per ADR-0005: writes the buffer to /tmp on the same device that
        captured the audio. Always unlinked on exit, even on failure.
        """
        model = self._ensure_model()

        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
            f.write(audio_bytes)
            tmp_path = Path(f.name)
        try:
            segments, _ = model.transcribe(
                str(tmp_path),
                language="ar",
                beam_size=beam_size,
                word_timestamps=True,
            )
            transcript_words: list[str] = []
            timings: list[tuple[float, float]] = []
            for segment in segments:
                for w in getattr(segment, "words", []) or []:
                    transcript_words.append(w.word.strip())
                    timings.append((w.start, w.end))

            # Diacritics-insensitive Levenshtein alignment so the user isn't
            # penalized for tashkeel / alif-variant spellings that don't change
            # pronunciation.
            expected_norm = tokenize(request.expected_text_uthmani)
            actual_norm = tokenize(" ".join(transcript_words))
            ops = align(expected_norm, actual_norm)
            word_results: list[WordResult] = []
            for op in ops:
                if op.expected_index is None or op.expected_word is None:
                    continue
                ew_idx = op.expected_index
                start_end = timings[ew_idx] if ew_idx < len(timings) else (0.0, 0.0)
                is_match = op.op == AlignOp.MATCH
                word_results.append(
                    WordResult(
                        word_index=ew_idx,
                        expected_word=op.expected_word,
                        actual_word=op.actual_word or "",
                        is_match=is_match,
                        confidence=0.85
                        if is_match
                        else (0.45 if op.op == AlignOp.SUBSTITUTE else 0.0),
                        alignment_start_ms=int(start_end[0] * 1000),
                        alignment_end_ms=int(start_end[1] * 1000),
                    )
                )
            return " ".join(transcript_words), word_results
        finally:
            try:
                tmp_path.unlink()
            except OSError:
                pass

    async def transcribe(
        self,
        audio_bytes: bytes,
        request: TranscribeRequest,
    ) -> AsrResult:
        transcript, word_results = self._run_whisper(
            audio_bytes, request, beam_size=2, suffix=".webm"
        )
        return AsrResult(
            transcript=transcript,
            word_results=word_results,
            expected_verse_key=request.expected_verse_key,
            model_id=self.model_id,
            processed_at=datetime.now(UTC).isoformat(),
        )

    async def partial_match(
        self,
        audio_bytes: bytes,
        request: TranscribeRequest,
    ) -> tuple[str, list[WordResult]]:
        # Greedy decoding (beam=1) for partials — ~30% faster, alignment
        # against the expected text smooths out the lower-quality output.
        return self._run_whisper(audio_bytes, request, beam_size=1, suffix=".webm")


def select_transcriber() -> Transcriber:
    """Pick the transcriber based on env. Default is stub."""
    real = os.environ.get("QALAAM_ASR_REAL", "").lower() in {"1", "true", "yes"}
    if real:
        _LOG.info("asr.provider.selected", provider="faster-whisper")
        return WhisperTranscriber()
    _LOG.info("asr.provider.selected", provider="stub")
    return StubTranscriber()
