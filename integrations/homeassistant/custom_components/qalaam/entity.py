"""Common entity base for Qalaam HA entities."""

from __future__ import annotations

from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import QalaamCoordinator


class QalaamEntity(CoordinatorEntity[QalaamCoordinator]):
    """Base class. Per HA dev guide: shared device_info + attribution."""

    _attr_attribution = "Powered by Qalaam (qalaam.app) + Quran.Foundation, QUL, EveryAyah"
    _attr_has_entity_name = True

    def __init__(self, coordinator: QalaamCoordinator) -> None:
        super().__init__(coordinator)
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, coordinator.entry.entry_id)},
            manufacturer="Qalaam",
            model="Qalaam Service",
            name="Qalaam",
            configuration_url="https://qalaam.app",
            entry_type=None,
        )
