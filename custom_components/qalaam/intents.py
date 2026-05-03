"""Qalaam Voice (Assist) intents.

Per HA Voice Chapter 11 (Oct 2025): two pipelines per satellite — Arabic +
user's primary language. The intents below are language-agnostic; sentence
templates live in `custom_sentences/<lang>/qalaam.yaml`.

Intents:
- QalaamPlaySurah  — "Play Surah Al-Fatiha"
- QalaamPlayAyah   — "Play Ayat al-Kursi"
- QalaamStartHifdh — "Start my Hifdh session"
"""

from __future__ import annotations

import logging
from typing import Final

import voluptuous as vol
from homeassistant.core import HomeAssistant
from homeassistant.helpers import intent

from .const import DEFAULT_RECITER_SLUG, DOMAIN, EVENT_HIFDH_SESSION_STARTED

_LOGGER: Final = logging.getLogger(__name__)


_SURAH_NAMES: Final[dict[str, int]] = {
    # Stub set; v1.0 hydrates from /v1/chapters with localized names.
    "al-fatiha": 1,
    "fatiha": 1,
    "al-baqarah": 2,
    "baqarah": 2,
    "yaseen": 36,
    "ya sin": 36,
    "ar-rahman": 55,
    "al-mulk": 67,
    "al-kahf": 18,
    "kahf": 18,
    "al-ikhlas": 112,
    "ikhlas": 112,
    "al-falaq": 113,
    "falaq": 113,
    "an-nas": 114,
    "nas": 114,
}


async def async_register_intents(hass: HomeAssistant) -> None:
    intent.async_register(hass, _PlaySurahIntent())
    intent.async_register(hass, _PlayAyahIntent())
    intent.async_register(hass, _StartHifdhIntent())


class _PlaySurahIntent(intent.IntentHandler):
    intent_type = "QalaamPlaySurah"
    description = "Play a surah on the configured Qalaam target speaker."
    slot_schema = {
        vol.Required("surah"): vol.Any(int, str),
        vol.Optional("reciter"): str,
        vol.Optional("target"): str,
    }

    async def async_handle(self, intent_obj: intent.IntentResponse) -> intent.IntentResponse:  # type: ignore[override]
        slots = self.async_validate_slots(intent_obj.slots)
        surah_raw = slots["surah"]["value"]
        if isinstance(surah_raw, int):
            surah_n = surah_raw
        else:
            normalized = str(surah_raw).strip().lower()
            surah_n = _SURAH_NAMES.get(normalized) or 1
        reciter = slots.get("reciter", {}).get("value") or DEFAULT_RECITER_SLUG
        target = slots.get("target", {}).get("value") or "media_player.qalaam"
        await intent_obj.hass.services.async_call(
            DOMAIN,
            "play_surah",
            {"surah": surah_n, "reciter_slug": reciter, "target": target},
            blocking=True,
        )
        response = intent_obj.create_response()
        response.async_set_speech(f"Playing surah {surah_n} on {target}.")
        return response


class _PlayAyahIntent(intent.IntentHandler):
    intent_type = "QalaamPlayAyah"
    description = "Play a single ayah."
    slot_schema = {
        vol.Required("surah"): int,
        vol.Required("ayah"): int,
        vol.Optional("reciter"): str,
        vol.Optional("target"): str,
    }

    async def async_handle(self, intent_obj: intent.IntentResponse) -> intent.IntentResponse:  # type: ignore[override]
        slots = self.async_validate_slots(intent_obj.slots)
        surah = slots["surah"]["value"]
        ayah = slots["ayah"]["value"]
        reciter = slots.get("reciter", {}).get("value") or DEFAULT_RECITER_SLUG
        target = slots.get("target", {}).get("value") or "media_player.qalaam"
        await intent_obj.hass.services.async_call(
            DOMAIN,
            "play_ayah",
            {"surah": surah, "ayah": ayah, "reciter_slug": reciter, "target": target},
            blocking=True,
        )
        response = intent_obj.create_response()
        response.async_set_speech(f"Playing {surah}:{ayah} on {target}.")
        return response


class _StartHifdhIntent(intent.IntentHandler):
    intent_type = "QalaamStartHifdh"
    description = "Begin today's Hifdh session."
    slot_schema = {vol.Optional("user"): str}

    async def async_handle(self, intent_obj: intent.IntentResponse) -> intent.IntentResponse:  # type: ignore[override]
        slots = self.async_validate_slots(intent_obj.slots)
        user = slots.get("user", {}).get("value")
        intent_obj.hass.bus.async_fire(EVENT_HIFDH_SESSION_STARTED, {"user_id": user, "trigger": "voice"})
        response = intent_obj.create_response()
        response.async_set_speech("Starting your Hifdh session.")
        return response
