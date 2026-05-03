"""DataUpdateCoordinator for Qalaam.

Per HA best practice: one coordinator per logical data source. Hot data (now-playing
state, current verse) is push-based; this coordinator handles slow-poll catalog
refresh (reciter list, recent Hifdh stats).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import timedelta
from typing import Any, Final

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryAuthFailed
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .const import (
    CONF_API_KEY,
    CONF_BASE_URL,
    DEFAULT_BASE_URL,
    DEFAULT_SCAN_INTERVAL_SECONDS,
    DOMAIN,
)

_LOGGER: Final = logging.getLogger(__name__)


@dataclass(slots=True, frozen=True)
class QalaamSnapshot:
    """Catalog snapshot fetched on each refresh."""

    reciters: tuple[dict[str, Any], ...]
    api_version: str


class QalaamCoordinator(DataUpdateCoordinator[QalaamSnapshot]):
    """Polls the Qalaam backend for catalog metadata. Fast state is push-based."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=timedelta(seconds=DEFAULT_SCAN_INTERVAL_SECONDS),
            config_entry=entry,
        )
        self.entry = entry
        self.base_url: str = entry.data.get(CONF_BASE_URL, DEFAULT_BASE_URL)
        self.api_key: str = entry.data[CONF_API_KEY]
        self._session = async_get_clientsession(hass)

    async def _async_update_data(self) -> QalaamSnapshot:
        try:
            async with self._session.get(
                f"{self.base_url}/v1/reciters",
                headers={"Authorization": f"Bearer {self.api_key}"},
                timeout=10,
            ) as resp:
                if resp.status == 401:
                    raise ConfigEntryAuthFailed("API key rejected by Qalaam backend.")
                if resp.status == 429:
                    raise UpdateFailed("Rate limited by Qalaam backend.")
                resp.raise_for_status()
                payload = await resp.json()
        except ConfigEntryAuthFailed:
            raise
        except Exception as err:  # noqa: BLE001
            raise UpdateFailed(f"Catalog refresh failed: {err}") from err

        return QalaamSnapshot(
            reciters=tuple(payload.get("reciters", ())),
            api_version=str(payload.get("api_version", "0.0.1")),
        )
