"""Manifest validation — every platform we forward must appear in PLATFORMS const."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "custom_components" / "qalaam"


def test_manifest_has_required_dependencies() -> None:
    data = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    assert "media_source" in data["dependencies"]
    assert "frontend" in data["dependencies"]
    assert "http" in data["dependencies"]


def test_translations_match_strings() -> None:
    strings = json.loads((ROOT / "strings.json").read_text(encoding="utf-8"))
    en = json.loads((ROOT / "translations" / "en.json").read_text(encoding="utf-8"))
    # Every entity translation key in strings.json must appear in en.json.
    for platform, keys in strings["entity"].items():
        for key in keys:
            assert key in en["entity"].get(platform, {}), (
                f"Missing en translation for {platform}.{key}"
            )


def test_voice_sentences_present_for_both_pipelines() -> None:
    for lang in ("en", "ar"):
        path = ROOT / "custom_sentences" / lang / "qalaam.yaml"
        assert path.exists(), f"Missing custom_sentences/{lang}/qalaam.yaml"


def test_const_platforms_have_modules() -> None:
    sys.path.insert(0, str(ROOT.parent))
    from custom_components.qalaam.const import PLATFORMS  # noqa: WPS433

    for platform in PLATFORMS:
        module_path = ROOT / f"{platform}.py"
        assert module_path.exists(), f"Declared platform {platform} has no module"
