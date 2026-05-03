"""Qalaam Home Assistant integration entry point.

Per ADR-0003: thin shim over the standalone Qalaam backend. The HA integration
is one of many device adapters; it does NOT own the Qalaam state model.

This file orchestrates:
- DataUpdateCoordinator boot
- Platform forwarding (media_player, sensor, binary_sensor, select, button, todo, calendar)
- Service registration (play_ayah, play_surah, start_memorization_session)
- Lovelace panel registration (apps/ha-panel)
- Voice intent registration (per HA Voice Chapter 11 dual-pipeline)
"""

from __future__ import annotations

import logging
from typing import Final

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryNotReady

from .const import DOMAIN, PLATFORMS
from .coordinator import QalaamCoordinator
from .intents import async_register_intents
from .panel import async_register_panel, async_remove_qalaam_panel
from .services import async_setup_services, async_unload_services

_LOGGER: Final = logging.getLogger(__name__)


async def async_setup(hass: HomeAssistant, config: dict) -> bool:  # noqa: ARG001
    """No YAML setup; everything is config-flow driven."""
    hass.data.setdefault(DOMAIN, {})
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Qalaam from a config entry."""
    coordinator = QalaamCoordinator(hass, entry)
    try:
        await coordinator.async_config_entry_first_refresh()
    except Exception as err:  # noqa: BLE001
        raise ConfigEntryNotReady(str(err)) from err

    hass.data[DOMAIN][entry.entry_id] = coordinator

    await hass.config_entries.async_forward_entry_setups(
        entry, [Platform(p) for p in PLATFORMS]
    )

    # Register cross-cutting features (idempotent).
    await async_setup_services(hass)
    await async_register_intents(hass)
    await async_register_panel(hass)

    entry.async_on_unload(entry.add_update_listener(_async_update_listener))
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry cleanly."""
    unload_ok = await hass.config_entries.async_unload_platforms(
        entry, [Platform(p) for p in PLATFORMS]
    )
    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id, None)
        await async_unload_services(hass)
        # Only remove the panel if no other Qalaam entries remain.
        if not hass.config_entries.async_entries(DOMAIN):
            await async_remove_qalaam_panel(hass)
    return unload_ok


async def _async_update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Reload on options change."""
    await hass.config_entries.async_reload(entry.entry_id)
