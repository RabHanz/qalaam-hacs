"""DataUpdateCoordinator for Qalaam.

Per HA best practice: one coordinator per logical data source. The catalog
(reciter list, api_version) refreshes on the slow interval; the Hifdh state
(streak, current sabqi, today's session count) and now-playing state are
fetched on the same poll for v0.1 — v1.0 splits them into a fast-poll
coordinator + WebSocket push for real-time accuracy.

Soft-fail design: a fetch failure on one endpoint doesn't take down the
whole snapshot. The coordinator surfaces stale data with a warning rather
than tanking every entity in the integration. Per CLAUDE.md "build for the
foundation" + ADR-0015 (HTTP/JSON v0.1 → gRPC v1.0).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
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
    CONF_USER_ID,
    DEFAULT_BASE_URL,
    DEFAULT_SCAN_INTERVAL_SECONDS,
    DEFAULT_USER_ID,
    DOMAIN,
)

_LOGGER: Final = logging.getLogger(__name__)

_QALAAM_SPEAKER_ID: Final = "qalaam"


@dataclass(slots=True, frozen=True)
class HifdhSnapshot:
    """Per-user Hifdh aggregate — drives the streak / sabqi / session sensors."""

    user_id: str
    streak_days: int = 0
    grace_days_remaining: int = 2
    current_sabqi: str | None = None
    manzil_cycle_position: str | None = None
    weakest_pages: tuple[str, ...] = field(default_factory=tuple)
    mutashabihat_watchlist: tuple[str, ...] = field(default_factory=tuple)
    today_session_count: int = 0


@dataclass(slots=True, frozen=True)
class NowPlayingSnapshot:
    """Backend's view of the qalaam virtual speaker — drives is_reciting + current_verse."""

    speaker_id: str = _QALAAM_SPEAKER_ID
    verse_key: str | None = None
    reciter_slug: str | None = None
    position_ms: int = 0
    is_playing: bool = False


@dataclass(slots=True, frozen=True)
class QalaamSnapshot:
    """Coordinator snapshot — catalog + Hifdh + now-playing in a single shape."""

    reciters: tuple[dict[str, Any], ...]
    api_version: str
    hifdh: HifdhSnapshot
    now_playing: NowPlayingSnapshot


class QalaamCoordinator(DataUpdateCoordinator[QalaamSnapshot]):
    """Polls the Qalaam backend for catalog + Hifdh state + now-playing."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=timedelta(seconds=DEFAULT_SCAN_INTERVAL_SECONDS),
            config_entry=entry,
        )
        self.entry = entry
        self.base_url: str = entry.data.get(CONF_BASE_URL, DEFAULT_BASE_URL).rstrip("/")
        self.api_key: str = entry.data[CONF_API_KEY]
        # user_id picked from options first (reactive to changes), falling back to
        # entry data, then the default for the unauth demo path.
        self.user_id: str = (
            entry.options.get(CONF_USER_ID)
            or entry.data.get(CONF_USER_ID)
            or DEFAULT_USER_ID
        )
        self._session = async_get_clientsession(hass)

    async def _async_update_data(self) -> QalaamSnapshot:
        catalog = await self._fetch_catalog()
        # Hifdh + now-playing are best-effort — a 404 / 5xx degrades to defaults
        # rather than tanking the whole integration.
        hifdh = await self._fetch_hifdh_state(soft=True)
        now_playing = await self._fetch_now_playing(soft=True)

        return QalaamSnapshot(
            reciters=catalog["reciters"],
            api_version=catalog["api_version"],
            hifdh=hifdh,
            now_playing=now_playing,
        )

    async def _fetch_catalog(self) -> dict[str, Any]:
        try:
            async with self._session.get(
                f"{self.base_url}/v1/reciters",
                headers=self._headers(),
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
        return {
            "reciters": tuple(payload.get("reciters", ())),
            "api_version": str(payload.get("api_version", "0.0.1")),
        }

    async def _fetch_hifdh_state(self, *, soft: bool) -> HifdhSnapshot:
        try:
            async with self._session.get(
                f"{self.base_url}/v1/hifdh/state",
                params={"user_id": self.user_id},
                headers=self._headers(),
                timeout=8,
            ) as resp:
                if resp.status >= 400:
                    raise RuntimeError(f"hifdh/state {resp.status}")
                p = await resp.json()
        except Exception as err:  # noqa: BLE001
            if soft:
                _LOGGER.debug("qalaam.hifdh_state.soft_fail: %s", err)
                return HifdhSnapshot(user_id=self.user_id)
            raise UpdateFailed(f"Hifdh state failed: {err}") from err
        return HifdhSnapshot(
            user_id=str(p.get("user_id") or self.user_id),
            streak_days=int(p.get("streak_days", 0) or 0),
            grace_days_remaining=int(p.get("grace_days_remaining", 2) or 0),
            current_sabqi=p.get("current_sabqi"),
            manzil_cycle_position=p.get("manzil_cycle_position"),
            weakest_pages=tuple(p.get("weakest_pages") or ()),
            mutashabihat_watchlist=tuple(p.get("mutashabihat_watchlist") or ()),
            today_session_count=int(p.get("today_session_count", 0) or 0),
        )

    async def _fetch_now_playing(self, *, soft: bool) -> NowPlayingSnapshot:
        try:
            async with self._session.get(
                f"{self.base_url}/v1/now-playing/{_QALAAM_SPEAKER_ID}",
                headers=self._headers(),
                timeout=5,
            ) as resp:
                if resp.status >= 400:
                    raise RuntimeError(f"now-playing {resp.status}")
                p = await resp.json()
        except Exception as err:  # noqa: BLE001
            if soft:
                _LOGGER.debug("qalaam.now_playing.soft_fail: %s", err)
                return NowPlayingSnapshot()
            raise UpdateFailed(f"Now-playing failed: {err}") from err
        return NowPlayingSnapshot(
            speaker_id=str(p.get("speaker_id") or _QALAAM_SPEAKER_ID),
            verse_key=p.get("verse_key"),
            reciter_slug=p.get("reciter_slug"),
            position_ms=int(p.get("position_ms", 0) or 0),
            is_playing=bool(p.get("is_playing")),
        )

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}
