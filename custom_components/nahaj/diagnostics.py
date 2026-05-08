"""Diagnostics for the Nahaj integration.

Per HACS quality scale (silver target): ship diagnostics so users can attach
useful detail to bug reports without leaking secrets.
"""

from __future__ import annotations

from typing import Any

from homeassistant.components.diagnostics import async_redact_data
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import CONF_API_KEY, DOMAIN

_REDACT = {CONF_API_KEY}


async def async_get_config_entry_diagnostics(
    hass: HomeAssistant,
    entry: ConfigEntry,
) -> dict[str, Any]:
    coordinator = hass.data[DOMAIN].get(entry.entry_id)
    return {
        "config_entry": {
            "data": async_redact_data(dict(entry.data), _REDACT),
            "options": dict(entry.options),
            "version": entry.version,
            "minor_version": entry.minor_version,
        },
        "coordinator": {
            "last_update_success": coordinator.last_update_success if coordinator else None,
            "reciter_count": (
                len(coordinator.data.reciters) if coordinator and coordinator.data else None
            ),
            "api_version": (coordinator.data.api_version if coordinator and coordinator.data else None),
        },
    }
