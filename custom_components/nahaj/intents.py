"""Nahaj Voice (Assist) intents.

Per HA Voice Chapter 11 (Oct 2025): two pipelines per satellite — Arabic +
user's primary language. The intents below are language-agnostic; sentence
templates live in `custom_sentences/<lang>/nahaj.yaml`.

PLAYBACK INTENTS (struct-routed, fast):
- NahajPlaySurah     — "Play Surah Al-Fatiha"
- NahajPlayAyah      — "Play Ayat al-Kursi"
- NahajStartHifdh    — "Start my Hifdh session"

QURANIC-KNOWLEDGE INTENTS (B3 — MCP-routed, LLM-friendly):
The user's HA satellite already runs a conversation agent (Whisper +
Piper + custom_conversation / extended_openai). The intents below
give HA Voice a structured way to answer Quranic-knowledge queries by
forwarding to the backend's /v1/mcp/call endpoint, which fans out to
the official mcp.quran.ai server (Quran.Foundation authoritative data)
for tafsir, morphology, and verse search.
- NahajExplainAyah   — "What does Surah 2 verse 255 mean?"
- NahajFindVerse     — "Find a verse about patience"
- NahajWordRoot      — "What's the root of istaghfir?"
"""

from __future__ import annotations

import logging
from typing import Any, ClassVar, Final

import voluptuous as vol
from homeassistant.core import HomeAssistant
from homeassistant.helpers import intent
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import (
    CONF_API_KEY,
    CONF_BASE_URL,
    DEFAULT_BASE_URL,
    DEFAULT_RECITER_SLUG,
    DOMAIN,
    EVENT_HIFDH_SESSION_STARTED,
)

_LOGGER: Final = logging.getLogger(__name__)

# Speech is read aloud — keep summaries short. Most TTS engines start to
# truncate or sound robotic past 80 words. Tafsir + verse search results
# from MCP can be paragraphs; we cap to this many chars before the speech
# response, with an ellipsis the LLM-conversation agent can re-query.
_MAX_SPEECH_CHARS: Final = 480


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
    intent.async_register(hass, _ExplainAyahIntent())
    intent.async_register(hass, _FindVerseIntent())
    intent.async_register(hass, _WordRootIntent())


def _trim_for_speech(s: str) -> str:
    """Cap a Markdown / HTML response to a TTS-friendly length.

    Strips obvious HTML/Markdown markers, collapses whitespace, then
    truncates at a clean sentence boundary near _MAX_SPEECH_CHARS.
    """
    if not isinstance(s, str):
        return ""
    # Light markdown / html scrub — full-fidelity is the conversation
    # agent's job; we just want clean prose for the speech channel.
    txt = s
    for ch in ("\\n", "\n", "\r"):
        txt = txt.replace(ch, " ")
    # Strip simple HTML tags (full BeautifulSoup-quality not needed —
    # conversation agent gets the raw payload via the LLM tool path).
    in_tag = False
    out: list[str] = []
    for c in txt:
        if c == "<":
            in_tag = True
            continue
        if c == ">":
            in_tag = False
            continue
        if not in_tag:
            out.append(c)
    txt = "".join(out)
    txt = " ".join(txt.split())  # collapse whitespace
    if len(txt) <= _MAX_SPEECH_CHARS:
        return txt
    cut = txt[:_MAX_SPEECH_CHARS]
    # Step back to the last sentence terminator so the cut sounds natural.
    for sep in (". ", "؟ ", "! ", "؛ ", "، "):
        idx = cut.rfind(sep)
        if idx > _MAX_SPEECH_CHARS // 2:
            return cut[: idx + 1].strip() + " …"
    return cut.strip() + " …"


async def _mcp_call(
    hass: HomeAssistant,
    tool_name: str,
    args: dict[str, Any],
) -> dict[str, Any] | None:
    """POST /v1/mcp/call/<tool_name> with `args` to the backend.

    The backend forwards to mcp.quran.ai with the right session id +
    grounding nonce. We return the parsed JSON or None on any failure
    so callers can fall back to a generic "I don't know" response —
    HA Voice should never raise unhandled exceptions to the user.
    """
    entries = hass.config_entries.async_entries(DOMAIN)
    base_url = entries[0].data.get(CONF_BASE_URL, DEFAULT_BASE_URL) if entries else DEFAULT_BASE_URL
    api_key = entries[0].data.get(CONF_API_KEY, "") if entries else ""
    url = f"{base_url.rstrip('/')}/v1/mcp/call/{tool_name}"
    session = async_get_clientsession(hass)
    try:
        async with session.post(
            url,
            json={"args": args},
            headers={"Authorization": f"Bearer {api_key}"} if api_key else {},
            timeout=15,
        ) as resp:
            if resp.status >= 400:  # noqa: PLR2004 -- HTTP error class
                _LOGGER.warning("nahaj mcp call %s -> %d", tool_name, resp.status)
                return None
            return await resp.json()
    except (TimeoutError, OSError) as err:
        _LOGGER.warning("nahaj mcp call %s failed: %s", tool_name, err)
        return None


def _extract_text(result: dict[str, Any] | None) -> str:
    """Pull the visible text out of an MCP tool-result envelope.

    MCP tool-results are `{ result: { content: [{ type, text }, ...] } }`
    or `{ tool, result }` depending on the call site. We probe both
    shapes and concatenate any text fragments. Empty string on miss.
    """
    if not result:
        return ""
    payload = result.get("result", result)
    content = payload.get("content") if isinstance(payload, dict) else None
    if isinstance(content, list):
        return " ".join(
            str(item.get("text", "")) for item in content if isinstance(item, dict)
        ).strip()
    if isinstance(payload, dict) and isinstance(payload.get("text"), str):
        return payload["text"]
    return ""


class _PlaySurahIntent(intent.IntentHandler):
    intent_type = "NahajPlaySurah"
    description = "Play a surah on the configured Nahaj target speaker."
    slot_schema: ClassVar[dict] = {
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
        target = slots.get("target", {}).get("value") or "media_player.nahaj"
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
    intent_type = "NahajPlayAyah"
    description = "Play a single ayah."
    slot_schema: ClassVar[dict] = {
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
        target = slots.get("target", {}).get("value") or "media_player.nahaj"
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
    intent_type = "NahajStartHifdh"
    description = "Begin today's Hifdh session."
    slot_schema: ClassVar[dict] = {vol.Optional("user"): str}

    async def async_handle(self, intent_obj: intent.IntentResponse) -> intent.IntentResponse:  # type: ignore[override]
        slots = self.async_validate_slots(intent_obj.slots)
        user = slots.get("user", {}).get("value")
        intent_obj.hass.bus.async_fire(
            EVENT_HIFDH_SESSION_STARTED, {"user_id": user, "trigger": "voice"}
        )
        response = intent_obj.create_response()
        response.async_set_speech("Starting your Hifdh session.")
        return response


class _ExplainAyahIntent(intent.IntentHandler):
    """B3 — "What does Surah X verse Y mean?" → MCP fetch_tafsir."""

    intent_type = "NahajExplainAyah"
    description = "Explain an ayah using a recognised tafsir."
    slot_schema: ClassVar[dict] = {
        vol.Required("surah"): vol.Any(int, str),
        vol.Required("ayah"): vol.Any(int, str),
        # Optional: Tafsir slug ('jalalayn', 'ibn-kathir', 'maududi', etc.)
        # Defaults to ibn-kathir, the most widely-recognised in English.
        vol.Optional("tafsir"): str,
    }

    async def async_handle(self, intent_obj: intent.IntentResponse) -> intent.IntentResponse:  # type: ignore[override]
        slots = self.async_validate_slots(intent_obj.slots)
        try:
            surah = int(slots["surah"]["value"])
            ayah = int(slots["ayah"]["value"])
        except (TypeError, ValueError):
            response = intent_obj.create_response()
            response.async_set_speech("I couldn't parse the surah or ayah number.")
            return response
        tafsir = slots.get("tafsir", {}).get("value") or "ibn-kathir"
        verse_key = f"{surah}:{ayah}"
        result = await _mcp_call(
            intent_obj.hass,
            "fetch_tafsir",
            {"slug": tafsir, "verse_keys": [verse_key]},
        )
        text = _trim_for_speech(_extract_text(result))
        response = intent_obj.create_response()
        if not text:
            response.async_set_speech(
                f"I couldn't find a tafsir entry for {verse_key}. Try another mufassir."
            )
        else:
            response.async_set_speech(text)
        return response


class _FindVerseIntent(intent.IntentHandler):
    """B3 — "Find a verse about patience" → MCP search_quran / search_translation."""

    intent_type = "NahajFindVerse"
    description = "Search the Quran for verses matching a topic or query."
    slot_schema: ClassVar[dict] = {
        vol.Required("query"): str,
        vol.Optional("language"): str,
    }

    async def async_handle(self, intent_obj: intent.IntentResponse) -> intent.IntentResponse:  # type: ignore[override]
        slots = self.async_validate_slots(intent_obj.slots)
        query = (slots["query"]["value"] or "").strip()
        language = (slots.get("language", {}).get("value") or "en").lower()
        if not query:
            response = intent_obj.create_response()
            response.async_set_speech("What would you like to search for?")
            return response
        # Use the translation-search MCP tool when the query is in a
        # non-Arabic language; the Arabic-search tool is only useful for
        # Arabic queries because it greps the canonical Uthmani text.
        tool = "search_translation" if language != "ar" else "search_quran"
        args: dict[str, Any] = {"query": query}
        if tool == "search_translation":
            args["language"] = language
        result = await _mcp_call(intent_obj.hass, tool, args)
        text = _trim_for_speech(_extract_text(result))
        response = intent_obj.create_response()
        if not text:
            response.async_set_speech(f"I couldn't find a verse matching '{query}'.")
        else:
            response.async_set_speech(text)
        return response


class _WordRootIntent(intent.IntentHandler):
    """B3 — "What's the root of istaghfir?" → MCP get_word_morphology."""

    intent_type = "NahajWordRoot"
    description = "Look up the morphology and root of a Quranic word."
    slot_schema: ClassVar[dict] = {
        vol.Required("word"): str,
    }

    async def async_handle(self, intent_obj: intent.IntentResponse) -> intent.IntentResponse:  # type: ignore[override]
        slots = self.async_validate_slots(intent_obj.slots)
        word = (slots["word"]["value"] or "").strip()
        if not word:
            response = intent_obj.create_response()
            response.async_set_speech("Which word would you like me to look up?")
            return response
        result = await _mcp_call(
            intent_obj.hass,
            "get_word_morphology",
            {"word": word},
        )
        text = _trim_for_speech(_extract_text(result))
        response = intent_obj.create_response()
        if not text:
            response.async_set_speech(f"I couldn't find morphology for '{word}'.")
        else:
            response.async_set_speech(text)
        return response
