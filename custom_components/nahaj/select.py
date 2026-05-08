"""Nahaj select entities — reciter + mushaf."""

from __future__ import annotations

from typing import Final

from homeassistant.components.select import SelectEntity, SelectEntityDescription
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import CONF_DEFAULT_RECITER, DEFAULT_RECITER_SLUG, DOMAIN
from .coordinator import NahajCoordinator
from .entity import NahajEntity

_RECITER_DESC: Final = SelectEntityDescription(
    key="reciter", translation_key="reciter", icon="mdi:account-voice"
)
_MUSHAF_DESC: Final = SelectEntityDescription(
    key="mushaf", translation_key="mushaf", icon="mdi:book-open-page-variant"
)
_MUSHAF_OPTIONS: Final = ["madani_15", "indopak_16", "uthmani_v1", "uthmani_v2"]


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    coordinator: NahajCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities(
        [
            NahajReciterSelect(coordinator),
            NahajMushafSelect(coordinator),
        ]
    )


class NahajReciterSelect(NahajEntity, SelectEntity):
    entity_description = _RECITER_DESC

    def __init__(self, coordinator: NahajCoordinator) -> None:
        super().__init__(coordinator)
        self._attr_unique_id = f"{coordinator.entry.entry_id}-select-reciter"
        self._attr_current_option = coordinator.entry.options.get(
            CONF_DEFAULT_RECITER, DEFAULT_RECITER_SLUG
        )

    @property
    def options(self) -> list[str]:
        return [r["slug"] for r in (self.coordinator.data.reciters if self.coordinator.data else ())]

    async def async_select_option(self, option: str) -> None:
        new_options = {**self.coordinator.entry.options, CONF_DEFAULT_RECITER: option}
        self.hass.config_entries.async_update_entry(self.coordinator.entry, options=new_options)
        self._attr_current_option = option
        self.async_write_ha_state()


class NahajMushafSelect(NahajEntity, SelectEntity):
    entity_description = _MUSHAF_DESC

    def __init__(self, coordinator: NahajCoordinator) -> None:
        super().__init__(coordinator)
        self._attr_unique_id = f"{coordinator.entry.entry_id}-select-mushaf"
        self._attr_options = list(_MUSHAF_OPTIONS)
        self._attr_current_option = coordinator.entry.options.get("mushaf", "madani_15")

    async def async_select_option(self, option: str) -> None:
        new_options = {**self.coordinator.entry.options, "mushaf": option}
        self.hass.config_entries.async_update_entry(self.coordinator.entry, options=new_options)
        self._attr_current_option = option
        self.async_write_ha_state()
