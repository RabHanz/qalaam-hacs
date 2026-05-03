"""ElevenLabs provider — MVP path per ADR-0014.

Pipeline:
  1. Cache lookup by SHA-256(text, voice_slug, speed, model_id) — return early
     if hit.
  2. Real ElevenLabs API call (POST /text-to-speech/<voice_id>) — only when
     ELEVENLABS_API_KEY is set in the environment. If the key is missing,
     a deterministic stub is returned so dev + CI can exercise the surface
     without spending credits.
  3. Perceptual watermark embed (`watermark.embed_watermark`) — every byte
     the worker returns is self-identifying as AI-generated per ADR-0007 +
     US AI Voice Rights Act.
  4. Cache write — uploads watermarked bytes to R2 (when configured) and
     hands back a signed URL.
"""

from __future__ import annotations

import logging
import os
from typing import Final

import httpx

from ..cache import AudioCache, CachedAudio, InMemoryCache, R2Cache, cache_key
from ..models import SynthesizeRequest, SynthesizeResponse
from ..watermark import embed_watermark

_LOG: Final = logging.getLogger(__name__)

ELEVEN_BASE: Final = "https://api.elevenlabs.io/v1"
ELEVEN_MODEL: Final = "eleven_multilingual_v2"


def _voice_id_for(voice_slug: str) -> str:
    """Resolve a Qalaam voice_slug → ElevenLabs voice_id (env-driven).

    The mapping is env-driven (not hard-coded) so the same binary can serve
    different ElevenLabs voice_ids per environment without a redeploy.
    """
    env_key = {
        "qalaam-house": "ELEVENLABS_VOICE_ID_QALAAM_HOUSE",
        "qalaam-house-mujawwad": "ELEVENLABS_VOICE_ID_QALAAM_HOUSE_MUJAWWAD",
    }.get(voice_slug, "")
    if not env_key:
        raise ValueError(f"No env mapping for voice_slug {voice_slug!r}")
    return os.environ.get(env_key, "")


class ElevenLabsProvider:
    name = "elevenlabs"

    def __init__(
        self,
        api_key: str | None = None,
        *,
        cache: AudioCache | None = None,
        watermark_tag: str = "qalaam-v1",
    ) -> None:
        self.api_key = api_key or os.environ.get("ELEVENLABS_API_KEY", "")
        # Prefer R2 when configured; fall back to in-memory for dev/test.
        if cache is not None:
            self.cache: AudioCache = cache
        else:
            r2 = R2Cache()
            self.cache = r2 if r2.configured else InMemoryCache()
        self.watermark_tag = watermark_tag

    async def synthesize(self, req: SynthesizeRequest) -> SynthesizeResponse:
        key = req.cache_key or cache_key(
            text=req.text,
            voice_slug=req.voice_slug,
            speed=req.speed,
            model_id=ELEVEN_MODEL,
        )
        # 1. Cache hit?
        hit = await self.cache.get(key)
        if hit is not None:
            _LOG.info("tts.cache.hit key=%s voice=%s", key, req.voice_slug)
            return SynthesizeResponse(
                audio_url=hit.audio_url,
                duration_ms=hit.duration_ms,
                cached=True,
                provider=self.name,
                voice_slug=req.voice_slug,
                watermark=self.watermark_tag,
            )

        # 2. Generate (real API or deterministic stub).
        audio_bytes, duration_ms = await self._generate(req)

        # 3. Watermark every output. Non-negotiable per ADR-0007.
        wm_bytes = embed_watermark(audio_bytes, tag=self.watermark_tag)

        # 4. Cache write.
        cached: CachedAudio = await self.cache.put(
            key, audio_bytes=wm_bytes, duration_ms=duration_ms
        )
        _LOG.info(
            "tts.synthesize.ok key=%s voice=%s bytes=%d duration_ms=%d",
            key,
            req.voice_slug,
            len(wm_bytes),
            duration_ms,
        )
        return SynthesizeResponse(
            audio_url=cached.audio_url,
            duration_ms=duration_ms,
            cached=False,
            provider=self.name,
            voice_slug=req.voice_slug,
            watermark=self.watermark_tag,
        )

    async def _generate(self, req: SynthesizeRequest) -> tuple[bytes, int]:
        """Returns (mp3_bytes, duration_ms). Stub when no API key."""
        if not self.api_key:
            # Deterministic stub for dev/test — fixed-length silent MP3 frame
            # so downstream callers get bytes of predictable shape.
            stub_bytes = b"\xff\xfb\x90\x44\x00" * 64  # 320 bytes, fake MPEG header
            duration_ms = max(500, int(len(req.text) * 60 / max(req.speed, 0.5)))
            return stub_bytes, duration_ms

        voice_id = _voice_id_for(req.voice_slug)
        if not voice_id:
            raise RuntimeError(
                f"ElevenLabs voice_id not configured for {req.voice_slug!r}; "
                f"set ELEVENLABS_VOICE_ID_* in env."
            )

        async with httpx.AsyncClient(timeout=30) as client:
            res = await client.post(
                f"{ELEVEN_BASE}/text-to-speech/{voice_id}",
                headers={"xi-api-key": self.api_key, "accept": "audio/mpeg"},
                json={
                    "text": req.text,
                    "model_id": ELEVEN_MODEL,
                    "voice_settings": {
                        "stability": 0.5,
                        "similarity_boost": 0.7,
                        "speed": req.speed,
                    },
                },
            )
            res.raise_for_status()
            audio_bytes = res.content
        # Approx duration: ElevenLabs returns ~128 kbps MP3, so 16 KB ≈ 1 sec.
        duration_ms = max(500, int(len(audio_bytes) * 1000 / 16_000))
        return audio_bytes, duration_ms
