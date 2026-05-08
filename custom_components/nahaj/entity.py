"""Common entity base for Nahaj HA entities."""

from __future__ import annotations

from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import NahajCoordinator


class NahajEntity(CoordinatorEntity[NahajCoordinator]):
    """Base class. Per HA dev guide: shared device_info + attribution."""

    _attr_attribution = (
        "Powered by Nahaj (nahaj.app) + Quran.Foundation, QUL, EveryAyah"
    )
    _attr_has_entity_name = True

    def __init__(self, coordinator: NahajCoordinator) -> None:
        super().__init__(coordinator)
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, coordinator.entry.entry_id)},
            manufacturer="Nahaj",
            model="Nahaj Service",
            name="Nahaj",
            configuration_url="https://nahaj.app",
            entry_type=None,
        )
