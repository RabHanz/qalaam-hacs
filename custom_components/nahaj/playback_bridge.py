"""Cross-device playback session bridge — Nahaj ⇄ Home Assistant.

Per ADR-0025 Phase 3: HA registers itself as a peer device in the user's
Nahaj playback session and reacts to load/play/pause/seek/transfer
events by invoking media_player services on the configured target
entity. Bidirectional — when the speaker plays/pauses through HA, we
push the new state back to the Nahaj session so all of the user's
other devices (phone, laptop, TV cast) stay in sync.

Wire model:

  Nahaj backend (SSE: /v1/playback/subscribe)
        │
        │  state events (verseKey/reciter/isPaused/target)
        ▼
  This module (HA add-on, Python asyncio task)
        │
        │  media_player.play_media / .media_pause / .media_play / etc.
        ▼
  Configured CONF_TARGET_PLAYER (Sonos / ESPHome / Cast on HA / etc.)

The target's state_changed events feed back through the existing
`NahajMediaPlayer._on_target_state_change` listener; here we add a
push-to-cloud step so a pause-on-the-speaker-itself propagates to the
user's other devices in real-time.

Auth: the integration's CONF_API_KEY (per #213) carries the user's
tier; the SSE endpoint requires `playback.session.read` (free,
auth-required). Validation happens once at coordinator boot — if the
key is invalid or revoked, the bridge logs and stops cleanly so the
rest of the integration (catalog, sensors, calendar) keeps working.
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import Callable
from typing import Any

from homeassistant.const import EVENT_HOMEASSISTANT_STARTED
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import CONF_TARGET_PLAYER, DOMAIN

_LOGGER = logging.getLogger(__name__)

# HTTP status thresholds — broken out as named constants so ruff's
# magic-value lint is satisfied AND the intent reads cleanly.
_HTTP_UNAUTHORIZED = 401
_HTTP_BAD_REQUEST = 400

# Reconnect cadence for the SSE stream. EventSource semantics — drop +
# reopen on any error, with exponential backoff capped at 30 s. The
# Nahaj backend's heartbeat keeps the connection alive at 25 s.
_RECONNECT_BASE_S = 1.0
_RECONNECT_MAX_S = 30.0
# Heartbeat cadence — must be < 5 min (the backend's stale-device
# pruner cutoff). 60 s leaves headroom for transient network blips.
_HEARTBEAT_INTERVAL_S = 60


class PlaybackBridge:
    """One bridge per ConfigEntry. Owns the SSE listener + heartbeat
    loop + the bridge between cloud session events and HA media_player
    services. Started from __init__.async_setup_entry, stopped on unload.
    """

    def __init__(
        self,
        hass: HomeAssistant,
        *,
        entry_id: str,
        base_url: str,
        api_key: str,
        device_id: str,
        device_name: str,
        target_player_factory: Callable[[], str | None],
    ) -> None:
        self._hass = hass
        self._entry_id = entry_id
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._device_id = device_id
        self._device_name = device_name
        # Callable rather than fixed value because options-flow updates
        # to CONF_TARGET_PLAYER mustn't require a bridge restart.
        self._target_player_factory = target_player_factory
        self._session = async_get_clientsession(hass)
        self._stop = asyncio.Event()
        self._tasks: list[asyncio.Task[Any]] = []
        # Track the last applied state so we don't issue duplicate
        # play_media calls on transient SSE re-subscribes.
        self._last_applied: dict[str, Any] | None = None

    async def async_start(self) -> None:
        """Boot the heartbeat + SSE listener. Idempotent — safe to call
        multiple times; subsequent calls are no-ops. The HA event bus
        signals when home assistant has finished booting; we wait for
        that so target media_player entities are guaranteed registered
        before we try to invoke services on them.
        """
        if self._tasks:
            return
        if self._hass.is_running:
            self._launch_loops()
            return

        @callback
        def _on_started(_event: Any) -> None:
            self._launch_loops()

        self._hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, _on_started)

    def _launch_loops(self) -> None:
        if self._tasks:
            return
        self._tasks.append(self._hass.loop.create_task(self._heartbeat_loop()))
        self._tasks.append(self._hass.loop.create_task(self._sse_loop()))

    async def async_stop(self) -> None:
        """Tear down loops on integration unload."""
        self._stop.set()
        for task in self._tasks:
            task.cancel()
        for task in self._tasks:
            try:
                await task
            except asyncio.CancelledError:
                pass
            except Exception as err:
                _LOGGER.debug("Task teardown raised (ignored): %s", err)
        self._tasks.clear()

    # ─── heartbeat ────────────────────────────────────────────────
    async def _heartbeat_loop(self) -> None:
        """Register this HA instance as a device with the Nahaj
        backend, then refresh every 60 s. The backend prunes devices
        whose last_seen is older than 5 minutes."""
        while not self._stop.is_set():
            await self._send_heartbeat()
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=_HEARTBEAT_INTERVAL_S)
            except TimeoutError:
                continue

    async def _send_heartbeat(self) -> None:
        try:
            async with self._session.post(
                f"{self._base_url}/v1/playback/devices/heartbeat",
                json={
                    "deviceId": self._device_id,
                    "name": self._device_name,
                    "capabilities": ["ha-bridge", "media-player"],
                },
                headers={"Authorization": f"Bearer {self._api_key}"},
                timeout=10,
            ) as resp:
                if resp.status == _HTTP_UNAUTHORIZED:
                    _LOGGER.warning(
                        "Nahaj playback bridge: API key rejected; "
                        "premium tier required for cross-device sync"
                    )
                    self._stop.set()
                elif resp.status >= _HTTP_BAD_REQUEST:
                    _LOGGER.debug(
                        "Heartbeat returned %s — will retry on next tick",
                        resp.status,
                    )
        except Exception as err:
            _LOGGER.debug("Heartbeat failed (transient): %s", err)

    # ─── SSE listener ─────────────────────────────────────────────
    async def _sse_loop(self) -> None:
        backoff = _RECONNECT_BASE_S
        while not self._stop.is_set():
            try:
                await self._sse_once()
                # Clean exit (server closed) → reset backoff, reconnect
                # quickly. The SSE endpoint stays open indefinitely so
                # this only fires on graceful close.
                backoff = _RECONNECT_BASE_S
            except asyncio.CancelledError:
                raise
            except Exception as err:
                _LOGGER.debug("SSE error: %s — reconnecting in %.1fs", err, backoff)
                try:
                    await asyncio.wait_for(self._stop.wait(), timeout=backoff)
                except TimeoutError:
                    pass
                backoff = min(backoff * 2, _RECONNECT_MAX_S)

    async def _sse_once(self) -> None:
        """Open one SSE connection. Iterates frames as they arrive,
        dispatching `state` events to `_apply_state`. The Nahaj server
        emits `event: state\\ndata: {...}\\n\\n` per spec, plus
        comment heartbeats (`: heartbeat\\n\\n`) every 25 s."""
        async with self._session.get(
            f"{self._base_url}/v1/playback/subscribe",
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "Accept": "text/event-stream",
            },
            timeout=None,
        ) as resp:
            if resp.status == _HTTP_UNAUTHORIZED:
                _LOGGER.warning("Nahaj SSE rejected — API key revoked or tier downgraded")
                self._stop.set()
                return
            resp.raise_for_status()
            event_type: str | None = None
            data_lines: list[str] = []
            async for raw in resp.content:
                if self._stop.is_set():
                    return
                line = raw.decode("utf-8", errors="replace").rstrip("\r\n")
                if not line:
                    # Frame terminator. Dispatch the buffered event.
                    if data_lines and event_type == "state":
                        try:
                            payload = json.loads("\n".join(data_lines))
                        except json.JSONDecodeError:
                            _LOGGER.debug("Malformed SSE frame, dropping")
                        else:
                            await self._apply_state(payload)
                    event_type = None
                    data_lines = []
                elif line.startswith(":"):
                    # Comment / heartbeat — ignore.
                    pass
                elif line.startswith("event:"):
                    event_type = line[len("event:") :].strip()
                elif line.startswith("data:"):
                    data_lines.append(line[len("data:") :].strip())

    # ─── apply state to HA ────────────────────────────────────────
    async def _apply_state(self, state: dict[str, Any]) -> None:
        """Honour a state push from Nahaj by invoking the appropriate
        media_player service on the configured target entity.

        Echo-suppression: skip when activeDeviceId matches our own
        deviceId — that's our own command coming back on the wire.
        Skip when target doesn't include 'ha' (the user is steering
        another device)."""
        if state.get("activeDeviceId") == self._device_id:
            return
        target_entity = self._target_player_factory()
        if not target_entity:
            return  # no target configured — bridge is idle
        target = state.get("target") or "local"
        # Phase 3 routing: only act when the session targets us. The
        # frontend currently sends 'local' or 'cast'; we accept 'ha'
        # as an explicit opt-in. The full transfer-to-HA UX lands
        # in the next iteration — for now, accept `target == 'ha'`
        # OR `target == f'ha:{target_entity}'`.
        if target != "ha" and not target.startswith("ha:"):
            return
        verse_key = state.get("verseKey")
        reciter = state.get("reciterSlug")
        is_paused = bool(state.get("isPaused", False))
        position = float(state.get("positionSeconds", 0))

        last = self._last_applied or {}
        media_changed = last.get("verseKey") != verse_key or last.get("reciterSlug") != reciter

        if media_changed and verse_key and reciter:
            # play_media — load new audio on the target. The Nahaj web
            # UI uses /v1/audio/by_verse/<vk>/<reciter> for the URL;
            # we hand that path to HA which will fetch + play.
            audio_url = f"{self._base_url}/v1/audio/by_verse/{verse_key}/{reciter}"
            await self._hass.services.async_call(
                "media_player",
                "play_media",
                {
                    "entity_id": target_entity,
                    "media_content_id": audio_url,
                    "media_content_type": "music",
                },
                blocking=False,
            )
        if is_paused:
            await self._hass.services.async_call(
                "media_player",
                "media_pause",
                {"entity_id": target_entity},
                blocking=False,
            )
        elif not media_changed:
            # Unpause without re-loading.
            await self._hass.services.async_call(
                "media_player",
                "media_play",
                {"entity_id": target_entity},
                blocking=False,
            )
        if position > 0 and not media_changed:
            await self._hass.services.async_call(
                "media_player",
                "media_seek",
                {"entity_id": target_entity, "seek_position": position},
                blocking=False,
            )

        self._last_applied = {
            "verseKey": verse_key,
            "reciterSlug": reciter,
            "isPaused": is_paused,
            "positionSeconds": position,
        }

    # ─── push HA-originated state changes back to Nahaj ────────────
    async def push_state(
        self,
        *,
        action: str,
        position: float | None = None,
        verse_key: str | None = None,
        reciter: str | None = None,
    ) -> None:
        """Called by the HA media_player listener when the speaker's
        own state changes (paused via remote, etc.) so the cloud
        session reflects the new truth.
        """
        if not self._api_key:
            return
        body: dict[str, Any] = {"action": action, "deviceId": self._device_id}
        if position is not None:
            body["position"] = position
        if verse_key:
            body["verseKey"] = verse_key
        if reciter:
            body["reciterSlug"] = reciter
        try:
            await self._session.post(
                f"{self._base_url}/v1/playback/command",
                json=body,
                headers={"Authorization": f"Bearer {self._api_key}"},
                timeout=10,
            )
        except Exception as err:
            _LOGGER.debug("push_state failed: %s", err)


def get_bridge(hass: HomeAssistant, entry_id: str) -> PlaybackBridge | None:
    """Return the bridge instance for a given config entry (or None
    when the integration is unloaded)."""
    domain = hass.data.get(DOMAIN, {})
    container = domain.get(entry_id, {}) if isinstance(domain.get(entry_id), dict) else {}
    return container.get("bridge") if isinstance(container, dict) else None


__all__ = ["CONF_TARGET_PLAYER", "PlaybackBridge", "get_bridge"]
