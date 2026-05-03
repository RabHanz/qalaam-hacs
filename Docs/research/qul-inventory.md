# QUL — Inventory & Qalaam Ingestion Plan

**Last updated:** 2026-05-04
**Source:** TarteelAI/quranic-universal-library (https://github.com/TarteelAI/quranic-universal-library) + live audit at https://qul.tarteel.ai
**Linked ADR:** ADR-0020 (QUL deep ingestion strategy)

> Audit method: live WebFetch against `qul.tarteel.ai/resources/*` index pages and the QUL FAQ + Credits + launch blog. Counts are live-observed; anything not directly observed is marked **speculative**.

## 1. Inventory

| # | Resource (slug) | Count | Shape | License | Source URL pattern | Qalaam outcome |
|---|---|---|---|---|---|---|
| 1 | **Recitations + segments** (`/resources/recitation`) | 152 (90 unsegmented + 62 segmented) | Audio zip + JSON/SQLite segment table (ayah-by-ayah word timestamps); reciters incl. Husary, Mishary, Abdul Basit, Madinah & Makkah Taraweeh 1429–1442 | Per-resource; many sourced from EveryAyah/QuranicAudio (mostly free, attribution expected) | `/resources/recitation/{id}` → JS-triggered signed download | O-13 (audio control), O-06 (recite w/ feedback), O-08 (memorization with audio anchor) |
| 2 | **Mushaf layouts** (`/resources/mushaf-layout`) | 27 (12 active observed: Indopak 9/13/15/16-line, KFGQPC V1/V2/V4, Qatar, Nastaleeq, DigitalKhatt, Ligature SVG) | SQLite: `pages(page_number,line_number,line_type{ayah,surah_name,basmallah},alignment,first_word_id,last_word_id,surah)` + `words(word_index,word_key,surah,ayah,text)` | Per-layout; KFGQPC layouts have KFGQPC reuse terms | `/resources/mushaf-layout/{id}` → sqlite/zip/docx | **O-19** (Hifdh portion-splits — page/line is the canonical unit), O-04 |
| 3 | **Translations** (`/resources/translation`) | 209 (193 ayah + 16 word-by-word) | sqlite/json; nested-by-surah and key-value variants; footnote variants | Mixed; per-translation review | `/resources/translation/{id}` | O-04, O-18 |
| 4 | **Tafsirs** (`/resources/tafsir`) | 115 (32 Mukhtasar + 83 Detailed) | sqlite/json; ayah-grouping (multi-ayah blocks); Ibn Kathir, Tabari, Qurtubi, Saadi, Al-Mukhtasar in 30+ langs | Per-resource | `/resources/tafsir/{id}` | O-18 |
| 5 | **Quran scripts** (`/resources/quran-script`) | 28 (Uthmani simple/full, Imlaei, KFGQPC Hafs ± tajweed, QPC Nastaleeq, Indopak Nastaleeq, PDMS Saleem, DigitalKhatt v1/v2, V1/V2/V4 glyphs, tajweed images, black images) | sqlite/json; ayah-level + word-level; fields: `verse_key`, `text`, `script_type`, `words[]` with positions | KFGQPC scripts: KFGQPC terms; DigitalKhatt: Anane attribution | `/resources/quran-script/{id}` | O-04, O-19, O-06 |
| 6 | **Quran fonts** | 18 | TTF/OTF (glyph-based, Unicode, translation fonts) | Per-font; KFGQPC + DigitalKhatt are the headliners | Resources page link group | O-19 (page-perfect rendering) |
| 7 | **Quran metadata** (`/resources/quran-metadata`) | 8 (Surah names, Sajda, Ayah, Juz, Hizb, Rub, Manzil, Ruku) | sqlite/json; IDs 63–70 | Likely permissive (factual) | `/resources/quran-metadata/{63..70}` | **O-19** (Hifdh boundaries: ruku/hizb/manzil), O-04 |
| 8 | **Transliteration** (`/resources/transliteration`) | 8 observed (Syllables ×3, Turkish, English-Tajweed, English wbw, generic, RTF Updated) | sqlite/json | Per-resource | `/resources/transliteration/{id}` | O-06 (non-Arab learners), O-08 |
| 9 | **Surah info** (`/resources/surah-info`) | 9 (Tamil, Urdu, Indonesian, English, Italian, Malayalam observed) | csv/json/sqlite; revelation place + period + themes + key topics | Per-resource | `/resources/surah-info/{id}` (e.g. id=3 English, id=4 Urdu) | O-18 |
| 10 | **Ayah topics & concepts** (`/resources/ayah-topics`) | 2,512 topics | sqlite/json; topic→ayah mappings + semantic relations (relations field: **partly speculative**) | Likely community-curated | `/resources/ayah-topics/{id}` | O-04 (thematic search), O-18 |
| 11 | **Grammar/morphology** (`/resources/morphology`) | 77,429 entries | 6 SQLite tables: word-level + ayah-level for `root`, `lemma`, `stem`; POS data | **Source = Kais Dukes' Quranic Arabic Corpus + Mustafa Jibaly** (per Credits) — Corpus historically GPL-style; check before redistribution | `/resources/morphology/{id}` | O-18 (deep word study), O-08 (root-based memorization) |
| 12 | **Mutashabihat** (`/resources/mutashabihat`) | 5,277 phrase similarities | JSON (sqlite **speculative**) | Community-curated | `/resources/mutashabihat/{id}` | **O-08** (we use a slice — full set unlocks v2 review engine) |
| 13 | **Similar ayahs** (`/resources/similar-ayah`) | 4,001 ayah-level pairs | sqlite/json | Community-curated | `/resources/similar-ayah/{id}` | O-08 (cross-juz confusion management), O-18 |
| 14 | **Ayah themes** (`/resources/ayah-theme`) | 1,049 | sqlite | Community-curated | `/resources/ayah-theme/{id}` | O-04, O-18 |

**Not in QUL** (per Tarteel launch blog, verbatim): *"Tarteel's audio datasets and AI models are not part of the QUL offering."* — so no recitation-error labels and no Tarteel ASR weights.

## 2. Priority list (which 5–8 to ingest first)

Ranked by leverage on Hifdh-first outcomes (O-08, O-19) and gap vs. what we already ship:

1. **Mushaf layouts (#2)** — full set, especially KFGQPC V1/V2/V4 + Indopak 13/15/16-line. Hifdh users memorize *to a specific page layout*. **O-19 unlock.**
2. **Segmented recitations + word timestamps (#1, segmented subset only — ~62 reciters)** — biggest jump for O-06 (recite-with-feedback highlighting) and O-13. Husary + Minshawi + Abdul Basit Murattal are the Hifdh canonical set.
3. **Mutashabihat full 5,277 + Similar ayahs 4,001 (#12 + #13)** — full ingest powers the v2 confusion-resolution engine that Tarteel/Quranly *don't* ship. **O-08 differentiator.**
4. **Quran metadata bundle (#7)** — all 8 tables. Cheap, small, factual. Ruku/Hizb/Rub/Manzil required for proper Hifdh portion boundaries. **O-19 prerequisite.**
5. **Word-by-word translations (#3, the 16 wbw subset)** — pairs with morphology to enable per-word tap-translation. **O-18 + O-06.**
6. **Morphology/grammar (#11)** — high value but **license-gated** (see §3); ingest behind a feature flag pending license verification.
7. **Surah info (#9)** — 9 languages of "context cards" we currently lack; small, easy. **O-18.**
8. **Quran scripts: Indopak Nastaleeq + KFGQPC V4 with tajweed (#5)** — extends Uthmani-only support; non-Arab subcontinental users (a core Qalaam ICP) need Indopak. **O-19, family-aware UX.**

Defer: full 209 translations (we ship 3, more is bloat without UX), 115 tafsirs (same), fonts (license-heavy), ayah topics/themes (v3 thematic browsing).

## 3. License gotchas

QUL itself is **MIT** (the Rails app), but per FAQ verbatim: *"The resources available on QUL vary in their copyright status."* Per-resource license review is mandatory.

- **Morphology (#11)** — derived from Dr. Kais Dukes' Quranic Arabic Corpus (historically GPL with attribution clause). Treat as copyleft until confirmed; do NOT bundle into closed-source mobile binaries without clearance.
- **KFGQPC fonts + scripts + V1/V2/V4 layouts** — King Fahd Complex own terms (generally permissive for non-commercial Quran apps, restrictive on font modification). Required attribution: *"King Fahd Glorious Quran Printing Complex."*
- **DigitalKhatt fonts/scripts** — credit to Dr. Amin Anane required.
- **Recitations** — most sourced from EveryAyah/QuranicAudio. Reciter-by-reciter rights vary; cross-check against the playbook in `reference_2026_ai_stack.md` before shipping any reciter in a paid SaaS tier.
- **Translations** — Sahih International, Pickthall, Clear Quran (already shipped) understood. New ingests need per-translator review.
- **Tafsirs** — Ibn Kathir, Tabari, Qurtubi (Arabic originals) public domain; their *translations* often are not.
- **Tarteel's own ASR/audio datasets are NOT in QUL** — don't pull them from this repo.

**Operational rule:** every ingested resource row must carry `source_id`, `source_url`, `license`, `attribution_required` columns. No exceptions. Treat license as a first-class ingest field, not metadata.

## 4. Direct URL patterns

**Resource directory (human-browsable index):**
- Recitations: `/resources/recitation` → `/resources/recitation/{id}`
- Mushaf layouts: `/resources/mushaf-layout` → `/resources/mushaf-layout/{id}` (e.g. `/19` = KFGQPC V4 1441H, 604 pages × 15 lines)
- Translations: `/resources/translation` → `/resources/translation/{id}` (verified: 176 = Montada French, 295 = Rashid Maash French)
- Tafsirs: `/resources/tafsir` → `/resources/tafsir/{id}`
- Scripts: `/resources/quran-script` → `/resources/quran-script/{id}` (verified: 47 = V4 Glyphs Tajweed wbw, 48 = DigitalKhatt wbw, 56 = Uthmani wbw, 59 = Indopak Nastaleeq wbw)
- Metadata: `/resources/quran-metadata/{63..70}` (Surah, Sajda, Ayah, Juz, Hizb, Rub, Manzil, Ruku)
- Surah info: `/resources/surah-info/{id}` (id=3 English, id=4 Urdu confirmed)
- Topics: `/resources/ayah-topics/{id}`
- Morphology: `/resources/morphology/{id}` (6 datasets: word/ayah × root/stem/lemma)
- Mutashabihat: `/resources/mutashabihat/{id}`
- Similar ayahs: `/resources/similar-ayah/{id}`
- Ayah themes: `/resources/ayah-theme/{id}`
- Transliteration: `/resources/transliteration/{id}`

**File URLs:** `Download sqlite` / `Download json` buttons render `href="#_"` — actual URLs are produced client-side (likely Rails Active Storage signed URLs at `https://qul.tarteel.ai/rails/active_storage/blobs/redirect/{signed_id}/{filename}` — **path speculative until intercepted**). Two ingest paths:
1. **Headless-browser scrape** the detail page, click button, capture redirect.
2. **Self-host from the SQL dump** — repo ships a downloadable PostgreSQL dump containing "limited development data" (full prod data still requires scrape).

**No public REST/GraphQL API exists.** Per FAQ verbatim: *"Currently, QUL does not have an API."*

## Sources

- [QUL Repo](https://github.com/TarteelAI/quranic-universal-library)
- [QUL Homepage](https://qul.tarteel.ai)
- [QUL Resources Index](https://qul.tarteel.ai/resources)
- [QUL FAQ](https://qul.tarteel.ai/faq) — license + API answers verbatim
- [QUL Credits](https://qul.tarteel.ai/credits) — attribution map
- [Tarteel QUL Launch Blog](https://tarteel.ai/blog/qul-launch/)
