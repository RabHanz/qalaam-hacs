"""Qalaam button entities — quick-action triggers.

- button.qalaam_test_me        → start a verse-pause Hifdh drill on the configured target.
- button.qalaam_mark_memorized → mark current portion as memorized (advances FSRS-6 state to 'locked').
"""

from __future__ import annotations

from typing import Final

from homeassistant.components.button import ButtonEntity, ButtonEntityDescription
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN, EVENT_HIFDH_SESSION_STARTED
from .coordinator import QalaamCoordinator
from .entity import QalaamEntity

_TEST_ME: Final = ButtonEntityDescription(
    key="test_me", translation_key="test_me", icon="mdi:microphone-question"
)
_MARK: Final = ButtonEntityDescription(
    key="mark_memorized", translation_key="mark_memorized", icon="mdi:check-decagram"
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    coordinator: QalaamCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities(
        [QalaamTestMeButton(coordinator), QalaamMarkMemorizedButton(coordinator)]
    )


class QalaamTestMeButton(QalaamEntity, ButtonEntity):
    entity_description = _TEST_ME

    def __init__(self, coordinator: QalaamCoordinator) -> None:
        super().__init__(coordinator)
        self._attr_unique_id = f"{coordinator.entry.entry_id}-button-test_me"

    async def async_press(self) -> None:
        self.hass.bus.async_fire(EVENT_HIFDH_SESSION_STARTED, {"trigger": "test_me"})


class QalaamMarkMemorizedButton(QalaamEntity, ButtonEntity):
    entity_description = _MARK

    def __init__(self, coordinator: QalaamCoordinator) -> None:
        super().__init__(coordinator)
        self._attr_unique_id = f"{coordinator.entry.entry_id}-button-mark_memorized"

    async def async_press(self) -> None:
        self.hass.bus.async_fire("qalaam_portion_marked_memorized", {})
