"""Wire types for the ASR worker."""

from __future__ import annotations

from pydantic import BaseModel, Field


class WordResult(BaseModel):
    word_index: int = Field(ge=0)
    expected_word: str
    actual_word: str
    is_match: bool
    confidence: float = Field(ge=0.0, le=1.0)
    alignment_start_ms: int | None = None
    alignment_end_ms: int | None = None


class AsrResult(BaseModel):
    """Cloud-syncable derived signals — NO audio (ADR-0005)."""

    transcript: str
    word_results: list[WordResult]
    expected_verse_key: str
    model_id: str
    model_version_hash: str | None = None
    processed_at: str  # ISO-8601


class TranscribeRequest(BaseModel):
    expected_verse_key: str
    expected_text_uthmani: str
    sample_rate: int = 16000


# --- WebSocket streaming wire types ---------------------------------------
# The browser opens a WS to /v1/recite/ws and exchanges the frames below.
# Audio NEVER leaves the worker's host (ADR-0005). Only derived signals
# (transcript + word-level matches) are returned over the wire.


class StreamInitFrame(BaseModel):
    type: str = Field(default="init", pattern="^init$")
    expected_verse_key: str
    expected_text_uthmani: str
    sample_rate: int = 16000
    # Browser audio is typically webm/opus from MediaRecorder. faster-whisper
    # ingests via ffmpeg so any format ffmpeg can decode is fine.
    audio_format: str = "webm"


class StreamEndFrame(BaseModel):
    type: str = Field(default="end", pattern="^end$")


class StreamPartialFrame(BaseModel):
    """Sent every ~2s while audio is streaming in."""

    type: str = Field(default="partial", pattern="^partial$")
    transcript: str
    word_results: list[WordResult]


class StreamFinalFrame(BaseModel):
    type: str = Field(default="final", pattern="^final$")
    result: AsrResult


class StreamErrorFrame(BaseModel):
    type: str = Field(default="error", pattern="^error$")
    message: str
    code: str
