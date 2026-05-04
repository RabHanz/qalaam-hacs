# `data/` — vendored offline datasets

Per ADR-0002. Files in this directory are downloaded by `make data-fetch` (root) and tracked via Git LFS (see `.gitattributes`).

## Contents

| Path | Source | License | Loaded by |
|---|---|---|---|
| `qul.sqlite` | TarteelAI/quranic-universal-library | MIT | `@qalaam/data-loader/qul` |
| `quran-align/<reciter>.json` | cpfair/quran-align v1.2 | CC-BY-4.0 | `@qalaam/data-loader/quran-align` |
| `quran-tajweed.json` | quran/quran-tajweed | CC-BY-4.0 | `@qalaam/data-loader/quran-tajweed` |

## Refresh

```bash
make data-fetch        # re-download anything missing
FORCE_REDOWNLOAD=1 make data-fetch   # re-download everything
```

## QUL bootstrap from public mini-dump (RECOMMENDED)

Per ADR-0020 + Docs/research/qul-inventory.md §4: the QUL Rails app
publishes a public Postgres dev dump at
`https://static-cdn.tarteel.ai/qul/mini-dumps/mini_quran_dev.sql.zip`.
This is the *legitimate* bootstrap path — no scraping required. It
covers chapters, verses, juz/hizb/rub/manzil/ruku/sajda metadata, and
word-by-word translations. The full mutashabihat + similar-ayah +
recitation-segments + mushaf-layouts datasets are NOT in the mini dump
— those still require the production dump (private) or a license-
reviewed scrape (per ADR-0020).

To run end-to-end:

```bash
# Spins a throwaway Postgres in Docker, restores the dump, exports the
# Qalaam-relevant resources to data/qul-source/, tears down the container.
./scripts/data/bootstrap-qul-from-dump.sh

# Now run the ingest scripts to populate data/qul.sqlite.
apps/backend/node_modules/.bin/tsx scripts/data/ingest-qul-metadata.ts
apps/backend/node_modules/.bin/tsx scripts/data/ingest-qul-mutashabihat-v2.ts
apps/backend/node_modules/.bin/tsx scripts/data/ingest-qul-wbw.ts
```

Each ingest script writes a row to `qalaam_v1_qul_ingest_log` with
`resource_slug`, `source_id`, `source_url`, `license`, `attribution`,
`source_sha256`, `row_count`, `ingested_at`. The build-time CI gate
(`assertIngestLogClean`) refuses to bundle any row tagged `unverified`
into a production build.

## QUL SHA pin (legacy — for the standalone qul.sqlite download)

`scripts/data/download-qul.sh` enforces a content-pinned SHA256 against the
QUL SQLite (per ADR-0002 risk mitigation). The pin must be set by a human
who has reviewed the QUL release notes — never by automated code or AI.

To bootstrap a brand-new pin:

```bash
export QUL_VERSION=<version>            # e.g., 2026-01
export QUL_URL=<actual-release-url>     # from https://qul.tarteel.ai/exports
export QALAAM_BOOTSTRAP_QUL=1
./scripts/data/download-qul.sh          # one-shot fetch (no SHA check)
./scripts/data/compute-qul-sha.sh       # prints SHA + integrity-check report
# Edit scripts/data/download-qul.sh: set QUL_SHA256=<value> from the output.
# Commit BOTH the URL and the SHA in the same change with the QUL release
# notes URL referenced in the commit message.
```

Subsequent fetches (without `QALAAM_BOOTSTRAP_QUL`) will fail-fast if the
downloaded SHA doesn't match the pinned value, blocking silent upstream
tamper or replacement.

## Attribution

Per the licenses above, the in-app "Settings → Data Sources" screen credits each upstream. See `THIRD_PARTY_NOTICES.md` for the full list. **Do not remove these credits.**

## Why these three

| Source | What it gives | What's NOT here |
|---|---|---|
| QUL | Arabic text (multiple scripts), juz/hizb/page indices, mushaf layouts, mutashabihat clusters, audio segments (top reciters) | Long-tail reciter audio segments |
| quran-align | Word-end timings for the long-tail reciters QUL hasn't covered yet | Mushaf metadata, mutashabihat |
| quran-tajweed | Per-character tajweed-rule annotations for Hafs Uthmani | All other riwayat |

For long-tail translations, `@qalaam/api-client-ts` lazy-fetches from `fawazahmed0/quran-api` (Unlicense) on demand — those don't ship in this directory.
