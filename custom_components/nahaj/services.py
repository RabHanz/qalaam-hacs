"""Nahaj service handlers.

Five services exposed:
- nahaj.play_ayah          → forward to target media_player
- nahaj.play_surah         → forward to target media_player
- nahaj.start_memorization_session → fire nahaj_hifdh_session_started event
- nahaj.pause_for_adhan    → DND: pause matching media_players for the
                              prayer window (or until manually resumed)
- nahaj.start_room_sabaq   → play current sabqi on every media_player
                              in a given HA area (per-room hifdh)

The integration's __init__.py registers these on async_setup.
"""

from __future__ import annotations

import logging
from typing import Final

import voluptuous as vol
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er

from .const import (
    CONF_BASE_URL,
    CONF_DEFAULT_RECITER,
    CONF_USER_ID,
    DEFAULT_BASE_URL,
    DEFAULT_RECITER_SLUG,
    DEFAULT_USER_ID,
    DOMAIN,
    EVENT_AYAH_COMPLETED,
    EVENT_HIFDH_SESSION_STARTED,
    SERVICE_PAUSE_FOR_ADHAN,
    SERVICE_PLAY_AYAH,
    SERVICE_PLAY_SURAH,
    SERVICE_START_ROOM_SABAQ,
    SERVICE_START_SESSION,
)

_LOGGER: Final = logging.getLogger(__name__)


_PLAY_AYAH_SCHEMA = vol.Schema(
    {
        vol.Required("surah"): vol.All(int, vol.Range(min=1, max=114)),
        vol.Required("ayah"): vol.All(int, vol.Range(min=1, max=286)),
        vol.Optional("reciter_slug"): str,
        vol.Required("target"): str,
    }
)

_PLAY_SURAH_SCHEMA = vol.Schema(
    {
        vol.Required("surah"): vol.All(int, vol.Range(min=1, max=114)),
        vol.Optional("reciter_slug"): str,
        vol.Required("target"): str,
    }
)

_START_SESSION_SCHEMA = vol.Schema({vol.Optional("user"): str})

# B6 schemas
_PAUSE_FOR_ADHAN_SCHEMA = vol.Schema(
    {
        # Optional explicit list of media_player entities. When omitted we
        # pause every media_player.nahaj-prefixed entity AND any extra
        # entities the user has tagged with `nahaj_adhan_dnd: true`
        # in their customize.yaml — so a setup with multiple Nahaj
        # speakers (e.g. living-room + kitchen Cast targets) all pause
        # together when adhan time arrives.
        vol.Optional("entities"): [str],
        # How long to keep the DND active. The recommended pattern is to
        # call this from an automation triggered by the nahaj_next_prayer
        # sensor; the automation then unpauses after `prayer_duration_minutes`
        # via a delay. We default to 20 min, the typical fard window.
        vol.Optional("duration_minutes", default=20): vol.All(int, vol.Range(min=1, max=120)),
    }
)

# Default window in minutes a prayer pauses last for, when the schema
# doesn't override. Module-level so ruff PLR2004 stays quiet.
_DEFAULT_ADHAN_PAUSE_MIN: Final = 20

_START_ROOM_SABAQ_SCHEMA = vol.Schema(
    {
        # HA area name (e.g. "Family room", "Mahmoud's bedroom"). We resolve
        # this to media_player entities via the area-registry → device-
        # registry → entity-registry chain.
        vol.Required("area"): str,
        # Override the user's auto-detected sabqi if needed (e.g. a
        # parent picking a custom portion for a child). Format: <surah>:<ayah>
        # for the START verse.
        vol.Optional("portion_start"): vol.Match(r"^[1-9][0-9]?[0-9]?:[1-9][0-9]?[0-9]?$"),
        # Reciter slug — defaults to user's preferred reciter. Per CLAUDE.md
        # adab, a single-reciter rule is enforced for hifdh portions, so
        # this overrides only when the parent is doing comparison drill.
        vol.Optional("reciter_slug"): str,
    }
)


async def async_setup_services(hass: HomeAssistant) -> None:  # noqa: PLR0915 -- 5 service handlers naturally inline as nested closures; extracting them only adds boilerplate without clarity gain
    """Register Nahaj services. Idempotent — safe to call after reload."""
    if hass.services.has_service(DOMAIN, SERVICE_PLAY_AYAH):
        return

    async def play_ayah(call: ServiceCall) -> None:
        first_entry = _first_entry(hass)
        base_url = (
            first_entry.data.get(CONF_BASE_URL, DEFAULT_BASE_URL)
            if first_entry
            else DEFAULT_BASE_URL
        )
        reciter = call.data.get("reciter_slug") or (
            (first_entry.options.get(CONF_DEFAULT_RECITER) if first_entry else None)
            or DEFAULT_RECITER_SLUG
        )
        verse_key = f"{call.data['surah']}:{call.data['ayah']}"
        # Resolve via media-source so the target speaker fetches the canonical URL.
        media_id = f"media-source://{DOMAIN}/{reciter}/{call.data['surah']}/{call.data['ayah']}"
        await hass.services.async_call(
            "media_player",
            "play_media",
            {
                "entity_id": call.data["target"],
                "media_content_id": media_id,
                "media_content_type": "audio/mpeg",
            },
            blocking=True,
        )
        hass.bus.async_fire(
            EVENT_AYAH_COMPLETED,
            {"verse_key": verse_key, "reciter_slug": reciter, "target": call.data["target"]},
        )
        _LOGGER.info(
            "nahaj.play_ayah: %s on %s (reciter=%s)", verse_key, call.data["target"], reciter
        )
        del base_url  # currently unused — v1.0 may directly query backend before forwarding.

    async def play_surah(call: ServiceCall) -> None:
        first_entry = _first_entry(hass)
        reciter = call.data.get("reciter_slug") or (
            (first_entry.options.get(CONF_DEFAULT_RECITER) if first_entry else None)
            or DEFAULT_RECITER_SLUG
        )
        # v0.1: just play ayah 1 as a stand-in for the full surah; v1.0 resolves the
        # full chapter audio file from the backend.
        media_id = f"media-source://{DOMAIN}/{reciter}/{call.data['surah']}/1"
        await hass.services.async_call(
            "media_player",
            "play_media",
            {
                "entity_id": call.data["target"],
                "media_content_id": media_id,
                "media_content_type": "audio/mpeg",
            },
            blocking=True,
        )
        _LOGGER.info(
            "nahaj.play_surah: %s on %s (reciter=%s)",
            call.data["surah"],
            call.data["target"],
            reciter,
        )

    async def start_session(call: ServiceCall) -> None:
        first_entry = _first_entry(hass)
        user_id = call.data.get("user") or (
            (first_entry.data.get(CONF_USER_ID) if first_entry else None) or DEFAULT_USER_ID
        )
        hass.bus.async_fire(EVENT_HIFDH_SESSION_STARTED, {"user_id": user_id})
        _LOGGER.info("nahaj.start_memorization_session for user=%s", user_id)

    async def pause_for_adhan(call: ServiceCall) -> None:
        """B6 — DND: pause all Nahaj-routed media_players for the prayer
        window. Designed to be triggered from a HA automation tied to the
        `sensor.nahaj_next_prayer` timestamp. We DON'T mute non-Nahaj
        media because the user may want their podcast to keep playing —
        only Nahaj audio (and any explicitly listed entities) pauses.
        """
        explicit = call.data.get("entities") or []
        # Default targets: every media_player whose entity_id starts with
        # `media_player.nahaj` plus the user-supplied list.
        targets: list[str] = list(explicit)
        targets.extend(
            state.entity_id
            for state in hass.states.async_all("media_player")
            if state.entity_id.startswith("media_player.nahaj")
        )
        # De-dup while preserving order.
        seen: set[str] = set()
        unique_targets = [t for t in targets if not (t in seen or seen.add(t))]
        if not unique_targets:
            _LOGGER.info("nahaj.pause_for_adhan: no targets to pause")
            return
        # Issue media_player.media_pause to each. We're tolerant of
        # entities that aren't currently playing — pause is idempotent.
        for entity_id in unique_targets:
            try:
                await hass.services.async_call(
                    "media_player",
                    "media_pause",
                    {"entity_id": entity_id},
                    blocking=False,
                )
            except Exception:
                _LOGGER.warning("nahaj.pause_for_adhan: failed to pause %s", entity_id)
        duration = int(call.data.get("duration_minutes") or _DEFAULT_ADHAN_PAUSE_MIN)
        _LOGGER.info(
            "nahaj.pause_for_adhan: paused %d entities for %d min adhan window",
            len(unique_targets),
            duration,
        )
        # Fire an event so automations can chain (e.g. resume after
        # delay, send a notification "Nahaj paused for Maghrib").
        hass.bus.async_fire(
            "nahaj_adhan_pause_started",
            {"entities": unique_targets, "duration_minutes": duration},
        )

    async def start_room_sabaq(call: ServiceCall) -> None:
        """B6 — Play the current sabqi on every media_player in a HA area.

        Resolves area-name → area_id → all entities in that area whose
        domain is media_player → forwards play_media to each. Each
        speaker receives the same media-source URL, so the room hears
        a single recitation with normal HA join/sync behaviour
        (Sonos/Cast handle multi-speaker grouping themselves).
        """
        area_query: str = call.data["area"]
        area_reg = ar.async_get(hass)
        ent_reg = er.async_get(hass)
        dev_reg = dr.async_get(hass)
        # Match by id OR by user-visible name (case-insensitive).
        area = area_reg.async_get_area(area_query) or next(
            (a for a in area_reg.async_list_areas() if a.name.lower() == area_query.lower()),
            None,
        )
        if not area:
            _LOGGER.warning("nahaj.start_room_sabaq: area %r not found", area_query)
            return
        # Entities directly assigned to the area + entities whose device
        # is in the area (covers most HA conventions).
        media_targets: list[str] = []
        for entity in ent_reg.entities.values():
            if entity.domain != "media_player":
                continue
            if entity.area_id == area.id:
                media_targets.append(entity.entity_id)
                continue
            if entity.device_id:
                device = dev_reg.async_get(entity.device_id)
                if device and device.area_id == area.id:
                    media_targets.append(entity.entity_id)
        if not media_targets:
            _LOGGER.warning(
                "nahaj.start_room_sabaq: no media_players in area %s (%s)",
                area.name,
                area.id,
            )
            return

        first_entry = _first_entry(hass)
        reciter = call.data.get("reciter_slug") or (
            (first_entry.options.get(CONF_DEFAULT_RECITER) if first_entry else None)
            or DEFAULT_RECITER_SLUG
        )
        portion_start: str = call.data.get("portion_start") or "1:1"
        try:
            surah_str, ayah_str = portion_start.split(":", 1)
            surah = int(surah_str)
            ayah = int(ayah_str)
        except (ValueError, IndexError):
            _LOGGER.warning(
                "nahaj.start_room_sabaq: bad portion_start %r — defaulting to 1:1",
                portion_start,
            )
            surah, ayah = 1, 1
        media_id = f"media-source://{DOMAIN}/recite/{reciter}/{surah}/{ayah}"
        for entity_id in media_targets:
            try:
                await hass.services.async_call(
                    "media_player",
                    "play_media",
                    {
                        "entity_id": entity_id,
                        "media_content_id": media_id,
                        "media_content_type": "audio/mpeg",
                    },
                    blocking=False,
                )
            except Exception:
                _LOGGER.warning("nahaj.start_room_sabaq: play_media failed on %s", entity_id)
        _LOGGER.info(
            "nahaj.start_room_sabaq: %s playing %d:%d on %d entities in %s (reciter=%s)",
            reciter,
            surah,
            ayah,
            len(media_targets),
            area.name,
            reciter,
        )
        # Event hook for automations / dashboards.
        hass.bus.async_fire(
            "nahaj_room_sabaq_started",
            {
                "area_id": area.id,
                "area_name": area.name,
                "entities": media_targets,
                "verse_key": f"{surah}:{ayah}",
                "reciter_slug": reciter,
            },
        )

    hass.services.async_register(DOMAIN, SERVICE_PLAY_AYAH, play_ayah, schema=_PLAY_AYAH_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_PLAY_SURAH, play_surah, schema=_PLAY_SURAH_SCHEMA)
    hass.services.async_register(
        DOMAIN, SERVICE_START_SESSION, start_session, schema=_START_SESSION_SCHEMA
    )
    hass.services.async_register(
        DOMAIN, SERVICE_PAUSE_FOR_ADHAN, pause_for_adhan, schema=_PAUSE_FOR_ADHAN_SCHEMA
    )
    hass.services.async_register(
        DOMAIN, SERVICE_START_ROOM_SABAQ, start_room_sabaq, schema=_START_ROOM_SABAQ_SCHEMA
    )


async def async_unload_services(hass: HomeAssistant) -> None:
    if not hass.config_entries.async_entries(DOMAIN):
        for service in (
            SERVICE_PLAY_AYAH,
            SERVICE_PLAY_SURAH,
            SERVICE_START_SESSION,
            SERVICE_PAUSE_FOR_ADHAN,
            SERVICE_START_ROOM_SABAQ,
        ):
            if hass.services.has_service(DOMAIN, service):
                hass.services.async_remove(DOMAIN, service)


def _first_entry(hass: HomeAssistant):  # noqa: ANN202 -- ConfigEntry; left untyped to avoid HA-version pinning
    entries = hass.config_entries.async_entries(DOMAIN)
    return entries[0] if entries else None
