"""Config + Options flow for Nahaj.

Per ADR-0012: v0.1 ships an API-key flow; OAuth2 client_credentials + Tier B
PKCE land in v1.0+. The form is intentionally minimal — Nahaj's backend
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
    CONF_WEB_URL,
    DEFAULT_BASE_URL,
    DEFAULT_RECITER_SLUG,
    DEFAULT_USER_ID,
    DEFAULT_WEB_URL,
    DOMAIN,
)

_LOGGER: Final = logging.getLogger(__name__)

# Module-level constant — keeps ruff PLR2004 (magic-number) + N806
# (function-local UPPER_CASE) both quiet without needing inline noqa.
_HTTP_OK: Final = 200


_USER_SCHEMA = vol.Schema(
    {
        vol.Required(CONF_API_KEY): str,
        vol.Optional(CONF_BASE_URL, default=DEFAULT_BASE_URL): str,
        vol.Optional(CONF_WEB_URL, default=DEFAULT_WEB_URL): str,
    }
)


class NahajConfigFlow(ConfigFlow, domain=DOMAIN):
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
                return self.async_create_entry(title="Nahaj", data=user_input)
            errors["base"] = "auth"

        return self.async_show_form(
            step_id="user",
            data_schema=_USER_SCHEMA,
            errors=errors,
            description_placeholders={"docs_url": "https://nahaj.app/docs/ha"},
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

    async def async_step_reconfigure(
        self,
        user_input: dict[str, Any] | None = None,
    ) -> ConfigFlowResult:
        """Full re-setup walk-through.

        Modern HA pattern (2024.10+): users hit "..." → "Reconfigure" on the
        integration card and re-enter every credential. This is what they
        want when they:
          • rotate the Nahaj API key
          • move the backend to a different host (self-hosted ↔ SaaS)
          • change the public web origin (custom domain rollout)

        Validates the new credentials before saving so we don't strand them.
        """
        errors: dict[str, str] = {}
        entry = self._get_reconfigure_entry()
        existing = entry.data

        if user_input is not None:
            valid = await self._verify_credentials(
                user_input[CONF_API_KEY],
                user_input.get(CONF_BASE_URL, DEFAULT_BASE_URL),
            )
            if valid:
                return self.async_update_reload_and_abort(
                    entry,
                    data={**existing, **user_input},
                )
            errors["base"] = "auth"

        return self.async_show_form(
            step_id="reconfigure",
            data_schema=vol.Schema(
                {
                    vol.Required(
                        CONF_API_KEY,
                        default=existing.get(CONF_API_KEY, ""),
                    ): str,
                    vol.Optional(
                        CONF_BASE_URL,
                        default=existing.get(CONF_BASE_URL, DEFAULT_BASE_URL),
                    ): str,
                    vol.Optional(
                        CONF_WEB_URL,
                        default=existing.get(CONF_WEB_URL, DEFAULT_WEB_URL),
                    ): str,
                }
            ),
            errors=errors,
            description_placeholders={"docs_url": "https://nahaj.app/docs/ha"},
        )

    @staticmethod
    @callback
    def async_get_options_flow(_config_entry: ConfigEntry) -> OptionsFlow:
        return NahajOptionsFlow()

    async def _verify_credentials(self, api_key: str, base_url: str) -> bool:
        session = async_get_clientsession(self.hass)
        try:
            async with session.get(
                f"{base_url.rstrip('/')}/healthz",
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=5,
            ) as resp:
                return resp.status == _HTTP_OK
        except Exception:
            return False


class NahajOptionsFlow(OptionsFlow):
    """Runtime options the user can tune without removing the entry.

    The data fields the user picked at setup-time (api_key, base_url,
    web_url) are NOT here — those are credentials. To change them the
    user uses "Reconfigure" (`async_step_reconfigure` on the config
    flow), which re-validates against the backend before saving.

    What's here are runtime preferences:
      • target_player    — which media_player Nahaj routes audio to
      • default_reciter  — slug used when no per-call reciter override
      • user_id          — Nahaj account to surface in sensors
      • family_room      — area_id used by per-room sabaq blueprint
      • child_areas      — comma-separated areas for door-LED automations
      • announce_volume  — TTS volume for khatm-milestone announcements
      • announce_language — language code for any TTS Nahaj triggers
    """

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
                vol.Optional(
                    "family_room",
                    default=current.get("family_room", ""),
                ): TextSelector(TextSelectorConfig()),
                vol.Optional(
                    "child_areas",
                    default=current.get("child_areas", ""),
                ): TextSelector(TextSelectorConfig()),
                vol.Optional(
                    "announce_volume",
                    default=current.get("announce_volume", 0.45),
                ): vol.All(vol.Coerce(float), vol.Range(min=0.0, max=1.0)),
                vol.Optional(
                    "announce_language",
                    default=current.get("announce_language", "en"),
                ): TextSelector(TextSelectorConfig()),
            }
        )
        return self.async_show_form(step_id="init", data_schema=schema)
