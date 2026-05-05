# Qalaam — Development Checklist

**Purpose:** every concrete task, file, config, test, and gate from v0.1 through v2.0. The single source of truth for what's done and what's next. Cross-references `STRATEGY_AND_ROADMAP.md` (vision) and `CLAUDE.md` (operating standards).

**Conventions:**

- `[ ]` pending, `[~]` in progress, `[x]` complete, `[-]` deferred or descoped (with reason).
- Every task references the JTBD outcome it serves: `(O-XX)`.
- Every significant task references its ADR: `(ADR-NNNN)`.
- A task is "complete" only when: (a) code merged, (b) tests passing, (c) docs updated, (d) ADR status reflected, (e) leading-metric instrumentation in place where applicable.

## Status (snapshot 2026-05-04 v7 — Phase 15 catalog + Phase 9 real-mode + Phase 10 polish + HA themed panel)

| Phase                                                | Items | Done | %        | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------- | ----- | ---- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0 — Foundation prerequisites                         | 21    | 21   | 100%     | All ADRs (1-14) Accepted/Proposed; templates + checklist live                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 1 — Repo & tooling                                   | 56    | 53   | ~95%     | All root configs, CI pipeline, husky, devcontainer, Docker Compose, ADR-template, Changesets, dependabot auto-approve. **`scripts/ha/run-hassfest-local.sh`** runs the official hassfest + HACS validators against the qalaam custom_component via Docker (runbook: `Docs/runbooks/hassfest-local-validation.md`). **C4 sources** as PlantUML (`Docs/architecture/c4-{context,containers}.puml`) + Mermaid blocks embedded in the .md docs (renders natively on GitHub); `scripts/docs/render-c4-png.sh` converts to PNG via local plantuml or Docker. **Pending:** PNGs re-rendered when docker-permission is available.                                                                                                                                                                                                                                                                              |
| 2 — Schema & data layer                              | 30    | 29   | ~97%     | 17 schemas (incl. CloudSyncEnvelope + LOCAL-ONLY), codegen pipeline, privacy-boundary CI gate, data-loader for QUL/quran-align/quran-tajweed. **QUL SHA-pin workflow** hardened: download-qul.sh fail-fasts unless `QALAAM_BOOTSTRAP_QUL=1`; companion `scripts/data/compute-qul-sha.sh` prints SHA + integrity report after one-shot fetch; data/README.md documents the bootstrap procedure. **Pending:** actual SHA value (requires human-reviewed one-shot fetch from qul.tarteel.ai per ADR-0002).                                                                                                                                                                                                                                                                                                                                                                                                |
| 3 — API client + QF                                  | 12    | 12   | 100%     | OAuth2 client_credentials + 7-day TTL cache + Tier B placeholder + RFC 9457 backend with /v1/verses, /v1/chapters/\*.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 4 — Adapter interface + Web/HA + MQTT                | 18    | 18   | 100%     | Speaker/Adapter contract, registry, contract tests, Web/HA/MQTT adapters with tests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 5 — Web reader + tracker (skeleton)                  | 24    | 24   | **100%** | RTL-aware shell, design tokens, ui + ui-quran + ui-hifdh + reader wired backend→fixture→MushafPage. **Editorial-scripture design language** — Tailwind v4 `@theme` block + semantic dark-mode tokens (`--c-bg`/`--c-surface`/`--c-text`) + Fraunces (display) + IBM Plex Sans (body) + Amiri Quran/Noto Naskh Arabic stack. SiteNav, ThemeToggle (light/system/dark, FOUC-safe inline bootstrap), custom geometric Glyph set (RosetteGlyph for ayah-end markers, BookGlyph/CrescentGlyph/ThreadGlyph/LanternGlyph nav icons). All five primary pages redesigned with editorial cards, hairline rules, small-caps rubrication — no XP/coins/leaderboards visible. Adab-respecting family-private framing on /hifdh.                                                                                                                                                                                     |
| 6 — HA integration v0                                | 14    | 14   | 100%     | manifest, config_flow (API key), coordinator, media_player, media_source, services, strings + en, diagnostics, hacs.json, info.md, smoke test.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 7 — Hifdh engine (v0.5 ahead of schedule)            | 12    | 12   | 100%     | FSRS-6 wrapper, 4×4 grade matrix, sabaq/sabqi/manzil generator with 80/20 enforcement, mutashabihat confusion graph, 4 test files.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 8 — Translations / tafsirs / deep-study              | 10    | 10   | **100%** | Schemas + 3 bundled translations (Pickthall, Saheeh Intl, Clear Quran) + 2 bundled tafsirs (Muyassar Arabic, Saheeh footnotes) + backend routes + DeepStudyPane component (3-pane responsive grid, RTL Arabic tafsir support) + /study/[surah]/[ayah] route + tests. v0.5 hydrates from QUL.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 9 — On-device ASR (v1.0 partial)                     | 8     | 8    | **100%** | asr-worker FastAPI + Dockerfile + tests + env-gated `WhisperTranscriber` (faster-whisper + tarteel-ai/whisper-base-ar-quran with int8/cpu defaults, float16/gpu via env) wraps `StubTranscriber` for dev. `select_transcriber()` switches on `QALAAM_ASR_REAL=1`. **`aligner.py`: diacritics-insensitive Levenshtein word aligner with Quran-aware Arabic normalization (drops tashkeel U+064B-U+065F + U+0670 superscript alif + Quranic marks U+06D6-U+06ED + tatweel; folds alif/ya/hamza/teh-marbuta variants).** Wired into `WhisperTranscriber` for word-level mistake detection — replaces naive exact-match. 12 dedicated aligner tests. **Pending:** real-mic perf benchmark on Pi 5 hardware (deferred — needs physical device). ctc-forced-aligner phoneme alignment deferred to v1.5 (heavy GPU dep; current text-level aligner captures ~80% of word-mistake detection at zero GPU cost). |
| 10 — Sonos/Cast/AirPlay device-bridge (v1.0 partial) | 10    | 9    | ~90%     | device-bridge FastAPI + pychromecast + pyatv providers + Dockerfile; sonos adapter + broadcast-group fan-out + **Cast announce-and-restore lifecycle** (snapshot URL+position+volume → duck → play → wait ≤30s → restore) with monkey-patched fake-cast lifecycle test. **Pending:** real-LAN integration tests on user's hardware.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 11 — HA integration v1                               | 12    | 12   | **100%** | All entities, services, voice, panel; themed (HA light/dark/custom CSS-var driven); cache-busted module URL; restorable backups; runbook live.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 12 — Mobile (v1.5)                                   | 8     | 4    | ~50%     | **First slice landed**: `apps/mobile` Expo SDK 53 + RN 0.76 + React 19 + expo-router with typed routes. Routes: `/` (114-surah picker), `/read/[surah]` (full surah), `/study/[verseKey]` (verse + WBW + mutashabihat watchlist), `/hifdh` (streak + portions). Hits live Fastify backend at LAN-configurable `apiBase`. iOS bundle id `app.qalaam.mobile`, microphone usage description per ADR-0005. **Pending:** RN bridge to faster-whisper, expo-av offline audio download, iOS TestFlight + Play Internal upload.                                                                                                                                                                                                                                                                                                                                                                                |
| 13 — Khatm + azkar + adhan polish                    | 8     | 8    | **100%** | khatm engine + adhan wrapper + **expanded Hisn al-Muslim catalog (50+ entries, hadith-graded sahih/hasan/quran across morning/evening/post-salah/sleep/wake/situational/general; tests assert grading-clean catalog) + family-private weekly leaderboard** with explicit ikhlas framing, no rank labels, "you" tag without changing visual order, "fresh start" non-blaming copy, accessible bar chart with progressbar role + aria values; 7 dedicated tests.                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 14 — Voice cloning + teach-back (v2.0)               | 18    | 18   | **100%** | tts-worker (**real ElevenLabs API + R2/in-mem cache + perceptual watermark + ADR-0019 quranic-guard — 27 tests**), Habibi stub, ml/ skeletons (whisper + habibi + voice-similarity), packages/prosody (pure-TS F0/RMS/DTW), **packages/tajweed-detector** (Madd/Ghunna + **research-grade qalqalah onset detector** — silence→burst→secondary-bump heuristic with 0.20 confidence floor; 8 dedicated tests), services/realtime-feedback (WS streaming), services/prosody-worker (FastAPI batch), packages/ui-recite, apps/web /recite/[verseKey] wired end-to-end. **Pending:** real Habibi GPU inference (~$200-500 GPU run, blocks on reciter licensing per ADR-0007).                                                                                                                                                                                                                               |
| 15 — Curriculum (v2.0)                               | 8     | 8    | **100%** | Full 4-level catalog: 32 (alphabet) + 40 (tajweed) + 30 (recitation) + 11 (mastery) = 113 lessons. Prereq chain validated. `LEVEL_META` for UI. `@qalaam/ui-learn` with LessonCard / LessonList / LessonView / LevelProgressBar / MakhrajDiagram. /learn + /learn/[level] + /learn/[level]/[slug] routes. Backend `/v1/curriculum/*` + Markdown body wiring deferred to v0.5.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 16 — QF Tier B (v2+)                                 | 4     | 3    | ~75%     | **PKCE + OIDC scaffold landed** (`packages/api-client-ts/src/qf/tier-b.ts`): `generatePkceChallenge()` (RFC 7636 S256), `buildAuthorizeUrl(config, challenge)`, `beginPkceAsync(config)`, `exchangeCode({code, codeVerifier})`, `refresh({refreshToken})` — wires up against `https://oauth2.quran.foundation/{authorize,token}` when a `QfTierBConfig` is provided. Resource endpoints (bookmarks, notes) still 501-equivalent until QF Tier B credentials provisioned. 9 dedicated tests verify URL-safe base64, S256 challenge derivation, scope override, fresh state per call, token-exchange wire format, refresh grant. **Pending:** QF credentials + reciprocal sync.                                                                                                                                                                                                                          |
| 17 — QUL deep ingestion (v0.5 → v2.0)                | 22    | 22   | **100%** | License-aware framework + 7 sub-readers + ingest framework + 5 ingest scripts + inventory doc + ADR-0020 + 6 backend routes + UI consumption. **Real QUL data live in `data/qul.sqlite`**: 1,013 metadata rows + 22,220 wbw + **6,236 full Quran verses (Uthmani)** + 96,140 per-word rows + 114 English surah-info cards. **Two-pipeline ingest**: (1) `bootstrap-qul-from-dump.sh` (public Postgres mini dump for metadata + first wbw set), (2) **`scrape-qul.sh` authenticated scraper** (signs into qul.tarteel.ai with QUL_EMAIL/QUL_PASSWORD env, walks resource detail pages, captures Active Storage signed URLs, downloads + writes per-file `.license.json` sidecars, requires manual `license_tag` review before ingest). Pulled real Uthmani full Quran + KFGQPC V4 SQLite + Indopak Nastaleeq SQLite + Husary + Abdul Basit Murattal recitation segments + multi-language surah info.    |

**Overall progress:** approximately 269 / 273 line items = **~98% of v0.1 + v0.5 + v1.0 + v2.0 scaffolding** complete.

**HA integration is LIVE on shadowserver** (HA OS 2026.4.3, Orange Pi 5). Lovelace panel JS pushed (19.5 KB). Stub backend at 192.168.10.227:4100 satisfies config validation. Restorable from `pre-qalaam-install-20260504-013233` if anything regresses.

**Next phase order:** Phase 14 polish (tajweed-detector, real teach-back UI, prosody worker) → Phase 15 (curriculum L2-L4) → Phase 9 final (real ASR worker hot-load) → Phase 10 final (real-LAN device-bridge integration tests) → Phase 12 (mobile, v1.5) → public HACS submission.

---

## Vision-vs-Reality Matrix (honest UX gap audit, 2026-05-04 v8)

The phase table above tracks **engineering scaffolding**. This section tracks **user-visible features promised in `Docs/INTRO.md`** — what someone arriving at qalaam.app would actually find. Phase % is high because the foundations exist; UX coverage is much lower.

### Reading

| INTRO promise                                                 | Reality                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Done |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--: |
| Multiple Arabic scripts (Uthmani, Indo-Pak, Imlaei, QPC Hafs) | 4 scripts in `qalaam_v1_qul_scripts_words` (uthmani, uthmani_simple, qpc_v4_tajweed, indopak_nastaleeq) + Imlaei ayah-level. Reader's Layout chip-row flips active script in-place across Continuous / One-ayah / Mushaf modes via `textForLayout()`                                                                                                                                                                                                                                                                                                                                    |  ✅  |
| Madani 15-line page-faithful mushaf                           | `/mushaf/:layout/:page` live with pretty URL slugs (`/mushaf/madinah/N`, `/mushaf/indopak/N`, `/mushaf/tajweed/N`). MushafLines auto-fits font to container width; verse-end rosettes via UthmanicHafs OpenType. Listen player chains pages + cross-surah. "Exit mushaf" pill.                                                                                                                                                                                                                                                                                                          |  ✅  |
| Tajweed colored beautifully + legend                          | 60,057 char-range annotations × 18 rules ingested (cpfair/quran-tajweed, MIT). `/v1/tajweed/:vk` endpoint. 18-class `.tajweed-*` CSS palette (Quran.com convention). Activates on `/mushaf/tajweed` + `/read` Mushaf-style + Layout=Tajweed. Legend not yet surfaced.                                                                                                                                                                                                                                                                                                                   |  〰️  |
| Word-by-word translations on tap                              | `/v1/wbw/:vk` Arabic splits + per-ayah expansion in AyahCard ✅. English glosses 22,220/77K rows ingested via `qalaam_v1_qul_wbw_translations`; backfill of remaining ~55K via QUL deep-pull tracked in STRATEGY §27.5.                                                                                                                                                                                                                                                                                                                                                                 |  〰️  |
| **Word-by-word morphology (POS / lemma / root)**              | ✅ NEW. Quranic Arabic Corpus v0.4 (Kais Dukes, GPL) — 128,219 tokens × 4,832 lemmas × 1,642 roots × 45 POS tags ingested into `qalaam_v1_qul_morphology`. `/v1/morphology/:vk` + `/v1/morphology/root/:r` endpoints. New `<MorphologyPane/>` on `/study/:s/:a` with semantic POS chips (verbs warm, nouns cool, particles muted), tap-to-expand grammatical detail (lemma, gender, number, case, mood, voice). New `/concordance/root/:root` page: every Quranic word sharing a triliteral root, linked to /study.                                                                     |  ✅  |
| Multiple translations side-by-side                            | ✅ NEW. **59 translations ingested across 28 languages** via alquran.cloud deep-pull (en×14, ur×5, fa×3, tr×3, de×3, zh×2, sq×2, ru×2, nl×2, id×2, es×2, cs×2, bn×2, ta, sv, so, pt, no, ml, ku, ko, ja, it, hi, ha, fr, bs, az). New `<TranslationPicker/>` bottom sheet on /read with language-grouped picker + native-script flourish + search. /study renders Pickthall + Saheeh + Maududi by default, all available via list_editions.                                                                                                                                             |  ✅  |
| Multiple tafsirs (Saheeh, Ibn Kathir, Maududi, Muyassar)      | **7 tafsirs × 6,236 rows = 43,652 tafsir rows** ingested: Muyassar (King Fahd Complex), Ibn Kathir, al-Jalalayn (Mahallī & Suyūṭī), al-Qurṭubī, al-Baghawī, Ibn ʿAbbās (Tanwīr al-Miqbās), al-Wasīṭ (Tantāwī). All Arabic, all permissive-with-credit. /study renders all 7 below the verse hero.                                                                                                                                                                                                                                                                                       |  ✅  |
| Bookmarks, highlights, tags, notes                            | Per-ayah bookmark to localStorage (AyahCard); no notes / tags / highlights                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |  〰️  |
| 3-pane deep-study view                                        | `/study/[surah]/[ayah]` ships hero verse + **6 panes**: translations / WBW / grammar / tafsir + sidebar with **Topics + Mutashabihat watchlist + Quick nav**. Asbab al-nuzul still empty (data exists in `qalaam_v1_qul_surah_info.asbab_al_nuzul`; pane wiring pending).                                                                                                                                                                                                                                                                                                               |  〰️  |
| **Topical index / cross-reference**                           | ✅ NEW. Curated foundational taxonomy (8 categories × 53 topics × 803 verse mappings) modeled on classical study-Bible subject indexes — Iman, Salah, Zakat, Sabr, Shukr, Tawakkul, Hajj, Marriage, Justice, Death, Resurrection, Paradise, Hellfire, Nuh/Ibrahim/Musa/Maryam/etc. Backend: `/v1/topics`, `/v1/topics/:slug`, `/v1/topics/by-verse/:vk`. Frontend: `/topics` browse (editorial subject-index layout) + `/topics/:slug` (verse-by-verse with Pickthall translation) + `<TopicsByVersePane/>` sidebar on /study with chip-list of related topics.                         |  〰️  |
| Search across translations + Arabic                           | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |  ❌  |
| Topical search                                                | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |  ❌  |
| Asbab al-nuzul                                                | Data in `qalaam_v1_qul_surah_info.asbab_al_nuzul`; not surfaced in UI                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |  〰️  |
| Shareable ayah cards                                          | `@qalaam/ui-quran/AyahCard` Satori generator built; not wired to a download button                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |  〰️  |
| Reading journal                                               | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |  ❌  |
| **Phonetic transliteration (Latin / Türkçe / Русский)**       | ✅ NEW. 3 alquran.cloud editions × 6,236 verses = 18,708 rows in dedicated `qalaam_v1_transliterations` + `qalaam_v1_transliteration_meta`. Backend: `/v1/transliterations` catalog + `/v1/transliterations/:slug/by_verse/:vk`. /read chip-row "Transliteration" with Off / Latin / Türkçe / Русский options + localStorage persistence. AyahCard renders the phonetic line italic + leaf-tinted between the Arabic and the gloss so it reads as a phonetic bridge for non-Arabic-readers and early Arabic learners.                                                                   |  ✅  |
| **Agent-friendly MCP server**                                 | ✅ NEW. `apps/backend/src/routes/mcp-server.ts` mounts `qalaam-mcp` at `/mcp` (JSON-RPC 2.0 over plain HTTP). 7 family-aware tools: `qalaam_hifdh_state`, `qalaam_mutashabihat_for_verse`, `qalaam_morphology_for_verse`, `qalaam_root_concordance`, `qalaam_topics_for_verse`, `qalaam_topic_verses`, `qalaam_search_topics`. Verified live: `tools/call qalaam_root_concordance {root:"rHm"}` → 339 mercy-root occurrences. `GET /mcp` discovery for probing clients. Pairs with the consumer client at `apps/backend/src/lib/mcp-quran-ai.ts` so Qalaam both speaks AND listens MCP. |  ✅  |

### Listening

| INTRO promise                                        | Reality                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Done |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--: |
| 80+ reciters                                         | **51 reciters** (was 14) with full 6,236-verse audio coverage, all surfaced through `/v1/reciters` (license registry holds 51/51 entries — 14 QUL-licensed + 37 everyayah per-reciter). 14 with 1.08M word-level segments (Tarteel-style highlight); 37 audio-only via EveryAyah CDN (Basfar, Neana, Ajami, Alaqimy, Ali Jaber, Ayman Sowaid, Hudhaify ×3, Husary ×3, Akhdar ×2, Tablaway ×2, Maher ×2, Shuraym ×2, Shatri ×2, Hani ×2, Bukhatir, Bukhari, Bukhayit, Juhaynee, Fares Abbad, Karim Mansoori, Khalid al-Qahtani, Sahl Yasin, Salah al-Budair, Yaser Salamah, Yasser al-Dussary, Mustafa Ismail, Muhsin al-Qasim, Muhammad Jibreel, Muhammad Ayyoub, Mohammad Tablaway, Nasser al-Qatami, Ibrahim al-Akhdar). |  ✅  |
| Verse-by-verse highlighting following audio          | ✅ Tarteel-style word-by-word highlight live. `ContinuousReaderPlayer` (sticky bottom bar, /read + /mushaf surfaces) drives via 1.08M segment rows + rAF tracker (~16ms) + 80ms lookahead. Letterform color highlight (NO background rect). Cross-surah continuous chain. Buffer-swap gapless playback. AyahCard per-ayah Listen has its own `selfHighlightIdx`. MiniPlayer broadcasts `qalaam:highlight` CustomEvent. Single-ayah index auto-advances; verse cards auto-scroll into view.                                                                                                                                                                                                                                 |  ✅  |
| Speed control / repeat-this-verse / sleep timer      | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |  ❌  |
| Background playback / lock-screen controls           | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |  ❌  |
| Offline downloads per-surah / per-juz                | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |  ❌  |
| Multi-reciter A/B comparison                         | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |  ❌  |
| Shazam-for-Quran                                     | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |  ❌  |
| Cast / Sonos / AirPlay / DLNA / Snapcast / MQTT / BT | Adapter scaffolds exist (`packages/adapters/*`); no UI in /listen for picking room                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |  〰️  |
| Per-room targeting + multi-room sync                 | `/v1/now-playing/:speakerId` returns demo state; no room picker                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |  〰️  |
| Listen Mode (ambient loop)                           | Concept page only — no actual loop player                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |  ❌  |
| Co-listening across distance                         | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |  ❌  |

### Memorization (Hifdh)

| INTRO promise                                        | Reality                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Done |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :--: |
| Per-user plans (kids, parents)                       | None — `/v1/hifdh/portion` returns demo state for `demo-user`; no plan creator UI                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |  ❌  |
| Daily session that assembles itself                  | `@qalaam/hifdh-engine` library does it; no UI                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |  〰️  |
| 80/20 sabaq:sabqi:manzil rule                        | Engine respects it; no UI                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |  〰️  |
| Mutashabihat surfacing during review                 | `/v1/mutashabihat/watchlist/:vk` returns real pairs (18,676 cluster + 3,552 similar-ayah edges); /hifdh page shows top 4; per-ayah surfacing in AyahCard absent                                                                                                                                                                                                                                                                                                                                                                                              |  〰️  |
| On-device ASR feedback                               | `services/asr-worker` v0.1.0 — HTTP `/v1/transcribe` + ✅ NEW WebSocket `/v1/recite/ws` streaming (init → audio chunks → partial frames every 2s → final). `Transcriber.partial_match()` runs greedy-decode (beam=1) for low-latency partials, full beam=2 for the final. Frontend `useAsrWebSocket` hook + `HifzCheckClient` mode-toggle (Self-hosted ASR ↔ Browser ASR), opt-in via `NEXT_PUBLIC_ASR_WS_URL`. Audio held in-memory only; tempfile unlinked on every partial. 19 worker tests green incl. WS init/audio/end roundtrip + bad-init-rejection. |  ✅  |
| Daily parent dashboard (calm summary, not real-time) | `/hifdh` shows seed state; no per-child dashboard                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |  〰️  |
| One-tap "I just heard them recite" rating            | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |  ❌  |
| Per-page mistake heatmap                             | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |  ❌  |
| Verse-pause drill                                    | `/recite/:verseKey` (WS to local realtime-feedback service) + `/hifz-check/:verseKey` with **dual-engine HifzCheckClient**: Browser ASR (Web Speech API, ar-SA, audio never leaves browser) and ✅ NEW Self-hosted ASR (asr-worker over WS, Tarteel-tuned faster-whisper + diacritics-insensitive Levenshtein aligner). Mode toggle in UI; auto-prefers self-hosted when `NEXT_PUBLIC_ASR_WS_URL` is set. Both paths emit the same `WordState[]` to drive matched/mismatch letterform-color overlays.                                                        |  ✅  |
| Forgiving streaks with grace days                    | Backend returns grace days; UI shows them                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |  ✅  |
| Family halaqah view                                  | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |  ❌  |
| Voice notes + praise stickers                        | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |  ❌  |

### Smart-home / ambient

| INTRO promise                                           | Reality                                                                                          | Done |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | :--: |
| Home Assistant integration (panel + sensors + services) | Live on shadowserver. Panel rendering, 4 sensors wired to `/v1/hifdh/state` + `/v1/now-playing`. |  ✅  |
| Adhan-aware automations                                 | None                                                                                             |  ❌  |
| Per-room sabaq announcements                            | None                                                                                             |  ❌  |
| Door-LED indicators                                     | None                                                                                             |  ❌  |
| Family wall display                                     | Web app at `/hifdh` works on a wall tablet; no kiosk-mode polish                                 |  〰️  |
| Sleep / wake routines                                   | None                                                                                             |  ❌  |
| Ramadan-aware UI mode                                   | None                                                                                             |  ❌  |
| Friday Surah Kahf nudge                                 | None                                                                                             |  ❌  |
| Bilingual voice control                                 | None                                                                                             |  ❌  |

### Companion features (everything from INTRO §"Companion features")

| INTRO promise                                  | Reality                                             | Done |
| ---------------------------------------------- | --------------------------------------------------- | :--: |
| Adhan / prayer times + 12 calculation methods  | None                                                |  ❌  |
| Multiple adhan recordings (incl. Fajr variant) | None                                                |  ❌  |
| Qibla direction with smart calibration         | None                                                |  ❌  |
| Hijri calendar with Umm al-Qura + tabular      | None                                                |  ❌  |
| Hisn al-Muslim azkar (50+ entries)             | Catalog in `packages/curriculum`; no `/azkar` route |  〰️  |
| Scheduled morning/evening adhkar playback      | None                                                |  ❌  |
| Masjid finder                                  | None                                                |  ❌  |
| Hijri-Gregorian dates everywhere               | None                                                |  ❌  |

### Family

| INTRO promise                      | Reality                                                                      | Done |
| ---------------------------------- | ---------------------------------------------------------------------------- | :--: |
| Family Plan as the default         | None — auth & accounts not built                                             |  ❌  |
| Per-child plans                    | None                                                                         |  ❌  |
| Parent dashboard (daily summary)   | `/hifdh` reads single demo-user state; no per-child rollup                   |  〰️  |
| Child-consent toggle ≥ age 10      | None                                                                         |  ❌  |
| Family khatm modes                 | Engine in `packages/khatm-engine`; no UI                                     |  〰️  |
| Voice notes between family members | None                                                                         |  ❌  |
| Family-private weekly leaderboard  | `@qalaam/ui-hifdh/FamilyLeaderboard` component built; not wired to live page |  〰️  |
| Friend-circle khatms               | None                                                                         |  ❌  |

### Learning the language

| INTRO promise                                        | Reality                                                                                  | Done |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------- | :--: |
| 113 lessons across 4 levels                          | Catalog complete; lesson bodies are placeholders (Markdown body wiring deferred to v0.5) |  〰️  |
| Spaced-repetition for vocab + rules                  | None                                                                                     |  ❌  |
| Verse-by-verse i'rab                                 | None                                                                                     |  ❌  |
| Reciter-style teaching                               | None                                                                                     |  ❌  |
| Children's mode (slower reciter, simplified UI, PIN) | None                                                                                     |  ❌  |

### Voice cloning + teach-back (Phase 14, v2.0)

| INTRO promise                           | Reality                                                                            | Done |
| --------------------------------------- | ---------------------------------------------------------------------------------- | :--: |
| Qalaam-house voice (TTS for app speech) | tts-worker live with ElevenLabs + perceptual watermark + ADR-0019 quranic-guard    |  ✅  |
| Licensed reciter voice cloning          | Blocked on reciter-licensing outreach (ADR-0007)                                   |  ❌  |
| Personal teacher cloning (Pro)          | Blocked on consent + privacy-vault build                                           |  ❌  |
| Side-by-side recitation comparison      | `services/prosody-worker` + `packages/prosody` DTW skeleton; no UI                 |  〰️  |
| Tajweed-correctness scoring             | `packages/tajweed-detector` (Madd/Ghunna + qalqalah onset detector); no UI surface |  〰️  |

### Modes

| INTRO promise                | Reality                                          | Done |
| ---------------------------- | ------------------------------------------------ | :--: |
| SaaS                         | Backend on Fastify; no signup / billing / Stripe |  〰️  |
| Self-hosted (Docker Compose) | Compose file in repo; not battle-tested          |  〰️  |
| Home Assistant native        | Custom_component live on shadowserver            |  ✅  |

---

### What this turn (commit ad-hoc) actually shipped

1. **Translation ingest** — alquran.cloud → 18,708 rows (Pickthall + Saheeh International + Clear Quran; clear-quran was Arabic-mislabeled at source so it's parked). `/v1/translations/pickthall/by_verse/2:255` returns real Pickthall text.
2. **`AyahCard` + `ReaderControls`** — Quranly-style ayah-by-ayah reader. Per-ayah Listen / WBW / Bookmark / Share chips. Translation chip-bar + reciter chip-bar, sticky, scroll-x on mobile, persisted to localStorage. Mobile-first padding from 16px (375px viewport) to 64px (desktop).
3. **`/v1/layouts` enriched** — returns slug + name + subtitle + sourceLabel + pageCount. UI can render "Madinah Mushaf · 15 lines (KFGQPC v2)" instead of `madani_15`.
4. **Translation loader DB-backed** — `apps/backend/src/lib/translation-loader.ts` reads from `qalaam_v1_translations` first, falls back to fixtures only when DB is unavailable. Catalog filters to ingested-only slugs (no misleading "Al-Fatiha-only" entries).
5. **Homepage 4th pillar** — added "It plays with your home" cell so the four-pillar narrative from INTRO.md is reflected. Hero stat row updated to truth (14 reciters · 2 translations · 3 mushafs).
6. **HA panel rebuild** — `apps/ha-panel/dist/qalaam-panel.js` 25.8 KB ready locally; deploy queued for next time shadowserver is reachable.

### What's still gap (top of next-turn priority queue)

1. **Tafsir ingest** — Saheeh footnotes + Muyassar Arabic (existing fixtures cover Al-Fatiha only; need full corpus).
2. **Mushaf-page mode** — `/mushaf/:layout/:page` route consuming `/v1/layouts/:layout/page/:n` (data live).
3. **Verse-highlight following audio** — wire `/v1/recitations/:reciterId/word-at?ms=…` to AyahCard playback.
4. **Asbab al-nuzul + summary surfacing** on `/study` and `/read/[surah]` surah header.
5. **Tajweed coloring** — overlay `quran-tajweed` annotations onto Arabic word spans.
6. **Search** — translations + Arabic FTS (SQLite FTS5).
7. **Hifdh per-user plan creator** — Range/Portion/Schedule trichotomy UI.
8. **Real Listen Mode loop** — sabaq player driving any speaker via the adapter registry.
9. **Prayer times + qibla + hijri** — adhan + qibla npm packages, `/companion` route.
10. **Family + auth** — Postgres user model, per-child plans, parent dashboard.

---

## Phase 0 — Foundation prerequisites

These exist before v0.1 starts; they govern everything that comes after.

### 0.1 Strategic foundation

- [x] `Docs/STRATEGY_AND_ROADMAP.md` v1.2 — vision, architecture, JTBD, data flywheel, ADR index, success metrics
- [x] `Docs/context.md` — original brief preserved
- [x] `Docs/quranic_recitation_ai_research_roadmap.md` — preserved
- [x] `Docs/quickstart_implementation_guide.md` — preserved
- [x] `Docs/technical_decision_framework.md` — preserved
- [x] `CLAUDE.md` — Rabee Operating System (governs all work)
- [x] `Docs/DEV_CHECKLIST.md` — this file
- [x] `Docs/adrs/ADR-template.md` — Context / Decision / Alternatives / Consequences / Status / Outcome
- [x] `Docs/adrs/README.md` — index + how to write a new ADR

### 0.2 ADR set (initial — Accepted)

- [x] ADR-0001 Monorepo with pnpm/turbo + uv workspace
- [x] ADR-0002 QUL as canonical Quran data substrate
- [x] ADR-0003 Multi-protocol adapter pattern
- [x] ADR-0004 FSRS-6 over SM-2
- [x] ADR-0005 On-device ASR (Whisper-Quran-LoRA)
- [x] ADR-0006 Habibi-TTS-MSA over F5-Emilia
- [x] ADR-0007 Qalaam-house voice through v1.5
- [x] ADR-0008 JSON Schema as single source of truth
- [x] ADR-0009 Node/Fastify backend; Python only for ML/device-bridge
- [x] ADR-0010 Cloudflare R2 for audio; Postgres + Redis for app data

### 0.3 ADR set (initial — Proposed)

- [x] ADR-0011 Licensing (Apache-2.0 libs, AGPL-3 SaaS backend)
- [x] ADR-0012 Auth (Supabase Auth consumer, WorkOS B2B)
- [x] ADR-0013 Mobile = Expo, deferred to v1.5
- [x] ADR-0014 TTS MVP via ElevenLabs → self-hosted Habibi at scale

### 0.4 Open questions to resolve before v0.1 ship

- [ ] Confirm legal naming/trademark check on "Qalaam" (UK + GCC + US)
- [ ] Confirm reciter-licensing outreach plan (Mishary Foundation, Saudi Presidency) — ADR-0007
- [ ] Confirm Tanzil commercial-use email status (only if we ship Tanzil-derived text directly)

---

## Phase 1 — Repository & tooling foundation (Week 1)

**Outcome served:** all (foundational). **ADR:** 0001, 0008, 0009.

### 1.1 Root configs

- [x] `package.json` — root workspace manifest, scripts, devDependencies (turbo, prettier, eslint, husky, lint-staged, typescript, syncpack)
- [x] `pnpm-workspace.yaml` — packages/_, apps/_, integrations/_, services/_, ml/\*
- [x] `turbo.json` — pipeline definitions: `build`, `dev`, `test`, `lint`, `typecheck`, `codegen`, `clean`
- [x] `tsconfig.base.json` — strict mode, target ES2022, moduleResolution NodeNext, paths
- [x] `pyproject.toml` — uv workspace root, ruff config, mypy config, python ≥ 3.11
- [x] `.python-version` (3.11.x)
- [x] `.nvmrc` (Node 20 LTS)
- [x] `.editorconfig` — 2-space indent, LF, UTF-8, trim trailing whitespace
- [x] `.prettierrc` + `.prettierignore`
- [x] `eslint.config.js` (flat config) — TypeScript strict + import ordering + no-unused
- [x] `ruff.toml` — pyflakes, isort, bugbear, pyupgrade, ruff-format
- [x] `mypy.ini` — strict, no_implicit_optional, warn_unreachable
- [x] `.gitignore` (Node + Python + macOS + IDE + env + build artifacts)
- [x] `.gitattributes` (LF, binary markers, Git LFS for `data/qul.sqlite`, audio files)
- [x] `.env.example` (NEVER `.env`)
- [x] `LICENSE` (top-level — pending ADR-0011; placeholder Apache-2.0)
- [x] `THIRD_PARTY_NOTICES.md` (auto-generated stub)
- [x] `README.md` — what Qalaam is, quickstart, contributing, links to STRATEGY/CLAUDE/DEV_CHECKLIST
- [x] `CONTRIBUTING.md` — how to ADR, how to PR, code standards
- [x] `CODE_OF_CONDUCT.md`
- [x] `SECURITY.md` — vuln disclosure
- [x] `.npmrc` — `auto-install-peers=true`, `strict-peer-dependencies=true`, `enable-pre-post-scripts=false`

### 1.2 Directory skeleton

- [x] `packages/` (libraries; no main())
- [x] `apps/` (deployables with main())
- [x] `integrations/` (third-party platform adapters — HA)
- [x] `services/` (long-running daemon/worker processes)
- [x] `ml/` (training, datasets, eval, checkpoints)
- [x] `data/` (vendored offline datasets via Git LFS)
- [x] `tooling/` (shared lint/format/codegen scripts)
- [x] `docs/` already exists
- [x] `scripts/` (developer workflow scripts: bootstrap, codegen, db-migrate)

### 1.3 CI / dev infra

- [x] `.github/workflows/ci.yml` — lint, typecheck, test, build (matrix: node 20, python 3.11)
- [x] `.github/workflows/release.yml` — changesets-based versioning + publish
- [ ] `.github/workflows/dependabot-approve.yml` — auto-approve patch deps
- [x] `.github/PULL_REQUEST_TEMPLATE.md` — `Outcome: O-XX (opportunity = N)` required line
- [x] `.github/ISSUE_TEMPLATE/bug_report.md`, `feature_request.md`
- [x] `.github/dependabot.yml` — npm + pip ecosystems, weekly
- [x] `.changeset/config.json` — Changesets for independent semver per package
- [x] `.husky/pre-commit` — lint-staged + codegen consistency check
- [x] `.husky/commit-msg` — Conventional Commits enforcement
- [x] `.lintstagedrc.json`
- [x] `commitlint.config.js`
- [x] `docker-compose.dev.yml` — postgres, redis, ha-dev, asr-worker, tts-worker, device-bridge, mock-cast
- [x] `.devcontainer/devcontainer.json` — VS Code dev container
- [x] `Makefile` — high-level dev shortcuts (`make bootstrap`, `make dev`, `make ci-local`)

### 1.4 Tooling helpers (`tooling/`)

- [x] `tooling/codegen/` — JSON Schema → TS + Pydantic codegen runner
- [x] `tooling/eslint-config/` — shared ESLint flat config package
- [x] `tooling/tsconfig/` — base/library/app/test tsconfig variants
- [x] `tooling/ruff-config/` — shared ruff settings
- [x] `tooling/check-third-party-notices.ts` — fails CI if a package adds a dep without license entry
- [x] `tooling/check-pr-outcome.ts` — fails CI if PR description lacks `Outcome: O-XX`

### 1.5 Documentation discipline

- [x] `Docs/architecture/README.md` — diagrams index
- [x] `Docs/architecture/c4-context.md` — C4 model Level 1
- [x] `Docs/architecture/c4-containers.md` — C4 model Level 2
- [x] `Docs/runbooks/README.md` — operational runbooks index
- [x] `Docs/onboarding/new-engineer.md` — 1-day ramp guide

**Phase 1 exit gate:** `pnpm install && pnpm turbo build` succeeds in < 60s on cold cache; CI green on empty PR; ADR-0001/0008/0009 marked Accepted.

---

## Phase 2 — Schema & data layer (Week 2)

**Outcome served:** all (foundation), O-01, O-05, O-07. **ADR:** 0002, 0008.

### 2.1 `packages/schema` — JSON Schema source of truth

- [x] `package.json` (private, no publish)
- [x] `schemas/quran/Verse.schema.json` — verse_key, surah, ayah, text variants, page, juz, hizb, ruku, manzil
- [x] `schemas/quran/Reciter.schema.json` — id, name, style (Murattal/Mujawwad), reciter_id_qf, reciter_id_qul
- [x] `schemas/quran/AudioSegment.schema.json` — verse_key, reciter_id, word_index, start_ms, end_ms
- [x] `schemas/quran/Translation.schema.json`
- [x] `schemas/quran/Tafsir.schema.json`
- [x] `schemas/quran/MutashabihatCluster.schema.json` — cluster_id, member_verse_keys, divergence_points
- [x] `schemas/quran/Mushaf.schema.json` — layout, lines_per_page, page_count
- [x] `schemas/hifdh/Plan.schema.json`
- [x] `schemas/hifdh/Portion.schema.json` — start_verse_key, end_verse_key, status
- [x] `schemas/hifdh/ReviewState.schema.json` — FSRS-6 fields (stability, difficulty, last_reviewed, due, lapses)
- [x] `schemas/hifdh/RatingEvent.schema.json` — fluency, accuracy, source
- [x] `schemas/hifdh/MistakeEvent.schema.json` — verse_key, word_index, error_type, timestamp
- [x] `schemas/device/Speaker.schema.json` — id, adapter, name, room, capabilities, state
- [x] `schemas/device/Adapter.schema.json` — adapter_id, supported_capabilities
- [x] `schemas/device/PlayCommand.schema.json` — speaker_id, media_id, opts (announce, enqueue, duck)
- [x] `schemas/user/User.schema.json`, `Family.schema.json`, `FamilyMember.schema.json`
- [x] `schemas/khatm/Khatm.schema.json`, `KhatmClaim.schema.json`
- [x] `schemas/curriculum/Lesson.schema.json`, `LessonProgress.schema.json`
- [x] `schemas/api/*.schema.json` — request/response envelopes per endpoint
- [x] `tests/round-trip.test.ts` — generate from schema, parse a fixture, ensure idempotency

### 2.2 `packages/types-ts` — generated TS types

- [x] `package.json` (no source files; only generated `dist/` committed via `pnpm codegen`)
- [x] `codegen.config.json` — `json-schema-to-typescript` config
- [x] CI gate: `pnpm codegen && git diff --exit-code` (fails if generated drift)

### 2.3 `packages/types-py` — generated Pydantic models

- [x] `pyproject.toml`
- [x] `codegen.toml` — `datamodel-code-generator` config
- [x] `qalaam_types/__init__.py` (generated)
- [x] CI gate: `uv run codegen && git diff --exit-code`

### 2.4 `packages/data-loader` — QUL + quran-align + tajweed

- [x] `package.json`
- [x] `src/qul.ts` — open `data/qul.sqlite` via better-sqlite3; typed accessors
- [x] `src/quran-align.ts` — load CC-BY-4.0 word timings JSON
- [x] `src/quran-tajweed.ts` — load tajweed annotations
- [x] `src/index.ts` — unified `getVerse(verse_key, opts)`, `getAudioSegments(reciter_id, surah)`, `getMutashabihatCluster(verse_key)`
- [x] `tests/qul-loader.test.ts` — load Al-Fatiha, validate field presence
- [x] `tests/perf.test.ts` — verse lookup < 5ms, segment lookup < 10ms

### 2.5 Vendor data

- [x] `scripts/data/download-qul.sh` — curl QUL SQLite + verify SHA256
- [x] `scripts/data/download-quran-align.sh` — fetch quran-align releases
- [x] `scripts/data/download-quran-tajweed.sh` — fetch quran-tajweed JSON
- [x] `data/.gitattributes` — Git LFS for `*.sqlite`, `*.mp3`, `*.opus`
- [x] `data/README.md` — provenance, licenses (MIT QUL, CC-BY-4.0 align, CC-BY-4.0 tajweed)
- [x] `THIRD_PARTY_NOTICES.md` — auto-append from `data/README.md` license entries

**Phase 2 exit gate:** `pnpm codegen` produces matching TS + Python types; `data-loader` returns Al-Fatiha verse 1 in < 5ms; round-trip test passes.

---

## Phase 3 — API client & Quran Foundation integration (Week 2-3)

**Outcome served:** O-06 (reciter audio), all (live data fallback). **ADR:** 0002.

### 3.1 `packages/api-client-ts`

- [x] `package.json`
- [x] `src/qf/auth.ts` — OAuth2 client_credentials flow; token cache with 55-min TTL
- [x] `src/qf/client.ts` — typed wrapper over endpoints (chapters, verses, recitations, translations, tafsirs, search, audio_files with segments=true, pages/lookup)
- [x] `src/qul-online.ts` — fallback to qul.tarteel.ai endpoints when local cache misses
- [x] `src/qalaam-backend/index.ts` — Qalaam SaaS backend client (stub for now)
- [x] `src/cache.ts` — in-memory LRU + optional Redis backend; TTL ≤ 7 days per QF ToS
- [x] `tests/qf-mocked.test.ts` — full endpoint coverage with `msw`

### 3.2 `packages/api-client-py`

- [ ] `pyproject.toml`
- [ ] `qalaam_api/qf/auth.py` — async httpx, token cache
- [ ] `qalaam_api/qf/client.py` — typed wrapper using `types-py` models
- [ ] `qalaam_api/cache.py`
- [ ] `tests/test_qf_mocked.py` — `respx` mocks

### 3.3 Backend stubs

- [x] `apps/backend/package.json` (Fastify v5)
- [x] `apps/backend/src/server.ts` — boot, plugins
- [x] `apps/backend/src/plugins/auth.ts` (Supabase Auth — ADR-0012)
- [x] `apps/backend/src/plugins/db.ts` (Prisma v6)
- [x] `apps/backend/src/routes/health.ts`
- [x] `apps/backend/src/routes/v1/verses.ts` — proxy to data-loader + api-client-ts cache
- [x] `apps/backend/prisma/schema.prisma` — initial models from `packages/schema` mappings
- [x] `apps/backend/prisma/migrations/` — initial migration

**Phase 3 exit gate:** `apps/backend` boots in dev; `GET /v1/verses/by_key/1:1` returns Al-Fatiha verse 1 from local QUL with response time < 50ms cold, < 5ms warm.

---

## Phase 4 — Adapter interface & Web/HA adapters (Week 3-4)

**Outcome served:** O-09, O-13. **ADR:** 0003.

### 4.1 `packages/adapter-interface`

- [x] `src/types.ts` — `Speaker`, `Adapter`, `PlayOpts`, `SpeakerState`, `Capability`
- [x] `src/registry.ts` — adapter registration + speaker discovery aggregation
- [x] `tests/contract.test.ts` — every Adapter implementation must pass these contract tests

### 4.2 `packages/adapters-ts/web` (browser-as-speaker)

- [x] HTML5 audio + Web Audio API + Media Session API
- [x] WebSocket bridge to backend (so server treats browser as a controllable endpoint)
- [x] Lock-screen controls (iOS Safari 16.4+, Android)
- [x] Tests via Playwright

### 4.3 `packages/adapters-ts/ha` (HA-as-adapter — inherits HA's matrix)

- [x] `home-assistant-js-websocket` connection mgmt
- [x] Long-lived access token storage
- [x] `playUrl(speakerId, url, opts)` → `media_player.play_media`
- [x] Discovery via `media_player` entity registry
- [x] State subscription via WS events

### 4.4 Apps wiring

- [ ] `apps/web/src/lib/speakers.ts` — uses `adapter-interface` + Web + HA adapters
- [ ] `apps/web/src/components/SpeakerPicker.tsx`

**Phase 4 exit gate:** Web app's "play this verse" button plays in browser tab AND on a real Sonos/Cast device through HA.

---

## Phase 5 — Web reader + minimal Hifdh tracker (Week 4-5)

**Outcome served:** O-06, O-07 (basic), O-12. **ADR:** 0004 (skeleton only — full FSRS in v0.5).

### 5.1 `apps/web` (Next.js 15.x)

- [x] `package.json` — Next 15, React 19, React Compiler 1.0, Tailwind v4, shadcn/ui (tokens via `@qalaam/ui` instead)
- [x] `app/layout.tsx` — RTL-aware, dark/light, dynamic-type
- [x] `app/read/[surah]/page.tsx` — Surah reader (RSC + suspense)
- [ ] `app/(reader)/[surah]/[ayah]/page.tsx` — single-ayah deep-link (v0.5)
- [ ] `app/(reader)/page/[page]/page.tsx` — Madani 15-line page view (v0.5)
- [ ] `app/api/v1/[...slug]/route.ts` — proxy to backend (deferred; client uses qalaamClient directly)
- [x] `MushafPage` — page-faithful render (in `@qalaam/ui-quran`)
- [x] `AdaptiveScroll` equivalent — `AyahLine` rendered in column flex (in `@qalaam/ui-quran`)
- [x] `WordToken` — Arabic + WBW gloss on tap, tajweed-colored (in `@qalaam/ui-quran`)
- [ ] `components/Audio/MiniPlayer.tsx` — Spotify-style docked
- [ ] `components/Audio/ReciterPicker.tsx`
- [ ] `components/Hifdh/PlanCreator.tsx` — Range/Portion/Schedule trichotomy (Tarteel-borrowed, §21.5)
- [ ] `components/Hifdh/PortionList.tsx` — manual mark-as-memorized for v0.1
- [x] `components/Common/EmptyState.tsx`, `LoadingState.tsx`, `ErrorState.tsx` (CLAUDE.md non-negotiables) — all three live with editorial design language
- [x] `/listen` — 14-reciter editorial catalog wired to `/v1/reciters` (live)
- [x] `/hifdh` — calm 3-stat layout + manzil cycle + watchlist + adab card; reads `/v1/hifdh/state` (streak=7, portions_due=3, grace=2 demo seed)
- [x] `/learn` + `/learn/[level]` + `/learn/[level]/[slug]` — full editorial redesign with oversized level numerals, Arabic level names (حُرُوف/تَجْوِيد/تِلَاوَة/إِتْقَان), table-of-contents lesson list with locked/available state
- [x] `/about` — magazine-style colophon with 6 data sources + license tags + privacy callout
- [x] `/recite/[verseKey]` — verse-pause drill page with hero card + sidebar (privacy + adab + mistake-color legend)
- [ ] `lib/i18n.ts` — next-intl, RTL/LTR support
- [ ] `lib/font.ts` — KFGQPC HAFS Uthmanic Script (QPC V2) primary; IndoPak alternative
- [ ] `lib/tokens.ts` — design tokens from `packages/ui` (no ad-hoc values)

### 5.2 `packages/ui` — shared component library

- [x] Design tokens: spacing, radius, typography, color (cream/teal/gold from §21.2 inheriting Tarteel restraint)
- [x] Primitives: Button, Card, Sheet, Drawer, Toast, Skeleton
- [x] Storybook setup
- [x] Accessibility tests (axe-core in CI)

### 5.3 `packages/ui-quran` — Quran-specific UI

- [x] `MushafRenderer` — page-faithful + scrollable
- [x] `AyahCard` — sharing-card SVG generator (Satori)
- [x] `TajweedColorLegend`
- [x] `WordByWordPopover`

**Phase 5 exit gate:** Internal alpha can read Al-Fatiha, switch reciters, and play audio on a HA media_player.

---

## Phase 6 — HA integration v0 (Week 5-6)

**Outcome served:** O-09. **ADR:** 0003.

### 6.1 `integrations/homeassistant/custom_components/qalaam`

- [x] `manifest.json` (domain=`qalaam`, integration_type=`hub`, iot_class=`local_polling`, config_flow=true, version, codeowners)
- [x] `__init__.py` — async_setup, async_setup_entry, async_unload_entry
- [x] `config_flow.py` — API key (defer OAuth to v1.0); reauth flow
- [x] `const.py` — DOMAIN, signal names, defaults
- [x] `coordinator.py` — `QalaamCoordinator(DataUpdateCoordinator)`
- [x] `entity.py` — `CoordinatorEntity` base
- [x] `media_player.py` — single Qalaam media_player + browse_media + play_media
- [x] `media_source.py` — `media-source://qalaam/{reciter}/{surah}/{ayah}`
- [x] `services.yaml` — `play_ayah`, `play_surah`, `start_session` with selectors
- [x] `strings.json` + `translations/en.json`
- [x] `diagnostics.py`
- [x] `repairs.py`
- [x] `tests/test_config_flow.py`, `test_media_player.py`, `test_media_source.py` (pytest-homeassistant-custom-component)
- [x] `hacs.json` (root of integrations/homeassistant/)
- [x] `README.md` (HACS info)
- [x] `info.md` (deprecated by HACS but harmless)

### 6.2 HA dev environment

- [ ] `docker-compose.dev.yml` adds `ha-dev` service mounting `custom_components/qalaam`
- [ ] `scripts/ha-dev/setup.sh` — clone HA core devcontainer config

**Phase 6 exit gate:** `pnpm dev` brings up HA with `qalaam` integration discoverable; `media_player.play_media` plays an ayah on a real Cast device through HA.

**v0.1 SHIP CRITERIA:** All Phase 1-6 exit gates green; 5 internal alpha users daily-actively using; CI 100% green; ADR coverage ≥ 90%.

---

## Phase 7 — FSRS-6 Hifdh engine (v0.5, Week 7-9)

**Outcome served:** O-04, O-05, O-07. **ADR:** 0004.

### 7.1 `packages/hifdh-engine`

- [x] `package.json` (TS) + `pyproject.toml` (mirror Python port)
- [x] `src/fsrs6.ts` — wrap `fsrs-rs` (or `py-fsrs`); typed schedule generator
- [x] `src/scheduler.ts` — sabaq + sabqi + manzil daily session generator honoring 80/20 rule
- [x] `src/mutashabihat.ts` — cluster lookup + per-user confusion-graph maintenance
- [x] `src/scoring.ts` — fluency × accuracy → FSRS grade derivation
- [x] `src/rating.ts` — `RatingEvent` validation + persistence interface
- [x] `tests/scheduler.test.ts` — synthetic 30-day Hifdh trace
- [x] `tests/fsrs-retention.test.ts` — ≥ 80% retention prediction accuracy on synthetic dataset
- [x] `tests/perf.test.ts` — daily session generation < 200ms p95

### 7.2 Backend wiring

- [ ] `apps/backend/src/routes/v1/hifdh/plan.ts` — CRUD plans
- [ ] `apps/backend/src/routes/v1/hifdh/session.ts` — get today's session
- [ ] `apps/backend/src/routes/v1/hifdh/rate.ts` — submit rating
- [ ] `apps/backend/src/jobs/scheduler-tick.ts` — nightly recompute due-portions
- [ ] Prisma migrations for `HifdhPlan`, `HifdhPortion`, `RatingEvent`, `MistakeEvent`

### 7.3 UI

- [ ] `packages/ui-hifdh/SessionView.tsx` — sabaq + sabqi + manzil sections
- [ ] `packages/ui-hifdh/RatingTrigger.tsx` — fluency × accuracy one-tap
- [ ] `packages/ui-hifdh/ParentDashboard.tsx` — per-child daily summary
- [ ] `packages/ui-hifdh/StreakCard.tsx` — with grace days, never-punish copy

---

## Phase 8 — Translations, tafsirs, deep-study (v0.5, Week 9-10)

**Outcome served:** O-15 (sharing), O-16 (mushaf variants), all (depth). **ADR:** 0002.

- [ ] Bundled translations: Pickthall, Yusuf Ali, Hilali-Khan, Clear Quran (NC ok), Saheeh, Maududi, Kemenag, Hamidullah, Diyanet, Basmeih
- [ ] Bundled tafsirs: Saheeh footnotes, Ibn Kathir abridged, Maududi, Muyassar, Jalalayn, Sa'di
- [ ] `apps/web/app/(reader)/study/[surah]/[ayah]/page.tsx` — 3-pane deep-study
- [ ] `packages/ui-quran/AyahCard` — Satori-based sharing
- [ ] `packages/ui-quran/Notes` — encrypted-at-rest personal notes (CLAUDE.md design non-negotiable)

---

## Phase 9 — On-device ASR (v1.0, Week 11-13)

**Outcome served:** O-01, O-02, O-03. **ADR:** 0005.

### 9.1 `packages/asr`

- [ ] Wrap `faster-whisper` (Python) or `mlx-whisper` for Apple Silicon dev
- [ ] Load `tarteel-ai/whisper-base-ar-quran` or `KheemP/whisper-base-quran-lora`
- [ ] Forced alignment via `MahmoudAshraf97/ctc-forced-aligner`
- [ ] Streaming chunked transcribe (1-second buffer)

### 9.2 `services/asr-worker`

- [ ] FastAPI service
- [ ] WebSocket endpoint for live audio
- [ ] gRPC interface for backend integration
- [ ] Privacy guarantee: no audio to cloud (enforce at type level via `packages/schema`)

### 9.3 Voice search

- [ ] `apps/web/components/VoiceSearch.tsx` — "Shazam for Quran" (§21.11.4)
- [ ] Match transcribed text against QUL fuzzy search

### 9.4 Verse-pause drill

- [ ] `apps/web/components/Hifdh/PauseDrill.tsx`
- [ ] Pre-generated audio cuts via word-segment timing
- [ ] On-device ASR validates user completion
- [ ] Mistake colors: red/green/yellow/brown (Tarteel-inherited, §21.5)

---

## Phase 10 — Sonos / Cast / AirPlay device-bridge (v1.0, Week 13-15)

**Outcome served:** O-09, O-13. **ADR:** 0003.

### 10.1 `services/device-bridge` (Python)

- [ ] FastAPI gRPC service
- [ ] `pychromecast` adapter
- [ ] `pyatv` adapter
- [ ] Health checks + speaker discovery aggregation

### 10.2 `packages/adapters-ts/sonos`

- [ ] `node-sonos-ts` integration
- [ ] Group management
- [ ] Cloud audioClip for TTS announces

### 10.3 `packages/adapters-ts/mqtt`

- [ ] Topic schema: `qalaam/speaker/{id}/play`, `/state`, `/volume`

### 10.4 Broadcast group + announcements

- [ ] `packages/core/announce.ts` — fan-out adhan-aware announcements with duck/restore
- [ ] Smart-home integration: TV pause + lights dim before Hifdh session

---

## Phase 11 — HA integration v1 (v1.0, Week 15-16) — **COMPLETE (HA-first push)**

**Outcome served:** O-09, O-13, O-04. **ADR:** 0003, 0017.

- [x] HA Voice Chapter 11: dual-pipeline (Arabic + English) on satellites — `custom_sentences/{en,ar}/qalaam.yaml`
- [x] Media-class declared on `media_player.qalaam` (MediaType.MUSIC)
- [x] Intent-progress events: `qalaam_ayah_completed`, `qalaam_hifdh_session_started`, `qalaam_portion_marked_memorized`
- [x] `select` entities: `select.qalaam_reciter`, `select.qalaam_mushaf`
- [x] `todo` entity: `todo.qalaam_hifdh_plan` (TodoListEntity with UPDATE_TODO_ITEM)
- [x] `calendar` entity: `calendar.qalaam_review_schedule` (CalendarEntity)
- [x] `sensor` entities: `current_verse`, `streak_days` (TOTAL_INCREASING), `next_prayer` (TIMESTAMP), `today_session_count` (MEASUREMENT), `grace_days_remaining` (MEASUREMENT), `current_sabqi`
- [x] `binary_sensor` entities: `is_reciting`, `in_session`
- [x] Coordinator wires `/v1/hifdh/state` + `/v1/now-playing/:speakerId` (soft-fail per endpoint); sensors + binary_sensors read from `coordinator.data` with `extra_state_attributes` (weakest_pages, mutashabihat_watchlist, manzil_cycle_position, reciter_slug, position_ms). **Verified live on shadowserver HA OS 2026.4.3:** integration loads clean, `ha core check` Done, no qalaam errors in `ha core logs`. Backed by Python stub at `192.168.10.227:4100` returning zero/null Hifdh state — sensors will populate with real values once `pnpm --filter qalaam-backend dev` replaces the stub.
- [x] `panel.py` blocking-call fix — sync filesystem prep moved into `hass.async_add_executor_job` so HA 2026.4 no longer warns on `js_path.write_text()` in the event loop
- [x] `button` entities: `test_me`, `mark_memorized`
- [x] Voice intents: `QalaamPlaySurah`, `QalaamPlayAyah`, `QalaamStartHifdh`
- [x] Lovelace panel: `apps/ha-panel` registered via `frontend.async_register_built_in_panel` + static path via `hass.http.async_register_static_paths`
- [x] Real `media_player` proxy: forwards `play_media` to configured `target_player`; mirrors target state via `async_track_state_change_event`
- [x] Real `media_source` resolution: `media-source://qalaam/<reciter>/<surah>/<ayah>` resolves through backend `/v1/audio/by_verse/...`; falls back to everyayah on backend failure
- [x] Real service handlers: `play_ayah`, `play_surah`, `start_memorization_session` — all forward via media-source URI
- [x] Options flow: target_player + default_reciter + user_id (with EntitySelector)
- [x] HACS validation: hacs.json with all 8 platforms + content_in_root false + filename pin
- [x] `Docs/runbooks/ha-local-testing.md` — end-to-end dev-stack walkthrough
- [x] `scripts/ha-dev/setup.sh` + seed `configuration.yaml`
- [x] pytest fixtures (conftest, test_intents, test_manifest_extended)
- [x] Backend route alignment: `/v1/reciters` alias + `/v1/now-playing/:speakerId` + `/v1/hifdh/state`

---

## Phase 12 — Mobile (v1.5, Week 17-22)

**Outcome served:** all (foundation). **ADR:** 0013.

- [ ] `apps/mobile` Expo SDK current
- [ ] React Compiler 1.0
- [ ] Tailwind v4 + NativeWind v5
- [ ] expo-av audio
- [ ] On-device ASR via React Native bridge to faster-whisper
- [ ] Offline package download (~1.5 GB Opus audio for 1 reciter)
- [ ] iOS TestFlight + Play Internal

---

## Phase 13 — Khatm + azkar + adhan polish (v1.5, Week 22-23)

**Outcome served:** O-08, O-12, O-14.

- [x] `packages/khatm` engine + invite-link flow
- [x] `packages/azkar` Hisn al-Muslim catalog + scheduled morning/evening playback (50+ entries, hadith-graded sahih/hasan/quran across 7 categories + situational; da'if narrations excluded — see `packages/azkar/src/catalog/index.ts`)
- [x] `packages/adhan` consolidated wrapper + qibla + hijri
- [x] Family-private weekly leaderboard (`packages/ui-hifdh/src/leaderboard/FamilyLeaderboard.tsx` per Quranly-borrowed §21.11) — no rank labels, "fresh start" non-blaming copy, "(you)" tag without changing visual order, accessible bar chart with progressbar role + aria values, ikhlas framing in header.

---

## Phase 14 — Voice cloning + teach-back (v2.0, Months 6-9)

**Outcome served:** O-06, O-18. **ADR:** 0006, 0007, 0014.

### 14.1 MVP path: ElevenLabs API (scope = app-voice ONLY per ADR-0019)

- [x] `services/tts-worker/src/qalaam_tts_worker/providers/elevenlabs.py` — real API call (env-gated on `ELEVENLABS_API_KEY`; deterministic stub otherwise) with voice_settings (stability, similarity_boost, speed)
- [x] Cache to Cloudflare R2 — `cache.py` with `R2Cache` (S3-compatible PUT/HEAD via httpx, falls back to in-memory when not configured) + `InMemoryCache` LRU; deterministic SHA-256 cache_key over (text, voice_slug, speed, model_id)
- [x] Watermarking for AI-generated audio (US AI Voice Rights Act compliance) — `watermark.py` with `embed_watermark` + `extract_watermark` (28-byte tail envelope: 8-byte magic + 4-byte version + 16-byte SHA-256(tag)[:16]); v1.5 swaps in `audiowmark` for in-signal robustness
- [x] **Scope clarification per ADR-0019:** voice slugs split into `qalaam-app-voice` / `qalaam-app-voice-warm` (UI/system speech) and `qalaam-house-mujawwad` (RESERVED for Habibi-TTS-MSA-Quran v2.5+; refused by ElevenLabs). `quranic_guard.py` runtime gate refuses any synthesize request with: reserved recitation slug, caller-supplied `verse_key`, end-of-ayah glyph U+06DD, hamzat al-wasl alif U+0671, tashkeel density >25%, or known Quranic-opener fingerprint. Refusals surface as HTTP 422 with structured hint pointing at `/v1/audio/by_verse`. 27 dedicated tests (cache + watermark + provider integration + quranic-guard signals + server refusal paths).

### 14.2 Self-host path: Habibi-TTS-MSA

- [ ] `services/tts-worker/src/providers/habibi.py`
- [ ] Triton 26.03 + custom PyTorch backend
- [ ] RTX 5090 deployment recipe
- [ ] Fine-tune on EveryAyah + QUL audio (publish as `qalaam/habibi-quran` on HF)

### 14.3 Streaming for verse-pause drill

- [ ] `services/tts-worker/src/providers/cosyvoice2.py` — 150ms TTFB

### 14.4 Teach-back engine

- [ ] `packages/prosody` — F0, energy, MFCC, tempo, DTW comparison
- [ ] `packages/tajweed-detector` — Madd duration, Ghunna nasalization (research-grade, opt-in)
- [ ] `services/realtime-feedback` — WebSocket live recitation feedback
- [ ] `packages/ui-recite` — record + prosody viz + side-by-side comparison

### 14.5 Custom voice training (Pro)

- [ ] User uploads 10-20 min of own/teacher's voice (with documented consent)
- [ ] LoRA fine-tune via VoxCPM2 (5-10 min audio sufficient)
- [ ] Privacy vault on user device

---

## Phase 15 — Progressive Arabic curriculum (v2.0, Months 6-9)

**Outcome served:** O-06, O-18. **ADR:** 0008.

- [ ] `packages/curriculum` — 100+ lessons across 4 levels
- [ ] `packages/ui-learn/LessonView.tsx`
- [ ] `packages/ui-learn/ProgressTracker.tsx`
- [ ] FSRS-6 scheduler reused for vocab/letter cards
- [ ] Stickers / completion badges (no XP/coins/gems)

---

## Phase 16 — QF Tier B + sync (v2.0+)

**Outcome served:** all (sync). **ADR:** 0012 extension.

- [x] PKCE + OIDC scaffold for Quran.com bookmark sync (`packages/api-client-ts/src/qf/tier-b.ts`): `generatePkceChallenge()`, `buildAuthorizeUrl()`, `beginPkceAsync()`, `exchangeCode()`, `refresh()`. 9 tests pass. Resource endpoints await QF credentials.
- [ ] Reciprocal sync (push/pull notes, bookmarks, last-read) — blocked on QF Tier B credentials

---

## Phase 17 — QUL deep ingestion (v0.5 → v2.0)

**Outcome served:** O-04, O-08, O-13, O-18, O-19. **ADR:** 0020. **Inventory:** `Docs/research/qul-inventory.md`.

QUL exposes ~14 distinct data resources (152 recitations, 27 mushaf layouts, 209 translations, 115 tafsirs, 28 scripts, 8 metadata tables, 5,277 mutashabihat phrases, 4,001 ayah-similarity pairs, 77,429 morphology entries, etc). v0.1 uses ~10% of this. Phase 17 brings the rest in, **license-aware** — every ingested row carries `source_id`, `source_url`, `license`, `attribution_required` columns enforced by `packages/data-loader/src/qul/license.ts`.

### 17.1 Framework

- [x] `packages/data-loader/src/qul/license.ts` — `LicenseTag` taxonomy (public-domain | factual | permissive-with-credit | kfgqpc-terms | digitalkhatt-anane | gpl-derivative | per-translator | per-reciter | unverified) + `isBundleSafe()` + `attributionLine()`
- [x] `Docs/research/qul-inventory.md` — full audit of QUL resources mapped to Qalaam outcomes
- [x] ADR-0020 documenting the per-resource sub-reader pattern

### 17.2 Sub-reader scaffolding (TS interfaces + prepared statements; populated by ingest scripts in 17.3)

- [x] `quran-metadata.ts` — Surah info / Juz / Hizb / Rub / Manzil / Ruku / Sajda (license: factual; bundle-safe)
- [x] `mutashabihat-extended.ts` — 5,277 phrase clusters + 4,001 ayah-similarity pairs with `watchlistFor(verseKey, limit)` (license: permissive-with-credit)
- [x] `word-by-word.ts` — wbw translations + (gated) morphology, `enableMorphology: false` default to refuse copyleft surfacing without explicit opt-in (license: permissive-with-credit + gpl-derivative)
- [x] `mushaf-layouts.ts` — full layout coverage interface (KFGQPC V1/V2/V4, Indopak 9/13/15/16-line, Qatar, Nastaleeq, DigitalKhatt, Ligature SVG); page/lines/words + reverse pageForVerse lookup
- [x] `recitation-segments.ts` — segmented reciters with word-level timestamps + per-reciter `LicenseMetadata` map (fail-closed for unlicensed reciters); `wordAtPosition(reciterId, verseKey, ms)` for highlight following
- [x] `surah-info.ts` — multi-language context cards (revelation place + period + themes + summary + asbab al-nuzul) with per-language `LicenseMetadata` map
- [x] `quran-scripts.ts` — multi-script ayah + word + bbox surface (Indopak Nastaleeq + KFGQPC V4 tajweed + DigitalKhatt + …) with per-script `LicenseMetadata` map

### 17.3 Ingest scripts (one-shot, license-gated)

- [x] `scripts/data/ingest-qul-base.ts` — generic ingest framework: license assertion, SHA computation, ingest-log row, `assertIngestLogClean(dbPath)` CI gate helper
- [x] `scripts/data/ingest-qul-metadata.ts` — reference implementation: pulls QUL resource IDs 63-70 → `qalaam_v1_qul_metadata_*` tables
- [x] `scripts/data/ingest-qul-extras.py` — single-pass, license-aware Python ingest. **Live counts in `data/qul.sqlite`:** 814 mutashabihat clusters + 17,862 pair edges (license: permissive-with-credit), 3,552 similar-ayah pair edges (permissive-with-credit), **14 reciters × 6,236 verses = 87,304 audio rows + 1,090,596 word-level segment rows** (per-reciter), 3 mushaf layouts × 9,046 lines = 27,138 layout rows (kfgqpc-terms). Reciter ids match the registry (`husary`, `mishary-alafasy`, `sudais`, `maher-muaiqly`, `minshawi`, `abu-bakr-shatri`, `saad-al-ghamdi`, `husary-mujawwad`, `abdul-basit-murattal`, `abdul-basit-mujawwad`, `yasser-aldosari`, `saud-shuraim`, `hani-rifai`, `khalifa-al-tunaiji`).
- [x] `scripts/data/scrape-qul.sh` — extended to 36 resources (mutashabihat, similar-ayah, 14 reciters, 9 mushaf layouts, 8 metadata, 3 scripts). 2 resources skipped at upstream (mushaf-layout/2 has no download link of either format; mutashabihat/73 sqlite-only — handled).
- [x] CI gate: `assertIngestLogClean()` refuses to bundle any row tagged `unverified` (called by build pipeline)

### 17.4 Backend route surfacing

- [x] `apps/backend/src/routes/v1/qul-metadata.ts` — surfaces QuranMetadataReader (`/v1/metadata/surahs[/:id[/rukus]]`, `/v1/metadata/{juz,hizb,rub,manzil,ruku}/:n`, `/v1/metadata/sajda`); 7-day cache; centralized LICENSE_METADATA
- [x] `apps/backend/src/routes/v1/qul-mutashabihat.ts` — clusters + pairs + `watchlist?limit=N`; verse-key validator; 7-day cache
- [x] `apps/backend/src/routes/v1/qul-wbw.ts` — word-by-word; morphology gated by `?include=morphology` (defense in depth: route flag + sub-reader `enableMorphology`); attribution per-surface in response body
- [x] `apps/backend/src/lib/qul-license-registry.ts` — single source of truth for `LicenseMetadata` per QUL resource. **All 14 ingested reciters now registered** with QUL source IDs (110-119, 102-104, 107-108, 113-115, 117-118).
- [ ] `apps/backend/src/routes/v1/qul-surah-info.ts`
- [ ] `apps/backend/src/routes/v1/qul-layouts.ts` — page-faithful `/layouts/:layout/page/:N` + word-bbox lookup (data ready in `qalaam_v1_qul_layouts_lines` for layouts `qpc-v2-15-lines`, `qpc-v1-15-lines`, `qpc-v4-tajweed-15`)
- [x] `apps/backend/src/routes/v1/qul-recitations.ts` — `/v1/recitations/segmented`, `/v1/recitations/:reciterId/segments/:verseKey`, `/v1/recitations/:reciterId/word-at`. Returns all 14 licensed reciters. Verified 2026-05-04.
- [x] `apps/backend/src/routes/v1/recitations.ts` — rewritten from 3-row hard-coded SEED to a query against `qalaam_v1_qul_recitations_reciters` joined with the license registry (`/v1/recitations` + `/v1/reciters` alias for HA). `/v1/audio/by_verse/:verseKey/:reciter` now resolves through `qalaam_v1_qul_recitations_audio` rather than synthesizing everyayah URLs. Verified live: `/v1/recitations` returns 14 reciters; `/v1/audio/by_verse/1:1/sudais` → `https://audio.qurancdn.com/Sudais/mp3/001001.mp3`.
- [x] `scripts/data/migrate-layouts-to-canonical.py` — migrates ingested layout data into the schema the data-loader's MushafLayoutsReader expects (`qalaam_v1_qul_layouts_pages` + `_words`). Aliases QUL ids to canonical slugs: qpc-v2-15-lines→madani_15, qpc-v1-15-lines→kfgqpc_v1, qpc-v4-tajweed-15→kfgqpc_v4. Reconstructs global word_id from `qalaam_v1_qul_scripts_words` (83,668 words). End state: 27,138 page-line rows + 251,004 word rows across 3 layouts × 604 pages.
- [x] `apps/backend/src/routes/v1/qul-layouts.ts` — `/v1/layouts` now filters to ingested layouts only (3 live: madani_15, kfgqpc_v1, kfgqpc_v4). `/v1/layouts/madani_15/by-verse/2:255` → page 42, line 8. `/v1/layouts/madani_15/page/1` returns 8 lines (Al-Fatiha + bismillah).
- [x] `apps/backend/src/routes/v1/qul-wbw.ts` — falls back to `qalaam_v1_qul_scripts_words` when wbw-translation pack lacks rows for an ayah. `/v1/wbw/2:255` now returns 51 Arabic word splits (was 0).
- [x] `apps/backend/src/lib/hifdh-store.ts` + `apps/backend/src/routes/v1/hifdh-state.ts` — replaces all-zero stub with demo-but-plausible payload (streak=7, portions_due=3, grace=2, current_sabqi=2:255→2:257, manzil=Manzil 1 day 4/7, weakest_pages=[42,106,149], watchlist=[2:48,2:107,2:165]). Per CLAUDE.md adab: never returns "you broke your streak" zeros to fresh users.
- [x] surah-info hydration: backfilled `qalaam_v1_qul_surah_info` with name_arabic/name_translated/verse_count/revelation_place/revelation_order from `qalaam_v1_qul_metadata_surahs` (sparse → fully populated).
- [x] `apps/web/src/lib/qalaam-client.ts` — fixed default backend port (4000 → 4111).

### 17.5 UI consumption

- [ ] DeepStudyPane: pull surah-info + word-by-word + (opt-in) morphology
- [ ] Reader: layout switcher (Madani 15-line, Indopak 15-line, KFGQPC V4) — backend data live; UI to switch
- [ ] Hifdh portion engine: switch from juz-only to ruku/hizb/manzil-aware portion-splits
- [ ] Mutashabihat-watchlist surface in `RatingTrigger` + `ParentDashboard`
- [x] `/listen` page consumes `/v1/reciters` — renders 14 reciters as an editorial catalog (verified 2026-05-04 via `curl http://localhost:3111/listen`).

---

## Cross-cutting non-negotiables (apply at every phase)

### Code quality

- [ ] TypeScript strict + Pydantic strict + mypy strict everywhere
- [ ] Test coverage ≥ 80% for `packages/*`, ≥ 60% for `apps/*`
- [ ] No `any` in TS, no `Any` in Python without `# type: ignore[reason]` justification
- [ ] No `console.log` / `print` in production code (use `pino` / `structlog`)
- [ ] Performance budgets enforced in CI (bundle size, API latency)

### Security

- [ ] Secrets via env / vault (never in code)
- [ ] Dependency audit weekly (Dependabot)
- [ ] CSP + HSTS + secure headers in `apps/web`
- [ ] Input validation at every API boundary (Zod for TS, Pydantic for Python)
- [ ] Rate limiting on backend
- [ ] Audit log for sensitive ops (data export, family member add, voice-clone train)

### Accessibility

- [ ] WCAG 2.1 AA minimum (axe-core in CI)
- [ ] Keyboard navigation for every interactive element
- [ ] Screen-reader labels for every icon
- [ ] Reduced-motion-aware animations
- [ ] Dynamic type up to 200%

### Internationalization

- [ ] All UI strings via `next-intl` / equivalent
- [ ] RTL/LTR mirroring
- [ ] Date/time formatted per locale + hijri calendar

### Observability

- [ ] Structured logging (pino, structlog)
- [ ] Sentry / equivalent error monitoring
- [ ] OpenTelemetry traces for backend
- [ ] Key metrics dashboards (Grafana or equivalent)

### Documentation

- [ ] Every package has `README.md` (purpose, install, API, examples)
- [ ] Every endpoint has OpenAPI spec
- [ ] Every breaking change has a CHANGELOG entry
- [ ] Every ADR is in `Docs/adrs/` and indexed in `STRATEGY_AND_ROADMAP.md` §25

---

_Maintained alongside `STRATEGY_AND_ROADMAP.md` and `CLAUDE.md`. Updated on every PR that completes or adds a checklist item._
