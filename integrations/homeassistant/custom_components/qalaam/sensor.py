"""Qalaam sensor entities — backed by the coordinator's HifdhSnapshot + NowPlayingSnapshot.

- sensor.qalaam_current_verse        — string of the verse currently playing.
- sensor.qalaam_streak_days          — Hifdh streak (TOTAL_INCREASING).
- sensor.qalaam_today_session_count  — number of portions due today (MEASUREMENT).
- sensor.qalaam_grace_days_remaining — grace days left this month (MEASUREMENT).
- sensor.qalaam_current_sabqi        — current sabqi range as text.
- sensor.qalaam_next_prayer          — TIMESTAMP for the next salah window
  (server-derived; returns None until the adhan package wires through the
  coordinator. Sensor stays registered so existing automations don't break).
"""

from __future__ import annotations

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
        key="today_session_count",
        translation_key="today_session_count",
        icon="mdi:format-list-numbered",
        native_unit_of_measurement="portions",
        state_class=SensorStateClass.MEASUREMENT,
    ),
    SensorEntityDescription(
        key="grace_days_remaining",
        translation_key="grace_days_remaining",
        icon="mdi:calendar-heart",
        native_unit_of_measurement="days",
        state_class=SensorStateClass.MEASUREMENT,
    ),
    SensorEntityDescription(
        key="current_sabqi",
        translation_key="current_sabqi",
        icon="mdi:bookmark-multiple-outline",
    ),
    SensorEntityDescription(
        key="next_prayer",
        translation_key="next_prayer",
        device_class=SensorDeviceClass.TIMESTAMP,
        icon="mdi:mosque",
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
    def __init__(
        self, coordinator: QalaamCoordinator, description: SensorEntityDescription
    ) -> None:
        super().__init__(coordinator)
        self.entity_description = description
        self._attr_unique_id = f"{coordinator.entry.entry_id}-sensor-{description.key}"

    @property
    def native_value(self):  # type: ignore[no-untyped-def]
        if self.coordinator.data is None:
            return None
        snap = self.coordinator.data
        key = self.entity_description.key
        if key == "current_verse":
            np = snap.now_playing
            return np.verse_key if (np.is_playing and np.verse_key) else None
        if key == "streak_days":
            return snap.hifdh.streak_days
        if key == "today_session_count":
            return snap.hifdh.today_session_count
        if key == "grace_days_remaining":
            return snap.hifdh.grace_days_remaining
        if key == "current_sabqi":
            return snap.hifdh.current_sabqi
        if key == "next_prayer":
            # Server-derived; coordinator surfaces it in v0.5 when adhan service
            # is wired. Sensor stays registered so automations can target it now.
            return None
        return None

    @property
    def extra_state_attributes(self) -> dict[str, object] | None:
        snap = self.coordinator.data
        if snap is None:
            return None
        key = self.entity_description.key
        if key == "current_verse":
            np = snap.now_playing
            return {
                "reciter_slug": np.reciter_slug,
                "position_ms": np.position_ms,
                "speaker_id": np.speaker_id,
            }
        if key == "streak_days":
            return {
                "weakest_pages": list(snap.hifdh.weakest_pages),
                "mutashabihat_watchlist": list(snap.hifdh.mutashabihat_watchlist),
                "manzil_cycle_position": snap.hifdh.manzil_cycle_position,
            }
        return None
