"""Google Cast provider — wraps pychromecast.

Per ADR-0003: Cast is the largest install base and has zero pairing friction
(mDNS discovery). pychromecast is the only viable Python lib; the Node ecosystem
has no maintained equivalent.

Discovery is amortized: we keep a CastBrowser running and serve cached devices.
Commands open per-device sessions on demand.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import suppress
from typing import Final
import asyncio

import pychromecast
import structlog
from pychromecast.discovery import CastBrowser, SimpleCastListener

from ..models import SpeakerOut, SpeakerStateOut

_LOG: Final = structlog.get_logger(__name__)


class CastProvider:
    """Stateful holder for the Cast browser + connected devices."""

    def __init__(self) -> None:
        self._browser: CastBrowser | None = None
        self._listener: SimpleCastListener | None = None
        self._known: dict[str, pychromecast.Chromecast] = {}

    async def start(self) -> None:
        if self._browser is not None:
            return
        loop = asyncio.get_running_loop()

        def _on_discovered(_uuid: object, _service: object) -> None:
            _LOG.info("cast.discovered")

        # pychromecast browser runs on a background zeroconf thread; safe to start in async context.
        self._listener = SimpleCastListener(_on_discovered)
        self._browser = CastBrowser(self._listener, pychromecast.zeroconf.Zeroconf())
        await loop.run_in_executor(None, self._browser.start_discovery)

    async def stop(self) -> None:
        if self._browser is None:
            return
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, self._browser.stop_discovery)
        self._browser = None

    async def discover(self) -> AsyncIterator[SpeakerOut]:
        if self._browser is None:
            await self.start()
        # Allow zeroconf a brief window to populate.
        await asyncio.sleep(2.0)
        if self._browser is None:
            return
        for service in self._browser.devices.values():
            yield SpeakerOut(
                id=f"urn:qalaam:speaker:cast:{service.uuid}",
                adapter="cast",
                external_id=str(service.uuid),
                name=service.friendly_name or "Cast device",
                room=None,
                capabilities=["play_url", "pause", "resume", "seek", "volume", "announce"],
                state=SpeakerStateOut(status="idle"),
            )

    async def play_url(self, device_id: str, url: str, *, mime: str = "audio/mpeg") -> None:
        cast = await self._connect(device_id)
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(
            None, lambda: cast.media_controller.play_media(url, mime)
        )
        await loop.run_in_executor(None, cast.media_controller.block_until_active)

    async def pause(self, device_id: str) -> None:
        cast = await self._connect(device_id)
        await asyncio.get_running_loop().run_in_executor(
            None, cast.media_controller.pause
        )

    async def resume(self, device_id: str) -> None:
        cast = await self._connect(device_id)
        await asyncio.get_running_loop().run_in_executor(
            None, cast.media_controller.play
        )

    async def seek(self, device_id: str, position_ms: int) -> None:
        cast = await self._connect(device_id)
        await asyncio.get_running_loop().run_in_executor(
            None, lambda: cast.media_controller.seek(position_ms / 1000.0)
        )

    async def set_volume(self, device_id: str, level: float) -> None:
        cast = await self._connect(device_id)
        await asyncio.get_running_loop().run_in_executor(
            None, lambda: cast.set_volume(level)
        )

    async def announce(self, device_id: str, url: str, *, duck: bool = True) -> None:
        """Save state, play, restore — Qalaam's broadcast-group primitive (strategy §10.1).

        Workflow:
          1. Snapshot the current media controller state (URL, position, volume).
          2. (Optional) duck volume to 0.7 of current.
          3. Play the announce URL.
          4. Wait for it to complete (or hit a 30s safety cap).
          5. Restore the saved URL at the saved position with the saved volume.

        Background: `pychromecast` exposes media-status events that fire when the
        announce track ends (`status.player_state == "IDLE"`). We poll briefly
        because the cast SDK's listener model is callback-based and weighted
        toward long-lived sessions.
        """
        cast = await self._connect(device_id)
        loop = asyncio.get_running_loop()

        # 1) snapshot
        prior_volume = cast.status.volume_level if cast.status else 0.7
        prior_status = cast.media_controller.status if cast.media_controller else None
        prior_url = getattr(prior_status, "content_id", None)
        prior_position = float(getattr(prior_status, "current_time", 0.0) or 0.0)
        was_playing = prior_status is not None and getattr(prior_status, "player_is_playing", False)

        try:
            # 2) duck
            if duck:
                ducked = max(0.05, min(prior_volume, 0.7))
                await loop.run_in_executor(None, lambda: cast.set_volume(ducked))

            # 3) play announce
            await loop.run_in_executor(
                None, lambda: cast.media_controller.play_media(url, "audio/mpeg")
            )
            await loop.run_in_executor(None, cast.media_controller.block_until_active)

            # 4) wait for completion (≤ 30s safety cap)
            announce_done = False
            for _ in range(60):
                await asyncio.sleep(0.5)
                state = getattr(cast.media_controller.status, "player_state", "")
                if state in {"IDLE", "FINISHED", "UNKNOWN"} or not getattr(
                    cast.media_controller.status, "player_is_playing", False
                ):
                    announce_done = True
                    break
            if not announce_done:
                _LOG.warning("cast.announce.timeout", device_id=device_id, url=url)
        finally:
            # 5) restore prior playback even if announce errored
            await loop.run_in_executor(None, lambda: cast.set_volume(prior_volume))
            if was_playing and prior_url and prior_url != url:
                await loop.run_in_executor(
                    None,
                    lambda: cast.media_controller.play_media(
                        prior_url, "audio/mpeg", current_time=prior_position
                    ),
                )

    async def _connect(self, device_id: str) -> pychromecast.Chromecast:
        if device_id in self._known:
            return self._known[device_id]
        if self._browser is None:
            await self.start()
        assert self._browser is not None  # noqa: S101 — invariant after start()
        chromecasts, _browser = await asyncio.get_running_loop().run_in_executor(
            None,
            lambda: pychromecast.get_listed_chromecasts(uuids=[device_id]),
        )
        if not chromecasts:
            raise RuntimeError(f"Cast device {device_id} not found.")
        cast = chromecasts[0]
        await asyncio.get_running_loop().run_in_executor(None, cast.wait)
        self._known[device_id] = cast
        return cast

    async def aclose(self) -> None:
        for cast in self._known.values():
            with suppress(Exception):
                cast.disconnect(blocking=False)
        await self.stop()
