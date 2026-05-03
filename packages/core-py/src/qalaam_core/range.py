"""Ayah-range primitives — Python mirror of @qalaam/core/range."""

from __future__ import annotations

from collections.abc import Generator
from dataclasses import dataclass

from qalaam_core.errors import QalaamError
from qalaam_core.verse_key import (
    SURAH_AYAH_COUNTS,
    VerseKey,
    compare_verse_keys,
    parts_of,
    verse_count,
    verse_key,
    walk_verse_keys,
)


@dataclass(frozen=True, slots=True)
class AyahRange:
    """Inclusive `[start, end]` ayah range. Construct via `ayah_range`."""

    start: VerseKey
    end: VerseKey


def ayah_range(start: VerseKey, end: VerseKey) -> AyahRange:
    if compare_verse_keys(start, end) > 0:
        raise QalaamError(
            "qalaam.range.start-after-end",
            f"AyahRange: start ({start}) must precede or equal end ({end}).",
        )
    return AyahRange(start, end)


def contains(r: AyahRange, key: VerseKey) -> bool:
    return compare_verse_keys(r.start, key) <= 0 and compare_verse_keys(key, r.end) <= 0


def overlaps(a: AyahRange, b: AyahRange) -> bool:
    return compare_verse_keys(a.start, b.end) <= 0 and compare_verse_keys(b.start, a.end) <= 0


def _adjacent(prev: VerseKey, nxt: VerseKey) -> bool:
    p = parts_of(prev)
    n = parts_of(nxt)
    if p.surah == n.surah and n.ayah == p.ayah + 1:
        return True
    return n.surah == p.surah + 1 and n.ayah == 1 and p.ayah == SURAH_AYAH_COUNTS[p.surah]


def touches(a: AyahRange, b: AyahRange) -> bool:
    return _adjacent(a.end, b.start) or _adjacent(b.end, a.start)


def intersect(a: AyahRange, b: AyahRange) -> AyahRange | None:
    if not overlaps(a, b):
        return None
    start = a.start if compare_verse_keys(a.start, b.start) >= 0 else b.start
    end = a.end if compare_verse_keys(a.end, b.end) <= 0 else b.end
    return ayah_range(start, end)


def union(a: AyahRange, b: AyahRange) -> AyahRange:
    if not overlaps(a, b) and not touches(a, b):
        raise QalaamError(
            "qalaam.range.empty",
            f"union: ranges {a} and {b} are disjoint and don't touch.",
        )
    start = a.start if compare_verse_keys(a.start, b.start) <= 0 else b.start
    end = a.end if compare_verse_keys(a.end, b.end) >= 0 else b.end
    return ayah_range(start, end)


def size(r: AyahRange) -> int:
    return verse_count(r.start, r.end)


def walk(r: AyahRange) -> Generator[VerseKey, None, None]:
    yield from walk_verse_keys(r.start, r.end)
