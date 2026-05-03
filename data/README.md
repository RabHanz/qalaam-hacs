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

## Attribution

Per the licenses above, the in-app "Settings → Data Sources" screen credits each upstream. See `THIRD_PARTY_NOTICES.md` for the full list. **Do not remove these credits.**

## Why these three

| Source | What it gives | What's NOT here |
|---|---|---|
| QUL | Arabic text (multiple scripts), juz/hizb/page indices, mushaf layouts, mutashabihat clusters, audio segments (top reciters) | Long-tail reciter audio segments |
| quran-align | Word-end timings for the long-tail reciters QUL hasn't covered yet | Mushaf metadata, mutashabihat |
| quran-tajweed | Per-character tajweed-rule annotations for Hafs Uthmani | All other riwayat |

For long-tail translations, `@qalaam/api-client-ts` lazy-fetches from `fawazahmed0/quran-api` (Unlicense) on demand — those don't ship in this directory.
