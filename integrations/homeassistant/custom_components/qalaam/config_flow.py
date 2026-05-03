"""Config + Options flow for Qalaam.

Per ADR-0012: v0.1 ships an API-key flow; OAuth2 client_credentials + Tier B
PKCE land in v1.0+. The form is intentionally minimal — Qalaam's backend
generates a long-lived API key per HA install.

Options flow exposes the runtime-tunable choices: target media_player + default
reciter + user id. Per HA dev guide (2024.12+): do NOT assign self.config_entry
in __init__ — it's provided automatically.
"""

from __future__ import annotations

import logging
from typing import Any, Final

import voluptuous as vol
from homeassistant.config_entries import ConfigEntry, ConfigFlow, ConfigFlowResult, OptionsFlow
from homeassistant.core import callback
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.selector import (
    EntitySelector,
    EntitySelectorConfig,
    TextSelector,
    TextSelectorConfig,
)

from .const import (
    CONF_API_KEY,
    CONF_BASE_URL,
    CONF_DEFAULT_RECITER,
    CONF_TARGET_PLAYER,
    CONF_USER_ID,
    DEFAULT_BASE_URL,
    DEFAULT_RECITER_SLUG,
    DEFAULT_USER_ID,
    DOMAIN,
)

_LOGGER: Final = logging.getLogger(__name__)


_USER_SCHEMA = vol.Schema(
    {
        vol.Required(CONF_API_KEY): str,
        vol.Optional(CONF_BASE_URL, default=DEFAULT_BASE_URL): str,
    }
)


class QalaamConfigFlow(ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(
        self,
        user_input: dict[str, Any] | None = None,
    ) -> ConfigFlowResult:
        errors: dict[str, str] = {}
        if user_input is not None:
            valid = await self._verify_credentials(
                user_input[CONF_API_KEY],
                user_input.get(CONF_BASE_URL, DEFAULT_BASE_URL),
            )
            if valid:
                await self.async_set_unique_id(user_input[CONF_API_KEY][:8])
                self._abort_if_unique_id_configured()
                return self.async_create_entry(title="Qalaam", data=user_input)
            errors["base"] = "auth"

        return self.async_show_form(
            step_id="user",
            data_schema=_USER_SCHEMA,
            errors=errors,
            description_placeholders={"docs_url": "https://qalaam.app/docs/ha"},
        )

    async def async_step_reauth(self, _entry_data: dict[str, Any]) -> ConfigFlowResult:
        return await self.async_step_reauth_confirm()

    async def async_step_reauth_confirm(
        self,
        user_input: dict[str, Any] | None = None,
    ) -> ConfigFlowResult:
        if user_input is not None:
            entry = self._get_reauth_entry()
            new_data = {**entry.data, CONF_API_KEY: user_input[CONF_API_KEY]}
            return self.async_update_reload_and_abort(entry, data=new_data)
        return self.async_show_form(
            step_id="reauth_confirm",
            data_schema=vol.Schema({vol.Required(CONF_API_KEY): str}),
        )

    @staticmethod
    @callback
    def async_get_options_flow(_config_entry: ConfigEntry) -> OptionsFlow:
        return QalaamOptionsFlow()

    async def _verify_credentials(self, api_key: str, base_url: str) -> bool:
        session = async_get_clientsession(self.hass)
        try:
            async with session.get(
                f"{base_url.rstrip('/')}/healthz",
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=5,
            ) as resp:
                return resp.status == 200
        except Exception:  # noqa: BLE001
            return False


class QalaamOptionsFlow(OptionsFlow):
    """Options: target_player + default_reciter + user_id."""

    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        # Per HA 2024.12+: self.config_entry is auto-provided.
        current = self.config_entry.options or {}
        schema = vol.Schema(
            {
                vol.Optional(
                    CONF_TARGET_PLAYER,
                    default=current.get(CONF_TARGET_PLAYER, ""),
                ): EntitySelector(EntitySelectorConfig(domain="media_player")),
                vol.Optional(
                    CONF_DEFAULT_RECITER,
                    default=current.get(CONF_DEFAULT_RECITER, DEFAULT_RECITER_SLUG),
                ): TextSelector(TextSelectorConfig()),
                vol.Optional(
                    CONF_USER_ID,
                    default=current.get(CONF_USER_ID, DEFAULT_USER_ID),
                ): TextSelector(TextSelectorConfig()),
            }
        )
        return self.async_show_form(step_id="init", data_schema=schema)
