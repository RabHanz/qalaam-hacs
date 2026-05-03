"""AirPlay 2 provider — wraps pyatv.

Per ADR-0003: pyatv is the only viable Python option (HAP-auth RAOP encryption
not yet implemented; HomePod sync is still better via Music Assistant). v0.1
ships discovery + basic play/pause/seek/volume; HomePod-specific full sync
lands when MA's open Sendspin protocol stabilizes (per §20.4).
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import suppress
from typing import Final

import pyatv
import structlog

from ..models import SpeakerOut, SpeakerStateOut

_LOG: Final = structlog.get_logger(__name__)


class AirPlayProvider:
    def __init__(self) -> None:
        self._sessions: dict[str, pyatv.interface.AppleTV] = {}

    async def discover(self) -> AsyncIterator[SpeakerOut]:
        scan = await pyatv.scan(loop=__import__("asyncio").get_running_loop())
        for atv in scan:
            yield SpeakerOut(
                id=f"urn:qalaam:speaker:airplay:{atv.identifier}",
                adapter="airplay",
                external_id=atv.identifier or atv.address.compressed,
                name=atv.name or "AirPlay device",
                room=None,
                capabilities=["play_url", "pause", "resume", "volume"],
                state=SpeakerStateOut(status="idle"),
            )

    async def play_url(self, device_id: str, url: str) -> None:
        atv = await self._connect(device_id)
        await atv.stream.play_url(url)

    async def pause(self, device_id: str) -> None:
        atv = await self._connect(device_id)
        await atv.remote_control.pause()

    async def resume(self, device_id: str) -> None:
        atv = await self._connect(device_id)
        await atv.remote_control.play()

    async def set_volume(self, device_id: str, level: float) -> None:
        atv = await self._connect(device_id)
        await atv.audio.set_volume(level * 100.0)

    async def _connect(self, device_id: str) -> pyatv.interface.AppleTV:
        if device_id in self._sessions:
            return self._sessions[device_id]
        loop = __import__("asyncio").get_running_loop()
        scan = await pyatv.scan(loop=loop, identifier=device_id)
        if not scan:
            raise RuntimeError(f"AirPlay device {device_id} not reachable.")
        atv = await pyatv.connect(scan[0], loop)
        self._sessions[device_id] = atv
        return atv

    async def aclose(self) -> None:
        for atv in self._sessions.values():
            with suppress(Exception):
                atv.close()
        self._sessions.clear()
