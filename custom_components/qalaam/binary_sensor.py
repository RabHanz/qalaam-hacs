"""Qalaam binary_sensor entities — backed by the coordinator's snapshots.

Surfaces every "is-it-now?" boolean a household automation needs:

- ``binary_sensor.qalaam_is_reciting``        — Qalaam audio currently playing.
- ``binary_sensor.qalaam_in_session``         — Hifdh session is active.
- ``binary_sensor.qalaam_in_prayer_window``   — current moment is inside a
  configured prayer window. The single most automation-relevant signal:
  the adhan-aware DND blueprint, sleep/wake routines, and per-room sabaq
  blueprint all gate on this.
- ``binary_sensor.qalaam_ramadan``            — current Hijri month is
  Ramadan. Drives the Ramadan-scenes blueprint + UI mode.
- ``binary_sensor.qalaam_last_ten_nights``    — last ten nights of Ramadan;
  triggers Laylat al-Qadr awareness scenes.
- ``binary_sensor.qalaam_friday_kahf_window`` — Thursday Maghrib through
  Friday Maghrib (the Sunnah window for Surah al-Kahf). Drives the
  friday-kahf-nudge blueprint.

Adab posture: every flag is observable; nothing is enforcing. The user's
automations decide what to do with them. Qalaam never silently changes
the home — the blueprints make every action visible in HA's automation
list.
"""

from __future__ import annotations

from datetime import UTC, datetime, time
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

# Python's weekday() — Mon=0 ... Sun=6. Friday Maghrib through next
# Friday Maghrib is the Sunnah window for Surah al-Kahf; the Islamic
# day starts at Maghrib so the window actually opens Thursday evening.
_WEEKDAY_THURSDAY: Final = 3
_WEEKDAY_FRIDAY: Final = 4

_DESCRIPTIONS: Final = (
    BinarySensorEntityDescription(
        key="is_reciting", translation_key="is_reciting", icon="mdi:headphones"
    ),
    BinarySensorEntityDescription(
        key="in_session", translation_key="in_session", icon="mdi:timer-outline"
    ),
    BinarySensorEntityDescription(
        key="in_prayer_window",
        translation_key="in_prayer_window",
        icon="mdi:mosque",
    ),
    BinarySensorEntityDescription(
        key="ramadan",
        translation_key="ramadan",
        icon="mdi:moon-waning-crescent",
    ),
    BinarySensorEntityDescription(
        key="last_ten_nights",
        translation_key="last_ten_nights",
        icon="mdi:weather-night",
    ),
    BinarySensorEntityDescription(
        key="friday_kahf_window",
        translation_key="friday_kahf_window",
        icon="mdi:book-open-page-variant",
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
        self._attr_unique_id = f"{coordinator.entry.entry_id}-binary_sensor-{description.key}"
        self._attr_suggested_object_id = f"qalaam_{description.key}"

    @property
    def is_on(self) -> bool:  # noqa: PLR0911 — straight-line dispatch over a tagged-union key
        if self.coordinator.data is None:
            return False
        snap = self.coordinator.data
        key = self.entity_description.key
        if key == "is_reciting":
            return snap.now_playing.is_playing
        if key == "in_session":
            return snap.hifdh.today_session_count > 0 and snap.now_playing.is_playing
        if key == "in_prayer_window":
            return snap.prayer_window.in_window
        if key == "ramadan":
            return snap.hijri.is_ramadan
        if key == "last_ten_nights":
            return snap.hijri.is_last_ten_nights
        if key == "friday_kahf_window":
            return _in_friday_kahf_window(snap)
        return False


def _in_friday_kahf_window(_snap: object) -> bool:
    """True between Thursday Maghrib and Friday Maghrib local time.

    The Islamic day starts at Maghrib, so the Sunnah of reading Surah
    al-Kahf on "Friday" actually begins at Maghrib on Thursday and ends
    at Maghrib on Friday. v0.2 approximates Maghrib at 17:30 local;
    v0.3 will read the actual Maghrib ISO from `_snap.prayer_times`
    once the coordinator surfaces per-prayer timestamps.
    """
    now = datetime.now(UTC).astimezone()  # local
    weekday = now.weekday()
    # Approximate Maghrib at 17:30 local when prayer-window not wired.
    # The blueprint user can swap this out via their own time-based
    # trigger if they want the precise Maghrib moment.
    bracket_open = time(17, 30)
    if weekday == _WEEKDAY_THURSDAY and now.time() >= bracket_open:
        return True
    if weekday == _WEEKDAY_FRIDAY and now.time() < bracket_open:
        return True
    return False
