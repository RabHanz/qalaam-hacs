"""ElevenLabs provider — MVP path per ADR-0014.

v0.1: stubbed (returns a placeholder URL) so the API surface is exercisable
without burning credits. The actual ElevenLabs call is a one-line swap.
"""

from __future__ import annotations

import os
from typing import Final

import httpx

from ..models import SynthesizeRequest, SynthesizeResponse

ELEVEN_BASE: Final = "https://api.elevenlabs.io/v1"


class ElevenLabsProvider:
    name = "elevenlabs"

    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key or os.environ.get("ELEVENLABS_API_KEY", "")

    async def synthesize(self, req: SynthesizeRequest) -> SynthesizeResponse:
        if not self.api_key:
            # Stub mode — return a placeholder so dev/test can exercise the API.
            return SynthesizeResponse(
                audio_url="https://example.test/qalaam-house-stub.mp3",
                duration_ms=3000,
                cached=False,
                provider=self.name,
                voice_slug=req.voice_slug,
            )
        # Real call — not yet wired in v0.1; left in for v0.5.
        async with httpx.AsyncClient(timeout=30) as client:
            voice_id = os.environ.get("ELEVENLABS_VOICE_ID_QALAAM_HOUSE", "")
            res = await client.post(
                f"{ELEVEN_BASE}/text-to-speech/{voice_id}",
                headers={"xi-api-key": self.api_key, "accept": "audio/mpeg"},
                json={"text": req.text, "model_id": "eleven_multilingual_v2"},
            )
            res.raise_for_status()
            # In production we'd upload to R2 and return a signed URL.
            return SynthesizeResponse(
                audio_url="https://r2.qalaam.app/tts/<sha>.mp3",
                duration_ms=int(len(req.text) * 60),  # rough estimate
                cached=False,
                provider=self.name,
                voice_slug=req.voice_slug,
            )
