"""Qalaam binary_sensor entities — backed by the coordinator's snapshots.

- binary_sensor.qalaam_is_reciting    — true while a Qalaam verse is playing.
- binary_sensor.qalaam_in_session     — true while a Hifdh session is active
  (heuristic v0.1: portions due today AND currently reciting; v0.5 has a real
  per-user `in_session` flag from the backend).
"""

from __future__ import annotations

from typing import Final

from homeassistant.components.binary_sensor import (
    BinarySensorEntity,
    BinarySensorEntityDescription,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN
from .coordinator import QalaamCoordinator
from .entity import QalaamEntity

_DESCRIPTIONS: Final = (
    BinarySensorEntityDescription(
        key="is_reciting", translation_key="is_reciting", icon="mdi:headphones"
    ),
    BinarySensorEntityDescription(
        key="in_session", translation_key="in_session", icon="mdi:timer-outline"
    ),
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    coordinator: QalaamCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([QalaamBinarySensor(coordinator, d) for d in _DESCRIPTIONS])


class QalaamBinarySensor(QalaamEntity, BinarySensorEntity):
    def __init__(
        self,
        coordinator: QalaamCoordinator,
        description: BinarySensorEntityDescription,
    ) -> None:
        super().__init__(coordinator)
        self.entity_description = description
        self._attr_unique_id = (
            f"{coordinator.entry.entry_id}-binary_sensor-{description.key}"
        )

    @property
    def is_on(self) -> bool:
        if self.coordinator.data is None:
            return False
        snap = self.coordinator.data
        key = self.entity_description.key
        if key == "is_reciting":
            return snap.now_playing.is_playing
        if key == "in_session":
            return snap.hifdh.today_session_count > 0 and snap.now_playing.is_playing
        return False
