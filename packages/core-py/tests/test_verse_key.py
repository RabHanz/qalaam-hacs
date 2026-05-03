"""Parity tests for qalaam_core.verse_key. Run with `uv run pytest`."""

from __future__ import annotations

import pytest

from qalaam_core import (
    SURAH_AYAH_COUNTS,
    TOTAL_VERSES,
    QalaamError,
    compare_verse_keys,
    parse_verse_key,
    parts_of,
    verse_count,
    verse_key,
    walk_verse_keys,
)


def test_parse_al_fatiha_1() -> None:
    k = parse_verse_key("1:1")
    parts = parts_of(k)
    assert parts.surah == 1
    assert parts.ayah == 1


def test_parse_al_baqarah_286() -> None:
    parts = parts_of(parse_verse_key("2:286"))
    assert parts.surah == 2
    assert parts.ayah == 286


@pytest.mark.parametrize("bad", ["", "x", "1", "1:", ":1", "0:1", "1:0", "1:abc", "115:1", "1:8"])
def test_parse_rejects_invalid(bad: str) -> None:
    with pytest.raises(QalaamError):
        parse_verse_key(bad)


def test_compare_verse_keys() -> None:
    assert compare_verse_keys(parse_verse_key("1:1"), parse_verse_key("1:2")) < 0
    assert compare_verse_keys(parse_verse_key("2:1"), parse_verse_key("1:7")) > 0
    assert compare_verse_keys(parse_verse_key("5:5"), parse_verse_key("5:5")) == 0


def test_walk_within_surah() -> None:
    seen = list(walk_verse_keys(parse_verse_key("1:1"), parse_verse_key("1:7")))
    assert len(seen) == 7
    assert seen[0] == "1:1"
    assert seen[-1] == "1:7"


def test_walk_cross_surah() -> None:
    seen = list(walk_verse_keys(parse_verse_key("1:6"), parse_verse_key("2:2")))
    assert seen == ["1:6", "1:7", "2:1", "2:2"]


def test_walk_rejects_reversed() -> None:
    with pytest.raises(QalaamError):
        list(walk_verse_keys(parse_verse_key("2:1"), parse_verse_key("1:1")))


def test_verse_count_within_surah() -> None:
    assert verse_count(parse_verse_key("1:1"), parse_verse_key("1:7")) == 7


def test_verse_count_cross_surah() -> None:
    assert verse_count(parse_verse_key("1:1"), parse_verse_key("2:286")) == 7 + 286


def test_verse_count_whole_quran() -> None:
    assert verse_count(parse_verse_key("1:1"), parse_verse_key("114:6")) == TOTAL_VERSES


def test_surah_ayah_counts_table() -> None:
    assert len(SURAH_AYAH_COUNTS) == 115
    assert SURAH_AYAH_COUNTS[0] == 0
    assert SURAH_AYAH_COUNTS[2] == 286
    assert sum(SURAH_AYAH_COUNTS) == TOTAL_VERSES


def test_verse_key_constructor() -> None:
    k = verse_key(2, 255)
    assert k == "2:255"
    parts = parts_of(k)
    assert parts.surah == 2
    assert parts.ayah == 255
