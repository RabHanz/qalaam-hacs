"""Constants for the Nahaj Home Assistant integration.

Per ADR-0003 + Docs/STRATEGY_AND_ROADMAP.md §6 (HA section). The DOMAIN here MUST
match the schema $id strings in `packages/schema/schemas/device/Speaker.schema.json`
where `adapter` includes 'ha'.
"""

from __future__ import annotations

from typing import Final

DOMAIN: Final = "nahaj"
PLATFORMS: Final[list[str]] = [
    "media_player",
    "sensor",
    "binary_sensor",
    "select",
    "button",
    "number",
    "todo",
    "calendar",
]

# Static-asset path served by the integration (Lovelace panel JS lives here).
PANEL_URL_PATH: Final = "nahaj"
PANEL_STATIC_URL: Final = "/nahaj_static"
PANEL_JS_FILENAME: Final = "nahaj-panel.js"

# Config-entry data keys
CONF_API_KEY: Final = "api_key"
CONF_BASE_URL: Final = "base_url"
# Standalone Nahaj web app URL — separate from the BACKEND base URL.
# Panel buttons that say "Open Nahaj →" / "Open tajweed mushaf →"
# need this so they can open the actual web app instead of pushing
# state into the HA frontend (the panel is already mounted at the
# `/nahaj` URL on HA, so window.history.pushState('/nahaj') is a
# no-op — must open a different origin in a new tab).
CONF_WEB_URL: Final = "web_url"
CONF_TARGET_PLAYER: Final = "target_player"
CONF_DEFAULT_RECITER: Final = "default_reciter_slug"
CONF_USER_ID: Final = "user_id"

# Production deployment lives at nahaj.app; the
# `/api/*` path proxies to the Fastify backend on the same Docker
# network. The `api.nahaj.app` subdomain is reserved but no DNS
# yet — once it lands, flip these defaults; existing installs
# continue to work via the reconfigure flow.
DEFAULT_BASE_URL: Final = "https://nahaj.app/api"
DEFAULT_WEB_URL: Final = "https://nahaj.app"
DEFAULT_SCAN_INTERVAL_SECONDS: Final = 300  # 5 minutes — catalog refresh
DEFAULT_RECITER_SLUG: Final = "mishary-alafasy"
DEFAULT_USER_ID: Final = "demo-user"

# Service names
SERVICE_PLAY_AYAH: Final = "play_ayah"
SERVICE_PLAY_SURAH: Final = "play_surah"
SERVICE_START_SESSION: Final = "start_memorization_session"
# B6 services — adhan-aware DND + per-room sabaq playback.
# `pause_for_adhan` mutes/pauses every media_player tagged with the
# Nahaj adhan-DND label (or all media_players if no label is given)
# until the prayer window closes.
# `start_room_sabaq` plays the user's current sabqi (today's new
# memorization portion) on the speakers in a given HA area, so
# different rooms can do different drill simultaneously.
SERVICE_PAUSE_FOR_ADHAN: Final = "pause_for_adhan"
SERVICE_START_ROOM_SABAQ: Final = "start_room_sabaq"

# Media-source root identifier (URI: media-source://nahaj/...)
MEDIA_SOURCE_NAME: Final = "Nahaj Quran"

# Custom event the integration emits on the bus — wired into automations.
EVENT_AYAH_COMPLETED: Final = "nahaj_ayah_completed"
EVENT_HIFDH_SESSION_STARTED: Final = "nahaj_hifdh_session_started"
