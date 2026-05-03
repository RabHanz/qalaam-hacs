"""Announce-lifecycle test using a fake Chromecast.

Verifies the save → duck → play → wait → restore sequence so the broadcast
group adhan announcement (strategy §10.1) can't accidentally clobber the
prior playback state.
"""

from __future__ import annotations

import asyncio
import sys
import types
from unittest.mock import MagicMock

import pytest


@pytest.fixture(autouse=True)
def _stub_pychromecast(monkeypatch: pytest.MonkeyPatch) -> None:
    """Stub pychromecast so we don't need real LAN hardware in CI."""
    fake = types.ModuleType("pychromecast")
    fake.Chromecast = type("Chromecast", (), {})  # type: ignore[attr-defined]

    class FakeBrowser:
        devices: dict[str, object] = {}

        def start_discovery(self) -> None: ...
        def stop_discovery(self) -> None: ...

    fake.discovery = types.SimpleNamespace(  # type: ignore[attr-defined]
        SimpleCastListener=lambda *args, **kwargs: object(),
        CastBrowser=FakeBrowser,
    )
    fake.zeroconf = types.SimpleNamespace(Zeroconf=lambda: object())  # type: ignore[attr-defined]
    fake.get_listed_chromecasts = lambda uuids: ([_make_fake_cast()], None)
    sys.modules["pychromecast"] = fake
    sys.modules.setdefault("pychromecast.discovery", fake.discovery)


def _make_fake_cast() -> MagicMock:
    cast = MagicMock(name="Chromecast")
    cast.status.volume_level = 0.6
    cast.media_controller.status.content_id = "https://example.test/sabaq.mp3"
    cast.media_controller.status.current_time = 42.0
    cast.media_controller.status.player_is_playing = True
    cast.media_controller.status.player_state = "PLAYING"

    # Once announce is dispatched, transition to IDLE so the wait-loop completes.
    def play_media(url: str, _mime: str, current_time: float = 0.0) -> None:
        cast.media_controller.status.content_id = url
        cast.media_controller.status.current_time = current_time
        cast.media_controller.status.player_state = "IDLE"
        cast.media_controller.status.player_is_playing = False

    cast.media_controller.play_media.side_effect = play_media
    return cast


@pytest.mark.asyncio
async def test_announce_saves_and_restores_state(monkeypatch: pytest.MonkeyPatch) -> None:
    # Import after stubbing so the fake module is wired in.
    from qalaam_device_bridge.providers.cast import CastProvider

    provider = CastProvider()
    cast = _make_fake_cast()
    provider._known["abc"] = cast  # type: ignore[attr-defined]

    await provider.announce("abc", "https://example.test/adhan.mp3", duck=True)

    # Volume was ducked then restored; cast.set_volume called at least 2x.
    assert cast.set_volume.call_count >= 2
    # The last set_volume restores the prior 0.6.
    assert cast.set_volume.call_args_list[-1].args[0] == 0.6
    # play_media was called for the announce, then again for restore.
    assert cast.media_controller.play_media.call_count >= 2


@pytest.mark.asyncio
async def test_announce_does_not_resume_when_nothing_was_playing() -> None:
    from qalaam_device_bridge.providers.cast import CastProvider

    provider = CastProvider()
    cast = _make_fake_cast()
    cast.media_controller.status.player_is_playing = False
    cast.media_controller.status.content_id = None
    provider._known["xyz"] = cast  # type: ignore[attr-defined]

    await provider.announce("xyz", "https://example.test/adhan.mp3", duck=False)

    # Only one play_media call: the announce. No restore.
    assert cast.media_controller.play_media.call_count == 1
