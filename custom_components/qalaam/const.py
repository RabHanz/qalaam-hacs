"""Constants for the Qalaam Home Assistant integration.

Per ADR-0003 + Docs/STRATEGY_AND_ROADMAP.md §6 (HA section). The DOMAIN here MUST
match the schema $id strings in `packages/schema/schemas/device/Speaker.schema.json`
where `adapter` includes 'ha'.
"""

from __future__ import annotations

from typing import Final

DOMAIN: Final = "qalaam"
PLATFORMS: Final[list[str]] = [
    "media_player",
    "sensor",
    "binary_sensor",
    "select",
    "button",
    "todo",
    "calendar",
]

# Static-asset path served by the integration (Lovelace panel JS lives here).
PANEL_URL_PATH: Final = "qalaam"
PANEL_STATIC_URL: Final = "/qalaam_static"
PANEL_JS_FILENAME: Final = "qalaam-panel.js"

# Config-entry data keys
CONF_API_KEY: Final = "api_key"
CONF_BASE_URL: Final = "base_url"
CONF_TARGET_PLAYER: Final = "target_player"
CONF_DEFAULT_RECITER: Final = "default_reciter_slug"
CONF_USER_ID: Final = "user_id"

DEFAULT_BASE_URL: Final = "https://api.qalaam.app"
DEFAULT_SCAN_INTERVAL_SECONDS: Final = 300  # 5 minutes — catalog refresh
DEFAULT_RECITER_SLUG: Final = "mishary-alafasy"
DEFAULT_USER_ID: Final = "demo-user"

# Service names
SERVICE_PLAY_AYAH: Final = "play_ayah"
SERVICE_PLAY_SURAH: Final = "play_surah"
SERVICE_START_SESSION: Final = "start_memorization_session"

# Media-source root identifier (URI: media-source://qalaam/...)
MEDIA_SOURCE_NAME: Final = "Qalaam Quran"

# Custom event the integration emits on the bus — wired into automations.
EVENT_AYAH_COMPLETED: Final = "qalaam_ayah_completed"
EVENT_HIFDH_SESSION_STARTED: Final = "qalaam_hifdh_session_started"
