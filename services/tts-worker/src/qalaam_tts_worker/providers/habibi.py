"""Habibi-TTS-MSA self-host provider (per ADR-0006).

v0.1: stub. v2.0 wires the real fine-tuned checkpoint behind Triton + RTX 5090.
"""

from __future__ import annotations

from ..models import SynthesizeRequest, SynthesizeResponse


class HabibiProvider:
    name = "habibi"

    async def synthesize(self, req: SynthesizeRequest) -> SynthesizeResponse:
        # Stub until the GPU pipeline is up (per DEV_CHECKLIST.md Phase 14).
        return SynthesizeResponse(
            audio_url="https://r2.qalaam.app/tts/qalaam-habibi-stub.mp3",
            duration_ms=3000,
            cached=False,
            provider=self.name,
            voice_slug=req.voice_slug,
        )
