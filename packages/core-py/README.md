# `qalaam-core` (Python)

Python mirror of `@qalaam/core` (TS). Same primitives, same semantics, same canonical surah-ayah-count table — required by the HA integration and Python sidecar services per ADR-0009.

Imports `qalaam-types` for the generated Pydantic models.

## Modules

- `qalaam_core.verse_key` — `VerseKey`, `parse_verse_key`, `verse_key`, `compare_verse_keys`, `walk_verse_keys`, `verse_count`.
- `qalaam_core.range` — `AyahRange`, `contains`, `overlaps`, `intersect`, `union`, `walk`, `size`.
- `qalaam_core.errors` — `QalaamError` with stable error codes (mirror of TS codes).

## Parity

A CI test (`tests/test_parity_with_ts.py`) runs a fixture set against both libraries and compares output byte-for-byte.
