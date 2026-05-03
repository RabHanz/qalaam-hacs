# ADR-0020: QUL deep ingestion — license-aware, per-resource sub-readers

- **Status:** Accepted
- **Date:** 2026-05-04
- **Deciders:** Qalaam maintainers
- **Outcome served:** O-04, O-08, O-13, O-18, O-19 (the bulk of the
  reader/Hifdh/deep-study surface)
- **Consulted:** ADR-0002 (QUL canonical data substrate)
- **Informed:** all engineering, all product

## Context

QUL (TarteelAI/quranic-universal-library, MIT-licensed Rails app at
https://qul.tarteel.ai) exposes ~14 distinct data resources with combined
counts of: 152 recitations (62 segmented), 27 mushaf layouts, 209
translations (16 word-by-word), 115 tafsirs, 28 quran-scripts, 8 metadata
tables (Surah/Sajda/Ayah/Juz/Hizb/Rub/Manzil/Ruku), 5,277 mutashabihat
phrases, 4,001 ayah-similarity pairs, 77,429 morphology entries, etc. Full
inventory in `Docs/research/qul-inventory.md`.

Qalaam v0.1 uses a thin slice (Uthmani text + basic mushaf layouts +
mutashabihat sample). The unused 90% includes everything we'd need for:
- Page-faithful reader on multiple mushaf layouts (KFGQPC V1/V2/V4,
  Indopak 9/13/15/16-line, Nastaleeq, DigitalKhatt) — required for O-19
  (Hifdh users memorize *to a specific layout*).
- Real ruku/hizb/rub/manzil boundaries for proper Hifdh portion-splits —
  v0.1 approximates with juz-only.
- Full 5,277-phrase mutashabihat + 4,001 ayah-similarity pairs to power
  the v2 confusion-resolution engine (the differentiator Tarteel + Quranly
  don't ship per `reference_competitive_ux.md`).
- Per-word tap-translation backed by 16 word-by-word translation packs +
  Quranic Arabic Corpus morphology (gpl-derivative — license-gated).
- 9-language surah-info "context cards" for the deep-study pane.
- Segmented recitations (62 reciters with word-level timestamps) for the
  recite-with-feedback word highlighter.

Two complications:

1. **Licensing varies per resource.** QUL's app is MIT, but per the QUL
   FAQ verbatim: *"The resources available on QUL vary in their copyright
   status. Some are in the public domain, while others may be subject to
   specific licenses."* Per the launch blog: *"The majority of the
   resources currently available in QUL were created or curated by the
   community, not Tarteel."* Bundling the morphology dataset (derived from
   Kais Dukes' Quranic Arabic Corpus, historically GPL with attribution
   clause) into a closed-source mobile binary would be a license violation.
2. **No public API exists.** Per the QUL FAQ: *"Currently, QUL does not
   have an API."* Download buttons render `href="#_"` and produce
   client-side signed URLs (likely Rails Active Storage). Ingestion
   requires either a headless-browser scrape or self-hosting from the
   PostgreSQL development dump in the QUL repo.

## Decision

We will ingest QUL into the existing `data/qul.sqlite` substrate as
**per-resource SQLite tables** prefixed `qalaam_v1_qul_*`, accessed via
**per-resource sub-reader objects** under `packages/data-loader/src/qul/`,
each carrying a typed `LicenseMetadata` so consumers can apply the right
bundling rules at compile time. The sub-readers compose into the existing
`QulReader` interface — no migration is required for v0.1 callers, the
new surface is additive.

License taxonomy (`packages/data-loader/src/qul/license.ts`):
`public-domain | factual | permissive-with-credit | kfgqpc-terms |
digitalkhatt-anane | gpl-derivative | per-translator | per-reciter |
unverified`. Helper `isBundleSafe(LicenseTag)` returns true only for the
first three; everything else requires explicit handling (typically:
service-side AGPL surfacing, or paid-tier gating with attribution).

Sub-readers landed in this ADR (as scaffolding; ingest scripts to
populate the tables follow in subsequent commits):

- `quran-metadata.ts` — Surah info / Juz / Hizb / Rub / Manzil / Ruku /
  Sajda. License: `factual`. Bundle-safe. **First concrete loader**:
  smallest payload, license-clean, unblocks Hifdh portion engine to use
  proper boundaries.
- `mutashabihat-extended.ts` — 5,277 phrase clusters + 4,001 ayah
  similarity pairs. License: `permissive-with-credit` (community
  curation; QUL attribution preserved). Powers the v2 confusion engine.
- `word-by-word.ts` — wbw translations + (gated) morphology. Translation
  surface: `permissive-with-credit` per pack. Morphology surface:
  `gpl-derivative` — refused by default, opt-in via
  `enableMorphology: true` only when the runtime context (e.g.,
  AGPL-licensed backend service) permits.

Mushaf layouts, segmented recitations, scripts (Indopak Nastaleeq + KFGQPC
V4), and surah-info follow in subsequent commits — same pattern.

Ingest scripts (`scripts/data/ingest-qul-*.ts`) attach the right
`LicenseMetadata` at row-write time. Every ingested row carries
`source_id`, `source_url`, `license`, `attribution_required` columns. No
exceptions. The ingest pipeline refuses to bundle anything still tagged
`unverified` into a production build.

## Alternatives considered

1. **Bundle ALL QUL resources into `data/qul.sqlite` indiscriminately.**
   **Rejected because** a single mismatched license (e.g., bundling
   morphology into the mobile app) is an irreversible legal exposure.
   Per-resource license tagging is mandatory.
2. **Pull QUL data live via a thin proxy of qul.tarteel.ai.** **Rejected
   because** QUL has no API; scraping the live site for every read would
   be slow, fragile, and a poor neighbour to a community resource. Local
   SQLite + periodic re-ingest is the right cadence.
3. **Switch the canonical substrate from QUL-SQLite to the QUL Postgres
   dump shipped in the repo.** **Rejected because** Postgres adds a
   runtime dep (Postgres server) for what's a read-mostly local cache;
   SQLite's zero-admin profile is better matched to mobile + edge deploy.
4. **One monolithic `QulReader` that surfaces every resource.**
   **Rejected because** the morphology surface alone is GPL-derivative —
   accidentally importing the wrong reader would taint downstream
   bundles. Per-resource sub-readers keep the license boundary in the
   type system, not in code review.

## Consequences

### Positive

- License classification is enforced in the type system: morphology
  cannot be surfaced without the caller affirming `enableMorphology: true`,
  forcing the conversation about bundle context.
- Sub-readers compose: a backend route can attach metadata + mutashabihat
  v2 + word-by-word in three lines without pulling the full QUL surface.
- Schema isolation (`qalaam_v1_qul_<resource>_*`) lets a QUL upstream bump
  land in one resource at a time without rippling through consumers.
- Inventory doc (`Docs/research/qul-inventory.md`) is the single source
  of truth for "what QUL has and what we use" — answers the recurring
  question without re-research.

### Negative

- Ingestion requires either headless scrape or working from the QUL
  repo's dev Postgres dump. Both are manual one-shot operations gated by
  human license review (per ADR-0002 SHA-pin philosophy).
- New sub-readers are not yet populated in `data/qul.sqlite` — the
  scaffolding lands in this ADR; rows arrive in follow-up commits. Until
  then, calling `metadata(...)` against an unpopulated DB throws
  `SQLITE_ERROR: no such table` (acceptable for scaffolding).

### Neutral

- `QulMushafLayoutRow.layout` literal union (`madani_15 | indopak_16 |
  uthmani_v1 | uthmani_v2`) will need to grow to cover the full QUL
  layout set. Done at use site, not in this ADR.

## Risks & monitoring

- **Risk:** new resource added to QUL upstream gets ingested without a
  license review. **Leading indicator:** `unverified`-tagged rows present
  in `data/qul.sqlite`. **Mitigation:** ingest pipeline refuses to bundle
  anything still tagged `unverified`; CI grep gate enforces.
- **Risk:** QUL changes a resource schema in a breaking way during a
  re-ingest. **Leading indicator:** ingest script's row-level validator
  raises. **Mitigation:** the `qalaam_v1_qul_*` table prefix means we
  don't auto-migrate the read-side; a schema change requires an explicit
  v2 view + migration ADR.
- **Risk:** active-storage signed URL pattern changes; scraper breaks.
  **Leading indicator:** ingest job 404. **Mitigation:** doc the scrape
  recipe in `Docs/research/qul-inventory.md` §4 and check it semi-annually.

## References

- Strategy doc section: `STRATEGY_AND_ROADMAP.md` §6 (data substrate),
  §21 (Hifdh methodology — ruku/hizb portion-splits)
- Inventory: `Docs/research/qul-inventory.md`
- Code: `packages/data-loader/src/qul/` (license.ts, quran-metadata.ts,
  mutashabihat-extended.ts, word-by-word.ts, index.ts)
- External: https://qul.tarteel.ai, https://github.com/TarteelAI/quranic-universal-library, https://qul.tarteel.ai/faq, https://qul.tarteel.ai/credits, https://tarteel.ai/blog/qul-launch/
- Related ADRs: ADR-0002 (QUL canonical), ADR-0011 (licensing)
