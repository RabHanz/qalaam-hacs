"""Wire types for the TTS worker."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

VoiceSlug = Literal["qalaam-house", "qalaam-house-mujawwad"]


class SynthesizeRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    voice_slug: VoiceSlug = "qalaam-house"
    verse_key: str | None = None
    speed: float = Field(default=1.0, ge=0.5, le=2.0)
    cache_key: str | None = None


class SynthesizeResponse(BaseModel):
    audio_url: str = Field(description="Signed Cloudflare R2 URL with TTL")
    duration_ms: int
    cached: bool
    provider: str
    voice_slug: VoiceSlug
    is_ai_generated: bool = True
    watermark: str = Field(default="qalaam-v1", description="ADR-0007 disclosure tag")


class Voice(BaseModel):
    slug: VoiceSlug
    name: str
    description: str
    is_licensed_for_cloning: bool
