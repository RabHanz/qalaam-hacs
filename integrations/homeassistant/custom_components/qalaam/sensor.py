"""Qalaam sensor entities.

- sensor.qalaam_current_verse — current playing verse_key (string).
- sensor.qalaam_streak_days   — Hifdh streak (TOTAL_INCREASING).
- sensor.qalaam_next_prayer   — TIMESTAMP for the next prayer window.
- sensor.qalaam_today_session_count — number of portions in today's session.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Final

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorEntityDescription,
    SensorStateClass,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN
from .coordinator import QalaamCoordinator
from .entity import QalaamEntity

_DESCRIPTIONS: Final = (
    SensorEntityDescription(
        key="current_verse",
        translation_key="current_verse",
        icon="mdi:book-open-variant",
    ),
    SensorEntityDescription(
        key="streak_days",
        translation_key="streak_days",
        icon="mdi:fire",
        native_unit_of_measurement="days",
        state_class=SensorStateClass.TOTAL_INCREASING,
    ),
    SensorEntityDescription(
        key="next_prayer",
        translation_key="next_prayer",
        device_class=SensorDeviceClass.TIMESTAMP,
        icon="mdi:mosque",
    ),
    SensorEntityDescription(
        key="today_session_count",
        translation_key="today_session_count",
        icon="mdi:format-list-numbered",
        native_unit_of_measurement="portions",
        state_class=SensorStateClass.MEASUREMENT,
    ),
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    coordinator: QalaamCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([QalaamSensor(coordinator, desc) for desc in _DESCRIPTIONS])


class QalaamSensor(QalaamEntity, SensorEntity):
    def __init__(self, coordinator: QalaamCoordinator, description: SensorEntityDescription) -> None:
        super().__init__(coordinator)
        self.entity_description = description
        self._attr_unique_id = f"{coordinator.entry.entry_id}-sensor-{description.key}"

    @property
    def native_value(self):  # type: ignore[no-untyped-def]
        key = self.entity_description.key
        # Stub values until the coordinator surfaces real /v1/hifdh/state + /v1/now-playing.
        if key == "current_verse":
            return None
        if key == "streak_days":
            return 0
        if key == "next_prayer":
            return datetime.now(timezone.utc) + timedelta(hours=2)
        if key == "today_session_count":
            return 0
        return None
