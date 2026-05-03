from __future__ import annotations

import os

import pytest

from qalaam_tts_worker.cache import InMemoryCache
from qalaam_tts_worker.models import SynthesizeRequest
from qalaam_tts_worker.providers.elevenlabs import ElevenLabsProvider
from qalaam_tts_worker.watermark import extract_watermark


@pytest.mark.asyncio
async def test_stub_path_when_no_api_key() -> None:
    """Without ELEVENLABS_API_KEY, the provider returns a deterministic stub.

    The stub path still flows through the cache + watermark pipeline so the
    response shape exactly matches the live-API path.
    """
    os.environ.pop("ELEVENLABS_API_KEY", None)
    provider = ElevenLabsProvider(cache=InMemoryCache())
    res = await provider.synthesize(
        SynthesizeRequest(text="Bismillah", voice_slug="qalaam-house")
    )
    assert res.cached is False
    assert res.is_ai_generated is True
    assert res.watermark == "qalaam-v1"
    assert res.duration_ms >= 500


@pytest.mark.asyncio
async def test_cache_hit_skips_generation() -> None:
    os.environ.pop("ELEVENLABS_API_KEY", None)
    cache = InMemoryCache()
    provider = ElevenLabsProvider(cache=cache)
    req = SynthesizeRequest(text="Alhamdulillah", voice_slug="qalaam-house")
    first = await provider.synthesize(req)
    second = await provider.synthesize(req)
    assert first.cached is False
    assert second.cached is True
    assert first.audio_url == second.audio_url


@pytest.mark.asyncio
async def test_cached_bytes_carry_perceptual_watermark() -> None:
    """The bytes we cache must carry the watermark — defense in depth.

    Even if a downstream consumer ignores the JSON `is_ai_generated` flag,
    the perceptual watermark in the audio bytes themselves still identifies
    the audio as AI-generated.
    """
    import base64

    os.environ.pop("ELEVENLABS_API_KEY", None)
    cache = InMemoryCache()
    provider = ElevenLabsProvider(cache=cache)
    res = await provider.synthesize(
        SynthesizeRequest(text="bismillahirahmaanirraheem", voice_slug="qalaam-house")
    )
    # In-memory cache returns data: URLs; pull the bytes back out.
    assert res.audio_url.startswith("data:audio/mpeg;base64,")
    raw = base64.b64decode(res.audio_url.split(",", 1)[1])
    info = extract_watermark(raw)
    assert info.is_present is True
    assert info.tag == "qalaam-v1"


@pytest.mark.asyncio
async def test_explicit_cache_key_is_honoured() -> None:
    os.environ.pop("ELEVENLABS_API_KEY", None)
    cache = InMemoryCache()
    provider = ElevenLabsProvider(cache=cache)
    a = await provider.synthesize(
        SynthesizeRequest(
            text="X", voice_slug="qalaam-house", cache_key="explicit-key"
        )
    )
    b = await provider.synthesize(
        SynthesizeRequest(
            text="Y", voice_slug="qalaam-house", cache_key="explicit-key"
        )
    )
    # Same explicit cache key — second call hits, even though text differs.
    assert b.cached is True
    assert b.audio_url == a.audio_url
