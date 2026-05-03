"""Wire types for the TTS worker.

Voice-slug naming convention (per ADR-0007 + ADR-0019):
  - `qalaam-app-voice`         — UI/system speech (settings prompts, deep-study
    explanations, "you have 3 portions due", page-turn cues). Routed to
    ElevenLabs in v0.1. Never used to render Quranic verses.
  - `qalaam-app-voice-warm`    — softer alt for night-mode / sleep flows.
  - `qalaam-house-mujawwad`    — gated until v2.5; only Habibi-TTS-MSA
    fine-tuned on the Quran corpus may serve this slug. Refused by the
    ElevenLabs provider at synthesize time.

The boundary is *both* a naming convention and a runtime guard — see
`providers/elevenlabs.py::_refuse_quranic_text`.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

VoiceSlug = Literal[
    "qalaam-app-voice",
    "qalaam-app-voice-warm",
    "qalaam-house-mujawwad",  # reserved — ElevenLabs refuses at synthesize time
]


class SynthesizeRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    voice_slug: VoiceSlug = "qalaam-app-voice"
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
    intended_use: Literal["app-speech", "recitation"] = "app-speech"
