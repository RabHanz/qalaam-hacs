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
    SensorEntityDescription(
        key="topic_of_day",
        translation_key="topic_of_day",
        icon="mdi:tag-text-outline",
    ),
    SensorEntityDescription(
        key="word_of_day",
        translation_key="word_of_day",
        icon="mdi:alphabet-arabic",
    ),
    SensorEntityDescription(
        key="hijri_date",
        translation_key="hijri_date",
        icon="mdi:calendar-month-outline",
    ),
    SensorEntityDescription(
        key="mutashabihat_count",
        translation_key="mutashabihat_count",
        icon="mdi:link-variant",
        state_class=SensorStateClass.MEASUREMENT,
    ),
    SensorEntityDescription(
        key="active_reciter",
        translation_key="active_reciter",
        icon="mdi:account-music",
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
    def native_value(self):  # type: ignore[no-untyped-def]  # noqa: PLR0911 PLR0912 ANN201 — straight-line dispatch over a tagged-union sensor key
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
            # Coordinator's prayer_window will be populated once the user
            # configures location via the config-flow; until then return None
            # so HA shows "unknown" rather than a misleading default.
            return snap.prayer_window.next_prayer_iso
        if key == "topic_of_day":
            return snap.topic_of_day.name_en or None
        if key == "word_of_day":
            return snap.word_of_day.form_arabic or None
        if key == "hijri_date":
            h = snap.hijri
            if h.year == 0:
                return None
            return f"{h.day:02d} {h.month_english or h.month} {h.year} AH"
        if key == "mutashabihat_count":
            return snap.mutashabihat_count
        if key == "active_reciter":
            return snap.now_playing.reciter_slug
        return None

    @property
    def extra_state_attributes(self) -> dict[str, object] | None:  # noqa: PLR0911 — straight-line dispatch over a tagged-union sensor key
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
        if key == "topic_of_day":
            return {
                "slug": snap.topic_of_day.slug,
                "verse_count": snap.topic_of_day.verse_count,
                "sample_verse_key": snap.topic_of_day.sample_verse_key,
            }
        if key == "word_of_day":
            w = snap.word_of_day
            return {
                "verse_key": w.verse_key,
                "lemma": w.lemma,
                "root": w.root,
                "pos": w.pos,
            }
        if key == "hijri_date":
            return {
                "year": snap.hijri.year,
                "month": snap.hijri.month,
                "day": snap.hijri.day,
                "is_ramadan": snap.hijri.is_ramadan,
                "is_last_ten_nights": snap.hijri.is_last_ten_nights,
            }
        if key == "mutashabihat_count":
            return {"watchlist": list(snap.hifdh.mutashabihat_watchlist)}
        return None
