"""Transcriber-provider tests — stub path only (real path needs faster-whisper)."""

from __future__ import annotations

import asyncio
import os

import pytest

from qalaam_asr_worker.models import TranscribeRequest
from qalaam_asr_worker.transcriber import StubTranscriber, select_transcriber


def test_select_transcriber_defaults_to_stub() -> None:
    os.environ.pop("QALAAM_ASR_REAL", None)
    t = select_transcriber()
    assert t.name == "stub"


def test_select_transcriber_real_when_env_set() -> None:
    # We don't actually instantiate the model in the test (would need GPU);
    # we only verify the selector picks the right class.
    os.environ["QALAAM_ASR_REAL"] = "1"
    try:
        t = select_transcriber()
        assert t.name == "faster-whisper"
    finally:
        os.environ.pop("QALAAM_ASR_REAL", None)


@pytest.mark.asyncio
async def test_stub_returns_perfect_match() -> None:
    t = StubTranscriber()
    result = await t.transcribe(
        b"",
        TranscribeRequest(
            expected_verse_key="1:1",
            expected_text_uthmani="بِسْمِ ٱللَّهِ",
            sample_rate=16000,
        ),
    )
    assert result.expected_verse_key == "1:1"
    assert len(result.word_results) == 2
    assert all(w.is_match for w in result.word_results)


def test_stub_signature_compatible_with_protocol() -> None:
    # Compile-time only — runs as a structural check that StubTranscriber
    # satisfies the Transcriber protocol.
    t: object = StubTranscriber()
    assert hasattr(t, "transcribe")
    assert hasattr(t, "model_id")
    assert hasattr(t, "name")
