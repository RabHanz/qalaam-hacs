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
from homeassistant.helpers import entity_registry as er

from .const import (
    CONF_API_KEY,
    CONF_BASE_URL,
    CONF_TARGET_PLAYER,
    CONF_USER_ID,
    DEFAULT_BASE_URL,
    DOMAIN,
    PLATFORMS,
)
from .coordinator import QalaamCoordinator
from .intents import async_register_intents
from .panel import async_register_panel, async_remove_qalaam_panel
from .playback_bridge import PlaybackBridge
from .services import async_setup_services, async_unload_services

_LOGGER: Final = logging.getLogger(__name__)


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """No YAML setup; everything is config-flow driven."""
    hass.data.setdefault(DOMAIN, {})
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Qalaam from a config entry."""
    # Pre-platform: rename any colliding generic entity_ids
    # (`sensor.qalaam`, `binary_sensor.qalaam_2`, …) left over from the
    # 0.1.x line where new sensors lacked translation keys and HA
    # auto-suffixed the device-name slug. We unique_id-match each
    # registry row to its canonical key and rename in place. Idempotent.
    _migrate_legacy_entity_ids(hass, entry)

    coordinator = QalaamCoordinator(hass, entry)
    try:
        await coordinator.async_config_entry_first_refresh()
    except Exception as err:
        raise ConfigEntryNotReady(str(err)) from err

    # Cross-device playback session bridge (ADR-0025 Phase 3).
    # Heartbeat + SSE listener; honours load/play/pause/seek events
    # by invoking media_player services on CONF_TARGET_PLAYER.
    base_url = entry.data.get(CONF_BASE_URL, DEFAULT_BASE_URL).rstrip("/")
    api_key = entry.data.get(CONF_API_KEY, "")
    user_id = entry.data.get(CONF_USER_ID, "")
    device_id = f"ha:{entry.entry_id}"
    device_name = entry.title or "Home Assistant"
    bridge = PlaybackBridge(
        hass,
        entry_id=entry.entry_id,
        base_url=base_url,
        api_key=api_key,
        device_id=device_id,
        device_name=device_name,
        target_player_factory=lambda: (
            entry.options.get(CONF_TARGET_PLAYER) or entry.data.get(CONF_TARGET_PLAYER)
        ),
    )
    # Bridge is best-effort — its API-key check happens lazily on
    # first POST, so we never block the rest of the integration on
    # premium auth (free-tier users still get sensors / panel /
    # media_player; the bridge just stops itself silently).
    if api_key and user_id:
        await bridge.async_start()

    # Existing platform code reads `hass.data[DOMAIN][entry.entry_id]` and
    # expects the coordinator directly — keep that contract. The bridge
    # lives as an attribute on the coordinator so platforms that need to
    # push state back (media_player listener, services) can find it via
    # the coordinator they already have.
    coordinator.playback_bridge = bridge  # type: ignore[attr-defined]
    hass.data[DOMAIN][entry.entry_id] = coordinator

    await hass.config_entries.async_forward_entry_setups(entry, [Platform(p) for p in PLATFORMS])

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
        coord = hass.data[DOMAIN].pop(entry.entry_id, None)
        bridge = getattr(coord, "playback_bridge", None) if coord else None
        if bridge is not None:
            await bridge.async_stop()
        await async_unload_services(hass)
        # Only remove the panel if no other Qalaam entries remain.
        if not hass.config_entries.async_entries(DOMAIN):
            await async_remove_qalaam_panel(hass)
    return unload_ok


async def _async_update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Reload on options change."""
    await hass.config_entries.async_reload(entry.entry_id)


def _migrate_legacy_entity_ids(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Rename generic ``sensor.qalaam`` / ``binary_sensor.qalaam_<N>`` to
    canonical keyed slugs (``sensor.qalaam_ramadan_phase`` etc.).

    Our ``unique_id`` format is ``<entry_id>-<platform>-<key>`` for
    sensor + binary_sensor (see sensor.py + binary_sensor.py). We can
    decode the canonical slug from the unique_id without touching the
    coordinator data. Anything that already has a key-shaped suffix
    (``…_in_prayer_window``) is left alone.
    """
    registry = er.async_get(hass)
    prefix_sensor = f"{entry.entry_id}-sensor-"
    prefix_binary = f"{entry.entry_id}-binary_sensor-"
    for ent in list(registry.entities.values()):
        if ent.config_entry_id != entry.entry_id:
            continue
        if ent.unique_id.startswith(prefix_sensor):
            key = ent.unique_id[len(prefix_sensor) :]
            domain = "sensor"
        elif ent.unique_id.startswith(prefix_binary):
            key = ent.unique_id[len(prefix_binary) :]
            domain = "binary_sensor"
        else:
            continue
        target = f"{domain}.qalaam_{key}"
        if ent.entity_id == target:
            continue
        # Avoid clobbering an existing entity at `target` (would happen
        # if both old and new IDs coexist mid-migration). Pick a unique
        # variant; HA suffixes on collision automatically.
        if (
            registry.async_get(target) is not None
            and registry.async_get(target).unique_id != ent.unique_id
        ):
            _LOGGER.debug(
                "Skipping rename %s -> %s (target occupied by another entity)",
                ent.entity_id,
                target,
            )
            continue
        _LOGGER.info("Renaming %s -> %s", ent.entity_id, target)
        registry.async_update_entity(ent.entity_id, new_entity_id=target)
