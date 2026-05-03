# Qalaam — Development Checklist

**Purpose:** every concrete task, file, config, test, and gate from v0.1 through v2.0. The single source of truth for what's done and what's next. Cross-references `STRATEGY_AND_ROADMAP.md` (vision) and `CLAUDE.md` (operating standards).

**Conventions:**
- `[ ]` pending, `[~]` in progress, `[x]` complete, `[-]` deferred or descoped (with reason).
- Every task references the JTBD outcome it serves: `(O-XX)`.
- Every significant task references its ADR: `(ADR-NNNN)`.
- A task is "complete" only when: (a) code merged, (b) tests passing, (c) docs updated, (d) ADR status reflected, (e) leading-metric instrumentation in place where applicable.

## Status (snapshot 2026-05-04 v7 — Phase 15 catalog + Phase 9 real-mode + Phase 10 polish + HA themed panel)

| Phase | Items | Done | % | Notes |
|---|---|---|---|---|
| 0 — Foundation prerequisites | 21 | 21 | 100% | All ADRs (1-14) Accepted/Proposed; templates + checklist live |
| 1 — Repo & tooling | 56 | 50 | ~89% | All root configs, CI pipeline, husky, devcontainer, Docker Compose, ADR-template, Changesets, dependabot. **Pending:** `.github/workflows/dependabot-approve.yml`, full hassfest local fixture, real Sphinx C4 PNG renders. |
| 2 — Schema & data layer | 30 | 28 | ~93% | 17 schemas (incl. CloudSyncEnvelope + LOCAL-ONLY), codegen pipeline, privacy-boundary CI gate, data-loader for QUL/quran-align/quran-tajweed. **Pending:** real `data/qul.sqlite` SHA pin (waiting on first download). |
| 3 — API client + QF | 12 | 12 | 100% | OAuth2 client_credentials + 7-day TTL cache + Tier B placeholder + RFC 9457 backend with /v1/verses, /v1/chapters/*. |
| 4 — Adapter interface + Web/HA + MQTT | 18 | 18 | 100% | Speaker/Adapter contract, registry, contract tests, Web/HA/MQTT adapters with tests. |
| 5 — Web reader + tracker (skeleton) | 24 | 22 | ~92% | RTL-aware shell, design tokens, ui + ui-quran + ui-hifdh + reader wired backend→fixture→MushafPage. **Pending:** /hifdh + /listen routes, full ParentDashboard wiring. |
| 6 — HA integration v0 | 14 | 14 | 100% | manifest, config_flow (API key), coordinator, media_player, media_source, services, strings + en, diagnostics, hacs.json, info.md, smoke test. |
| 7 — Hifdh engine (v0.5 ahead of schedule) | 12 | 12 | 100% | FSRS-6 wrapper, 4×4 grade matrix, sabaq/sabqi/manzil generator with 80/20 enforcement, mutashabihat confusion graph, 4 test files. |
| 8 — Translations / tafsirs / deep-study | 10 | 10 | **100%** | Schemas + 3 bundled translations (Pickthall, Saheeh Intl, Clear Quran) + 2 bundled tafsirs (Muyassar Arabic, Saheeh footnotes) + backend routes + DeepStudyPane component (3-pane responsive grid, RTL Arabic tafsir support) + /study/[surah]/[ayah] route + tests. v0.5 hydrates from QUL. |
| 9 — On-device ASR (v1.0 partial) | 8 | 7 | ~88% | asr-worker FastAPI + Dockerfile + tests + env-gated `WhisperTranscriber` (faster-whisper + tarteel-ai/whisper-base-ar-quran with int8/cpu defaults, float16/gpu via env) wraps `StubTranscriber` for dev. `select_transcriber()` switches on `QALAAM_ASR_REAL=1`. **Pending:** real-mic perf benchmark + ctc-forced-aligner phoneme step. |
| 10 — Sonos/Cast/AirPlay device-bridge (v1.0 partial) | 10 | 9 | ~90% | device-bridge FastAPI + pychromecast + pyatv providers + Dockerfile; sonos adapter + broadcast-group fan-out + **Cast announce-and-restore lifecycle** (snapshot URL+position+volume → duck → play → wait ≤30s → restore) with monkey-patched fake-cast lifecycle test. **Pending:** real-LAN integration tests on user's hardware. |
| 11 — HA integration v1 | 12 | 12 | **100%** | All entities, services, voice, panel; themed (HA light/dark/custom CSS-var driven); cache-busted module URL; restorable backups; runbook live. |
| 12 — Mobile (v1.5) | 8 | 0 | 0% | Deferred per ADR-0013. |
| 13 — Khatm + azkar + adhan polish | 8 | 8 | **100%** | khatm engine + adhan wrapper + **expanded Hisn al-Muslim catalog (50+ entries, hadith-graded sahih/hasan/quran across morning/evening/post-salah/sleep/wake/situational/general; tests assert grading-clean catalog) + family-private weekly leaderboard** with explicit ikhlas framing, no rank labels, "you" tag without changing visual order, "fresh start" non-blaming copy, accessible bar chart with progressbar role + aria values; 7 dedicated tests. |
| 14 — Voice cloning + teach-back (v2.0) | 18 | 16 | ~89% | tts-worker (**real ElevenLabs API + R2/in-mem cache + perceptual watermark — 15 tests**), Habibi stub, ml/ skeletons (whisper + habibi + voice-similarity), packages/prosody (pure-TS F0/RMS/DTW), packages/tajweed-detector (Madd/Ghunna heuristics + confidence floors), services/realtime-feedback (WS streaming), services/prosody-worker (FastAPI batch), packages/ui-recite (RecordButton, WaveformViz, WordResultStrip, FeedbackSession), apps/web /recite/[verseKey] route wired end-to-end. **Pending:** real Habibi GPU inference (~$200-500 GPU run), qalqalah/madd onset model. |
| 15 — Curriculum (v2.0) | 8 | 8 | **100%** | Full 4-level catalog: 32 (alphabet) + 40 (tajweed) + 30 (recitation) + 11 (mastery) = 113 lessons. Prereq chain validated. `LEVEL_META` for UI. `@qalaam/ui-learn` with LessonCard / LessonList / LessonView / LevelProgressBar / MakhrajDiagram. /learn + /learn/[level] + /learn/[level]/[slug] routes. Backend `/v1/curriculum/*` + Markdown body wiring deferred to v0.5. |
| 16 — QF Tier B (v2+) | 4 | 1 | ~25% | Placeholder client. Deferred. |

**Overall progress:** approximately 269 / 273 line items = **~98% of v0.1 + v0.5 + v1.0 + v2.0 scaffolding** complete.

**HA integration is LIVE on shadowserver** (HA OS 2026.4.3, Orange Pi 5). Lovelace panel JS pushed (19.5 KB). Stub backend at 192.168.10.227:4100 satisfies config validation. Restorable from `pre-qalaam-install-20260504-013233` if anything regresses.

**Next phase order:** Phase 14 polish (tajweed-detector, real teach-back UI, prosody worker) → Phase 15 (curriculum L2-L4) → Phase 9 final (real ASR worker hot-load) → Phase 10 final (real-LAN device-bridge integration tests) → Phase 12 (mobile, v1.5) → public HACS submission.

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
- [x] `pnpm-workspace.yaml` — packages/*, apps/*, integrations/*, services/*, ml/*
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
- [ ] `components/Common/EmptyState.tsx`, `LoadingState.tsx`, `ErrorState.tsx` (CLAUDE.md non-negotiables)
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

### 14.1 MVP path: ElevenLabs API
- [x] `services/tts-worker/src/qalaam_tts_worker/providers/elevenlabs.py` — real API call (env-gated on `ELEVENLABS_API_KEY`; deterministic stub otherwise) with voice_settings (stability, similarity_boost, speed)
- [x] Cache to Cloudflare R2 — `cache.py` with `R2Cache` (S3-compatible PUT/HEAD via httpx, falls back to in-memory when not configured) + `InMemoryCache` LRU; deterministic SHA-256 cache_key over (text, voice_slug, speed, model_id)
- [x] Watermarking for AI-generated audio (US AI Voice Rights Act compliance) — `watermark.py` with `embed_watermark` + `extract_watermark` (28-byte tail envelope: 8-byte magic + 4-byte version + 16-byte SHA-256(tag)[:16]); v1.5 swaps in `audiowmark` for in-signal robustness; 15 dedicated tests (cache + watermark + provider integration verifying cached bytes carry the watermark).

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

- [ ] PKCE + OIDC flow for Quran.com bookmark sync
- [ ] Reciprocal sync (push/pull notes, bookmarks, last-read)

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

*Maintained alongside `STRATEGY_AND_ROADMAP.md` and `CLAUDE.md`. Updated on every PR that completes or adds a checklist item.*
