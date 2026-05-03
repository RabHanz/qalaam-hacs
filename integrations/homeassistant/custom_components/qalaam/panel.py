"""Lovelace panel registration.

Mounts apps/ha-panel/dist/qalaam-panel.js as a static asset and registers a
sidebar panel pointing at it. Per strategy §11 + apps/ha-panel/README.md.

Cache-busting: the module_url carries `?v=<file-mtime>` so a freshly-pushed
panel.js bypasses any stale browser cache without manual hard-refresh.

Idempotency note: this function is also safe to call when the static path is
already registered — `frontend_url_path` membership in `hass.data["frontend_panels"]`
is the gate. Re-registering after a hot-reload is therefore a no-op.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Final

from homeassistant.components.frontend import (
    async_register_built_in_panel,
    async_remove_panel,
)
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant

from .const import DOMAIN, PANEL_JS_FILENAME, PANEL_STATIC_URL, PANEL_URL_PATH

_LOGGER: Final = logging.getLogger(__name__)


_STUB_MARKER: Final = "/* QALAAM_PANEL_STUB */"


def _ensure_panel_dir_sync(panel_dir: Path, js_path: Path) -> str:
    """Sync filesystem prep — runs in HA executor so we never block the loop.

    Creates the panel_dist dir, writes a stub bundle if no real bundle is
    present, and returns the version tag to use in the cache-busting suffix.
    """
    panel_dir.mkdir(exist_ok=True)
    if not js_path.exists():
        js_path.write_text(
            f"{_STUB_MARKER}\n"
            "console.warn('qalaam-panel: stub loaded — push the real apps/ha-panel/dist/qalaam-panel.js bundle');\n"
            "// Intentionally does NOT call customElements.define so the real bundle\n"
            "// can register the qalaam-panel element on first load without a name clash.\n",
            encoding="utf-8",
        )
    try:
        return str(int(js_path.stat().st_mtime))
    except OSError:
        return "0"


async def async_register_panel(hass: HomeAssistant) -> None:
    """Idempotent panel registration. Safe to call after every config-entry setup."""
    if PANEL_URL_PATH in hass.data.get("frontend_panels", {}):
        return

    panel_dir = Path(__file__).parent / "panel_dist"
    js_path = panel_dir / PANEL_JS_FILENAME

    # Filesystem work goes through the executor — HA forbids sync I/O on the
    # event loop and will warn (or in stricter releases, raise).
    version_tag = await hass.async_add_executor_job(
        _ensure_panel_dir_sync, panel_dir, js_path
    )

    # cache_headers=False so a freshly-scp'd bundle is picked up on next request
    # without waiting out a long cache TTL.
    await hass.http.async_register_static_paths(
        [StaticPathConfig(PANEL_STATIC_URL, str(panel_dir), False)]
    )

    # Cache-busting suffix so any historical stub entry in the browser cache is
    # bypassed by a different URL on the new registration.
    module_url = f"{PANEL_STATIC_URL}/{PANEL_JS_FILENAME}?v={version_tag}"

    async_register_built_in_panel(
        hass,
        "custom",
        sidebar_title="Qalaam",
        sidebar_icon="mdi:book-open",
        frontend_url_path=PANEL_URL_PATH,
        config={
            "_panel_custom": {
                "name": "qalaam-panel",
                "module_url": module_url,
                "embed_iframe": False,
                "trust_external": False,
            }
        },
        require_admin=False,
    )
    _LOGGER.info(
        "qalaam: Lovelace panel registered at /%s (module_url=%s)",
        PANEL_URL_PATH,
        module_url,
    )


async def async_remove_qalaam_panel(hass: HomeAssistant) -> None:
    if PANEL_URL_PATH in hass.data.get("frontend_panels", {}):
        async_remove_panel(hass, PANEL_URL_PATH)
