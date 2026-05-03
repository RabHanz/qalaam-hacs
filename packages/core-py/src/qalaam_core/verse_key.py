"""Verse-key primitives — Python mirror of @qalaam/core/verse-key.

Same canonical SURAH_AYAH_COUNTS table; same regex; same semantics. Parity with
the TS version is enforced by a cross-language CI test.
"""

from __future__ import annotations

import re
from collections.abc import Generator, Iterable
from dataclasses import dataclass
from typing import NewType, Final

from qalaam_core.errors import QalaamError

VerseKey = NewType("VerseKey", str)
"""A validated `"surah:ayah"` identifier. Construct only via `parse_verse_key` / `verse_key`."""

_VERSE_KEY_PATTERN: Final[re.Pattern[str]] = re.compile(
    r"^([1-9]|[1-9][0-9]|10[0-9]|11[0-4]):([1-9][0-9]{0,2})$"
)

# Canonical ayah counts per surah (1-indexed; index 0 unused).
# MUST match SURAH_AYAH_COUNTS in packages/core/src/verse-key/index.ts byte-for-byte.
SURAH_AYAH_COUNTS: Final[tuple[int, ...]] = (
    0,
    7, 286, 200, 176, 120, 165, 206, 75, 129, 109,
    123, 111, 43, 52, 99, 128, 111, 110, 98, 135,
    112, 78, 118, 64, 77, 227, 93, 88, 69, 60,
    34, 30, 73, 54, 45, 83, 182, 88, 75, 85,
    54, 53, 89, 59, 37, 35, 38, 29, 18, 45,
    60, 49, 62, 55, 78, 96, 29, 22, 24, 13,
    14, 11, 11, 18, 12, 12, 30, 52, 52, 44,
    28, 28, 20, 56, 40, 31, 50, 40, 46, 42,
    29, 19, 36, 25, 22, 17, 19, 26, 30, 20,
    15, 21, 11, 8, 8, 19, 5, 8, 8, 11,
    11, 8, 3, 9, 5, 4, 7, 3, 6, 3,
    5, 4, 5, 6,
)

TOTAL_VERSES: Final[int] = 6236
TOTAL_SURAHS: Final[int] = 114


@dataclass(frozen=True, slots=True)
class VerseKeyParts:
    surah: int
    ayah: int


def parse_verse_key(raw: str) -> VerseKey:
    """Parse and validate a `"surah:ayah"` string. Raises QalaamError on invalid input."""
    match = _VERSE_KEY_PATTERN.fullmatch(raw)
    if match is None:
        raise QalaamError(
            "qalaam.verse-key.invalid-format",
            f'Verse key must match "surah:ayah" with surah ∈ [1, 114]: got {raw!r}',
        )
    surah = int(match.group(1))
    ayah = int(match.group(2))
    _validate_bounds(surah, ayah)
    return VerseKey(raw)


def verse_key(surah: int, ayah: int) -> VerseKey:
    """Construct a validated VerseKey from numeric components."""
    _validate_bounds(surah, ayah)
    return VerseKey(f"{surah}:{ayah}")


def parts_of(key: VerseKey) -> VerseKeyParts:
    """Decompose a VerseKey into its parts."""
    s, a = key.split(":")
    return VerseKeyParts(surah=int(s), ayah=int(a))


def compare_verse_keys(a: VerseKey, b: VerseKey) -> int:
    """Lexicographic mushaf-order comparator. Returns -1/0/+1-style int."""
    pa = parts_of(a)
    pb = parts_of(b)
    if pa.surah != pb.surah:
        return pa.surah - pb.surah
    return pa.ayah - pb.ayah


def walk_verse_keys(start: VerseKey, end: VerseKey) -> Generator[VerseKey, None, None]:
    """Yield every verse key from start to end inclusive, in mushaf order."""
    if compare_verse_keys(start, end) > 0:
        raise QalaamError(
            "qalaam.range.start-after-end",
            f"walk_verse_keys: start ({start}) is after end ({end}).",
        )
    parts = parts_of(start)
    end_parts = parts_of(end)
    surah, ayah = parts.surah, parts.ayah
    while True:
        yield verse_key(surah, ayah)
        if surah == end_parts.surah and ayah == end_parts.ayah:
            return
        if ayah < SURAH_AYAH_COUNTS[surah]:
            ayah += 1
        else:
            surah += 1
            ayah = 1


def verse_count(start: VerseKey, end: VerseKey) -> int:
    """Inclusive count of verses between start and end."""
    if compare_verse_keys(start, end) > 0:
        raise QalaamError(
            "qalaam.range.start-after-end",
            f"verse_count: start ({start}) is after end ({end}).",
        )
    a = parts_of(start)
    b = parts_of(end)
    if a.surah == b.surah:
        return b.ayah - a.ayah + 1
    count = SURAH_AYAH_COUNTS[a.surah] - a.ayah + 1
    for s in range(a.surah + 1, b.surah):
        count += SURAH_AYAH_COUNTS[s]
    count += b.ayah
    return count


def _validate_bounds(surah: int, ayah: int) -> None:
    if not isinstance(surah, int) or surah < 1 or surah > TOTAL_SURAHS:
        raise QalaamError(
            "qalaam.verse-key.surah-out-of-range",
            f"Surah must be an integer in [1, {TOTAL_SURAHS}]; got {surah}",
        )
    max_ayah = SURAH_AYAH_COUNTS[surah]
    if not isinstance(ayah, int) or ayah < 1 or ayah > max_ayah:
        raise QalaamError(
            "qalaam.verse-key.ayah-out-of-range",
            f"Ayah must be an integer in [1, {max_ayah}] for surah {surah}; got {ayah}",
        )


def walk_iter(items: Iterable[VerseKey]) -> tuple[VerseKey, ...]:  # convenience for tests
    return tuple(items)
