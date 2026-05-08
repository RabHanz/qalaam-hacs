"""Nahaj calendar entity — review schedule (FSRS-6 due dates surfaced on the HA calendar)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from homeassistant.components.calendar import CalendarEntity, CalendarEvent
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN
from .coordinator import NahajCoordinator
from .entity import NahajEntity


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    coordinator: NahajCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([NahajReviewCalendar(coordinator)])


class NahajReviewCalendar(NahajEntity, CalendarEntity):
    _attr_translation_key = "review_schedule"

    def __init__(self, coordinator: NahajCoordinator) -> None:
        super().__init__(coordinator)
        self._attr_unique_id = f"{coordinator.entry.entry_id}-calendar-review"

    @property
    def event(self) -> CalendarEvent | None:
        # Stub: today's session at the next round hour. v0.5 reads /v1/hifdh/session.
        now = datetime.now(UTC)
        start = (now + timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
        return CalendarEvent(
            summary="Hifdh review",
            start=start,
            end=start + timedelta(minutes=20),
        )

    async def async_get_events(
        self,
        hass: HomeAssistant,
        start_date: datetime,
        end_date: datetime,
    ) -> list[CalendarEvent]:
        # Stub: one event per day in the requested range, at 20:00 UTC. v0.5 hydrates real due dates.
        events: list[CalendarEvent] = []
        cur = start_date.replace(hour=20, minute=0, second=0, microsecond=0)
        while cur <= end_date:
            events.append(
                CalendarEvent(
                    summary="Hifdh review",
                    start=cur,
                    end=cur + timedelta(minutes=20),
                )
            )
            cur += timedelta(days=1)
        return events
