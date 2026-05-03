"""Config-flow smoke tests.

Per CLAUDE.md §11.2: every integration ships tests. Real test scaffolding uses
`pytest-homeassistant-custom-component`. This file is a placeholder that
asserts the manifest is valid; full HA fixtures are wired in v1.0 (per
DEV_CHECKLIST.md Phase 6).
"""

from __future__ import annotations

import json
from pathlib import Path


HERE = Path(__file__).resolve().parent
MANIFEST = HERE.parent / "custom_components" / "qalaam" / "manifest.json"


def test_manifest_well_formed() -> None:
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    assert data["domain"] == "qalaam"
    assert data["integration_type"] == "hub"
    assert data["config_flow"] is True
    assert "version" in data  # required for custom integrations
    assert isinstance(data["dependencies"], list)
    assert "media_source" in data["dependencies"]
