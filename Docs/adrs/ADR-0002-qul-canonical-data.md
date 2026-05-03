# ADR-0002: QUL (TarteelAI/quranic-universal-library) as canonical Quran data substrate

- **Status:** Accepted
- **Date:** 2026-05-02
- **Deciders:** Founder
- **Outcome served:** O-01 (mistake detection latency), O-05 (mutashabihat confusion), O-07 (long-term retention)
- **Consulted:** N/A
- **Informed:** Future contributors

## Context

Qalaam needs an offline-first canonical store for: Arabic text (multiple scripts: Uthmani, IndoPak, Imlaei, QPC Hafs), juz/hizb/page/ruku/manzil indices, mushaf layouts (Madani 15-line, Indo-Pak 16-line), word-level audio segment timestamps for at least the top 5 reciters, mutashabihat clusters, and root/morphology data — all under licenses that permit commercial redistribution in a SaaS product.

Quran.Foundation API is excellent for live calls but its ToS caps caching at 1 week, making it unsuitable as the offline substrate. Tanzil's text license requires email approval for commercial use. The community options surveyed in May 2026:

- **TarteelAI/quranic-universal-library (QUL)** — MIT-licensed, actively maintained (Quran.com 2.0 is built on it), provides everything above plus a `morphology_phrases` table that supersedes the older Mutashabihat JSON datasets.
- **AbdullahGhanem/quran-database** — no LICENSE (= no redistribution rights), data-integrity bug confirmed, abandoned. Audited and rejected.
- **fawazahmed0/quran-api** — Unlicense (PD), excellent for translations, weaker schema; complementary, not canonical.
- **cpfair/quran-tajweed** — CC-BY-4.0 but dormant since 2018-2019; replaced by QUL's tajweed data.
- **corpus.quran.com (Quranic Arabic Corpus)** — GPL copyleft on morphology — risky for commercial SaaS.

## Decision

We will use **QUL (TarteelAI/quranic-universal-library)** as the canonical offline data substrate, vendored as `data/qul.sqlite` via Git LFS. Live calls go to QF API as overlay (cache TTL ≤ 7 days per ToS); long-tail translations lazy-load from `fawazahmed0/quran-api` via jsDelivr. Audio MP3s lazy-download from `everyayah.com` per reciter selection.

## Alternatives considered

1. **fawazahmed0/quran-api as canonical store.** Tempting because PD-licensed and broad translation coverage. **Rejected because** schema is shallow (no mutashabihat, no word-level segments, no mushaf layouts).

2. **Build our own canonical store from Tanzil + scrapes.** **Rejected because** QUL has already done this work better, with Tarteel's resources and community goodwill, and is MIT-licensed.

3. **Live-only (no offline).** **Rejected because** O-03 (offline Hifdh) is opportunity = 16 (highest in §23.2) and Tarteel's #1 review complaint is internet dependency.

4. **AbdullahGhanem/quran-database.** **Rejected because** no LICENSE, abandoned, integrity bugs.

## Consequences

### Positive

- Single source of truth aligned with Quran.com 2.0 — same data backs the Quran.com web reader.
- MIT license clears commercial use unambiguously.
- Word-level segments + mutashabihat clusters arrive in one package — no stitching required.
- Updates to QUL (new reciters, layout corrections) propagate cleanly via `pnpm data:update`.

### Negative

- We're dependent on Tarteel's continued maintenance of QUL (mitigation: Tarteel is a well-funded org with community contributors; we contribute back to derisk).
- Initial `data/qul.sqlite` is ~200 MB compressed (Git LFS handles it).

### Neutral

- We must honor MIT attribution in the app's "Data Sources" screen.

## Risks & monitoring

- **Risk:** QUL stops being maintained. **Leading indicator:** > 60 days without a release on github.com/TarteelAI/quranic-universal-library. **Mitigation:** we already have a fork-and-maintain plan; the codebase is small and we have the expertise.
- **Risk:** QUL changes schema in a breaking way. **Leading indicator:** PR titles in the QUL repo containing "BREAKING". **Mitigation:** pin to a release tag in `scripts/data/download-qul.sh`; review schema changes before bumping.

## References

- Strategy doc: §4 Data foundation, §20.1 Open Quran data delta
- Memory: `reference_quran_data.md`
- External: https://qul.tarteel.ai, https://github.com/TarteelAI/quranic-universal-library
- Related ADRs: ADR-0008 (schema source of truth)
