# QUL — Inventory & Qalaam Ingestion Plan

**Last updated:** 2026-05-04
**Source:** TarteelAI/quranic-universal-library (https://github.com/TarteelAI/quranic-universal-library) + live audit at https://qul.tarteel.ai
**Linked ADR:** ADR-0020 (QUL deep ingestion strategy)

> Audit method: live WebFetch against `qul.tarteel.ai/resources/*` index pages and the QUL FAQ + Credits + launch blog. Counts are live-observed; anything not directly observed is marked **speculative**.

## 1. Inventory

| #   | Resource (slug)                                       | Count                                                                                                                                                                     | Shape                                                                                                                                                                   | License                                                                                                                                    | Source URL pattern                                          | Qalaam outcome                                                                         |
| --- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1   | **Recitations + segments** (`/resources/recitation`)  | 152 (90 unsegmented + 62 segmented)                                                                                                                                       | Audio zip + JSON/SQLite segment table (ayah-by-ayah word timestamps); reciters incl. Husary, Mishary, Abdul Basit, Madinah & Makkah Taraweeh 1429–1442                  | Per-resource; many sourced from EveryAyah/QuranicAudio (mostly free, attribution expected)                                                 | `/resources/recitation/{id}` → JS-triggered signed download | O-13 (audio control), O-06 (recite w/ feedback), O-08 (memorization with audio anchor) |
| 2   | **Mushaf layouts** (`/resources/mushaf-layout`)       | 27 (12 active observed: Indopak 9/13/15/16-line, KFGQPC V1/V2/V4, Qatar, Nastaleeq, DigitalKhatt, Ligature SVG)                                                           | SQLite: `pages(page_number,line_number,line_type{ayah,surah_name,basmallah},alignment,first_word_id,last_word_id,surah)` + `words(word_index,word_key,surah,ayah,text)` | Per-layout; KFGQPC layouts have KFGQPC reuse terms                                                                                         | `/resources/mushaf-layout/{id}` → sqlite/zip/docx           | **O-19** (Hifdh portion-splits — page/line is the canonical unit), O-04                |
| 3   | **Translations** (`/resources/translation`)           | 209 (193 ayah + 16 word-by-word)                                                                                                                                          | sqlite/json; nested-by-surah and key-value variants; footnote variants                                                                                                  | Mixed; per-translation review                                                                                                              | `/resources/translation/{id}`                               | O-04, O-18                                                                             |
| 4   | **Tafsirs** (`/resources/tafsir`)                     | 115 (32 Mukhtasar + 83 Detailed)                                                                                                                                          | sqlite/json; ayah-grouping (multi-ayah blocks); Ibn Kathir, Tabari, Qurtubi, Saadi, Al-Mukhtasar in 30+ langs                                                           | Per-resource                                                                                                                               | `/resources/tafsir/{id}`                                    | O-18                                                                                   |
| 5   | **Quran scripts** (`/resources/quran-script`)         | 28 (Uthmani simple/full, Imlaei, KFGQPC Hafs ± tajweed, QPC Nastaleeq, Indopak Nastaleeq, PDMS Saleem, DigitalKhatt v1/v2, V1/V2/V4 glyphs, tajweed images, black images) | sqlite/json; ayah-level + word-level; fields: `verse_key`, `text`, `script_type`, `words[]` with positions                                                              | KFGQPC scripts: KFGQPC terms; DigitalKhatt: Anane attribution                                                                              | `/resources/quran-script/{id}`                              | O-04, O-19, O-06                                                                       |
| 6   | **Quran fonts**                                       | 18                                                                                                                                                                        | TTF/OTF (glyph-based, Unicode, translation fonts)                                                                                                                       | Per-font; KFGQPC + DigitalKhatt are the headliners                                                                                         | Resources page link group                                   | O-19 (page-perfect rendering)                                                          |
| 7   | **Quran metadata** (`/resources/quran-metadata`)      | 8 (Surah names, Sajda, Ayah, Juz, Hizb, Rub, Manzil, Ruku)                                                                                                                | sqlite/json; IDs 63–70                                                                                                                                                  | Likely permissive (factual)                                                                                                                | `/resources/quran-metadata/{63..70}`                        | **O-19** (Hifdh boundaries: ruku/hizb/manzil), O-04                                    |
| 8   | **Transliteration** (`/resources/transliteration`)    | 8 observed (Syllables ×3, Turkish, English-Tajweed, English wbw, generic, RTF Updated)                                                                                    | sqlite/json                                                                                                                                                             | Per-resource                                                                                                                               | `/resources/transliteration/{id}`                           | O-06 (non-Arab learners), O-08                                                         |
| 9   | **Surah info** (`/resources/surah-info`)              | 9 (Tamil, Urdu, Indonesian, English, Italian, Malayalam observed)                                                                                                         | csv/json/sqlite; revelation place + period + themes + key topics                                                                                                        | Per-resource                                                                                                                               | `/resources/surah-info/{id}` (e.g. id=3 English, id=4 Urdu) | O-18                                                                                   |
| 10  | **Ayah topics & concepts** (`/resources/ayah-topics`) | 2,512 topics                                                                                                                                                              | sqlite/json; topic→ayah mappings + semantic relations (relations field: **partly speculative**)                                                                         | Likely community-curated                                                                                                                   | `/resources/ayah-topics/{id}`                               | O-04 (thematic search), O-18                                                           |
| 11  | **Grammar/morphology** (`/resources/morphology`)      | 77,429 entries                                                                                                                                                            | 6 SQLite tables: word-level + ayah-level for `root`, `lemma`, `stem`; POS data                                                                                          | **Source = Kais Dukes' Quranic Arabic Corpus + Mustafa Jibaly** (per Credits) — Corpus historically GPL-style; check before redistribution | `/resources/morphology/{id}`                                | O-18 (deep word study), O-08 (root-based memorization)                                 |
| 12  | **Mutashabihat** (`/resources/mutashabihat`)          | 5,277 phrase similarities                                                                                                                                                 | JSON (sqlite **speculative**)                                                                                                                                           | Community-curated                                                                                                                          | `/resources/mutashabihat/{id}`                              | **O-08** (we use a slice — full set unlocks v2 review engine)                          |
| 13  | **Similar ayahs** (`/resources/similar-ayah`)         | 4,001 ayah-level pairs                                                                                                                                                    | sqlite/json                                                                                                                                                             | Community-curated                                                                                                                          | `/resources/similar-ayah/{id}`                              | O-08 (cross-juz confusion management), O-18                                            |
| 14  | **Ayah themes** (`/resources/ayah-theme`)             | 1,049                                                                                                                                                                     | sqlite                                                                                                                                                                  | Community-curated                                                                                                                          | `/resources/ayah-theme/{id}`                                | O-04, O-18                                                                             |

**Not in QUL** (per Tarteel launch blog, verbatim): _"Tarteel's audio datasets and AI models are not part of the QUL offering."_ — so no recitation-error labels and no Tarteel ASR weights.

## 2. Priority list (which 5–8 to ingest first)

Ranked by leverage on Hifdh-first outcomes (O-08, O-19) and gap vs. what we already ship:

1. **Mushaf layouts (#2)** — full set, especially KFGQPC V1/V2/V4 + Indopak 13/15/16-line. Hifdh users memorize _to a specific page layout_. **O-19 unlock.**
2. **Segmented recitations + word timestamps (#1, segmented subset only — ~62 reciters)** — biggest jump for O-06 (recite-with-feedback highlighting) and O-13. Husary + Minshawi + Abdul Basit Murattal are the Hifdh canonical set.
3. **Mutashabihat full 5,277 + Similar ayahs 4,001 (#12 + #13)** — full ingest powers the v2 confusion-resolution engine that Tarteel/Quranly _don't_ ship. **O-08 differentiator.**
4. **Quran metadata bundle (#7)** — all 8 tables. Cheap, small, factual. Ruku/Hizb/Rub/Manzil required for proper Hifdh portion boundaries. **O-19 prerequisite.**
5. **Word-by-word translations (#3, the 16 wbw subset)** — pairs with morphology to enable per-word tap-translation. **O-18 + O-06.**
6. **Morphology/grammar (#11)** — high value but **license-gated** (see §3); ingest behind a feature flag pending license verification.
7. **Surah info (#9)** — 9 languages of "context cards" we currently lack; small, easy. **O-18.**
8. **Quran scripts: Indopak Nastaleeq + KFGQPC V4 with tajweed (#5)** — extends Uthmani-only support; non-Arab subcontinental users (a core Qalaam ICP) need Indopak. **O-19, family-aware UX.**

Defer: full 209 translations (we ship 3, more is bloat without UX), 115 tafsirs (same), fonts (license-heavy), ayah topics/themes (v3 thematic browsing).

## 3. License gotchas

QUL itself is **MIT** (the Rails app), but per FAQ verbatim: _"The resources available on QUL vary in their copyright status."_ Per-resource license review is mandatory.

- **Morphology (#11)** — derived from Dr. Kais Dukes' Quranic Arabic Corpus (historically GPL with attribution clause). Treat as copyleft until confirmed; do NOT bundle into closed-source mobile binaries without clearance.
- **KFGQPC fonts + scripts + V1/V2/V4 layouts** — King Fahd Complex own terms (generally permissive for non-commercial Quran apps, restrictive on font modification). Required attribution: _"King Fahd Glorious Quran Printing Complex."_
- **DigitalKhatt fonts/scripts** — credit to Dr. Amin Anane required.
- **Recitations** — most sourced from EveryAyah/QuranicAudio. Reciter-by-reciter rights vary; cross-check against the playbook in `reference_2026_ai_stack.md` before shipping any reciter in a paid SaaS tier.
- **Translations** — Sahih International, Pickthall, Clear Quran (already shipped) understood. New ingests need per-translator review.
- **Tafsirs** — Ibn Kathir, Tabari, Qurtubi (Arabic originals) public domain; their _translations_ often are not.
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

**No public REST/GraphQL API exists.** Per FAQ verbatim: _"Currently, QUL does not have an API."_

## Sources

- [QUL Repo](https://github.com/TarteelAI/quranic-universal-library)
- [QUL Homepage](https://qul.tarteel.ai)
- [QUL Resources Index](https://qul.tarteel.ai/resources)
- [QUL FAQ](https://qul.tarteel.ai/faq) — license + API answers verbatim
- [QUL Credits](https://qul.tarteel.ai/credits) — attribution map
- [Tarteel QUL Launch Blog](https://tarteel.ai/blog/qul-launch/)

---

## 5. Live catalogue snapshot — 2026-05-06

Refreshed scrape of `https://qul.tarteel.ai/resources/*` (528 resources, 14 categories) cross-referenced against current Qalaam ingest tables. Replaces the §1 row counts where they diverge.

| Category          | QUL count | Qalaam current                                                     | Coverage gap              |
| ----------------- | --------: | ------------------------------------------------------------------ | ------------------------- |
| `ayah-theme`      |         1 | NOT INGESTED                                                       | 1                         |
| `ayah-topics`     |         1 | mostly ingested (61 topics, 802 verse mappings)                    | 0                         |
| `font`            |        17 | 2 self-hosted (UthmanicHafs, AlQuranIndoPak)                       | 15                        |
| `morphology`      |         6 | fully ingested (128k entries via QAC fork)                         | 0                         |
| `mushaf-layout`   |        12 | 3 (madani-15, kfgqpc-v1, kfgqpc-v4) + 1 image (madani-16)          | 8                         |
| `mutashabihat`    |         1 | fully ingested (19,385 pairs)                                      | 0                         |
| `quran-metadata`  |         8 | fully ingested (hizb / juz / manzil / rub / ruku / sajda / surahs) | 0                         |
| `quran-script`    |        28 | imlaei_simple + uthmani_simple in qul_scripts_ayahs                | 26 incl. QPC v1/v2/v4 PUA |
| `recitation`      |       133 | 51 reciters                                                        | 82                        |
| `similar-ayah`    |         1 | fully ingested (3,552 pairs)                                       | 0                         |
| `surah-info`      |         6 | 1 lang only (English, 456 rows)                                    | 5 langs                   |
| `tafsir`          |       108 | 7 ingested                                                         | 101                       |
| `translation`     |       198 | 59 ingested                                                        | 139                       |
| `transliteration` |         8 | 3 ingested                                                         | 5                         |

**Aggregate gap:** ~382 resources not yet ingested.

### Top 8 missing-by-leverage (priority order for §6)

1. **QPC v1 / v2 / v4 PUA scripts** (5 of 28 quran-scripts: ids 47, 57, 61, 80, 81). Unlocks per-page glyph fonts and the canonical KFGQPC Tajweed COLR rendering — single highest pedagogical lift. Pairs with the 604 per-page font files (currently NOT downloaded). Replaces our CSS-overlay-tajweed approximation with the canonical Quran-Foundation rendering used by Quran.com / Tarteel.
2. **Mushaf-layouts gap** (ids: `12` Indopak 15-line Qudratullah, `11` Indopak 16-line Taj, `8` KFGQPC Nastaleeq 15-line, `15` KFGQPC V1 1405H print, `10` KFGQPC V2 1421H print, `21` Digital Khatt KFGQPC V2 layout, `570` Mushaf Qatar, `571` Indopak 9-line Gaba, `236`/`313` Indopak 13-line). Sub-continental + Qatari Hifdh students memorize to specific page layouts.
3. **Recitations long-tail** (~82 reciters not in our 51-reciter set — segmented audio + word timestamps power recite-with-feedback for non-canonical reciters).
4. **Tafsirs (101 missing)** — multilingual Mukhtasar coverage (Russian, Indonesian, Sinhalese, Tamil, Bambara, etc.) and the Saadi/Tabari/Qurtubi Arabic + translated sets (ids 22-37, 262-485). Highest-leverage subset: `35` Ibn Kathir EN, `22` Ibn Kathir AR, `30` Ibn Kathir UR, `37` Tabari AR, `23` Qurtubi AR, `283/308/309/310/485/484/503` As-Saadi multilingual, `266/262` Al-Mukhtasar EN/RU.
5. **Translations long-tail (139 missing)** — Sahih International, Pickthall, Yusuf Ali variants, Indonesian Mokhtasar, Urdu Maududi, Turkish, French (Rashid Maash, Montada), German Zaidan, Malay, Tamil, Hindi, Farsi Makarem, Bengali, Somali, Swahili.
6. **Surah-info other 5 languages** (ids 4 Urdu, 5 Tamil, 6 Italian, 7 Malayalam, 454 Indonesian). Cheap ingest, big multilingual UX win.
7. **Ayah-themes** (id 62). Currently not ingested. ~1,049 entries powering thematic browsing.
8. **Fonts (15 missing)** — KFGQPC V1 / V2 / V4 page-by-page font sets, Me Quran (Madani Hafs), Digital Khatt V1/V2. Tied to QPC scripts above.

---

## 6. Action plan — 2026-05-06 → next session(s)

Sub-tasks tracked in TaskCreate (#201–#210, parent task #122):

| #             | Action                                                                                                                      | Status  |
| ------------- | --------------------------------------------------------------------------------------------------------------------------- | ------- |
| 122a (`#201`) | Live catalogue snapshot — this section                                                                                      | ✅      |
| 122b (`#202`) | Gap analysis vs Qalaam tables — this section                                                                                | ✅      |
| 122c (`#203`) | Ingest QPC v1 / v2 / v4 PUA scripts (quran-script ids 47, 57, 61, 80, 81)                                                   | ⏳ next |
| 122d (`#204`) | Self-host all 604 QPC V4 Tajweed page fonts (`https://verses.quran.foundation/fonts/quran/hafs/v4/colrv1/woff2/p{N}.woff2`) | ⏳      |
| 122e (`#205`) | Backend `/v1/qpc-text/:vk?layout=v1\|v2\|v4` returns PUA text + page number + fontFamily                                    | ⏳      |
| 122f (`#206`) | /read Tajweed mode renders PUA text with the matching per-page font (canonical KFGQPC tajweed)                              | ⏳      |
| 122g (`#207`) | Ingest 8 missing mushaf-layouts (Indopak 9/13/15/16, KFGQPC v1/v2 layouts, DigitalKhatt, Qatar)                             | ⏳      |
| 122h (`#208`) | License + SHA256 pin metadata → `qalaam_v1_data_sources`                                                                    | ⏳      |
| 122i (`#209`) | `/credits` page surfacing every QUL attribution                                                                             | ⏳      |
| 122j (`#210`) | Update DEV_CHECKLIST + STRATEGY_AND_ROADMAP §27.10                                                                          | ⏳      |

### Scraper extension list

The 36-resource priority list in `scripts/data/scrape-qul.sh` is being extended to cover the gaps above. New entries (full id table — file diff in this session):

```
# QPC PUA scripts (122c unlock)
quran-script    47  v4-tajweed-wbw          json
quran-script    57  qpc-v1-glyphs-wbw       json
quran-script    61  qpc-v2-glyphs-wbw       json
quran-script    80  qpc-v2-ayahs            json
quran-script    81  qpc-v1-ayahs            json

# Mushaf layouts (122g)
mushaf-layout    8  kfgqpc-nastaleeq-15     sqlite
mushaf-layout   11  indopak-16-taj          sqlite
mushaf-layout   12  indopak-15-qudratullah  sqlite
mushaf-layout   15  kfgqpc-v1-layout        sqlite
mushaf-layout   10  kfgqpc-v2-layout        sqlite
mushaf-layout   21  digital-khatt-layout    sqlite
mushaf-layout  570  mushaf-qatar            sqlite
mushaf-layout  571  indopak-9-gaba          sqlite
mushaf-layout  236  indopak-13-qudratullah  sqlite
mushaf-layout  313  indopak-13-taj          sqlite

# Surah-info other languages
surah-info       4  urdu                    json
surah-info       5  tamil                   json
surah-info       6  italian                 json
surah-info       7  malayalam               json
surah-info     454  indonesian              json

# Transliterations
transliteration 71  english-wbw             json
transliteration 72  generic                 json
transliteration 75  syllables-2             json
transliteration 76  syllables-old           json
transliteration 78  english-rtf-updated     json
transliteration 68  turkish                 json
transliteration 69  english-tajweed         json

# Ayah themes
ayah-theme      62  ayah-themes             json

# Tafsirs (top 12 by importance)
tafsir          22  ibn-kathir-ar           sqlite
tafsir          30  ibn-kathir-ur           sqlite
tafsir          31  ibn-kathir-bn           sqlite
tafsir          35  ibn-kathir-en           sqlite
tafsir          37  tabari-ar               sqlite
tafsir          23  qurtubi-ar              sqlite
tafsir         266  al-mukhtasar-en         sqlite
tafsir         262  al-mukhtasar-ru         sqlite
tafsir          24  saadi-ar                sqlite
tafsir          36  saadi-ru                sqlite
tafsir         283  saadi-sq                sqlite
tafsir         309  saadi-ur                sqlite

# Translations (top 20 multilingual)
translation     20  sahih-international-en  json
translation     85  pickthall-en            json
translation     22  yusuf-ali-en            json
translation    131  clear-quran-en          json
translation     27  mufti-taqi-en           json
translation     33  maududi-en              json
translation     54  indonesian-kemenag      json
translation     21  urdu-junagarhi          json
translation    158  urdu-maududi            json
translation     43  turkish-yazir           json
translation     65  french-rashid-maash     json
translation    176  french-montada          json
translation     63  spanish                 json
translation     86  german-zaidan           json
translation     97  malay                   json
translation    101  tamil                   json
translation    103  hindi-suhel             json
translation     59  farsi-makarem           json
translation     35  bengali-mokhtasar       json
translation     90  somali                  json
```

After scrape: `pnpm ingest:qul-extended` (new alias) walks the extended raw set and populates qalaam*v1*\*. Per-resource license review remains manual per ADR-0020.
