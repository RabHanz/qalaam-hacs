"""Nahaj button entities — quick-action triggers wired to the live backend.

- ``button.nahaj_test_me``        → fetch today's Hifdh session and play the
                                     first item's verse on the configured
                                     target speaker. Also fires the
                                     ``nahaj_hifdh_session_started`` HA
                                     event for any existing automations
                                     still listening for it.
- ``button.nahaj_mark_memorized`` → record a Smooth rating against the
                                     user's most-recent portion (auto-creates
                                     an Al-Fatihah portion if none exists).
                                     Also fires ``nahaj_portion_marked_memorized``.

Both presses go through the coordinator's authenticated session
(api_key resolved at config-flow time → user via api_keys table on
the backend). A press is a no-op with a logged warning when:
  - the API key is missing (free-tier install with no premium credentials)
  - the network is down (logged at debug; HA shows the press as completed
    so the dashboard doesn't spin)

Press latency is dominated by the round-trip to the Nahaj backend
(~50-300ms typical); the press is fire-and-forget so the UI returns
immediately.
"""

from __future__ import annotations

import logging
from typing import Any, Final

from homeassistant.components.button import ButtonEntity, ButtonEntityDescription
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import (
    CONF_DEFAULT_RECITER,
    CONF_TARGET_PLAYER,
    DEFAULT_RECITER_SLUG,
    DOMAIN,
    EVENT_HIFDH_SESSION_STARTED,
)
from .coordinator import NahajCoordinator
from .entity import NahajEntity

_LOGGER: Final = logging.getLogger(__name__)

_TEST_ME: Final = ButtonEntityDescription(
    key="test_me", translation_key="test_me", icon="mdi:microphone-question"
)
_MARK: Final = ButtonEntityDescription(
    key="mark_memorized", translation_key="mark_memorized", icon="mdi:check-decagram"
)
_RECORD_MISTAKE: Final = ButtonEntityDescription(
    key="record_mistake_here",
    translation_key="record_mistake_here",
    icon="mdi:alert-circle-outline",
)
_REPLAY_LAST: Final = ButtonEntityDescription(
    key="replay_last_portion",
    translation_key="replay_last_portion",
    icon="mdi:replay",
)

# Smooth-rating fluency x accuracy. Maps to FsrsGrade=4 (Easy) — the
# most charitable interpretation of "I just memorized this", which
# advances the review schedule by the maximum stable interval.
_SMOOTH_RATING: Final = {"fluency": 3, "accuracy": 3}

# Network timeouts kept tight so a stuck button press doesn't freeze
# the HA dashboard. Both endpoints are <300ms in normal operation.
_REQUEST_TIMEOUT_S: Final = 5


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    coordinator: NahajCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities(
        [
            NahajTestMeButton(coordinator),
            NahajMarkMemorizedButton(coordinator),
            NahajRecordMistakeButton(coordinator),
            NahajReplayLastButton(coordinator),
        ]
    )


class NahajTestMeButton(NahajEntity, ButtonEntity):
    entity_description = _TEST_ME

    def __init__(self, coordinator: NahajCoordinator) -> None:
        super().__init__(coordinator)
        self._attr_unique_id = f"{coordinator.entry.entry_id}-button-test_me"
        self._attr_suggested_object_id = "nahaj_test_me"

    async def async_press(self) -> None:
        c = self.coordinator
        # Fire the legacy event first — automations that listened for
        # this from v0.1 onward stay functional. Event payload now
        # carries `verse_key` once the session fetch returns so
        # listeners can branch on which verse Nahaj picked.
        first_verse = await _fetch_first_session_verse(c)

        self.hass.bus.async_fire(
            EVENT_HIFDH_SESSION_STARTED,
            {
                "trigger": "test_me",
                "verse_key": first_verse,
                "user_id": c.user_id,
            },
        )

        target = c.entry.options.get(CONF_TARGET_PLAYER) or c.entry.data.get(CONF_TARGET_PLAYER)
        if not target or not first_verse:
            # No target configured (or no portion to rate) — the event
            # fired above is the only side effect.
            _LOGGER.debug("nahaj.test_me: no playback (target=%s verse=%s)", target, first_verse)
            return

        reciter = (
            c.entry.options.get(CONF_DEFAULT_RECITER)
            or c.entry.data.get(CONF_DEFAULT_RECITER)
            or DEFAULT_RECITER_SLUG
        )
        surah, ayah = first_verse.split(":")
        media_id = f"media-source://{DOMAIN}/{reciter}/{surah}/{ayah}"
        try:
            await self.hass.services.async_call(
                "media_player",
                "play_media",
                {
                    "entity_id": target,
                    "media_content_id": media_id,
                    "media_content_type": "audio/mpeg",
                },
                blocking=True,
            )
        except Exception as err:
            _LOGGER.warning("nahaj.test_me: play_media failed for %s: %s", target, err)


class NahajMarkMemorizedButton(NahajEntity, ButtonEntity):
    entity_description = _MARK

    def __init__(self, coordinator: NahajCoordinator) -> None:
        super().__init__(coordinator)
        self._attr_unique_id = f"{coordinator.entry.entry_id}-button-mark_memorized"
        self._attr_suggested_object_id = "nahaj_mark_memorized"

    async def async_press(self) -> None:
        c = self.coordinator
        result = await _post_rate_current(c, _SMOOTH_RATING)
        # Defensive shape extraction — earlier versions assumed result
        # was always a dict, but a backend error path could return a
        # list (Fastify's default error envelope occasionally) and the
        # naive .get() then raised "'list' object has no attribute
        # 'get'" inside the press handler. Treat anything non-dict as
        # "no payload" and surface the event without portion_id.
        portion_id: str | None = None
        derived_grade: int | None = None
        if isinstance(result, dict):
            portion = result.get("portion")
            if isinstance(portion, dict):
                pid = portion.get("id")
                if isinstance(pid, str):
                    portion_id = pid
            grade = result.get("derived_grade")
            if isinstance(grade, int):
                derived_grade = grade
        self.hass.bus.async_fire(
            "nahaj_portion_marked_memorized",
            {
                "user_id": c.user_id,
                "portion_id": portion_id,
                "derived_grade": derived_grade,
            },
        )
        # Trigger an immediate coordinator refresh so streak / current
        # sabqi sensors reflect the new rating without waiting for the
        # next 5-minute poll cycle.
        await c.async_request_refresh()


async def _fetch_first_session_verse(c: NahajCoordinator) -> str | None:
    """GET /v1/hifdh/session and pull the first item's start verse.
    Returns None on any failure (no API key, network down, empty session)."""
    if not c.api_key:
        return None
    try:
        async with c._session.get(
            f"{c.base_url}/v1/hifdh/session",
            headers={"Authorization": f"Bearer {c.api_key}"},
            timeout=_REQUEST_TIMEOUT_S,
        ) as resp:
            if resp.status >= 400:  # noqa: PLR2004
                _LOGGER.debug("nahaj.test_me.session: HTTP %s", resp.status)
                return None
            body = await resp.json()
    except Exception as err:
        _LOGGER.debug("nahaj.test_me.session: %s", err)
        return None

    # Defensive: backend should return {date, items, stats} but be
    # tolerant of error envelopes (lists / unexpected shapes) so a
    # button press never raises out of the press handler.
    if not isinstance(body, dict):
        return None
    items = body.get("items")
    if not isinstance(items, list) or not items:
        return None
    first = items[0]
    if not isinstance(first, dict):
        return None
    rng = first.get("range") if isinstance(first.get("range"), dict) else None
    if not isinstance(rng, dict):
        return None
    start = rng.get("start") if isinstance(rng.get("start"), dict) else None
    if not isinstance(start, dict):
        return None
    surah = start.get("surah")
    ayah = start.get("ayah")
    if not surah or not ayah:
        return None
    return f"{surah}:{ayah}"


async def _post_rate_current(c: NahajCoordinator, body: dict[str, Any]) -> dict[str, Any] | None:
    """POST /v1/hifdh/rate-current. Returns the parsed response or None
    on failure (API key missing, network down, non-2xx)."""
    if not c.api_key:
        _LOGGER.debug("nahaj.mark_memorized: no api_key configured")
        return None
    try:
        async with c._session.post(
            f"{c.base_url}/v1/hifdh/rate-current",
            json=body,
            headers={"Authorization": f"Bearer {c.api_key}"},
            timeout=_REQUEST_TIMEOUT_S,
        ) as resp:
            if resp.status >= 400:  # noqa: PLR2004
                _LOGGER.warning("nahaj.mark_memorized: backend returned %s", resp.status)
                return None
            return await resp.json()
    except Exception as err:
        _LOGGER.warning("nahaj.mark_memorized: %s", err)
        return None


class NahajRecordMistakeButton(NahajEntity, ButtonEntity):
    """Record a mistake on the currently-playing verse.

    Pulls the verse_key from the coordinator's now_playing snapshot
    (the speaker context) and POSTs to /v1/mistakes with kind=
    'self-mark'. Used during a recite session — when the listener
    notices a stumble, they tap once. The mistake feeds the heatmap
    + the weakest_page sensor.

    No-ops with a logged warning when nothing is playing or the API
    key is missing.
    """

    entity_description = _RECORD_MISTAKE

    def __init__(self, coordinator: NahajCoordinator) -> None:
        super().__init__(coordinator)
        self._attr_unique_id = f"{coordinator.entry.entry_id}-button-record_mistake_here"
        self._attr_suggested_object_id = "nahaj_record_mistake_here"

    async def async_press(self) -> None:
        c = self.coordinator
        np = c.data.now_playing if c.data else None
        verse_key = np.verse_key if np else None
        if not verse_key:
            _LOGGER.debug("nahaj.record_mistake: nothing playing")
            return
        if not c.api_key:
            _LOGGER.debug("nahaj.record_mistake: no api_key")
            return
        try:
            async with c._session.post(
                f"{c.base_url}/v1/mistakes",
                json={"verseKey": verse_key, "kind": "hesitation", "source": "self-mark"},
                headers={"Authorization": f"Bearer {c.api_key}"},
                timeout=_REQUEST_TIMEOUT_S,
            ) as resp:
                if resp.status >= 400:  # noqa: PLR2004
                    _LOGGER.warning(
                        "nahaj.record_mistake: backend returned %s on %s",
                        resp.status,
                        verse_key,
                    )
                    return
        except Exception as err:
            _LOGGER.warning("nahaj.record_mistake: %s", err)
            return
        # Refresh so the weakest_page sensor reflects the new mistake
        # without waiting for the 5-min poll cycle.
        await c.async_request_refresh()


class NahajReplayLastButton(NahajEntity, ButtonEntity):
    """Replay the current sabqi audio on the configured target speaker.

    Reads now_playing.verse_key + now_playing.reciter_slug; if both
    are present, calls media_player.play_media on the target. Useful
    after a Replay rating — re-anchor the verse audio without
    navigating back to the web app.
    """

    entity_description = _REPLAY_LAST

    def __init__(self, coordinator: NahajCoordinator) -> None:
        super().__init__(coordinator)
        self._attr_unique_id = f"{coordinator.entry.entry_id}-button-replay_last_portion"
        self._attr_suggested_object_id = "nahaj_replay_last_portion"

    async def async_press(self) -> None:
        c = self.coordinator
        target = c.entry.options.get(CONF_TARGET_PLAYER) or c.entry.data.get(CONF_TARGET_PLAYER)
        np = c.data.now_playing if c.data else None
        verse_key = np.verse_key if np else None
        if not target or not verse_key:
            _LOGGER.debug(
                "nahaj.replay_last: missing target=%s or verse=%s", target, verse_key
            )
            return
        reciter = (
            (np.reciter_slug if np else None)
            or c.entry.options.get(CONF_DEFAULT_RECITER)
            or c.entry.data.get(CONF_DEFAULT_RECITER)
            or DEFAULT_RECITER_SLUG
        )
        surah, ayah = verse_key.split(":")
        media_id = f"media-source://{DOMAIN}/{reciter}/{surah}/{ayah}"
        try:
            await self.hass.services.async_call(
                "media_player",
                "play_media",
                {
                    "entity_id": target,
                    "media_content_id": media_id,
                    "media_content_type": "audio/mpeg",
                },
                blocking=True,
            )
        except Exception as err:
            _LOGGER.warning("nahaj.replay_last: %s", err)
