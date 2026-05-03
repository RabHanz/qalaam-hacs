from __future__ import annotations

import pytest

from qalaam_tts_worker.cache import InMemoryCache, R2Cache, cache_key


def test_cache_key_is_deterministic_and_changes_with_inputs() -> None:
    a = cache_key(text="bismillah", voice_slug="qalaam-house", speed=1.0, model_id="eleven_multilingual_v2")
    b = cache_key(text="bismillah", voice_slug="qalaam-house", speed=1.0, model_id="eleven_multilingual_v2")
    assert a == b
    assert len(a) == 32

    diff_text = cache_key(text="bismillahir", voice_slug="qalaam-house", speed=1.0, model_id="eleven_multilingual_v2")
    diff_voice = cache_key(text="bismillah", voice_slug="qalaam-house-mujawwad", speed=1.0, model_id="eleven_multilingual_v2")
    diff_speed = cache_key(text="bismillah", voice_slug="qalaam-house", speed=1.25, model_id="eleven_multilingual_v2")
    diff_model = cache_key(text="bismillah", voice_slug="qalaam-house", speed=1.0, model_id="other")

    assert {a, diff_text, diff_voice, diff_speed, diff_model} == {a, diff_text, diff_voice, diff_speed, diff_model}
    assert a != diff_text != diff_voice != diff_speed != diff_model


@pytest.mark.asyncio
async def test_in_memory_cache_round_trip() -> None:
    cache = InMemoryCache(max_entries=4)
    cached = await cache.put("k1", audio_bytes=b"hello", duration_ms=1234)
    assert cached.duration_ms == 1234
    assert cached.audio_url.startswith("data:audio/mpeg;base64,")

    hit = await cache.get("k1")
    assert hit is not None
    assert hit.audio_url == cached.audio_url

    miss = await cache.get("missing")
    assert miss is None


@pytest.mark.asyncio
async def test_in_memory_cache_evicts_oldest_when_over_capacity() -> None:
    cache = InMemoryCache(max_entries=2)
    await cache.put("a", audio_bytes=b"a", duration_ms=1)
    await cache.put("b", audio_bytes=b"b", duration_ms=1)
    # Bump 'a' so 'b' is the oldest.
    _ = await cache.get("a")
    await cache.put("c", audio_bytes=b"c", duration_ms=1)
    assert await cache.get("b") is None
    assert await cache.get("a") is not None
    assert await cache.get("c") is not None


def test_r2_cache_falls_back_when_not_configured() -> None:
    cache = R2Cache(bucket="x", endpoint="", access_key="", secret_key="")
    assert cache.configured is False
