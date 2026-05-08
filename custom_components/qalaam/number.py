"""Qalaam number entities — daily-pages quota for the active plan.

`number.qalaam_daily_pages_quota` mirrors the user's first ACTIVE
plan's `daily_pages` value. Reading is a derived view of the
coordinator's snapshot (the coordinator already pulls /v1/plans for
other purposes once we extend it). Writing PATCHes the underlying
plan via /v1/plans/:id with `dailyPages: <new>`.

Range 1-20 page/day. Step 1. Mirrors the slider in the web app's
HifdhPlanPanel so a household can adjust quota from a Lovelace card
("we're traveling this week, drop to 1") without opening the web UI.

Auth posture: writes go through the coordinator's authenticated
session. No api_key (free-tier install with no premium) → the entity
surfaces as unknown and writes are rejected with a logged warning.
"""

from __future__ import annotations

import logging
from typing import Any, Final

from homeassistant.components.number import NumberEntity, NumberEntityDescription
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN
from .coordinator import QalaamCoordinator
from .entity import QalaamEntity

_LOGGER: Final = logging.getLogger(__name__)

_DAILY_PAGES_MIN: Final = 1
_DAILY_PAGES_MAX: Final = 20

_DESCRIPTION: Final = NumberEntityDescription(
    key="daily_pages_quota",
    translation_key="daily_pages_quota",
    icon="mdi:book-open-variant-outline",
    native_min_value=_DAILY_PAGES_MIN,
    native_max_value=_DAILY_PAGES_MAX,
    native_step=1,
    native_unit_of_measurement="pages/day",
)

_REQUEST_TIMEOUT_S: Final = 5


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    coordinator: QalaamCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([QalaamDailyQuotaNumber(coordinator)])


class QalaamDailyQuotaNumber(QalaamEntity, NumberEntity):
    """Read/write daily-pages quota for the user's first active plan.

    The `native_value` is fetched lazily from /v1/plans on each
    coordinator refresh and cached on the entity instance. Writing
    issues a PATCH /v1/plans/:id and triggers an immediate refresh
    so the value re-syncs without waiting for the 5-min poll.
    """

    entity_description = _DESCRIPTION

    def __init__(self, coordinator: QalaamCoordinator) -> None:
        super().__init__(coordinator)
        self._attr_unique_id = f"{coordinator.entry.entry_id}-number-daily_pages_quota"
        self._attr_suggested_object_id = "qalaam_daily_pages_quota"
        # Cached values — populated by _refresh_plan() called from
        # async_added_to_hass and async_set_native_value.
        self._cached_plan_id: str | None = None
        self._cached_value: int | None = None

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        await self._refresh_plan()

    @property
    def native_value(self) -> float | None:
        return float(self._cached_value) if self._cached_value is not None else None

    @property
    def available(self) -> bool:
        # Surface unavailable when there's no active plan to bind to —
        # the user has to create a plan via the web first.
        return self._cached_plan_id is not None

    async def _refresh_plan(self) -> None:
        """GET /v1/plans, pick the first active self-assigned plan,
        cache its id + dailyPages. Soft-fail to None on any error."""
        c = self.coordinator
        if not c.api_key:
            self._cached_plan_id = None
            self._cached_value = None
            return
        try:
            async with c._session.get(  # noqa: SLF001
                f"{c.base_url}/v1/plans",
                headers={"Authorization": f"Bearer {c.api_key}"},
                timeout=_REQUEST_TIMEOUT_S,
            ) as resp:
                if resp.status >= 400:  # noqa: PLR2004
                    self._cached_plan_id = None
                    self._cached_value = None
                    return
                body = await resp.json()
        except Exception as err:  # noqa: BLE001
            _LOGGER.debug("qalaam.daily_quota.refresh: %s", err)
            return

        plans = body.get("plans") or []
        # Pick the first active plan owned by the auth user, biased
        # toward self-assignment (which is the free-tier solo case).
        chosen: dict[str, Any] | None = None
        for p in plans:
            if p.get("status") != "active":
                continue
            chosen = p
            break

        if not chosen:
            self._cached_plan_id = None
            self._cached_value = None
            return

        plan_id = chosen.get("id")
        daily = chosen.get("dailyPages")
        if isinstance(plan_id, str) and isinstance(daily, (int, float)):
            self._cached_plan_id = plan_id
            self._cached_value = int(daily)

    async def async_set_native_value(self, value: float) -> None:
        c = self.coordinator
        if not c.api_key:
            _LOGGER.warning("qalaam.daily_quota.write: no api_key configured")
            return
        if self._cached_plan_id is None:
            _LOGGER.warning(
                "qalaam.daily_quota.write: no active plan to write to — "
                "create a plan in the Qalaam web app first."
            )
            return
        clamped = int(max(_DAILY_PAGES_MIN, min(_DAILY_PAGES_MAX, value)))
        try:
            async with c._session.patch(  # noqa: SLF001
                f"{c.base_url}/v1/plans/{self._cached_plan_id}",
                json={"dailyPages": clamped},
                headers={"Authorization": f"Bearer {c.api_key}"},
                timeout=_REQUEST_TIMEOUT_S,
            ) as resp:
                if resp.status >= 400:  # noqa: PLR2004
                    _LOGGER.warning(
                        "qalaam.daily_quota.write: PATCH /v1/plans/%s returned %s",
                        self._cached_plan_id,
                        resp.status,
                    )
                    return
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning("qalaam.daily_quota.write: %s", err)
            return
        # Optimistic update so the slider doesn't snap back; the
        # coordinator refresh below confirms the canonical value.
        self._cached_value = clamped
        self.async_write_ha_state()
        # Re-fetch the plan to confirm the write landed AND triggers
        # related sensors (next_review_due via session generator) to
        # recompute on the next snapshot.
        await self._refresh_plan()
        await c.async_request_refresh()
