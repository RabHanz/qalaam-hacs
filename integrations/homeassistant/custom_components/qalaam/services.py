"""Qalaam service handlers.

Three services exposed:
- qalaam.play_ayah          → forward to target media_player
- qalaam.play_surah         → forward to target media_player
- qalaam.start_memorization_session → fire qalaam_hifdh_session_started event

The integration's __init__.py registers these on async_setup.
"""

from __future__ import annotations

import logging
from typing import Final

import voluptuous as vol
from homeassistant.core import HomeAssistant, ServiceCall

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
    SERVICE_PLAY_AYAH,
    SERVICE_PLAY_SURAH,
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


async def async_setup_services(hass: HomeAssistant) -> None:
    """Register Qalaam services. Idempotent — safe to call after reload."""
    if hass.services.has_service(DOMAIN, SERVICE_PLAY_AYAH):
        return

    async def play_ayah(call: ServiceCall) -> None:
        first_entry = _first_entry(hass)
        base_url = (
            first_entry.data.get(CONF_BASE_URL, DEFAULT_BASE_URL) if first_entry else DEFAULT_BASE_URL
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
        _LOGGER.info("qalaam.play_ayah: %s on %s (reciter=%s)", verse_key, call.data["target"], reciter)
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
        _LOGGER.info("qalaam.play_surah: %s on %s (reciter=%s)", call.data["surah"], call.data["target"], reciter)

    async def start_session(call: ServiceCall) -> None:
        first_entry = _first_entry(hass)
        user_id = call.data.get("user") or (
            (first_entry.data.get(CONF_USER_ID) if first_entry else None) or DEFAULT_USER_ID
        )
        hass.bus.async_fire(EVENT_HIFDH_SESSION_STARTED, {"user_id": user_id})
        _LOGGER.info("qalaam.start_memorization_session for user=%s", user_id)

    hass.services.async_register(DOMAIN, SERVICE_PLAY_AYAH, play_ayah, schema=_PLAY_AYAH_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_PLAY_SURAH, play_surah, schema=_PLAY_SURAH_SCHEMA)
    hass.services.async_register(
        DOMAIN, SERVICE_START_SESSION, start_session, schema=_START_SESSION_SCHEMA
    )


async def async_unload_services(hass: HomeAssistant) -> None:
    if not hass.config_entries.async_entries(DOMAIN):
        for service in (SERVICE_PLAY_AYAH, SERVICE_PLAY_SURAH, SERVICE_START_SESSION):
            if hass.services.has_service(DOMAIN, service):
                hass.services.async_remove(DOMAIN, service)


def _first_entry(hass: HomeAssistant):  # type: ignore[no-untyped-def]
    entries = hass.config_entries.async_entries(DOMAIN)
    return entries[0] if entries else None
