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
