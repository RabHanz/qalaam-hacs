# `@qalaam/data-loader`

Local data substrate. Reads the vendored offline assets:

- **QUL SQLite** (`data/qul.sqlite`, MIT) — verses (multiple scripts), translations, tafsirs, recitations, audio segments, mushaf layouts, mutashabihat clusters.
- **cpfair/quran-align** (`data/quran-align/<reciter>.json`, CC-BY-4.0) — word-end timings.
- **quran/quran-tajweed** (`data/quran-tajweed.json`, CC-BY-4.0) — per-character tajweed annotations.

Per ADR-0002 + ADR-0010: this package is the offline-first contract. Online-only fallback to QUL/QF API lives in `@qalaam/api-client-ts`.

## Performance budget

- Verse lookup by `VerseKey`: **≤ 5 ms p95** (better-sqlite3 prepared statement).
- Audio-segment lookup for an ayah: **≤ 10 ms p95**.
- Mutashabihat cluster lookup by `VerseKey`: **≤ 20 ms p95**.

## Use

```ts
import { openQul } from '@qalaam/data-loader/qul';

const qul = openQul('data/qul.sqlite');
const verse = qul.getVerse(parseVerseKey('1:1'));
const segments = qul.getAudioSegments(parseVerseKey('1:1'), reciterId);
const cluster = qul.getMutashabihatCluster(parseVerseKey('2:255'));
```
