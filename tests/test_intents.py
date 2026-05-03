"""Voice intents — verify registration + dispatch shape without booting full HA."""

from __future__ import annotations

import sys
from pathlib import Path


def _add_custom_components_to_path() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    sys.path.insert(0, str(repo_root / "integrations" / "homeassistant"))


def test_intent_constants_match_const_module() -> None:
    _add_custom_components_to_path()
    from custom_components.qalaam import const  # noqa: WPS433

    # The Voice intents reference these — must stay aligned with services.py.
    assert const.SERVICE_PLAY_AYAH == "play_ayah"
    assert const.SERVICE_PLAY_SURAH == "play_surah"
    assert const.SERVICE_START_SESSION == "start_memorization_session"
    assert const.EVENT_HIFDH_SESSION_STARTED == "qalaam_hifdh_session_started"
    assert const.EVENT_AYAH_COMPLETED == "qalaam_ayah_completed"


def test_panel_constants_align() -> None:
    _add_custom_components_to_path()
    from custom_components.qalaam import const  # noqa: WPS433

    assert const.PANEL_URL_PATH == "qalaam"
    assert const.PANEL_STATIC_URL == "/qalaam_static"
    assert const.PANEL_JS_FILENAME == "qalaam-panel.js"
