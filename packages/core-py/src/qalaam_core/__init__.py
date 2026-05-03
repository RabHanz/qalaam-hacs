"""qalaam-core — Python mirror of @qalaam/core.

Same primitives, same semantics. The TS version is the reference; this version
exists for Python services (HA integration, ASR/TTS workers, device-bridge)
per ADR-0009.
"""

from qalaam_core.errors import QalaamError, QalaamErrorCode
from qalaam_core.range import AyahRange, ayah_range, contains, intersect, overlaps, size, union, walk
from qalaam_core.verse_key import (
    SURAH_AYAH_COUNTS,
    TOTAL_SURAHS,
    TOTAL_VERSES,
    VerseKey,
    compare_verse_keys,
    parse_verse_key,
    parts_of,
    verse_count,
    verse_key,
    walk_verse_keys,
)

__all__ = [
    "AyahRange",
    "QalaamError",
    "QalaamErrorCode",
    "SURAH_AYAH_COUNTS",
    "TOTAL_SURAHS",
    "TOTAL_VERSES",
    "VerseKey",
    "ayah_range",
    "compare_verse_keys",
    "contains",
    "intersect",
    "overlaps",
    "parse_verse_key",
    "parts_of",
    "size",
    "union",
    "verse_count",
    "verse_key",
    "walk",
    "walk_verse_keys",
]
