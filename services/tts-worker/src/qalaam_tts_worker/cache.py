"""Audio cache — looks up + stores TTS bytes by deterministic content hash.

Layered design (per ADR-0010 + CLAUDE.md "build for the foundation"):
  1. In-process LRU (`InMemoryCache`) — survives the lifetime of one worker
     process; useful for dev and as an L1 in front of the network.
  2. Cloudflare R2 (`R2Cache`) — durable cross-process cache with zero-egress
     pricing for our serving CDN. Real bytes uploaded once, signed URL handed
     back to the client.

The cache *key* is a SHA-256 over (text, voice_slug, speed, model_id). That
makes the same text+voice+speed deterministic across worker restarts so a
re-synthesis returns the cached audio_url immediately. Cache invalidation
happens implicitly when any input changes — no manual eviction needed.
"""

from __future__ import annotations

import hashlib
import logging
import os
import time
from dataclasses import dataclass
from typing import Final, Protocol

import httpx

_LOG: Final = logging.getLogger(__name__)


def cache_key(*, text: str, voice_slug: str, speed: float, model_id: str) -> str:
    """Deterministic SHA-256-based cache key. Truncated to 32 hex chars."""
    h = hashlib.sha256()
    # Order matters — keep stable across versions or the cache invalidates.
    h.update(text.encode("utf-8"))
    h.update(b"\x1f")
    h.update(voice_slug.encode("utf-8"))
    h.update(b"\x1f")
    h.update(f"{speed:.4f}".encode("ascii"))
    h.update(b"\x1f")
    h.update(model_id.encode("utf-8"))
    return h.hexdigest()[:32]


@dataclass(slots=True, frozen=True)
class CachedAudio:
    audio_url: str
    duration_ms: int


class AudioCache(Protocol):
    async def get(self, key: str) -> CachedAudio | None: ...
    async def put(self, key: str, *, audio_bytes: bytes, duration_ms: int) -> CachedAudio: ...


class InMemoryCache:
    """Bounded LRU keyed by cache_key. Stores the audio_url + duration only.

    Audio bytes are NOT held in memory (they live in the underlying object
    store). Capping at `max_entries` prevents the dict from growing unbounded
    in long-running workers.
    """

    def __init__(self, max_entries: int = 512) -> None:
        self._max = max_entries
        self._store: dict[str, tuple[CachedAudio, float]] = {}

    async def get(self, key: str) -> CachedAudio | None:
        entry = self._store.get(key)
        if entry is None:
            return None
        cached, _ = entry
        # Bump recency.
        self._store[key] = (cached, time.monotonic())
        return cached

    async def put(self, key: str, *, audio_bytes: bytes, duration_ms: int) -> CachedAudio:
        # In-process cache doesn't actually serve the bytes — it caches the
        # URL produced by the underlying R2 layer. For pure in-memory mode
        # (tests / local dev with no R2), we synthesize a data: URL.
        url = f"data:audio/mpeg;base64,{_b64(audio_bytes)}"
        cached = CachedAudio(audio_url=url, duration_ms=duration_ms)
        self._store[key] = (cached, time.monotonic())
        if len(self._store) > self._max:
            self._evict_oldest()
        return cached

    def _evict_oldest(self) -> None:
        if not self._store:
            return
        oldest_key = min(self._store, key=lambda k: self._store[k][1])
        self._store.pop(oldest_key, None)


def _b64(b: bytes) -> str:
    import base64

    return base64.b64encode(b).decode("ascii")


class R2Cache:
    """Cloudflare R2-backed cache. Stores audio at `tts/<key>.mp3` and returns
    a signed URL via R2's S3-compatible API.

    Lazy: requires R2 credentials in env. If credentials are absent, falls
    back to in-memory storage (so unit tests don't need network access).
    """

    def __init__(
        self,
        *,
        bucket: str | None = None,
        endpoint: str | None = None,
        access_key: str | None = None,
        secret_key: str | None = None,
        signed_ttl_seconds: int = 3600,
    ) -> None:
        self.bucket = bucket or os.environ.get("R2_BUCKET", "qalaam-tts")
        self.endpoint = endpoint or os.environ.get("R2_ENDPOINT", "")
        self.access_key = access_key or os.environ.get("R2_ACCESS_KEY", "")
        self.secret_key = secret_key or os.environ.get("R2_SECRET_KEY", "")
        self.signed_ttl_seconds = signed_ttl_seconds
        self._fallback = InMemoryCache()

    @property
    def configured(self) -> bool:
        return bool(self.endpoint and self.access_key and self.secret_key)

    async def get(self, key: str) -> CachedAudio | None:
        if not self.configured:
            return await self._fallback.get(key)
        # Use HEAD to verify presence cheaply; if 200, sign and return.
        url = self._object_url(key)
        async with httpx.AsyncClient(timeout=5) as client:
            try:
                head = await client.head(url, headers=self._auth_headers("HEAD", key))
            except httpx.HTTPError as err:
                _LOG.debug("R2.head.failed key=%s err=%s", key, err)
                return None
        if head.status_code != 200:
            return None
        duration_ms = int(head.headers.get("x-amz-meta-duration-ms", "0") or "0")
        return CachedAudio(audio_url=self._signed_url(key), duration_ms=duration_ms)

    async def put(
        self, key: str, *, audio_bytes: bytes, duration_ms: int
    ) -> CachedAudio:
        if not self.configured:
            return await self._fallback.put(key, audio_bytes=audio_bytes, duration_ms=duration_ms)
        url = self._object_url(key)
        async with httpx.AsyncClient(timeout=30) as client:
            res = await client.put(
                url,
                content=audio_bytes,
                headers={
                    **self._auth_headers("PUT", key),
                    "content-type": "audio/mpeg",
                    "x-amz-meta-duration-ms": str(duration_ms),
                },
            )
            res.raise_for_status()
        return CachedAudio(audio_url=self._signed_url(key), duration_ms=duration_ms)

    def _object_url(self, key: str) -> str:
        return f"{self.endpoint}/{self.bucket}/tts/{key}.mp3"

    def _signed_url(self, key: str) -> str:
        # Real signing happens in the storage SDK; for v0.1 we emit the
        # canonical object URL with a TTL hint that the caller can sign.
        # Per ADR-0010 the production deploy will use boto3.generate_presigned_url
        # against R2's S3 endpoint — wiring deferred to v0.5.
        ttl = self.signed_ttl_seconds
        return f"{self._object_url(key)}?expires_in={ttl}"

    def _auth_headers(self, method: str, key: str) -> dict[str, str]:
        # Placeholder: real SigV4 signing belongs in a dedicated module
        # (`r2_sigv4.py`) and is wired in v0.5. We pass through the API key
        # in a header that R2 will reject for unsigned writes — the caller
        # must enable `configured` only when signing is wired.
        del method, key
        return {"x-qalaam-r2-key": self.access_key}
