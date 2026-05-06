# Qalaam — Strategy & Roadmap

**Status:** Planning — synthesis of (a) deep research across Quran.Foundation API, Home Assistant integration patterns, Hifdh methodology, multi-protocol device casting, open Quran datasets, and companion features; and (b) the prior strategic vision in `context.md`, `quranic_recitation_ai_research_roadmap.md`, `quickstart_implementation_guide.md`, and `technical_decision_framework.md`.

**Last updated:** 2026-05-02 (v1.2 — adds §23 JTBD Foundation, §24 Data Flywheel Architecture, §25 Decision Register, §26 Refined Success Metrics — aligning with `CLAUDE.md` "Rabee Operating System")
**Document purpose:** single source of truth for product vision, architecture, technology choices, and phased delivery — superset of all prior docs in this folder.

> **Note on currency:** Sections 1-19 preserve the synthesis as drafted in May 2026 from prior docs (`context.md`, `quranic_recitation_ai_research_roadmap.md` Nov 2025, `quickstart_implementation_guide.md` Nov 2025, `technical_decision_framework.md` Nov 2025) plus initial deep research. **Sections 20-22 contain fresh May 2026 research and supersede prior picks where they conflict.** When in doubt, the later section wins.

---

## 0. Executive summary

Qalaam is a **family-aware, smart-home-aware, AI-augmented Quran and Hifdh platform** delivered as a modular monorepo. It runs in three modes from the same codebase:

1. **SaaS** — cloud-hosted backend + web/mobile clients + optional self-hosted device-bridge for LAN devices.
2. **Self-hosted** — all packages on user hardware (Pi/NAS), no cloud dependency.
3. **Home Assistant native** — Qalaam runs inside HA via the integration; HA is _one of many_ device adapters (alongside Cast, Sonos, AirPlay, Web/PWA, MQTT, Bluetooth A2DP).

It combines features that have never been combined in one product:

- **Verse-by-verse recitation playback** with word-level highlighting on any speaker on the home network.
- **Hifdh memorization engine** with FSRS scheduling, mutashabihat-aware drills, parent dashboards, and on-device ASR-based recall checking — all respecting traditional Hifdh pedagogy (sabaq/sabqi/manzil, 80/20 revision, single-reciter rule, mushaf-page anchor, no surveillance, no riya'-inducing gamification).
- **Reciter voice cloning** — F5-TTS / XTTS-v2 / StyleTTS2 generate any verse in any of 36+ professional reciter voices, with prosody preservation.
- **Teach-back recitation training** — user records, system transcribes (Whisper-large-v3 fine-tuned on EveryAyah), extracts prosody (F0/energy/MFCC/tempo), compares against target reciter, returns visual+audio feedback with tajweed rule scoring.
- **Progressive Quranic Arabic curriculum** — 4-level structured learning path (alphabet → tajweed fundamentals → connected recitation → advanced mastery), 100+ lessons, gamified.
- **Smart-home ambient features** — adhan-aware scheduling, per-room sabaq announcements, listen-mode ambient playback, sleep/wake routines, door-LED indicators, family wall display, shared family khatm.
- **Comprehensive companion features** — adhan/qibla/hijri, Hisn al-Muslim azkar, multi-reciter comparison, deep-study 3-pane (Arabic + translations + tafsir + WBW), tajweed-colored mushaf, ayah-card sharing, kids mode, Ramadan mode, masjid finder.

**Why this is feasible now:** F5-TTS (Oct 2024) brings production-grade zero-shot voice cloning; Tarteel-AI's fine-tuned Whisper checkpoints (`whisper-base-ar-quran`, `whisper-tiny-ar-quran`) hit ~6-9% WER on Quranic audio and run on CPU/Apple Silicon; the EveryAyah dataset (127K samples, 36 reciters, 829 hours) is freely available; the QUL dataset (TarteelAI/quranic-universal-library, MIT) provides license-clean canonical text/audio/segments/mutashabihat. The smart-home + on-device-ML + Hifdh-pedagogy combination is the moat — no incumbent does it.

**Estimated trajectory:**

| Milestone                                                                               | Time                |
| --------------------------------------------------------------------------------------- | ------------------- |
| v0.1 foundation (monorepo, data layer, basic web reader, HA-as-adapter)                 | 4-6 weeks           |
| v0.5 Hifdh core (FSRS, parent dashboard, mutashabihat, deep-study)                      | 4-6 weeks           |
| v1.0 smart-home & casting (Cast/Sonos/AirPlay, ASR drill, HA integration shipped)       | 6-8 weeks           |
| v1.5 mobile + breadth (Expo apps, Snapcast, word-level mistake detection, family khatm) | 6-8 weeks           |
| v2.0 AI cloning + teach-back + Arabic curriculum                                        | 3-6 months          |
| Scale to 10K paying users                                                               | 12 months from v0.1 |

---

## 1. Vision & end-goal product

### 1.1 Jobs-to-be-done

Users hire Qalaam to do these jobs (from the prior strategy doc, preserved verbatim because they remain accurate):

**Primary Job:** "Help me recite Quran correctly like my favorite reciter."

**Functional Jobs:**

- Hear how a specific reciter would recite any verse.
- Get feedback on my recitation accuracy.
- Learn Quranic Arabic progressively.
- Practice anytime without a human teacher.
- Memorize Quran with an authentic, teacher-like methodology.
- Help my children memorize without burning out — gentle, smart, family-aware.

**Emotional Jobs:**

- Feel confident in my recitation.
- Connect spiritually through beautiful recitation.
- Honor the tradition of Quranic preservation.

**Social Jobs:**

- Recite correctly in congregation.
- Teach my children proper recitation.
- Participate meaningfully in Ramadan prayers.
- Complete a family/community khatm together.

### 1.2 Personas (preserved from prior docs)

**Persona 1 — The Convert.** Age 18-35. Needs Arabic from scratch. Pain: no local teacher, intimidated. Solution: gentle gamified path + voice cloning to hear how words should sound.

**Persona 2 — The Parent.** Age 30-50. Needs to teach kids Quran at home. Pain: expensive tutors, scheduling. Solution: family plan, kid-friendly UI, parent dashboard, on-device ASR drill, family khatm.

**Persona 3 — The Hifz Student.** Age 15-40. Needs perfect recitation for memorization. Pain: inconsistent teacher feedback. Solution: Hifdh engine + AI feedback anytime + multiple reciter styles.

**Persona 4 — The Scholar.** Age 25-60. Needs to study recitation differences. Pain: no comparative-analysis tool. Solution: multi-reciter side-by-side, detailed prosody, qira'at layered translations.

### 1.3 What Qalaam does that competitors don't

| Feature                           | Tarteel | Quran.com | Ayat (KSU) | Quran Companion | **Qalaam**                        |
| --------------------------------- | ------- | --------- | ---------- | --------------- | --------------------------------- |
| Mistake detection                 | ✅      | ❌        | ❌         | ❌              | ✅ (on-device)                    |
| Word-by-word follow               | ✅      | ✅        | ✅         | ⚠️              | ✅                                |
| **Voice cloning**                 | ❌      | ❌        | ❌         | ❌              | ✅ **36+ reciters**               |
| **Teach-back / prosody feedback** | ❌      | ❌        | ❌         | ❌              | ✅ **F0+energy+tajweed**          |
| **Progressive Arabic curriculum** | ⚠️      | ❌        | ⚠️         | ❌              | ✅ **100+ lessons**               |
| Multi-reciter comparison          | ❌      | ⚠️        | ⚠️         | ❌              | ✅ side-by-side                   |
| **Hifdh FSRS scheduler**          | ⚠️      | ❌        | ❌         | ❌              | ✅ FSRS + mutashabihat            |
| **Parent dashboard**              | ❌      | ❌        | ❌         | ❌              | ✅ daily summary, no surveillance |
| **Smart-home integration**        | ❌      | ❌        | ❌         | ❌              | ✅ Cast/Sonos/AirPlay/HA/Web      |
| **Adhan-aware scheduling**        | ❌      | ❌        | ❌         | ❌              | ✅                                |
| **Family khatm**                  | ❌      | ❌        | ❌         | ❌              | ✅                                |
| **Offline-first**                 | ⚠️      | ❌        | ⚠️         | ✅              | ✅                                |
| **Self-hostable**                 | ❌      | ❌        | ❌         | N/A             | ✅                                |
| **Custom voice training (Pro)**   | ❌      | ❌        | ❌         | ❌              | ✅                                |

---

## 2. Architectural pillars

| #   | Pillar                                                                                                                                        | Why                                                                                                         |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 1   | **Protocol-agnostic core** — adapter pattern; HA, Cast, Sonos, AirPlay, Web, MQTT, BT-A2DP all conform to one `Speaker` / `Adapter` interface | Music Assistant proves this scales; locks no user into HA                                                   |
| 2   | **Three deployment modes share one codebase** — SaaS, self-hosted, HA-native                                                                  | Same Hifdh engine runs on a Pi or in the cloud; HA users don't get a worse product                          |
| 3   | **Two-tier auth from day one** — Quran.Foundation Content (M2M) and User (PKCE+OIDC); Tier B deferred to v2 to avoid scope sprawl             | QF API mandates it; bookmarks/sync valuable but not v0.1-critical                                           |
| 4   | **Offline canonical layer = QUL + quran-align + quran-tajweed (license-clean)** with QF API as live overlay (≤1 week cache per ToS)           | ToS-compliant, legally redistributable, integrity-checked, mushaf-agnostic                                  |
| 5   | **Mushaf-agnostic ayah-range data model**                                                                                                     | Same data renders Madani 15-line, Indo-Pak 16-line, etc. — preserves the visual anchor for memorizers       |
| 6   | **FSRS over SM-2; unit = page or half-page (configurable)**                                                                                   | Anki's published benchmarks; matches what teachers actually use                                             |
| 7   | **Mutashabihat as a first-class entity** — cluster library + per-user confusion graph                                                         | Single most-cited Hifdh pitfall; no app surfaces it as data                                                 |
| 8   | **Privacy-first ML — Tarteel Whisper + custom models on-device only** for recall checks                                                       | Family ASR audio never leaves LAN. The defensible moat.                                                     |
| 9   | **Voice cloning as opt-in cloud feature**                                                                                                     | F5-TTS needs GPU; ship as cloud SaaS feature, with optional self-hosted GPU mode for advanced users         |
| 10  | **Adhan-aware everything** — no Hifdh actions trigger in prayer windows                                                                       | Non-negotiable for the target audience                                                                      |
| 11  | **Codegen for shared types from one schema** — JSON Schema → TS types + Pydantic models + OpenAPI                                             | Single source of truth; SDKs in TS and Python stay in sync                                                  |
| 12  | **No real-time parent surveillance, no public leaderboards, no AI sheikh chatbot**                                                            | Daily summaries only; private family-only stats; LLMs hallucinate Quran text — fitnah risk                  |
| 13  | **Quality-first, then optimize** — F5-TTS even if slower initially, fine-tune later                                                           | Per the Technical Decision Framework: "make it work, make it right, make it fast"                           |
| 14  | **Aggressive caching for AI generation** — pre-gen common verses, Redis + CDN multi-tier                                                      | 60% cost reduction; per-request infra savings dominate user economics                                       |
| 15  | **Brand and adab matter** — design choices around riya', surveillance, real Hifdh methodology, and Islamic ethics inform every UX decision    | Target audience will reject Western edtech instincts; the product must feel right to a teacher and a parent |

---

## 3. Monorepo structure

```
qalaam/
├── packages/                                  # libraries, no main()
│   ├── schema/                                # JSON Schema source-of-truth → codegen
│   ├── types-ts/                              # generated TS types from schema
│   ├── types-py/                              # generated Pydantic models from schema
│   ├── core/                                  # TS: domain primitives, ayah ranges, mushaf utils
│   ├── core-py/                               # Python port of core (HA + device-bridge use it)
│   ├── api-client-ts/                         # Quran.Foundation + Qalaam-backend client (TS)
│   ├── api-client-py/                         # same surface, Python
│   ├── data-loader/                           # QUL SQLite loader + quran-align + tajweed
│   ├── hifdh-engine/                          # FSRS scheduler, mutashabihat detector, accuracy scoring
│   ├── adapter-interface/                     # Speaker/Adapter contract (TS + py mirror)
│   ├── adapters-ts/                           # Web/PWA, Sonos, MQTT, HA-as-adapter (Node-native)
│   ├── adapters-py/                           # Cast (pychromecast), AirPlay (pyatv) sidecars
│   ├── ui/                                    # React component library + design tokens
│   ├── ui-quran/                              # mushaf renderer, ayah card generator (Satori)
│   ├── ui-hifdh/                              # SRS review surface, parent dashboard, mutashabihat drill
│   ├── ui-learn/                              # Arabic curriculum lesson UI, tajweed playground
│   ├── ui-recite/                             # voice-cloning + teach-back UI (recording, prosody viz)
│   ├── asr/                                   # Tarteel Whisper wrapper (faster-whisper), on-device only
│   ├── tts-cloning/                           # F5-TTS / XTTS-v2 / StyleTTS2 wrapper, prosody hooks
│   ├── prosody/                               # F0, energy, MFCC, tempo extraction + DTW comparison
│   ├── tajweed-detector/                      # Madd duration, Ghunna nasalization, qalqalah scoring
│   ├── curriculum/                            # 100+ lesson catalog, level definitions, progress logic
│   ├── khatm/                                 # group reading plans, claim/aggregate logic
│   ├── azkar/                                 # Hisn al-Muslim catalog + scheduler
│   └── adhan/                                 # adhan (Batoul) wrapper + qibla + hijri (consolidated)
├── apps/
│   ├── web/                                   # Next.js standalone SaaS frontend
│   ├── mobile/                                # Expo / RN (later) — reuses packages/ui
│   ├── backend/                               # Node/Fastify SaaS backend (auth, sync, multi-user, billing)
│   ├── ha-panel/                              # Lovelace custom panel — reuses packages/ui-quran + ui-hifdh
│   └── studio/                                # internal: dataset prep, fine-tuning, eval dashboards
├── integrations/
│   └── homeassistant/                         # custom_components/qalaam — thin shim over core-py + adapters-py
├── services/
│   ├── device-bridge/                         # Python service hosting Cast/AirPlay/pyatv (gRPC to Node)
│   ├── recitation-sync/                       # optional: ayah-timing sync server (long-poll/WS)
│   ├── asr-worker/                            # Tarteel Whisper recall worker (LAN-only by default)
│   ├── tts-worker/                            # F5-TTS / XTTS-v2 inference worker (cloud GPU)
│   ├── prosody-worker/                        # offline prosody analysis batch
│   └── realtime-feedback/                     # WebSocket server for live recitation feedback
├── ml/
│   ├── datasets/                              # download scripts: EveryAyah, AR-DAD, CQDV1, RetaSy, tlog
│   ├── training/                              # F5-TTS fine-tune, Whisper fine-tune, prosody models
│   ├── eval/                                  # WER, similarity, prosody-score evaluation harnesses
│   └── checkpoints/                           # versioned model artifacts (HuggingFace Hub backed)
├── data/                                      # vendored offline datasets (large; git LFS)
│   ├── qul.sqlite                             # QUL canonical store
│   ├── quran-align/                           # CC-BY-4.0 word timings per reciter
│   └── quran-tajweed.json                     # CC-BY-4.0 tajweed coloring
├── tooling/                                   # eslint, ruff, mypy, tsconfig, prettier configs
├── docs/                                      # architecture, contributor guide, ADRs
│   ├── STRATEGY_AND_ROADMAP.md                # this file
│   ├── context.md                             # original brief
│   ├── quickstart_implementation_guide.md     # 48-hour AI sprint
│   ├── quranic_recitation_ai_research_roadmap.md  # full AI roadmap
│   └── technical_decision_framework.md        # model & infra decisions
├── .github/workflows/                         # CI: lint, type, test, build, release
├── docker-compose.dev.yml                     # one-command local dev (backend + HA dev + workers)
├── pnpm-workspace.yaml
├── turbo.json
├── pyproject.toml                             # uv workspace root
└── package.json
```

### Tooling

- **pnpm + Turborepo** for JS/TS — cached incremental builds across the graph.
- **uv workspace** for Python — fast, reproducible.
- **Changesets** — independent semver per package; `core` can move without forcing `homeassistant` to bump.
- **JSON Schema → TS + Pydantic** via `json-schema-to-typescript` + `datamodel-code-generator`. Run on pre-commit.
- **One Docker Compose** at root: `backend`, `ha-dev`, `asr-worker`, `tts-worker`, `device-bridge`, `mock-cast`.
- **OpenAPI** generated from TypeBox schemas → both `api-client-ts` and `api-client-py`.
- **THIRD_PARTY_NOTICES** auto-generated from each package's `licenses.json`.
- **Modal.com** or **RunPod** for GPU training and TTS inference (configurable; user can self-host).
- **HuggingFace Hub** for model storage and dataset hosting.
- **Weights & Biases** for training experiment tracking.

---

## 4. Data & content foundation

### 4.1 Offline canonical layer (license-clean, ship in `data/`)

| Source                                                                                         | License   | Role                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TarteelAI/quranic-universal-library (QUL)** — github.com/TarteelAI/quranic-universal-library | MIT       | Canonical store: Arabic in multiple scripts (Uthmani, Indo-Pak, Imlaei, QPC Hafs), juz/hizb/page/ruku/manzil indices, mushaf layouts, **mutashabihat clusters**, root/morphology, surah info, audio segments with word-level timestamps (machine + human-corrected). Replaces ~80% of what you'd otherwise stitch together. |
| **cpfair/quran-align** — github.com/cpfair/quran-align                                         | CC-BY-4.0 | Word-end timestamps (start_ms, end_ms) per ayah; ~73 ms accuracy; fallback for reciters QUL doesn't cover.                                                                                                                                                                                                                  |
| **quran/quran-tajweed** — github.com/quran/quran-tajweed                                       | CC-BY-4.0 | 5.5 MB JSON of per-character tajweed rule annotations (17 rule classes: madd_2/4/5/6, ghunnah, qalqalah, idghaam variants, ikhfa, izhar, iqlab, lam shamsiyyah, etc.) indexed against Tanzil Uthmani.                                                                                                                       |

### 4.2 Mirror lazily on demand

| Source                                | License        | Role                                                                                  |
| ------------------------------------- | -------------- | ------------------------------------------------------------------------------------- |
| **fawazahmed0/quran-api**             | Unlicense      | 440+ translations across 98 languages; cached on jsDelivr.                            |
| **everyayah.com**                     | Effectively PD | Per-ayah MP3s for 80+ qaris; lazy-download per reciter selection.                     |
| **Quran.Foundation API**              | Bespoke ToS    | Live fallback for fresh data + Tier B user features. **ToS caps cache at 1 week.**    |
| **`audio.qurancdn.com`**              | Bespoke        | Stable signed URLs returned by QF API; pass straight to media_player without re-auth. |
| **`cdn.islamic.network/quran/audio`** | Open           | Al Quran Cloud CDN; 32-192 kbps variants; useful as no-auth fallback.                 |
| **`download.quranicaudio.com`**       | Open           | Full-surah MP3 mirror.                                                                |

### 4.3 ML training datasets (used in `ml/datasets/`)

| Dataset                                       | Size                      | Reciters                   | License               | Purpose                                 |
| --------------------------------------------- | ------------------------- | -------------------------- | --------------------- | --------------------------------------- |
| **tarteel-ai/everyayah** (HuggingFace)        | 127K samples, 829 hrs     | 36 professional            | Open                  | Voice cloning training, ASR fine-tuning |
| **AR-DAD (Arabic Diversified Audio Dataset)** | 15,810 clips, 37 chapters | 30 reciters + 12 imitators | Open                  | Robustness training (imitator handling) |
| **CQDV1**                                     | 218K files (full Quran)   | 35 reciters                | Registration required | Comprehensive coverage                  |
| **tarteel-ai/tlog**                           | User submissions          | Ordinary Muslims           | Gated access          | Mistake-detection training              |
| **RetaSy/quranic_audio_dataset**              | 7K recordings             | Non-Arabic speakers        | Open                  | Mistake-labeled data                    |

### 4.4 Datasets to avoid

- **AbdullahGhanem/quran-database** — no LICENSE (= default copyright = no redistribution rights), abandoned (11 commits in 4 years), open data-integrity bug (240 hizb entries vs canonical 60). Audited and rejected.
- **Direct Tanzil edition shipping** without explicit written commercial permission — reuse via QUL/quran-tajweed/fawazahmed0 instead, which transitively trace back to Tanzil under permissive re-licensing.

### 4.5 Translations to ship in v1 (license verified)

| Translation                        | Status                                                       |
| ---------------------------------- | ------------------------------------------------------------ |
| Pickthall (1930)                   | Public domain                                                |
| Yusuf Ali (1934 original)          | Public domain                                                |
| Hilali-Khan                        | KFGQPC, redistributable                                      |
| Mustafa Khattab "Clear Quran"      | CC-BY-ND for non-commercial; commercial permission available |
| Saheeh International               | Permission usually granted                                   |
| Mufti Taqi Usmani                  | Permission usually granted                                   |
| Maududi (Urdu)                     | Mostly redistributable                                       |
| Kemenag (Indonesian)               | Government-issued, free                                      |
| Hamidullah (French, older edition) | Free                                                         |
| Diyanet (Turkish)                  | Government, redistributable                                  |
| Abdullah Basmeih (Malay)           | JAKIM, redistributable                                       |

### 4.6 Tafsirs to ship in v1

- Saheeh International footnotes (with permission)
- Ibn Kathir abridged English (older PD translations)
- Maududi (Tafhim ul-Quran) Urdu
- Muyassar Arabic
- Jalalayn Arabic
- Sa'di Arabic

**Defer to v2:** Tabari, Qurtubi, Maarif-ul-Quran, Bayan-ul-Quran (large; lazy-load by ayah).

### 4.7 Word-by-word grammar (i'rab)

- **Quranic Arabic Corpus (corpus.quran.com)** by Kais Dukes — gold standard, but **GNU GPL** copyleft. Use carefully or seek alternative licensing. Many commercial apps quietly reuse it; legal risk noted.
- **Quran.com WBW glosses** (English + Urdu) via QF API — usable for translation crutch in v1.
- **Defer:** full i'rab dependency trees (research-grade UX).

### 4.8 Attribution requirements

- MIT (QUL) — keep copyright/permission notice.
- CC-BY-4.0 (quran-align, quran-tajweed) — visible credit; "Data sources" section in app About / Settings.
- Document all in `THIRD_PARTY_NOTICES` file.

---

## 5. Multi-protocol device adapter layer

### 5.1 Adapter stack (v1 ships 5-7 adapters)

| #   | Adapter                                               | Library                                                                    | Why                                                                                                                                                                                                                                |
| --- | ----------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Google Cast / Chromecast / Google Home / Nest Hub** | `pychromecast` (Python sidecar) or `@foxxmd/castv2` (maintained Node fork) | Biggest install base, zero pairing, mDNS discovery, group casting via virtual device.                                                                                                                                              |
| 2   | **Sonos**                                             | `node-sonos-ts` (TypeScript-first, MIT, actively maintained)               | Best API of any vendor; first-class groups/zones, native queue, native announce-and-restore.                                                                                                                                       |
| 3   | **AirPlay 2**                                         | `pyatv` (Python sidecar, MIT, very active)                                 | HomePod/Apple TV/AirPlay-2 stereos. PIN pairing once per device.                                                                                                                                                                   |
| 4   | **Web/PWA**                                           | HTML5 audio + Web Audio API + Media Session API                            | Browser as a controllable speaker via WebSocket; lock-screen controls (iOS Safari 16.4+, all Android). Likely the most-used adapter in practice.                                                                                   |
| 5   | **HA-as-adapter**                                     | `home-assistant-js-websocket` (Apache-2.0, official)                       | Long-lived access token → call `media_player.play_media` on any HA entity. **Inherits HA's entire device matrix** (LMS, Squeezebox, Roon, Bluesound, Heos, Yamaha MusicCast) without writing more adapters. Highest leverage path. |
| 6   | **MQTT**                                              | `mqtt` npm                                                                 | ~50 LoC; pairs with ESPHome `media_player` and Snapcast.                                                                                                                                                                           |
| 7   | **Bluetooth A2DP (local)**                            | `bluetoothctl` + `mpv`/`pw-play`                                           | Pi-in-the-kid's-room fallback.                                                                                                                                                                                                     |

### 5.2 Deferred adapters

- **Matter casting** — still TV/video-only in 2026; revisit 2027.
- **HomeKit-as-output** — no `play_url`; useful only as control surface ("Hey Siri, pause Quran") not as output.
- **Native Alexa Music Skill** — requires Amazon partnership; not realistic for indie. Use Alexa for TTS announcements only via `alexa-remote2`.
- **Native DLNA/UPnP** — fragmented; let HA-as-adapter cover it.
- **Snapcast** — Phase 1.5 if true sub-millisecond multi-room across cheap clients (Pi Zero per room) becomes a goal.

### 5.3 Common abstraction (Spotify-Connect-style "active device" model)

```typescript
interface Speaker {
  id: string;
  adapter: AdapterId;
  name: string;
  room?: string;
  capabilities: Set<'play_url' | 'pause' | 'seek' | 'volume' | 'queue' | 'group' | 'announce'>;
  state: {
    status: 'idle' | 'playing' | 'paused';
    positionMs?: number;
    mediaId?: string;
    volume?: number;
  };
}

interface Adapter {
  discover(): AsyncIterable<Speaker>;
  playUrl(id: string, url: string, opts: PlayOpts): Promise<void>;
  pause(id: string): Promise<void>;
  resume(id: string): Promise<void>;
  seek(id: string, ms: number): Promise<void>;
  setVolume(id: string, level: number): Promise<void>;
  getState(id: string): Promise<SpeakerState>;
  announce(id: string, url: string, duck?: boolean): Promise<void>;
  group?(ids: string[]): Promise<GroupId>;
}
```

Plus: an "active device" per user, and a "broadcast group" for adhan-aware fan-out announcements.

### 5.4 Architectural note: Python sidecars

Cast (`pychromecast`) and AirPlay (`pyatv`) have no maintained Node libraries. Architecture: the **device-bridge** runs as a Python service alongside the Node backend, communicating over local gRPC (or WebSocket+JSON for simplicity). The TS `Adapter` interface is the contract; Node and Python implementations both satisfy it.

### 5.5 Reference projects to study

- **Music Assistant** (music-assistant.io, Apache-2.0) — closest existing project; read its `players/` directory before writing adapters.
- **Snapcast** (GPL-3) — synchronized multi-room.
- **Owntone** (GPL-2) — AirPlay 2 emitter reference.
- **Mopidy** (Apache-2.0) — plugin architecture worth borrowing.
- **Home Assistant `media_player` integrations** — canonical reference for every device quirk.

---

## 6. Quran.Foundation API integration

### 6.1 Two-tier OAuth (confirmed)

**Base URLs (prod):**

- Content APIs: `https://apis.quran.foundation/content/api/v4/...`
- User APIs: `https://apis.quran.foundation/auth/v1/...`
- OAuth token: `https://oauth2.quran.foundation/oauth2/token`
- Pre-prod: replace `apis` with `apis-prelive`, and `oauth2` with `prelive-oauth2`

**Tier A — Content (M2M).** `grant_type=client_credentials`, `scope=content`. 1-hour tokens, no refresh. Required headers on every request: `x-auth-token: <token>` + `x-client-id: <id>`. Right tier for HA integration in v1.

**Tier B — User APIs (per-user).** Authorization Code + PKCE + OIDC. Scopes: `openid offline_access user collection`. Refresh tokens via `offline_access`. Required for bookmarks/notes/streaks/last-read — no anonymous access. **Defer to v2.**

### 6.2 Critical endpoints

- **Verses:** `/verses/by_chapter/{id}`, `/by_juz`, `/by_page`, `/by_hizb`, `/by_rub_el_hizb`, `/by_ruku`, `/by_manzil`, `/by_key/{verse_key}`, `/random`
- **Common params:** `words=true`, `word_fields=`, `fields=`, `translations=` (CSV of IDs), `tafsirs=`, `audio=<reciter_id>`, `per_page` (max 50), `page`
- **Audio with timing (critical for Hifdh):** `GET /audio/reciters/{id}/audio_files?chapter={n}&segments=true` returns word-level segments as `[word_index, start_ms, end_ms]`. Canonical timing source when QUL doesn't cover the reciter.
- **Resources:** `/resources/recitations`, `/resources/translations`, `/resources/tafsirs`, `/resources/languages`, `/resources/chapter_reciters`, `/resources/recitation_styles`, `/resources/word_by_word_translations`
- **Search:** `/search?q=&size=&page=&language=` (Elasticsearch-backed, AND semantics within translations, boosts Arabic Quranic-text hits)
- **Page lookup:** `/pages/lookup` resolves verse range → mushaf page numbers + line numbers (for page-faithful UI)
- **Related verses:** `/related_verses/by_key/{verse_key}` (cross-references)
- **Footnotes:** `/foot_notes/{id}` (referenced from translation HTML)
- **Glyph code v1/v2:** `/quran/verses/code_v1`, `/code_v2` (for QCF font rendering)
- **Qira'at:** `qiraat` and `layered_translations` endpoints (seven/ten canonical readings as a layered overlay on Hafs)

### 6.3 ToS constraints (must respect)

- **Caching capped at 1 week** for Content data unless explicitly permitted. Design cache TTL accordingly or pull from QUL/Tanzil/everyayah for offline storage.
- Quran text **must not be modified**.
- No redistribution/resale of raw API data.
- No ML training, biometric, or ad-profile use without written consent.
- Termination: 30 days notice, immediate on breach, with delete-all obligation.

### 6.4 Production gating

Credentials are issued via "Request Access" form. Demo credentials exist for pre-prod only. Rate limits unpublished but enforced — plan for 429 backoff.

---

## 7. Hifdh engine

### 7.1 Methodology baseline (from research, must be respected)

**Three-tier daily structure (non-negotiable):**

- **Sabaq** — new lesson today. Quantum: half-page (~7-8 lines) for kids/casual, one page for serious students, two pages only for full-time intensive.
- **Sabqi** — last 7-10 days (often "current Juz") recited fresh. Bridges short-term to mid-term.
- **Manzil/Dhor** — everything else memorized, cycled every 1-3 months.

**80/20 rule:** 80% of daily Hifdh time is revision, 20% is new memorization. Inverting this is the documented #1 reason students plateau and quit around Juz 10-15.

**Unit choice for SRS:** half-page or page is the canonical unit, not ayah. The Madani 15-line mushaf's fixed page layout is itself a memory cue — students recall by visualizing page position. Per-ayah granularity destroys the visual anchor. Larger than a page is too coarse.

**Algorithm:** **FSRS over SM-2** (Anki benchmarks confirm). Rate on two axes — fluency (paused/hesitant/smooth) and accuracy (errors/minor tajweed/clean) — derive a single FSRS grade.

**Mutashabihat (similar-verse confusion):** dominant source of advanced-student errors. Build clusters from QUL dataset; track per-user confusion graph.

**Single-reciter rule:** lock reciter at first memorization; allow change only after lock-in.

**Same-mushaf rule:** store data as ayah ranges (mushaf-agnostic); render to whichever mushaf the user uses.

**"Locking in" definition:** student recites fluidly, eyes closed, no prompts, correct tajweed, on multiple separate days, surviving teacher-style mid-page interruption tests.

### 7.2 Data model (`packages/hifdh-engine`)

- **`Plan`** — user's Hifdh roadmap (target completion, daily quantum, mushaf, locked reciter).
- **`Portion`** — `(start_verse_key, end_verse_key, status: new | sabqi | manzil | weak | locked)` — page-aligned by default but ayah-range internally.
- **`ReviewState`** — FSRS fields (`stability`, `difficulty`, `last_reviewed`, `due`, `lapses`).
- **`RatingEvent`** — `(timestamp, fluency: 0-3, accuracy: 0-3, source: self | parent | asr)`.
- **`MistakeEvent`** — `(verse_key, word_index, type: omission | substitution | order | tajweed | hesitation, timestamp)` — drives weakness scoring + mutashabihat-cluster heatmaps.
- **`MutashabihatCluster`** — precomputed from QUL; user's `confusion_graph` tracks which cluster members they've swapped.
- **Pace and confidence** — rolling average pages/day, retention% over 7/30/90-day windows, predicted "weakest portion" for next session.
- **Reciter preference per portion** (single-reciter rule — lock at first memorization).
- **Mushaf preference** (Madani 15-line vs Indo-Pak 16-line — affects page boundaries).
- **Family graph** — users, guardians, who-can-see-what-of-whom, per-child target schedule.

### 7.3 Scheduler

FSRS (open-source reference impl). Daily generator produces a session: `[sabaq-page, sabqi-portions-due, manzil-portions-due]` honoring the 80/20 split.

### 7.4 Parent dashboard (`packages/ui-hifdh`)

Per-child:

- Today's status, current sabqi range, manzil cycle position, 7-day streak.
- Top-5 weakest pages by error rate.
- Mutashabihat watchlist.
- One-tap "I just heard them recite" rating (fluency × accuracy) — voice-tag option for hands-free.
- Last 7-day streak with grace-day support (1-2/month).

**Rules:**

- Daily summaries only. **Never real-time mistake notifications** (surveillance, not pedagogy).
- No public leaderboards (riya' concern). Family-private only, framed as "to encourage each other, not to show off."
- Streaks have grace days; never punish "you lost your 90-day streak."

### 7.5 On-device ASR pipeline (`services/asr-worker`)

- **Model:** `tarteel-ai/whisper-base-ar-quran` via `faster-whisper` (or `tiny-ar-quran` on weaker hardware).
- **Two endpoints:**
  1. **Voice search** ("which ayah did I just say?") — ship in v0.5.
  2. **Verse-pause drill** (prompt half-ayah, wait, ASR transcribe, fuzzy-match against expected continuation, score, log mistake) — ship in v1.0.
- **Latency target:** 1-3 seconds after end-of-utterance.
- **Privacy:** runs fully on LAN. **Never ship audio to cloud.** Single most defensible feature of the project.

**Defer to v2:** word-level mistake detection (forced alignment on top of ASR, e.g., wav2vec2 Arabic + Quran lexicon, or the Adapting Whisper-large-v3 as Speech-to-Phoneme work from ArabicNLP 2025).

**Research-grade — do NOT promise:** tajweed-correctness scoring (madd lengths, ghunnah, qalqalah from audio).

---

## 8. AI/ML stack — voice cloning & teach-back (preserved from prior strategy)

This section preserves the AI vision from `quranic_recitation_ai_research_roadmap.md` and `technical_decision_framework.md` _without omission_, integrated into the Qalaam architecture.

### 8.1 TTS / Voice cloning model selection

| Model                | Quality    | Speed    | Arabic             | License        | Training                | Best for                     |
| -------------------- | ---------- | -------- | ------------------ | -------------- | ----------------------- | ---------------------------- |
| **F5-TTS** ⭐ WINNER | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ✅ Native          | MIT            | Zero-shot               | **Production (recommended)** |
| **XTTS-v2**          | ⭐⭐⭐⭐   | ⭐⭐⭐⭐ | ✅ Native          | CPML (NC base) | Zero-shot, fine-tunable | Battle-tested alternative    |
| **StyleTTS2**        | ⭐⭐⭐⭐⭐ | ⭐⭐⭐   | ⚠️ Needs fine-tune | MIT            | Fine-tuning needed      | Highest quality (advanced)   |
| **Bark**             | ⭐⭐⭐     | ⭐⭐     | ⚠️ Limited         | MIT            | Zero-shot               | Not recommended              |
| **Tortoise**         | ⭐⭐⭐⭐   | ⭐       | ⚠️ Limited         | Apache 2.0     | Zero-shot               | Too slow                     |

**F5-TTS (October 2024)** — winner because:

- Latest tech, flow matching architecture (better quality than autoregressive)
- 10-15s reference audio sufficient
- Native Arabic support (16 languages)
- Sub-500ms latency for 10s output
- MIT license, fully commercial
- Active development

**XTTS-v2** — runner-up. Use when needing fine-tuning or have existing Coqui infrastructure. License caveat: CPML non-commercial for base; commercial licensing or fine-tuned variants needed for SaaS.

**StyleTTS2** — quality champion (beats human in tests) but no native Arabic; requires fine-tuning pipeline. Reserve for Phase 2+.

### 8.2 Voice cloning engine (`packages/tts-cloning`)

**Input:** user selects reciter (e.g., Sheikh Mishary Alafasy)
**Output:** any Quranic verse generated in that reciter's voice

```python
class ReciterVoiceEngine:
    def __init__(self):
        self.f5_model = F5TTS.from_pretrained("SWivid/F5-TTS_v1")
        self.reciter_samples = self.load_reciter_library()

    def clone_reciter(self, reciter_name: str, text: str) -> AudioArray:
        ref_audio = self.reciter_samples[reciter_name]
        output = self.f5_model.synthesize(
            text=text,
            reference_audio=ref_audio,
            language="ar",
            style_transfer=True,
            steps=32  # quality vs speed
        )
        return output
```

**Data requirement:** 15-30 seconds per reciter (readily available from EveryAyah). Can generate infinite variations.

### 8.3 ASR — Whisper Large-v3

| Model                                  | WER (Quran) | Speed         | Arabic                | Cost | Best for                          |
| -------------------------------------- | ----------- | ------------- | --------------------- | ---- | --------------------------------- |
| **Whisper Large-v3** ⭐                | ~5-8%       | Fast          | ✅ Excellent          | Free | **Recommended for cloud**         |
| **Tarteel Custom (NeMo)**              | ~3-5%       | Very Fast     | ✅ Specialized        | N/A  | Proprietary                       |
| **`tarteel-ai/whisper-base-ar-quran`** | ~6-9%       | Moderate      | ✅ Quranic-fine-tuned | Free | **On-device (LAN) recall checks** |
| **`tarteel-ai/whisper-tiny-ar-quran`** | ~8-12%      | Fast (CPU-OK) | ✅ Quranic-fine-tuned | Free | Constrained hardware              |
| Wav2Vec2 Arabic                        | ~10-15%     | Fast          | ✅ Good               | Free | Alternative                       |
| NeMo ASR                               | ~5-10%      | Very Fast     | ✅ Good               | Free | Enterprise                        |

```python
import whisper
model = whisper.load_model("large-v3")
result = model.transcribe(
    "user_recitation.mp3",
    language="ar",
    word_timestamps=True
)
```

**For production:** fine-tune on EveryAyah dataset for 2-3% WER improvement.

### 8.4 Teach-back system (`packages/prosody` + `packages/tajweed-detector`)

**How it works:**

1. User records themselves reciting a verse.
2. ASR transcribes (Whisper-large-v3 or Tarteel fine-tuned).
3. System extracts prosody features.
4. Voice cloner generates target reciter's version of the same text.
5. Prosody comparison (DTW alignment) returns score + suggestions.
6. UI shows side-by-side waveforms, pitch curves, tajweed errors.
7. Generated encouragement audio in target reciter's voice.

```python
class TeachBackEngine:
    def __init__(self):
        self.asr = WhisperQuran()
        self.voice_cloner = ReciterVoiceEngine()
        self.prosody_analyzer = ProsodyComparator()
        self.tajweed_detector = TajweedDetector()

    def teach_verse(self, user_audio: bytes, target_reciter: str):
        user_text, user_timing = self.asr.transcribe(user_audio)
        user_prosody = self.prosody_analyzer.extract(user_audio)
        target_audio = self.voice_cloner.clone_reciter(target_reciter, user_text)
        target_prosody = self.prosody_analyzer.extract(target_audio)
        feedback = self.prosody_analyzer.compare(user_prosody, target_prosody)
        tajweed = self.tajweed_detector.score(user_audio, user_text)
        return {
            "accuracy_score": feedback.score,
            "timing_deviations": feedback.timing_diff,
            "pitch_suggestions": feedback.pitch_corrections,
            "tajweed_errors": tajweed.errors,
            "playback_comparison": self.generate_side_by_side(user_audio, target_audio)
        }
```

### 8.5 Prosody comparison

Features extracted (via librosa):

- **Pitch contour (F0 trajectory)** — `librosa.yin(y, fmin=50, fmax=500)`
- **Energy envelope** — `librosa.feature.rms(y=y)[0]`
- **Tempo / rhythm** — `librosa.beat.beat_track(y=y, sr=sr)`
- **MFCCs (timbre)** — `librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)`

Comparison via Dynamic Time Warping (`fastdtw`) over F0 + energy correlation, returning:

- Overall score 0-100
- Pitch accuracy
- Energy matching
- Suggestions

```python
class ProsodyComparator:
    def extract_features(self, audio_path):
        y, sr = librosa.load(audio_path)
        return {
            'f0': librosa.yin(y, fmin=50, fmax=500),
            'energy': librosa.feature.rms(y=y)[0],
            'tempo': librosa.beat.beat_track(y=y, sr=sr)[0],
            'mfcc': librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        }

    def compare(self, user_features, target_features):
        from scipy.spatial.distance import euclidean
        from fastdtw import fastdtw
        pitch_distance, _ = fastdtw(user_features['f0'], target_features['f0'], dist=euclidean)
        energy_corr = np.corrcoef(user_features['energy'], target_features['energy'])[0,1]
        score = 100 * (1 - pitch_distance/1000) * energy_corr
        return {
            'score': score,
            'pitch_accuracy': 1 - pitch_distance/1000,
            'energy_matching': energy_corr,
            'suggestions': self.generate_suggestions(user_features, target_features)
        }
```

### 8.6 Tajweed rule detection

```python
class TajweedDetector:
    def detect_madd(self, audio, text):
        """Detect elongation (Madd) duration"""
        madd_letters = self.find_madd_positions(text)
        for pos in madd_letters:
            duration = self.measure_duration(audio, pos)
            expected = self.get_madd_duration(text[pos])
            if abs(duration - expected) > 0.1:
                return {
                    'error': 'incorrect_madd',
                    'position': pos,
                    'expected': expected,
                    'actual': duration
                }
        return {'status': 'correct'}

    def detect_ghunna(self, audio, text):
        """Detect nasalization (Ghunna)"""
        ghunna_pos = self.find_ghunna_positions(text)
        for pos in ghunna_pos:
            nasal_score = self.compute_nasality(audio, pos)
            if nasal_score < 0.7:
                return {
                    'error': 'weak_ghunna',
                    'position': pos,
                    'score': nasal_score
                }
        return {'status': 'correct'}
```

Rules to detect: madd (2/4/5/6 harakat), ghunnah, qalqalah (sughra/kubra), idghaam variants, ikhfa haqiqi/shafawi, izhar halqi/shafawi, iqlab, lam shamsiyyah/qamariyyah, raa rules.

**Reality check:** real-time tajweed correctness scoring is research-grade. Ship as opt-in "experimental" feature with low confidence intervals; never market as authoritative.

### 8.7 Real-time WebSocket feedback pipeline (`services/realtime-feedback`)

```python
class RealtimeFeedbackServer:
    def __init__(self):
        self.asr = WhisperASR()
        self.prosody = ProsodyAnalyzer()

    async def handle_audio_stream(self, websocket):
        buffer = []
        async for message in websocket:
            chunk = np.frombuffer(message, dtype=np.float32)
            buffer.append(chunk)
            if len(buffer) >= 10:  # 1 second
                audio = np.concatenate(buffer)
                buffer = []
                transcript = await self.asr.transcribe_async(audio)
                prosody = await self.prosody.analyze_async(audio)
                await websocket.send(json.dumps({
                    'text': transcript,
                    'prosody_score': prosody.score,
                    'real_time_corrections': prosody.suggestions
                }))
```

### 8.8 Hybrid TTS strategy

**Phase 1 — Zero-shot:** F5-TTS out-of-the-box with EveryAyah reference samples, 5 reciters.
**Phase 2 — Fine-tuning:** Fine-tune F5-TTS on Quranic-specific prosody.
**Phase 3 — Tajweed modeling:** Add tajweed rule conditioning (elongation, ghunna, etc.).

```python
# Fine-tune F5-TTS on EveryAyah
from datasets import load_dataset
from f5_tts import F5TTS, FineTuner

dataset = load_dataset("tarteel-ai/everyayah")
elite_reciters = ["abdul_basit", "alafasy", "husary", "sudais", "minshawi"]
train_data = dataset.filter(lambda x: x['reciter'] in elite_reciters)

model = F5TTS.from_pretrained("f5-tts-v1")
trainer = FineTuner(
    model=model,
    dataset=train_data,
    batch_size=16,
    learning_rate=1e-5,
    epochs=10,
    save_every=1000
)
trainer.train()
model.save_pretrained("f5-tts-quranic")
```

**Expected results:** 20-30% improvement in prosody accuracy, better tajweed elongations, more natural pause patterns.

### 8.9 Custom voice training (Pro tier)

Allow users to upload their own voice samples (10-20 minutes) → fine-tune a personal model → use it for self-listen-back in their own voice. Pro-tier feature, GPU-budgeted.

### 8.10 Fine-tuning Whisper on EveryAyah

```python
from transformers import WhisperForConditionalGeneration, Seq2SeqTrainer

model = WhisperForConditionalGeneration.from_pretrained("openai/whisper-large-v3")
# fine-tune on tarteel-ai/everyayah → ~3-5% WER improvement
```

---

## 9. Progressive Quranic Arabic curriculum (`packages/curriculum`)

Preserved from prior strategy, integrated as a first-class feature.

### 9.1 4-level structure

```
Level 1: Arabic Alphabet & Pronunciation (~30 lessons)
├── Harakat (vowel marks: fatha, kasra, damma, sukun, shadda)
├── Letter sounds in isolation
├── Letter forms (initial, medial, final, isolated)
└── Basic word formation, joining letters

Level 2: Tajweed Fundamentals (~40 lessons)
├── Makhraj (articulation points)
├── Sifat (letter qualities)
├── Noon Sakinah / Tanween rules (izhar, idghaam, iqlab, ikhfa)
├── Meem Sakinah rules (idghaam shafawi, ikhfa shafawi, izhar shafawi)
├── Madd categories
├── Qalqalah letters (qutbu jadin)
├── Ghunnah, lam shamsiyyah/qamariyyah
└── Short surahs (Juz Amma) practice

Level 3: Connected Recitation (~30 lessons)
├── Fluency building
├── Intermediate surahs
├── Pause/stop signs (waqf, ibtidaa)
├── Style analysis (comparing reciters)
└── Maqamat introduction

Level 4: Advanced Mastery (Pro)
├── Complete surah memorization (with Hifdh engine integration)
├── Multiple qira'at (recitation styles: Hafs, Warsh, Qaloon, etc.)
├── Teaching/certification preparation
└── Group recitation / leadership preparation
```

### 9.2 Lesson UI (`packages/ui-learn`)

```python
class ArabicLearningModule:
    def lesson_practice(self, user_id: int, lesson_id: int):
        lesson = self.get_lesson(lesson_id)
        self.show_arabic_text(lesson.text)
        self.play_reciter_audio(lesson.reference_audio)
        user_recording = self.record_user()
        feedback = self.teach_back_engine.analyze(user_recording, lesson.target_reciter)
        encouragement = self.voice_cloner.synthesize(
            text=self.get_encouragement(feedback.score),
            reciter=lesson.target_reciter
        )
        return {
            "feedback": feedback,
            "next_lesson": self.get_next_lesson(feedback.score),
            "encouragement_audio": encouragement
        }
```

### 9.3 Spaced repetition for vocabulary/letters

FSRS again — same engine as Hifdh — but operating on letter/word/rule cards.

### 9.4 Gamification (carefully)

- **Streaks** with grace days. **Never** "you lost your streak."
- **Stickers / completion badges** for kids (modeled on the sticker-chart instinct).
- **No XP/levels/coins/gems** — adab-inappropriate for the target audience.
- **No public leaderboards** — riya' risk.
- **Family-private leaderboard only**, explicitly framed as encouragement.

---

## 10. Smart-home & ambient features (the moat)

### 10.1 Gold-tier (ship)

- **Adhan-aware scheduling** — uses `packages/adhan` (Batoul Apps adhan lib, MIT, supports MWL/Egyptian/Karachi/ISNA/Umm al-Qura/Tehran/Jafari/JAKIM/etc.); no Hifdh actions in prayer windows.
- **Per-room scheduled "sabaq starts now"** announcement with auto-pause TVs / dim lights / mute other speakers.
- **Listen mode** — passive low-volume loop of the _current week's portion_ (sabaq + sabqi) during chores. Evidence-backed Hifdh technique ("audio bath"); no app does it home-wide.
- **Sleep/wake routines** — last-revised portion at lights-out and on Fajr alarm with gradual volume.
- **Verse-pause drill** — speaker recites half an ayah, child completes, on-device ASR judges. Mutashabihat-cluster drills.
- **Door-LED indicator** — green = wird done, amber = sabqi pending, red = nothing today.
- **Family wall display** — wall tablet/e-ink with each member's status; family-private, never public.
- **Family khatm announcements** — Echo/Google Home announces "Dad finished his juz tonight, 4 juz left."

### 10.2 Mixed (ship carefully)

- **Whisper/STT recall checking via room mic** — push-to-talk or session-bounded only; never ambient. Privacy-loaded.

### 10.3 Skip (gimmick or ethically risky)

- Gamified XP/levels/coin economies with cartoon mascots — adab-inappropriate.
- Social leaderboards across families — riya' concern.
- Voice "AI sheikh" chatbot — LLMs hallucinate Quran; fitnah risk.
- Real-time push notifications to parents about kids' mistakes — surveillance.

### 10.4 Adhan / qibla / hijri (`packages/adhan`)

- **Library:** `adhan` by Batoul Apps (MIT, ports in JS/Swift/Kotlin/Dart/Python). Supports all major methods + custom; high-latitude rules (MiddleOfTheNight, SeventhOfTheNight, TwilightAngle); Asr Hanafi/Shafi'i.
- **Athan audio:** ship Mishary Al-Afasy + Madinah/Makkah adhan defaults from archive.org PD recordings; Fajr "as-salatu khayrum min an-nawm" variant.
- **Qibla:** great-circle bearing math (Kaaba 21.4225, 39.8262); `adhan.Qibla(coordinates).direction`.
- **Hijri calendar:** Umm al-Qura (Saudi official, predictable through 1500 AH), Tabular Islamic, Moonsighting Committee Worldwide. Libs: `hijri-converter` (Python), `moment-hijri` (JS).
- **Events to surface:** 1 Muharram, Ashura, Mawlid (with disclaimer about differing views), 15 Sha'ban, Ramadan start, Laylat al-Qadr odd nights, Eid al-Fitr, Dhul Hijjah days, Day of Arafah, Eid al-Adha, Tashreeq days.
- **Smart-home angle:** auto-pause TVs at adhan, dim lights, play adhan on Sonos, send phone-silence command. **This is the moat.**

### 10.5 Hisn al-Muslim azkar (`packages/azkar`)

Canonical reference: Hisn al-Muslim by Sa'eed bin Wahf al-Qahtani. JSON datasets: `hisnmuslim.com` official, `Yajeed/HisnElmoslem` and `nawawi-foundation/dua` (verify hadith grading).

Categories: morning/evening azkar, post-salah, sleeping, waking, eating, travel, distress, ruqyah (Falaq, Nas, Ikhlas, Ayatul Kursi, last 2 of Baqarah), istikhara, salatul-hajah, prophetic supplications by category.

**Smart-home integration:** scheduled morning/evening azkar playback after Fajr/Maghrib with Arabic + transliteration + 1 translation + audio per dua.

### 10.6 Khatm tracking (`packages/khatm`)

A genuinely underserved feature. Mechanics: a group (family/masjid/friend circle) creates a khatm; system slices 30 juz / 604 pages / 6236 ayahs into commitments; members claim ranges; progress aggregates; on completion, trigger celebratory dua announcement.

Common modes:

- **Funeral khatm** (one-time, urgent, often within 3 days)
- **Ramadan family khatm** (1 juz/person × 30 days)
- **Rolling weekly khatm** (1/7 manzil/day)
- **Hifdh-class khatm** (each student a juz they've memorized)

**v1:** create khatm, invite link, juz claim board, daily nudge.
**Defer:** masjid-wide khatms (hundreds of members; needs moderation tooling).

---

## 11. UI/UX (web + mobile + HA panel)

### 11.1 Frontend stack

- **Web:** Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Mobile:** Expo / React Native (defer to v1.5)
- **State:** Zustand or Redux Toolkit
- **Audio:** Web Audio API + Media Session API (web), expo-av (mobile)
- **Real-time:** WebSocket / WebRTC for live feedback
- **HA panel:** custom Lovelace card, reuses `packages/ui-quran` and `packages/ui-hifdh`

### 11.2 Standalone UI/UX vision

A **beautiful, premium standalone web/mobile UI** that:

- Works fully independently (PWA-installable, offline-first, no HA required)
- Connects to HA when available (auto-discovery via `home-assistant-js-websocket`) and exposes additional controls
- Functions as a complete modular framework / SaaS — auth, sync, multi-user, billing, all in one product

### 11.3 Deep-study mode

3-pane layout (desktop) / tabbed (mobile):

- Pane 1: Arabic with WBW glosses on tap, tajweed coloring
- Pane 2: 1-2 stacked translations
- Pane 3: scrollable tafsir
- Sync scroll by ayah anchor; persist user's pane configuration per device class.

### 11.4 Mushaf renderer (`packages/ui-quran`)

- **Fonts:** Amiri (SIL OFL, free), Scheherazade New (SIL OFL, IndoPak-friendly), KFGQPC Uthman Taha Hafs (Islamic non-commercial; verify for commercial), Noto Naskh Arabic (SIL OFL, safe everywhere).
- **Latin pairing:** Inter, Source Sans, or Noto Sans. Don't mix more than two Latin faces.
- **Tajweed coloring:** Tanzil tajweed-simple + neutral palette + legend modal. Avoid copying Dar al-Maarifah's Tajweed Quran palette pixel-for-pixel (registered work).
- **Smart-home tajweed angle:** smart light strip echoes the active rule color while a verse plays — novel teaching aid for kids.

### 11.5 Ayah card sharing

Server-side image generation with **satori + resvg** (Node) or **Pillow** (Python). 4-5 templates, square + story aspect ratios, branded watermark. Defer user-customizable templates (scope creep).

### 11.6 Notes / annotations / highlights

Per-ayah notes with rich text, tags, color highlights, exportable as Markdown/PDF. Sync across devices. **Privacy critical** — encrypt at rest; users write deeply personal reflections.

### 11.7 Accessibility

- **RTL** baseline with bidi-correct mixed Arabic+English (`dir="auto"` and proper Unicode bidi marks).
- **Screen readers:** Arabic TTS is weak; ship pre-recorded ayah audio as the "screen reader" for Arabic. NVDA/VoiceOver for English translations.
- **Dyslexia-friendly:** OpenDyslexic font option, increased line-height, no justified text.
- **Vocal-only mode:** voice-controlled navigation ("next ayah", "repeat", "translate") — huge for blind users; integrate with platform voice assistants. **Genuinely underserved.**
- **Large text:** dynamic type up to 200%, mushaf-page mode falls back to scrollable when zoom exceeds page capacity.

### 11.8 Kids mode

Simplified UI, encouraging child-friendly reciter (Mansour az-Zahrani, Idris Abkar slow), no ads ever, parental PIN, stickers on completion (no coin/gem economies).

### 11.9 Ramadan mode

Auto-enabled by hijri date; juz-a-day default goal, suhoor/iftar countdowns, Taraweeh tracker, Laylat al-Qadr odd-night reminders, Ramadan light scenes (sahoor warm dim, iftar bright).

---

## 12. Backend architecture (`apps/backend`)

### 12.1 Stack

- **Language:** Node.js 20+ / TypeScript (Fastify framework)
- **Database:** PostgreSQL (Supabase initially) + Redis (caching)
- **Storage:** Cloudflare R2 (audio cache + user recordings) → S3 + CloudFront at scale
- **Auth:** email magic link → OAuth (Apple/Google) → optional QF Tier B passthrough
- **Billing:** Stripe (Free / Premium / Pro tiers)
- **Real-time:** WebSocket via `ws` or `socket.io`

### 12.2 Database schema (preserved from technical decision framework)

```sql
-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    subscription_tier TEXT DEFAULT 'free',  -- free | premium | pro
    preferences JSONB
);

-- Family relationships
CREATE TABLE family_members (
    id UUID PRIMARY KEY,
    family_id UUID NOT NULL,
    user_id UUID REFERENCES users(id),
    role TEXT NOT NULL,  -- guardian | member | child
    visible_to JSONB     -- which family members can see this user's stats
);

-- Hifdh plans
CREATE TABLE hifdh_plans (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    target_completion DATE,
    daily_quantum TEXT,  -- 'half_page' | 'page' | 'two_pages'
    mushaf TEXT,         -- 'madani_15' | 'indopak_16'
    locked_reciter TEXT,
    created_at TIMESTAMP
);

-- Hifdh portions
CREATE TABLE hifdh_portions (
    id UUID PRIMARY KEY,
    plan_id UUID REFERENCES hifdh_plans(id),
    start_verse_key TEXT NOT NULL,
    end_verse_key TEXT NOT NULL,
    status TEXT,         -- 'new' | 'sabqi' | 'manzil' | 'weak' | 'locked'
    fsrs_state JSONB,    -- stability, difficulty, last_reviewed, due, lapses
    last_reviewed TIMESTAMP
);

-- Rating events
CREATE TABLE rating_events (
    id UUID PRIMARY KEY,
    portion_id UUID REFERENCES hifdh_portions(id),
    timestamp TIMESTAMP NOT NULL,
    fluency INT,         -- 0-3
    accuracy INT,        -- 0-3
    source TEXT          -- 'self' | 'parent' | 'asr'
);

-- Mistakes log
CREATE TABLE mistake_events (
    id UUID PRIMARY KEY,
    portion_id UUID REFERENCES hifdh_portions(id),
    verse_key TEXT NOT NULL,
    word_index INT,
    error_type TEXT,     -- omission | substitution | order | tajweed | hesitation
    timestamp TIMESTAMP
);

-- Curriculum progress
CREATE TABLE user_progress (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    lesson_id INT NOT NULL,
    completed_at TIMESTAMP,
    score FLOAT,
    attempts INT DEFAULT 1,
    audio_recording_url TEXT
);

-- TTS / generated audio cache
CREATE TABLE audio_cache (
    id UUID PRIMARY KEY,
    text_hash TEXT NOT NULL,
    reciter TEXT NOT NULL,
    audio_url TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    access_count INT DEFAULT 0,
    UNIQUE(text_hash, reciter)
);

-- Khatms
CREATE TABLE khatms (
    id UUID PRIMARY KEY,
    family_id UUID,
    type TEXT,           -- 'funeral' | 'ramadan' | 'rolling_weekly' | 'hifdh_class'
    target_completion DATE,
    created_by UUID REFERENCES users(id),
    invite_code TEXT
);

CREATE TABLE khatm_claims (
    id UUID PRIMARY KEY,
    khatm_id UUID REFERENCES khatms(id),
    user_id UUID REFERENCES users(id),
    juz_or_range TEXT,
    completed_at TIMESTAMP
);

-- Speakers & adapters (per-user device registry)
CREATE TABLE speakers (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    adapter_id TEXT NOT NULL,  -- cast | sonos | airplay | web | ha | mqtt | bt
    external_id TEXT,
    name TEXT,
    room TEXT,
    capabilities JSONB,
    paired_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_user_progress ON user_progress(user_id, lesson_id);
CREATE INDEX idx_audio_cache ON audio_cache(text_hash, reciter);
CREATE INDEX idx_hifdh_due ON hifdh_portions((fsrs_state->>'due'));
CREATE INDEX idx_mistake_log ON mistake_events(portion_id, verse_key);
```

### 12.3 Caching strategy

```python
# Redis cache for frequent verses
import redis, hashlib
redis_client = redis.Redis(host='localhost', port=6379)

def get_cached_audio(text: str, reciter: str) -> bytes | None:
    cache_key = hashlib.md5(f"{text}:{reciter}".encode()).hexdigest()
    return redis_client.get(f"audio:{cache_key}")

def cache_audio(text: str, reciter: str, audio: bytes):
    cache_key = hashlib.md5(f"{text}:{reciter}".encode()).hexdigest()
    redis_client.setex(f"audio:{cache_key}", 86400, audio)  # 24 hours
```

**Cache hit rates (from prior strategy):**

- Al-Fatiha: ~80% (most common)
- Popular surahs: ~60%
- Random verses: ~10%

**Cost savings:** 40-60% reduction in TTS generation costs.

### 12.4 Cost optimization

1. **Aggressive caching** — pre-gen top 100 verses × all reciters at startup. **60% cost reduction.**
2. **Model quantization** — `torch.quantization.quantize_dynamic`; 800MB → 200MB; 95% quality retention.
3. **Smart load balancing** — high priority → GPU; low priority → batch queue.
4. **Batch processing** — multiple verses per inference call; **80% API call reduction.**

---

## 13. Infrastructure & cost analysis

### 13.1 By scale

#### MVP (< 100 users)

```yaml
Backend: Modal.com Serverless (~$0.0005/sec, pay per use)
Frontend: Vercel Free Tier
Database: Supabase Free (PostgreSQL, 500MB, unlimited API)
Cost: $0-50/month
```

#### Growth (100-10K users)

```yaml
Backend:
  Option A: Modal.com ($200-800/month)
  Option B: RunPod Dedicated GPU ($150-400/month)
Frontend: Vercel Pro ($20/month)
Database: Supabase Pro ($25/month)
Storage: Cloudflare R2 ($15-50/month)
Cost: $400-900/month
```

#### Scale (10K+ users)

```yaml
Backend: Kubernetes on GCP/AWS, auto-scaling GPU nodes, multi-region
Frontend: Vercel Enterprise + CDN
Database: PostgreSQL (RDS/CloudSQL) + Redis cluster
Storage: S3/GCS + CloudFront
Cost: $3,000-10,000/month
Revenue (20% conversion @ $9.99): $19,980/month at 10K users
Gross margin: 85%
```

### 13.2 Hybrid serving architecture

```
┌─────────────────────────────────────┐
│  API Gateway (Vercel Edge)          │
│  - Route based on load              │
└─────────┬───────────────────────────┘
          │
    ┌─────┴─────┐
    │           │
┌───▼───┐   ┌───▼────┐
│Modal  │   │RunPod  │
│(Burst)│   │(Base)  │
└───────┘   └────────┘
```

Run 2-3 dedicated GPUs for base load; auto-scale with Modal for peak. Route by queue depth.

### 13.3 Development time estimate (preserved)

```
Phase 1 (MVP):       300-400 hours
Phase 2 (Teaching):  200-300 hours
Phase 3 (Curriculum): 300-400 hours
Phase 4 (Premium):   200-300 hours
Phase 5 (Scale):     200 hours
Total: 1200-1600 hours (6-8 months full-time)
```

---

## 14. Business model & monetization

### 14.1 Tier structure (preserved from prior strategy, refined)

```
Free Tier:
- Read full Quran (offline-first, all translations)
- Listen to any reciter (audio CDN)
- 5 verses/day TTS voice cloning generation
- 1 reciter voice for cloning
- Basic Hifdh tracker (mark portions, no FSRS)
- Basic curriculum (lessons 1-30: alphabet)
- Adhan + qibla + hijri
- 1 family member (no family features)
- Ads-supported (tasteful, Islamic-aware)

Premium ($9.99/month or $79/year):
- Unlimited TTS generation
- All 36+ reciter voices
- Full FSRS Hifdh engine (sabaq/sabqi/manzil, mutashabihat, parent dashboard)
- Full curriculum (100+ lessons)
- Family plan (up to 6 members)
- Family khatm
- Smart-home integration (Cast/Sonos/AirPlay/HA/MQTT)
- On-device ASR drill (verse-pause)
- Deep-study 3-pane (all tafsirs)
- Notes + highlights export
- No ads
- Download audio for offline
- Priority support

Pro ($19.99/month or $159/year):
- Everything in Premium
- Custom voice training (your own voice cloned)
- Advanced analytics (retention curves, weakness heatmaps)
- API access (build your own client)
- Group learning (classroom mode for teachers, up to 30 students)
- Certification program (verified completion badges)
- White-label option for masjid/school deployments
- Self-host bundle (Docker Compose images for HA/Pi)
```

### 14.2 Revenue projection (from prior strategy)

```
At 10,000 users with 20% conversion to Premium:
- 2,000 paying × $9.99 = $19,980/month
- Infra cost ~$3,000/month
- Gross margin: ~85%
```

### 14.3 Marketing channels (preserved)

```
1. Organic Content (Primary)
   - YouTube: Quran recitation tutorials, Hifdh tips
   - TikTok: Short tajweed tips, family Hifdh moments
   - Blog: SEO for "how to learn Quran recitation," "Hifdh schedule"

2. Community Building
   - Discord server for users
   - WhatsApp groups (regional)
   - Reddit (r/Quran, r/islam, r/hifz)

3. Partnerships
   - Islamic centers/mosques
   - Online Quran schools
   - Influential sheikhs/reciters
   - Hifdh academies (white-label Pro)

4. Paid Acquisition (Later)
   - Google Ads (search)
   - Facebook/Instagram (community)
   - TikTok Ads (young Muslims)
```

### 14.4 Donation reminders (in-app)

Friday + last 10 nights of Ramadan; integrate with reputable charity APIs (Islamic Relief, Penny Appeal, LaunchGood) — disclose affiliations transparently.

---

## 15. Phased roadmap (synthesizing both plans)

### v0.1 — Foundation (4-6 weeks)

**Goal:** monorepo scaffold + working web reader + HA-as-adapter

1. Monorepo scaffold (pnpm/turbo + uv workspace, shared lint/format/CI, Docker Compose dev, codegen pipeline).
2. `packages/schema` — JSON Schema for Verse, Reciter, AudioSegment, Speaker, Adapter, Plan, Portion, ReviewState.
3. `packages/data-loader` — vendor QUL SQLite, quran-align, quran-tajweed; typed accessors.
4. `packages/api-client-ts` — QF Tier A client + Qalaam-backend stub.
5. `packages/core` + `packages/hifdh-engine` — domain types + skeleton FSRS (full impl in v0.5).
6. `packages/adapter-interface` + `packages/adapters-ts/web` — Web/PWA browser-as-speaker via Media Session API.
7. `packages/adapters-ts/ha` — HA WebSocket as-adapter (drive any HA media_player from day one).
8. `apps/web` — Next.js: surah/page reader, audio playback w/ word-by-word highlight, reciter picker, basic Hifdh tracker (mark memorized).
9. `apps/backend` — Fastify with auth (email magic-link), per-user state, multi-device sync.
10. `integrations/homeassistant` — minimal `custom_components/qalaam`: config flow (API key only), single `media_player` entity, `play_ayah` service, browseable media-source.

**Deliverable:** working web app + HA integration that plays any verse on any HA-controlled speaker.

### v0.5 — Hifdh core (4-6 weeks)

1. Full FSRS scheduler in `packages/hifdh-engine` with sabaq/sabqi/manzil daily session generator.
2. Mutashabihat clusters loaded from QUL; per-user confusion graph.
3. `packages/ui-hifdh` — parent dashboard (daily summary, no real-time), one-tap rating, streak with grace.
4. `packages/ui-quran` deep-study 3-pane (Arabic + 2 translations + tafsir).
5. Tafsirs: Saheeh footnotes, Ibn Kathir abridged, Maududi Urdu, Muyassar Arabic.
6. Translations: Pickthall, Yusuf Ali, Hilali-Khan, Clear Quran, Saheeh, Mufti Taqi, Maududi, Kemenag, Hamidullah, Diyanet, Basmeih.
7. `packages/ui-quran/ayah-card` — Satori-based image generation (4-5 templates).
8. Notes + 5-color highlights + tags + Markdown/PDF export.
9. Voice search ("which ayah did I just say?") via on-device `whisper-base-ar-quran`.

**Deliverable:** full Hifdh-tracking + deep-study experience.

### v1.0 — Smart-home & casting (6-8 weeks)

1. Python device-bridge (`services/device-bridge`) hosting `pychromecast` (Cast) and `pyatv` (AirPlay) via gRPC.
2. `packages/adapters-ts/sonos` (`node-sonos-ts`).
3. `packages/adapters-ts/mqtt` (~50 LoC).
4. Verse-pause Hifdh drill via on-device ASR (Tarteel Whisper base).
5. HA integration v1: full media_player + media_source + 10+ helper entities (sensor for current verse, todo for Hifdh plan, calendar for review schedule, button for "test me", select for reciter).
6. Broadcast-group announcements (adhan-aware).
7. `packages/khatm` family khatm with smart-speaker announcements.
8. `packages/azkar` Hisn al-Muslim with morning/evening scheduled playback.
9. `packages/adhan` consolidated (Batoul lib + qibla + hijri).
10. Kids mode + Ramadan mode toggles.

**Deliverable:** smart-home native experience with Cast/Sonos/AirPlay; first proper HA release on HACS.

### v1.5 — Mobile + breadth (6-8 weeks)

1. `apps/mobile` Expo app (React Native), reusing `packages/ui*`.
2. iOS/Android offline package (~1.5GB Opus audio for 1 reciter).
3. Snapcast adapter (`packages/adapters-ts/snapcast`).
4. Word-level mistake detection (forced alignment via wav2vec2 Arabic + Quran lexicon, or Adapting Whisper-large-v3 to phoneme).
5. Family-private leaderboard with explicit ikhlas/riya' framing.
6. Masjid finder (OpenStreetMap `amenity=place_of_worship religion=muslim`).
7. Friday Surah Kahf nudge.
8. Memorize-this-surah-in-7-days mini-courses (Mulk, Yaseen, Kahf, Rahman, Waqi'ah, Sajdah, last 10 surahs).
9. Verse-of-the-day push (curated 365 ayahs by theme).
10. Apple Watch / Wear OS companion (just-recite-and-rate one-tap).

**Deliverable:** mobile parity + advanced ML.

### v2.0 — AI cloning + teach-back + Arabic curriculum (3-6 months)

1. `packages/tts-cloning` — F5-TTS production pipeline; 5 reciters MVP, scale to 36+.
2. `services/tts-worker` — Modal/RunPod GPU inference with caching.
3. `packages/prosody` — F0/energy/MFCC/tempo + DTW comparison.
4. `packages/tajweed-detector` — Madd duration + Ghunna nasalization scoring.
5. `services/realtime-feedback` — WebSocket streaming for live recitation feedback.
6. `packages/ui-recite` — recording UI, prosody visualization, side-by-side comparison.
7. `packages/curriculum` + `packages/ui-learn` — 100+ lessons across 4 levels.
8. Whisper-large-v3 fine-tuned on EveryAyah → Qalaam-WhisperAR-Quran model on HuggingFace.
9. F5-TTS fine-tuned on EveryAyah → Qalaam-F5TTS-Quran model on HuggingFace.
10. QF Tier B (PKCE+OIDC) optional integration for Quran.com bookmark sync.
11. Pro tier custom voice training pipeline.

**Deliverable:** Tarteel-class ASR + full voice cloning + complete curriculum.

### v2.5 — Depth & ecosystem (open)

1. i'rab dependency trees (defer license question on QAC GPL).
2. Multi-tafsir simultaneous compare (4-pane).
3. Live tajweed correctness scoring (research-grade, opt-in, "experimental" badge).
4. Vocal-only navigation mode (accessibility).
5. AR qibla mode (WebXR).
6. HACS quality scale → silver → gold.
7. HA Core integration submission (requires brand PR, frontend split, no `version` in manifest).
8. White-label Pro offering for Hifdh academies.
9. API SDK + developer portal.
10. Certification + verified-completion badges.

---

## 16. Risk mitigation

### 16.1 Technical risks

| Risk                          | Mitigation                                                                                                                              |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Voice quality not good enough | Use multiple models (F5, XTTS) + fine-tune on Quranic data + A/B test with users                                                        |
| High inference costs          | Cache common verses + serverless (pay per use) + model quantization + batch processing                                                  |
| ASR accuracy issues           | Fine-tune Whisper on EveryAyah + use Tarteel's open checkpoints + human verification loop                                               |
| Tajweed detection complexity  | Partner with Islamic scholars + start with basic rules + iterate based on feedback + ship as opt-in experimental                        |
| Cast/AirPlay protocol churn   | pychromecast and pyatv have track records of shipping fixes promptly; vendor-locked alternatives are worse; subscribe to issue trackers |
| QF API ToS changes            | Maintain QUL+everyayah+Tanzil as canonical fallbacks; QF only as live overlay                                                           |
| HACS / HA core rejection      | Ship to HACS first, iterate; HA core submission only after months of stable HACS use                                                    |

### 16.2 Business risks

| Risk                                        | Mitigation                                                                                                                                                                        |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Low user adoption                           | Freemium model + content marketing (YouTube, TikTok) + partner with mosques + free tier genuinely useful                                                                          |
| Competition from Tarteel                    | Focus on unique features (voice cloning, Hifdh engine, smart-home, family) + superior UX + faster iteration                                                                       |
| Religious sensitivities                     | Advisory board of scholars + transparent about AI limitations + user consent for voice usage + explicit disclaimers on AI-generated audio                                         |
| Reciter copyright concerns on cloned voices | Get explicit permission where possible (especially for living reciters) + use only PD/openly-licensed reciters in Free tier + Pro tier requires reciter consent for new additions |
| Family privacy concerns                     | Encrypt notes at rest + on-device ASR by default + opt-in for any cloud sync + transparent data export/deletion                                                                   |
| Burnout (solo dev)                          | Ship in phases + use proven libraries + monorepo enables incremental refactoring + community contributions for translations                                                       |

### 16.3 Religious / adab risks

| Risk                             | Mitigation                                                                                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI hallucinating Quran text      | **Never** ship LLM-based "Quran chat." TTS only generates from verified text input; ASR matches against canonical text only.                      |
| Tajweed scoring being inaccurate | Ship as experimental, low-confidence; never claim authoritative                                                                                   |
| Riya' from public leaderboards   | No public leaderboards. Family-private only, with explicit framing about ikhlas                                                                   |
| Surveillance feel for kids       | No real-time mistake notifications; daily summaries only; child consent toggle past age ~10                                                       |
| Adab-inappropriate gamification  | No XP/levels/coins; sticker-charts and streaks are the ceiling                                                                                    |
| Sectarian sensitivities          | Default to Hafs riwayah + Madani mushaf; offer Warsh/Qaloon and Indo-Pak as alternatives; let user pick adhan calculation method per their school |

---

## 17. Open decisions before scaffolding

1. **License of Qalaam itself** — recommend **Apache-2.0 for libraries, AGPL-3 for the SaaS backend** (matches Music Assistant pattern). Need user's decision.
2. **SaaS backend stack** — Node/Fastify (consistency with TS frontends) or Python/FastAPI (consistency with HA + ASR)? Recommend **Node/Fastify**; Python only where unavoidable (device-bridge, asr-worker, tts-worker, prosody-worker).
3. **Mobile** — Expo/RN (code-share with web) or native? Recommend **Expo**, defer to v1.5.
4. **Hosting topology** — Modal+Vercel for MVP; Hetzner+Cloudflare for self-hosting independence. Need user's preference on EU/MENA vs US presence.
5. **Tier B (user OAuth) timing** — defer until v2 per QF docs, or invest early so bookmarks sync from day one? Recommend **defer**; ship our own user store first.
6. **Brand decisions** — colors, typography (Amiri vs KFGQPC Uthman Taha for Arabic, Inter vs Geist for Latin), tone. Need design pass before final UI commits — recommend `ui-designer` agent or human design partner.
7. **Reciter copyright clearance** — for v0.1, ship only the public-domain everyayah set; for v2.0+ voice cloning, need an explicit reciter-consent process. Need legal review.
8. **Studio reciter agreements** — talk to specific reciters or their estates (Abdul Basit, Husary, Minshawi are deceased; Alafasy, Sudais, Shuraim alive) about voice-clone licensing for the Pro tier.
9. **Self-hosting bundle delivery** — Docker Compose, Helm chart, HA add-on, Pi image? Recommend **Docker Compose for v1.0, HA add-on for v1.5, Helm later**.
10. **HACS vs HA core priority** — recommend HACS-first with `version` in manifest and `quality_scale: silver`; HA core submission only at v2.0+ after frontend split.

---

## 18. Quick references

### 18.1 Key external resources

- **Quran Foundation API docs:** https://api-docs.quran.foundation/
- **Quran Foundation OAuth quickstart:** https://api-docs.quran.foundation/docs/quickstart/
- **QUL (TarteelAI/quranic-universal-library):** https://qul.tarteel.ai/ + https://github.com/TarteelAI/quranic-universal-library
- **cpfair/quran-align:** https://github.com/cpfair/quran-align
- **quran/quran-tajweed:** https://github.com/quran/quran-tajweed
- **fawazahmed0/quran-api:** https://github.com/fawazahmed0/quran-api
- **everyayah.com:** https://everyayah.com/data/
- **Al Quran Cloud CDN:** https://alquran.cloud/cdn
- **Tanzil:** https://tanzil.net/
- **EveryAyah dataset (HF):** https://huggingface.co/datasets/tarteel-ai/everyayah
- **Tarteel Whisper checkpoints:** https://huggingface.co/tarteel-ai/whisper-base-ar-quran + `whisper-tiny-ar-quran`
- **F5-TTS:** https://github.com/SWivid/F5-TTS
- **Coqui XTTS-v2:** https://github.com/coqui-ai/TTS
- **StyleTTS2:** https://github.com/yl4579/StyleTTS2
- **OpenAI Whisper:** https://github.com/openai/whisper
- **Music Assistant:** https://music-assistant.io/
- **adhan (Batoul Apps):** https://github.com/batoulapps/adhan
- **Hisn al-Muslim JSON:** https://hisnmuslim.com/

### 18.2 Companion docs in this folder

- `context.md` — original project brief
- `quranic_recitation_ai_research_roadmap.md` — full AI research roadmap (preserved verbatim; superseded by sections 8-9 of this doc)
- `quickstart_implementation_guide.md` — 48-hour AI sprint code (still useful for v2.0 TTS prototype)
- `technical_decision_framework.md` — model & infra decision matrices (preserved verbatim; superseded by sections 8 + 12-13 of this doc)

---

## 19. Success criteria

### 19.1 v0.1 success

- Monorepo builds clean (pnpm + uv) with one command
- `apps/web` reads any surah, plays any reciter, tracks Hifdh portions manually
- HA integration plays an ayah on a Cast/Sonos via `media_player.play_media`
- Code-gen pipeline produces matching TS + Python types from one schema
- License-clean: third-party notices auto-generated and complete

### 19.2 v1.0 success

- 100 alpha users using daily
- HA integration on HACS with positive reviews
- Cast/Sonos/AirPlay all working in real homes
- Verse-pause drill catches >80% of clear mistakes on `whisper-base-ar-quran`
- Family khatm completed by at least 5 families during one Ramadan

### 19.3 v2.0 success

- Voice cloning produces audio rated >=4/5 by native speakers in blind test
- Whisper fine-tuned on EveryAyah → <5% WER
- 100+ curriculum lessons, completion rate >50% Level 1 → Level 2
- 1,000 paying users; 20% conversion from free to premium
- 36+ reciters in voice library

### 19.4 12-month success

- 10K registered users
- 2K paying ($20K MRR)
- Top-3 ranking in Islamic apps category on Play Store + App Store for "Hifdh" / "Quran memorization"
- Featured in HA blog post
- At least 1 white-label Hifdh academy customer

---

_Strategy & Roadmap v1.0 — synthesized 2026-05-02. Preserves and extends `quranic_recitation_ai_research_roadmap.md`, `quickstart_implementation_guide.md`, `technical_decision_framework.md`, and `context.md`. May Allah grant success to this project._

---

## 20. 2026 Ecosystem Delta — what changed since the prior baselines

This section is a delta on top of §1-19. Each item is keyed: **prior baseline → 2026 state → recommended action**. Sections 20.1-20.4 are non-AI; 20.5-20.7 are AI/ML; the table at 20.8 summarizes priority-ordered action items.

### 20.1 Open Quran data

**TarteelAI/quranic-universal-library (QUL).**

- Prior: launched late 2024 as a centralized hub; word-level segments only for a handful of reciters.
- 2026 state: QUL is now the de-facto canonical pipeline. **Quran.com 2.0 (a Tarteel partnership) is built on top of QUL.** Audio segmentation pipeline handles ayah-by-ayah and gapless surah audio with a public `surah_audio_files` segment editor. Multiple Mushaf layouts now live: Madani, Uthmani, 15-line Indo-Pak, **16-line Indo-Pak (the new Indo-Pak digital fonts)**. The `morphology_phrases` table on QUL is now the open mutashabihat source.
- Action: **Upgrade.** Treat QUL as the primary data substrate (replace anything that previously came from disparate scrapes). Use QUL's word-segment timestamps for both highlighting AND ASR alignment. Hit `qul.tarteel.ai/resources` and `qul.tarteel.ai/mushaf_layouts` directly. Replace `cpfair/quran-tajweed` references in §4.1 with QUL's tajweed data; replace `corpus.quran.com` (GPL) with QUL's morphology when license-clean equivalence is confirmed.

**Quran-MD (NeurIPS 2025 Muslims-in-ML).**

- Prior: not in the baseline.
- 2026 state: brand-new 264k MP3 files, 32 reciters, ayah-level + word-level alignments, Arabic + English + transliteration. Suitable for ASR, tajweed detection, TTS, and multimodal embeddings.
- Action: **Adopt.** Genuinely new gold for retrieval, voice-clone reference selection, and per-word timing tasks. (https://arxiv.org/html/2601.17880v1)

**Tanzil, fawazahmed0/quran-api, Al Quran Cloud, everyayah, cpfair/quran-tajweed, Tarteel mutashabihat JSON.**

- Tanzil v1.1 frozen since Feb 2021 — keep as citable fallback; do not expect updates.
- fawazahmed0 stable, 440+ translations on `1` branch — keep for translation breadth.
- cpfair/quran-tajweed dormant since 2018-2019 — **replace** with QUL tajweed.
- Waqar144/Quran_Mutashabihat_Data — superseded by QUL morphology_phrases — **upgrade**.

**Quran.Foundation API.**

- Prior: v4 content APIs + OAuth2 client-credentials; user-tier APIs being introduced.
- 2026 state: continued additions through 2025-2026 — media-class additions to media-search intents, expanded translation_info endpoints, and an officially documented **Quran MCP server** with semantic search across verified text, translations, tafsir, and word-by-word morphology. The `/docs/updates/` page is the authoritative changelog. The MCP roadmap (last updated 2025-07-22) calls out async, streaming, multimodal/video.
- Action: **Re-evaluate.** Subscribe to `/docs/updates/`. **For any LLM-facing surface, prefer the official Quran MCP over building our own retrieval.** Confirm rate limits in their developer portal before committing — public docs do not publish hard numbers.

**New morphological corpora to evaluate:** **QAMAR (AbjadNLP 2026)** — "fully verified and accurate Quranic Arabic morphological dataset." **Morphologically Annotated Quranic Corpus (arXiv 2506.18148)** — 77,429 tokens, 3 expert linguists, manual lemma + POS. If either is permissively licensed, we finally have a commercial-friendly i'rab/morphology base; until then, keep `corpus.quran.com` (GPL) for non-distributed internal tooling only.

### 20.2 Home Assistant 2024.12 → 2026.5

**Voice / Assist (this is the big one for Qalaam):**

- **Voice Chapter 10 (June 2025):** next-gen Assist pipeline with streamed intent-progress events.
- **Voice Chapter 11 (Oct 2025, "multilingual assistants"):** up to two wake words and **two Assist pipelines per satellite** — dual-language households now native. Big deal for Qalaam (Arabic + English/Urdu/etc. simultaneously).
- **2025.7:** media-class added to media `search-and-play` intent.
- **2025.10:** relative volume control intents.
- **2026.1 "Labs human-friendly triggers":** new high-level trigger types (calendar start/end, person arrives/departs, button press).
- **2026.2:** expanded the human-friendly trigger types.
- **2026.4:** `remote.turned_on` / `remote.turned_off` triggers added; OAuth helper token-request exception handling migrated.

**Action:** upgrade the integration to (a) register a media-class on our media-search intent so Voice routes Quran queries naturally, (b) declare two pipelines (Arabic + English) for satellites, (c) emit intent-progress events for long-running ASR memorization checks.

**HACS:**

- Requires HA 2024.4.1+; `info.md` no longer rendered (use README); YAML config removed; sensor platform removed; metadata moved to a Cloudflare-hosted source.
- Action: **Keep**, migrate any legacy `info.md`/YAML, ensure `hacs/action` validation passes.

**Music Assistant (MA) status inside HA:**

- **MA is now a first-class HA-shipped integration.** Players visible as HA entities, individual control (volume, on/off) outsourceable to HA entities. Voice Control blueprints exist in `music-assistant/voice-support`.
- **Action:** Adopt MA as our media-output abstraction inside HA; do not roll our own player matrix in the HA integration. (Outside HA, our own multi-protocol stack stands.)

**Mawaqit / islamic_prayer_times:**

- `islamic_prayer_times` (core) still healthy. `mawaqit/home-assistant` still active and the only mosque-aware option (20 km mosque search around HA coordinates). Mawaqit shipped a v4 mobile app for Ramadan 2026, no breaking HA-side change.
- Action: **Keep both;** expose Qalaam-internal "prayer-time triggers" that delegate to whichever is configured.

### 20.3 Music Assistant standalone

- **2.7 (Dec 2025) "Taking over the airwaves":** Apple Music as music provider; **full AirPlay 2 player provider with HomePod sync**; remote streaming web app; **Sendspin** — a brand-new open-source multimedia streaming/sync protocol (tech preview) positioning as the open Cast/AirPlay alternative.
- **2.8 (Mar 2026) "Let's get this party started!":** Sendspin matured (close to GA); HEOS and Dashie Kiosk player providers; music sources Bandcamp, YouSee, Emby Music, NFS, SomaFM, ORF Radiothek, Yandex, Zvuk, Kion. **Multi-protocol players merged into a single logical player.**
- Action: **Adopt as gold reference.** Watch Sendspin closely — if Sendspin lands, we may want to ride it instead of inventing our own multi-protocol primitive.

### 20.4 Casting libraries — concrete updates

| Lib                                              | 2026 state                                                                                                                                                                                                                                                                            | Action                                                                                                                        |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **pychromecast**                                 | 14.0.10, Python 3.11+, mDNS/zeroconf still core; minor breaks around CEC info                                                                                                                                                                                                         | Keep — only viable Cast lib                                                                                                   |
| **pyatv**                                        | 0.17.0 (Jan 2026); MRP-over-AirPlay-2 working; **HAP-auth encryption for RAOP still not implemented** — only legacy pairing; AirPlay-2 metadata still tracked in #1255                                                                                                                | Keep but accept ceiling. **Use Music Assistant's AirPlay-2 provider when full sync needed; pyatv for direct device control.** |
| **node-sonos-ts**                                | Active; 2024 Sonos-app debacle did not break the local SOAP API; cloud `audioClip` still required for non-interrupting alerts/TTS                                                                                                                                                     | Keep; TTS path uses cloud audioClip                                                                                           |
| **Snapcast**                                     | **0.34.0 (Oct 2025)**; 0.33 added PipeWire stream/player; ESP32/ESP32-S2 microcontroller Snapclient; Rust reimplementation `snapcast-rs` separating protocol engine from app shell                                                                                                    | Upgrade. Rust core interesting if we want embeddable Snapcast                                                                 |
| **Matter Casting**                               | Deployed on FireTV Cube gen3, FireTV Edition TVs, Echo Show 15; Panasonic adopting; Plex/Pluto/Sling/STARZ/ZDF announced — **no Netflix/Disney+**. Matter 1.3 added TV push messages, dialogs, search. **MA has open discussion (#2342) for "MatterCast audio receiver" but no impl** | **Re-evaluate, do not commit.** Matter Casting in 2026 is video-first; audio support unproven. Wait one more cycle.           |
| **WebTransport / WebRTC for browser-as-speaker** | **WebTransport went Baseline March 2026** when Safari 26.4 shipped. MoQ (Media-over-QUIC) is real but universal browser MoQ is "2026-2027." HA supports WebRTC two-way audio for cameras (Hikvision integration shows the pattern)                                                    | **Adopt WebTransport for browser-speaker path now** — it's the right primitive. Defer MoQ.                                    |

### 20.5 TTS / voice cloning — supersedes §8.1-8.2 picks

**The November 2024 F5-TTS pick is no longer a complete answer.** F5-TTS code is still excellent but the original Emilia weights are CC-BY-NC. The right 2026 starting checkpoint for Arabic is **Habibi-TTS MSA (X-LANCE/SJTU, Jan 2026, Apache-2.0)** — built on F5-TTS, trained with stage-wise curriculum (95K hrs CN+EN → MSA → 12 dialects). **Use Habibi MSA weights, not original F5.**

**Three new contenders to pilot in parallel:**

| Model                                     | License                                                     | Why it matters                                                                                                                                                                                   |
| ----------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Habibi-TTS MSA**                        | **Apache-2.0** (MSA model); CC-BY-NC-SA for unified/SAU/UAE | Best Arabic open quality + commercial freedom + active community                                                                                                                                 |
| **VoxCPM2** (OpenBMB, Apr 2026)           | Apache-2.0                                                  | 48 kHz, 30 langs incl. Arabic; **fine-tunes on as little as 5-10 min audio** — most data-efficient option for cloning a single reciter. Voice-design from text is a unique controllable feature. |
| **CosyVoice 2**                           | Apache-2.0                                                  | **150ms streaming TTFB** with identical streaming/non-streaming quality; Arabic via LoRA. **Use this for verse-pause Hifdh drill** — F5/Habibi are non-autoregressive and not streaming-suited.  |
| **Chatterbox Multilingual** (Resemble AI) | **MIT, native Arabic**                                      | Most permissive Arabic-native option; streaming-capable; emotion control. Fallback if Habibi licensing changes.                                                                                  |

**Other models surveyed but not picked:**

- **OmniVoice (Apr 2026, Apache-2.0)** — 600+ langs, 40× RTF; impressive coverage but no specific Arabic-tuning advantage.
- **Sesame CSM-1B** — Apache-2.0, English-first; revisit when CSM-2 multilingual ships.
- **Kyutai TTS 1.6B** — CC-BY-4.0 with attribution, EN/FR only at release; great streaming but no Arabic until someone fine-tunes.
- **Orpheus-TTS 3B** — Apache-2.0, EN-first.
- **IndexTTS 2/2.5, Spark-TTS 0.5B, Fish Audio S2, MARS5** — all license-restrictive (NC, NC-SA, AGPL, paid commercial). **Skip.**
- **MaskGCT** — CC-BY-NC, English-first. Skip.
- **MegaTTS 3** — restrictive. Skip.
- **OpenAI gpt-realtime** — preset voices only, no custom clone. Useful for non-cloning Arabic TTS API path; not for reciter-style.
- **ElevenLabs / Inworld TTS-1.5 / Fish Audio API** — viable commercial APIs; see §20.5.4 below.

**Cross-Lingual F5-TTS (arXiv 2509.14579, Sept 2025):** lets us clone a voice without needing the prompt transcript (uses forced alignment + speaking-rate predictor). Directly relevant — we can clone Sheikh Sudais from a 10-second clip without typing what he just said.

**Tarteel still has not open-sourced their ASR.** QUL is text/audio only. Tarteel's NeMo/Riva production stack remains closed. We must build our own ASR fine-tunes.

**Whisper status:**

- **Whisper-large-v3 (NOT turbo)** is still the open default for Arabic. Turbo's 4-layer decoder hurts low-resource langs.
- **`gpt-4o-transcribe` (API)** is the new accuracy ceiling for Arabic — meaningful improvement over open Whisper.
- **No Whisper v4 from OpenAI as of May 2026.**
- **NVIDIA Canary-1b-v2 / Parakeet-tdt-0.6b-v3 do NOT cover Arabic** — skip.

**Quranic-specialized open models:**

- **`tarteel-ai/whisper-base-ar-quran`** + **`whisper-tiny-ar-quran`** — still the on-device baseline (per §7.5).
- **`KheemP/whisper-base-quran-lora`** — 74M params, ~6% WER, diacritic-sensitive; **viable for on-device mobile inference**.
- **`TBOGamer22/wav2vec2-quran-phonetics`** — first open Wav2Vec2 phonetic Quran model; outputs sound-level labels for word-/phoneme-level mistake detection.
- **`IbrahimSalah/Wav2vecLarge_quran_syllables_recognition`** — Quranic syllable-level wav2vec2 (same author as Arabic-F5-TTS-v2).
- **`MahmoudAshraf97/ctc-forced-aligner`** — modern default over MFA; uses Wav2Vec2/HuBERT/MMS pretrained models; recommended Python pipeline.

#### 20.5.1 Tajweed-aware modeling — new academic work

This is the biggest research advance since November 2024:

- **Iqra'Eval Shared Task @ ArabicNLP 2025 (Suzhou)** — first open MDD (mispronunciation detection & diagnosis) benchmark using QuranMB.
- **"Bringing Tajweed-Aware Phonemes to Qur'anic Mispronunciation Detection" (NeurIPS 2025 MusIML)** — formalizes a tajweed-aware phonemizer; explicitly notes **Madd is a duration phenomenon mapped to long-vowel symbols** (not new phonemes). Prosody/duration models capture it, not new phoneme inventories.
- **"Adapting Whisper-large-v3 as Speech-to-Phoneme for Qur'anic" (ArabicNLP 2025)** — published recipe; Whisper-large-v3 fine-tuned to output phoneme sequences. **Most relevant to our Hifdh mistake-detection use case.** As of May 2026 no public weights checkpoint is confirmed; **implement the recipe ourselves** — architecture is straightforward (CTC head on Whisper-large-v3 encoder).
- **Hafs2Vec (ArabicNLP 2025)** — Iqra'Eval submission; IqraEval HF org hosts dataset/space.
- **IQRA 2026 (Interspeech 2026 challenge)** on automatic pronunciation assessment for MSA — preprint at arXiv 2603.29087. Actively recruiting.
- **No published TTS conditions on tajweed at synthesis time as of May 2026.** Research gap and a potential Qalaam differentiator: combine the NeurIPS 2025 phonemizer with F5/Habibi word-level duration boosts.

#### 20.5.2 Streaming TTS — sub-200ms for verse-pause drill

For Qalaam's verse-pause Hifdh drill:

- **CosyVoice 2 streaming mode + Habibi-MSA fine-tuned weights** is the most realistic open self-host path.
- **Kyutai TTS 1.6B** is the cleanest if/when an Arabic fine-tune exists.
- **F5-TTS / Habibi are non-autoregressive — do NOT stream-generate.** Pre-generate the verse and stream the file.
- **gpt-realtime** for non-cloning Arabic narration if we want a low-friction path.

#### 20.5.3 Self-hosted inference stack

- **`faster-whisper` is still the default** for Whisper on CUDA (CTranslate2 backend, ~4× speedup at same accuracy).
- **`whisper.cpp` v2** for CPU/Metal/edge — improved through 2025 but slower than mlx-whisper on M-series.
- **`mlx-whisper` / `lightning-whisper-mlx`** is **2× faster than whisper.cpp on Apple Silicon** (Jan 2026 benchmark). **Dev default for MacBook teams.**
- **`vllm-tts` is NOT a thing** — vLLM is LLM-only. There's a vLLM-omni issue tracking F5-TTS support but no shipped backend.
- **NVIDIA Triton Inference Server 26.03 (Apr 2026)** — production wrapper. Pair Triton + custom Python/PyTorch backend for F5/CosyVoice.
- **TensorRT-LLM** does not yet ship official F5/CosyVoice kernels; community ports exist with ~2× speedup.

#### 20.5.4 GPU economics 2026

- **RTX 5090 (32 GB GDDR7, ~$2,000)** **frequently matches or exceeds H100** on single-GPU low-batch INT8/FP8 inference (0.9-1.1× H100). **New prosumer sweet spot for self-hosting Habibi-TTS / F5.**
- **H100** still wins by 1.5-2× on multi-GPU training and large-batch throughput (HBM3 + NVLink).
- **L4 / A10G / L40S** still relevant for TTS without H100-class memory; A10G on AWS at ~$1/hr.
- **B200** shipping but oversubscribed — not relevant for early-stage Qalaam.
- **Etched Sohu** had not shipped to customers as of March 2026 — ignore.
- **Groq** acquired by NVIDIA (Dec 2025, $20B); Groq 3 LPU at GTC 2026; currently doesn't host TTS — Whisper Large v3 Turbo is on Groq, no TTS yet.

**For Qalaam:** single RTX 5090 box (~$2K hardware, ~$0.76/hr serverless equiv) handles ~8-12 concurrent F5-TTS streams comfortably; more for streaming CosyVoice 2.

**Cloud price ladder (Apr-May 2026):** RunPod serverless RTX 4090 $0.34/hr → RTX 5090 $0.76/hr; Modal A100 40GB ~$2.10/hr (best DX); Replicate per-second (cold starts hurt UX); skip Lepton/CoreWeave for early-stage.

#### 20.5.5 ElevenLabs / commercial APIs — should we white-label first?

**Math:**

- Quran ≈ 330,000 Arabic words ≈ 1.6M characters.
- Generating the full Quran in one reciter voice ≈ $50-150 ElevenLabs credits, **once** (then cache → CDN).
- Per active Hifdh user generating 50 verses/day at ~150 chars/verse ≈ 7,500 chars/day ≈ **~$0.25/user/month**.

**Verdict:** For MVP / first 1,000 users, **ElevenLabs (Creator $22/mo or Inworld TTS-1.5 Mini, similar pricing, lower latency) is cheaper and faster than self-hosting**. No GPU infra, sub-300ms latency, high quality. The blocker is reciter likeness — see §22.

**Break-even:** ~5,000 active Hifdh users or ~8-15M chars/month. Beyond that, self-host Habibi-TTS-MSA fine-tuned on EveryAyah on a single RTX 5090.

#### 20.5.6 License delta summary

| Change                                                             | Impact for Qalaam                                     |
| ------------------------------------------------------------------ | ----------------------------------------------------- |
| **Coqui defunct; XTTS-v2 base = CPML (NC)**                        | Skip permanently                                      |
| **F5-TTS code MIT; F5 Emilia weights CC-BY-NC**                    | Use code from F5; train on commercially-licensed data |
| **Habibi-TTS MSA Apache-2.0**                                      | **Adopt as starting checkpoint**                      |
| **VoxCPM2 Apache-2.0**                                             | Adopt for data-efficient cloning                      |
| **OmniVoice Apache-2.0**                                           | Available; not currently best Arabic                  |
| **Chatterbox Multilingual MIT, native Arabic**                     | Adopt as fallback                                     |
| **Sesame CSM-1B Apache-2.0**                                       | Watch for CSM-2 multilingual                          |
| **Orpheus-TTS Apache-2.0**                                         | Watch                                                 |
| **Kyutai TTS CC-BY-4.0**                                           | OK with attribution                                   |
| **Spark-TTS / IndexTTS 2 / MaskGCT / MegaTTS 3 / Fish S2 / MARS5** | Restrictive; skip                                     |

### 20.6 Backend / SaaS stack

- **Fastify v5** GA, used in modern Better-Auth + Fastify multi-tenant SaaS patterns. Keep our pick.
- **Prisma v6** vs **Drizzle**: Prisma still wins on ecosystem/tooling for complex schemas; Drizzle wins on SQL-closeness/edge runtimes. **Supabase + Prisma** = safe SaaS default. **Turso + Drizzle** = sharpest edge stack — keep on the list for self-host bundle.
- **Auth in 2026:** **Clerk** = best DX for React-shaped consumer SaaS; **WorkOS** = best for B2B (SSO/SCIM/admin portal — has been the breakout in 2025); **Supabase Auth** = bundled; **Better-Auth** (open-source) credible self-hosted alternative.
- **Stripe Billing:** 2025-06-30 "basil" API or later for `flexible` billing-mode Checkout Sessions. **Major 2026 release: AI-usage metering** — token counts, model API calls, agent tasks via Meter Events; integrates with Vercel AI Gateway and OpenRouter for automatic cost passthrough.
- **Cloudflare R2:** $0.015/GB-month standard, $0.01/GB-month infrequent-access, **0 egress** (durable differentiator), 10 GB free. Class A $4.50/M, Class B $0.36/M.

**Action:**

- **Adopt Stripe AI metering** for voice-clone usage billing.
- **Adopt Cloudflare R2** for reciter audio (bandwidth profile = lots of audio egress = R2 wins overwhelmingly vs S3).
- Pick **WorkOS** for B2B (school/madrasa) tier.
- Pick **Clerk or Supabase Auth** for consumer tier.

### 20.7 Frontend / FSRS / misc

- **React 19** GA. **React Compiler 1.0** released Oct 7, 2025 — production-ready, used in Meta. **Adopt** (zero memo cost).
- **Next.js 15.x mainline** is current stable; **Next.js 16 shipped** with routing/caching improvements but **stay on 15 mainline** for v0.1.
- **Tailwind v4 + NativeWind v5** — pin minor versions; v4→v5 migration involves `nativewind@preview`, `react-native-css`, RN-Reanimated bumps.
- **wavesurfer.js** still leader for waveform UIs; **AudioWorklet** is the right path for any real-time analyzer (memorization listener, recitation cadence).
- **Arabic rendering:** continue using SIL Harmattan / KFGQPC fonts shipped via QUL Mushaf Layouts; combine with `@react-native-community/text` RTL flow + `unicode-bidi: plaintext` for mixed strings.
- **FSRS:** Anki shipped **FSRS-5** then **FSRS-6 in Anki 25.07 (July 2025)**. FSRS-6 reworks same-day-review stability with new params w17/w18 (grade weight) and w19 (S-saturation). Use **`fsrs-rs` (Rust) or `py-fsrs`** which track the algorithm. **No Hifdh app advertises FSRS-6 by name — defensible Qalaam wedge.**
- **batoulapps/Adhan** unchanged — keep.
- **`adhan` Python/JS/Swift/Kotlin** — no calculation methods added 2025-2026; catalog stable.

### 20.8 2026 Hifdh app landscape

- **Tarteel 5.76.5 (Apr 2026)** — widgets, distraction-free video mode, mistake detection, refreshed Turkish UI. **ASR still server-side (no on-device shipped).** Still the leader. Multiple Tarteel-derived/independent open Whisper fine-tunes and Wav2Vec2 phonetic ASR exist on HF — viable for an on-device first-mover (us).
- **Quranly** — habit-formation focus; no Hifdh-engine breakthrough.
- **Mathani** (new entrant 2025) — structured Hifdh + spaced repetition + quiz formats (fill-in-blank, ayah ordering, "what comes next") + leaderboards and team battles. **Closest competitor to Qalaam.**
- **Quoranize V2** (2025-2026) — claims on-device-style "AI voice recognition" + smart spaced repetition + per-recitation accuracy feedback. Filter-by-mastery review.
- **Quran IQ** — confidence-based repetition.
- **Hifz Tracker (Sidr Productions)** — simple log + calendar.
- **Bayyinah Academy** — courses, not Hifdh tracking.

**Nobody publicly ships FSRS by name. Quoranize/Quran IQ describe "smart"/"confidence-based" SR. Mutashabihat-aware drills exist as static features in a few apps but no SR-integrated mutashabihat-aware engine.**

**Action:** Re-evaluate competitive positioning. Mathani + Quoranize V2 are credible competitors. Our differentiators (FSRS-6 by name, mutashabihat-aware SR, on-device Whisper-Quran or Wav2Vec2-phonetic, multi-protocol cast, voice cloning, family halaqah) are all still genuinely open lanes.

### 20.9 Top-line priority-ordered actions from §20

1. **Re-platform on QUL** for text/audio/segments/mushaf — single largest leverage.
2. **Switch starting TTS checkpoint from F5-TTS-Emilia to Habibi-TTS-MSA (Apache-2.0).**
3. **Ship on-device Whisper-Quran-LoRA ASR** — uncontested in app market (Tarteel still cloud).
4. **Adopt FSRS-6 by name + mutashabihat-aware drills** — defensible wedge.
5. **HA integration: dual-pipeline + media-class search intent + MA-as-output abstraction.**
6. **Use WebTransport (now Baseline) for browser-speaker; defer Matter Casting and MoQ.**
7. **Cloudflare R2 + Stripe AI metering** for SaaS billing/storage spine.
8. **Replace cpfair/quran-tajweed with QUL tajweed; replace corpus.quran.com (GPL) with QAMAR or arXiv 2506.18148 if licenses permit.**
9. **For TTS streaming (verse-pause drill): use CosyVoice 2 (150ms TTFB), not F5/Habibi.**
10. **For MVP voice cloning: white-label ElevenLabs/Inworld until ~5K active users, then self-host Habibi on RTX 5090.**

---

## 21. Competitive UX deep-dive — Tarteel + Quranly

This section distills field research on the two most-respected apps in the category into design principles for Qalaam.

### 21.1 Who makes what

**Tarteel AI** — Founded 2018 by Anas Abou Allaban (CEO/CSO), Abdellatif Abdelfattah, Mohamed Moussa (CTO). HQ Mansfield, US. Backed by Founders Inc. 15M+ downloads claimed, 4M+ active users in 150+ countries. Android rating ~4.78-4.83. Ships QUL as an open-source Quran resource hub.

**Quranly** — Founded by Esa Khan, UK-based. "World's first habit-building Qur'an app." Distribution-led (TikTok-heavy), Duolingo-of-Quran positioning. iOS 4.6-4.7, Play 4.5+. Uses Adapty for paywall management.

**Brief tension:** Tarteel = "study tool with AI conscience." Quranly = "habit app with Islamic skin." **Qalaam's lane = family + home + AI continuity** — neither competitor is even trying for it.

### 21.2 Visual design language

#### Tarteel

- **Palette:** Restrained, "scholarly tech." Deep teal/navy primary (`#1B4D5A`-ish family), warm off-white background (`#F7F4EE` cream), gold/amber accent for highlights and bookmarks. Mistake-detection colors are functional and load-bearing: **red** (errors), **green** (correct), **yellow** (tashkeel mistakes), **brown** (peeked words), with **orange-yellow gradient for historical frequency heatmap**. Dark mode is true dark (~`#0E1416`), not just inverted.
- **Typography:** Latin = humanist sans (Inter / SF System on iOS). Arabic = **KFGQPC HAFS Uthmanic Script (QPC V2)** primary; **IndoPak** as user-selectable alternative. Custom font sizing is a settings primitive.
- **Iconography:** Custom outline set, 1.5-2px stroke, rounded terminals. Mic icon is a recurring brand motif.
- **Density:** Airy. Cards with generous padding, ~16-24px corner radius, soft shadows. Premium and quiet.
- **Personality:** Premium / serious / academic. Adult-coded. Reads like a study app (Anki, Readwise) more than a religious app.

#### Quranly

- **Palette:** Expressive and "alive." Emerald/forest green primary, peach/coral accents, **dynamic color theme that shifts with time of day** (morning warm, evening cool). Multiple "reading themes" beyond just light/dark.
- **Typography:** Latin = geometric sans (Poppins/SF family). Arabic offers Uthmani and IndoPak with adjustable size. Hasanat counter uses tabular numerics.
- **Iconography:** Filled and rounded; closer to Duolingo/Headspace. Heavy 3D-ish soft illustrations and emoji-like glyphs for badges/levels ("Break the Egg," "Beast Mode").
- **Density:** Information-rich on Home (streak, verses, time, hasanat, weekly tracker, daily challenge). Larger radius (~20-28px), generous shadows.
- **Personality:** Playful / motivating / Gen-Z / Duolingo-coded. **Divisive:** App Store reviews specifically call out streak notifications as feeling "demotivating" and "shifting focus from Quranic rewards to maintaining streaks."

**Qalaam takeaway:** Default to **Tarteel-grade calm** (cream/teal/gold, restraint, generous whitespace). Add **Quranly-style optional theming** and a **kids' mode that ramps expressiveness up**. Tarteel's restraint is the right long-term aesthetic for adult/family users; Quranly's expressiveness is the right hook for first-time users and kids.

### 21.3 Information architecture

- **Tarteel:** Bottom tab bar — Home / Read (mushaf) / Memorize / Search (voice) / Profile. Onboarding: account → mic permission → goal-planning step (Range / Portion / Schedule).
- **Quranly:** Bottom tab bar — Home (habit) / Quran / Stats / Profile. Onboarding: persona detection → daily verse target (defaults gently low) → font → reciter → notifications → **soft paywall with 3 tiers including "I can't afford it."**

**Qalaam takeaway:** Borrow Quranly's **tiny-habit onboarding ramp ("1 verse is fine")** and the **"I can't afford it" tier** (best brand moment in either app). Borrow Tarteel's **depth in reader settings**.

### 21.4 Reader experience

- **Tarteel:** Page-faithful Madani + Adaptive Mode (scrollable, large-text, ayah-highlighted). Long-press a verse → action sheet (Copy / Share / Bookmark / Translations / Tafsir). Translation/Tafsir in drawer/sheet, one tap away. Voice-first search ("Shazam for Quran"). Mini-player → full-screen → lockscreen integration.
- **Quranly:** Page-faithful + continuous scroll. **Multiple reading themes (paper/sepia/dark/etc.).** Tap-to-show translation per ayah; **vibration haptic on advancing to next verse** — reviewers specifically praise this. **Personal Notes** (Tarteel does not have).

**Qalaam takeaway:** Ship **all three** — Tarteel-grade mushaf precision + Quranly-grade haptics/notes + the **per-word tap glossary that NEITHER ships well**.

### 21.5 Memorization / Hifdh UX (the core comparison)

**Tarteel — gold standard here.** Three pillars:

1. **Range / Portion / Schedule goal trichotomy** — declare a Goal with three knobs: **Range** (e.g., Juz 29-30), **Portion** (1 page / 1 Juz / N minutes / unspecified), **Schedule** (daily / weekly / specific weekdays / no schedule). Tarteel auto-decomposes the goal into sessions. **Borrow this verbatim.**
2. **Hidden Verses mode** — page renders blank/blurred and the AI reveals each word as you correctly recite, in real time. **"Peeking" is metered** — peeked words colored brown so you can see your dependency map later.
3. **Mistake detection (premium):**
   - In-session feedback: word flagged with dotted underline + red color. After self-correction, underline disappears but red stays as session record.
   - Color semantics: **red = error, green = correct, yellow = tashkeel mistake, brown = peeked**.
   - Latency: sub-second; "instant"/"real-time." **Requires internet (cloud ASR).**
   - **Post-hoc, NOT interruptive** — AI does not stop you mid-recitation. **Critical, and Qalaam should match it.**
   - Reviews complaint: false positives in known-bad spots. #1 functional grievance.

**Tarteel's historical mistake heatmap** — red/orange/yellow gradient over the mushaf showing frequency of past errors. **Best progress visualization in the category.** You can "work back from red to no-color" over time.

**Family Plan** — $13/mo annual = $156/yr for 5 seats, **web-only purchase**. Separate "Tarteel Parents Portal" Android app. Parents see study time, accuracy, completed sessions, and specific mistakes per child.

**Gamification:** Streaks, heatmaps, milestone-style. **No leaderboards.** Adult-coded.

**Quranly Hifdh** — shallow. Audio repeat (ayah/range/Surah) and tracking present but **no live mistake detection, no hidden-verse mode, no spaced-repetition**. Strength is the _habit_ layer wrapping Hifdh: streaks, levels (Alif/Laam… 4 levels with badges), challenges ("Break the Egg" 2-min, "Beast Mode" 30-min), **private friends-only weekly leaderboard**.

**Qalaam Hifdh takeaway:**

- **Borrow Tarteel's Range/Portion/Schedule trichotomy verbatim.**
- **Borrow Tarteel's post-hoc (non-interruptive) feedback model as default.**
- **Borrow Tarteel's red→orange→yellow→clear heatmap colors and visual language.**
- **Ship on-device ASR** so users without stable internet (Pakistan, rural Indonesia, Subway) can still get mistake detection — solves Tarteel's #1 review complaint at the architectural level.
- **Ship mutashabihat-aware review queue** — surface similar verses together when they're a confusion source. **No app does this.**
- **Ship voice-cloning your own teacher** — a genuine differentiator with massive emotional moat (see §22 for licensing).
- **Ship family/halaqah co-Hifdh** with parent dashboards that include voice notes and praise prompts, not just metrics.

### 21.6 Listening / audio UX

- **Tarteel:** Reciter list with **offline download per Surah** (collapsible accordion). Background, mini-player, lockscreen. Verse-by-verse highlight while playing is **core and free**. Listening features have a dedicated tutorial series — speed, repeat range, follow-along all customizable.
- **Quranly:** Reciter selection, audio repeat (ayah/range/Surah). Less depth.

**Neither does:** multi-reciter A/B comparison, smart-speaker (Alexa/HomePod) handoff, CarPlay-first design, "listen with Mom 800km away" co-listening — **all Qalaam differentiators**.

### 21.7 Learn / curriculum

**Both apps weak.** Quranly markets "personalized learning plans" but actual surface is challenges/nudges. Tarteel publishes blog content but does not ship in-app curriculum. Separate "Tarteel Academy" iOS app exists as a sibling product.

**Qalaam takeaway:** **Wide-open lane.** Don't be preachy; be a coach.

### 21.8 Subscription / paywall

|                     | Tarteel                                        | Quranly                      |
| ------------------- | ---------------------------------------------- | ---------------------------- |
| Monthly             | ~$7.50/mo (annual) ≈ $90/yr                    | $4.99/mo                     |
| Annual              | ~$90/yr                                        | $39.99/yr                    |
| Lifetime            | iOS up to $239.99 (likely lifetime SKU)        | £49 (75% off promo)          |
| Family              | $13/mo annual = $156/yr, 5 seats, **web-only** | n/a                          |
| Trial               | 7-day                                          | n/a                          |
| "I can't afford it" | n/a                                            | **Yes, in onboarding**       |
| Hero pitch          | AI tools / Mistake Detection                   | Habit / streaks / challenges |

**Quranly's "I can't afford it" tier is the most distinctive paywall framing in either app.** Founder-stated policy: app is free for anyone who can't afford it.

**Qalaam takeaway:** **Steal the "I can't afford it" tier verbatim.** Make Family Plan **the** plan, not an upsell — given Qalaam's family/smart-home angle. Adapty for paywall A/B testing is the right tool.

### 21.9 Moments of delight

**Tarteel:**

- The moment a hidden verse reveals itself word-by-word as you recite — genuinely thrilling first-time UX.
- Voice search "Shazam for Quran" — recite half a phrase, app jumps to it.
- Historical-mistakes heatmap "oh wow" moment in tutorials.

**Quranly:**

- Vibration haptic on advancing to next verse — small but reviewer-beloved.
- Hasanat counter ticking up rapidly while reading — dopamine.
- Time-of-day color shift on home screen.
- "Break the Egg" / "Beast Mode" challenge naming — copy personality.

### 21.10 What each gets wrong

**Tarteel:**

- Mistake-detection false positives in recurring spots — #1 review complaint.
- **Internet dependency** — cloud ASR means no offline Hifdh.
- Subscription friction — paywall locks the feature most users came for.
- **No personal notes**, weak journaling.
- Family Plan is web-only purchase — friction.
- **Adult-only — no kids' mode, no halaqah.**
- **No smart-speaker / CarPlay focus.**
- Aesthetic slightly austere for kids.

**Quranly:**

- **Streak guilt** — reviewers complain notifications "condescending and demotivating."
- Buggy / slow loading; repeated logout-loops.
- **No automatic device sync.**
- **No mistake detection at all.**
- Hifdh depth is thin — habit app with Quran inside.
- Limited reciter library.
- Can't count Quran reading done outside the app.

### 21.11 Top 5 features Qalaam should pull

**From Tarteel:**

1. **Range / Portion / Schedule goal trichotomy** — verbatim primitive.
2. **Mistake highlight color system** (red error / green correct / yellow tashkeel / brown peeked) — pre-learned visual language.
3. **Historical-mistakes heatmap** with frequency-decaying color (red→orange→yellow→clear).
4. **Voice search ("Shazam for Quran")** as a free, signature capability.
5. **QUL public-good contribution** — Tarteel built community goodwill by open-sourcing data; Qalaam should contribute back to QUL rather than re-source.

**From Quranly:**

1. **"I can't afford it" free tier** in onboarding.
2. **Verse-advance haptic + ticking hasanat counter** — small, dopamine-rich.
3. **Tiny-habit goal default (1 verse minimum)** — gentler ramp than Tarteel.
4. **Private friends-only weekly leaderboard** (opt-in, invite-controlled, never global) — right gamification posture for religious context.
5. **Topical search** ("names of Allah," "stories of the prophets").

### 21.12 What NEITHER ships — Qalaam differentiators

1. **On-device ASR** for mistake detection (works on a plane / rural / Subway). Solves Tarteel's #1 functional complaint architecturally.
2. **Voice-cloning your teacher / parent / favourite reciter** — cloned voice walks alongside in earbuds, corrects in _teacher's_ voice, with a tone you trust. Massive emotional moat. (Requires explicit consent flow + watermarking — see §22.)
3. **Family halaqah** — multiplayer Hifdh: parent assigns portion to child, gets voice-note evidence + heatmap + AI summary + can leave a praise sticker or audio reply. Better than Tarteel's analytics-only Parents Portal.
4. **Smart-home / CarPlay-first** — "Hey Qalaam, continue from Surah Al-Kahf verse 19 in Mishary's voice." Lockscreen-as-mushaf widget for elders.
5. **Mutashabihat-aware review** — surface similar verses together when confusion source.
6. **Cross-app reading import** — count a Quran read in a paper mushaf via "I just read pages 50-55" log + voice spot-check. Solves Quranly's "outside the app" complaint.
7. **Co-listening across distance** — synced playback so a parent in London and a child in Lahore can listen to a Surah together, with text chat per ayah.
8. **Non-judgmental streak ethics** — "you missed yesterday, no penalty, here's a 30-second make-up portion." Quranly's tone problem is a moat for someone who solves it.
9. **Local-first encrypted family vault** — privacy-first parental dashboards (Tarteel's are fine but cloud-native).
10. **Reading mode Sajdah / Ruku tactile cues.**

### 21.13 Visual references

**Tarteel screens to study:**

1. App Store screenshot 1 — "Memorization Mistake Detection in Action": dotted-underline red over Arabic word mid-recitation. **Match the restraint, differentiate the palette (warmer).**
2. Hidden Verses tutorial (YouTube `UrKJSa3S5AU`) — words materializing on a blurred page. Study reveal animation timing.
3. Mistake-detection demo (YouTube `DPxQU3NPbLU`) — full session arc.
4. Historical Mistakes heatmap screen (App Store carousel) — red/orange/yellow over Mushaf page. **Visual vocabulary to inherit.**
5. Goal Planning screen — Range / Portion / Schedule trichotomy.
6. Tarteel UX/UI Case Study by Mustafa Kamel on Behance (`behance.net/gallery/124476305`) — third-party but useful mood-board.
7. Adaptive Mode reading screen — ayah highlighted in cream-yellow, translation inline.
8. Voice Search ("Shazam for Quran") screen — listening animation, mic-pulse motif.
9. Tarteel.ai homepage hero — type ramp, brand color, "AI Quran" framing.
10. Family Plan landing (`tarteel.ai/family`) — multi-seat visual treatment.

**Quranly screens to study:**

1. quranly.app homepage — green/coral palette, illustrated 3D-ish hero.
2. App Store screenshot 1 — Home with weekly tracker strip, today's challenge, hasanat counter, streak.
3. Onboarding paywall (Adapty paywall library `adapty.io/paywall-library/quranly`) — three tiers including "I can't afford it." **Direct visual reference; the screen to study.**
4. "Break the Egg" / "Beast Mode" challenge cards — copy tone and badge illustration.
5. Hasanat counter screen — tabular numerics, ticking animation.
6. Reading themes picker.
7. Weekly leaderboard (private friends).
8. Calendar/streak heatmap on Profile.
9. Time-of-day-aware home (morning/midday/dusk screenshots).
10. ScreensDesign showcase (`screensdesign.com/showcase/quran-by-quranly`) — clean external collection.

### 21.14 Qalaam design principles synthesized

1. **Domestic warmth, not Duolingo-glow.** Family-first apps (Hearth, Tinybeans) > language-learning apps (Duolingo, Memrise) as aesthetic reference.
2. **Restraint as default, expressiveness as kids' mode toggle.**
3. **Inherit Tarteel's mistake-color vocabulary** — users already know it; relearning it would be hostile.
4. **Adopt Tarteel's Range/Portion/Schedule trichotomy** as the canonical Hifdh-goal primitive.
5. **Adopt Quranly's "I can't afford it" tier and 1-verse default** as the canonical onboarding empathy primitives.
6. **Always non-interruptive feedback** during recitation (post-hoc only).
7. **Family Plan as default plan**, not upsell.
8. **Zero global / public leaderboards.** Family-private only, framed as encouragement.
9. **Streaks with grace days**; never punish a missed day. ("Welcome back, here's where you left off.")
10. **Day 1 multi-device sync.** No manual logout/login.
11. **Personal notes from day 1.** Encrypted at rest.
12. **YouTube-first content marketing** for the family/parent audience; TikTok for the youth/Hifdh-student audience.

---

## 22. Reciter voice-licensing playbook

The single biggest legal/ethical risk in §8's voice-cloning ambition. Status as of May 2026:

### 22.1 Legal landscape

- **Tennessee ELVIS Act (2024)** — first US state to extend right-of-publicity to AI voice clones; criminalizes unauthorized digital voice replication.
- **US AI Transparency and Voice Rights Act (early 2026)** — federal disclosure requirement for AI-generated voices in commercial contexts (advertising, political, entertainment).
- **WIPO 2025 report** — voice cloning cases up 300% YoY since 2023.
- **NY Court ruling (Skadden, July 2025)** — voice clones can violate right of publicity even without name use.
- **No fatwa or scholarly ruling specifically on reciter voice cloning** has surfaced in public English-language sources for 2025-2026. Scholars who address adjacent issues (e.g., listening to Mishary's recitations) have not addressed synthetic regeneration. **Expect a fatwa wave once a Qalaam-class app actually ships.**
- **No reciter or estate has publicly issued an AI-clone license.** Distribution permission for recordings (qurancentral, qul.tarteel.ai) is **not** the same as cloning permission.
- **GCC jurisdictions** (Saudi, Kuwait, UAE) are receptive to right-of-publicity claims under personality-rights doctrine — relevant given target audience and reciter origin.

### 22.2 Three product framings (least → most risky)

1. **Qalaam-house voice (DEFAULT, ALL TIERS).** Train on a corpus of multiple reciters and present an unattributed Qalaam-house voice that doesn't claim to be any individual. Avoids right-of-publicity entirely. Loses some emotional appeal but is the right default.
2. **Opt-in user voice cloning (Pro tier).** Let students/parents/teachers clone _their own_ voice (or a teacher's voice with explicit documented consent + signed release). Privacy-vault stored on user-device or encrypted cloud. Right-of-publicity is not implicated when the subject consents.
3. **Licensed reciter voices (premium add-on, post-licensing).** For specific reciters, pursue formal licensing — Mishary's Alafasy Foundation, Saudi Presidency of the Two Holy Mosques (Sudais, Shuraim), reciter estates (Abdul Basit, Husary, Minshawi). At least one major Quran-tech NGO is reportedly working on this; could become a moat.

### 22.3 Operational guardrails

- **Do not ship reciter voice clones in public/marketing-facing features without licensing.** Right-of-publicity claims travel internationally.
- **Always watermark AI-generated audio.** Inaudible perceptual watermark + visible "AI-generated" badge on UI. Required for US disclosure compliance after AI Transparency Act.
- **For internal demos and testing**, fine-tunes are fine — copyright/right-of-publicity claims trigger on commercial use and public distribution.
- **Consent flow for opt-in voice cloning** must include: (a) plain-language explanation, (b) the user's recorded statement of consent, (c) signed release, (d) withdrawal mechanism (delete-all + key revocation).
- **Tajweed-aware "Qalaam-house voice"** is the unique product wedge that no app has — ship this first; avoid reciter naming.

### 22.4 Path to licensed reciter voices

| Step | Action                                                                                                                                                                    | Owner                     |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| 1    | Identify and contact reciter offices: Alafasy Foundation, Saudi Presidency of the Two Holy Mosques, deceased-reciter estates (via Darussalam, Maktabat al-Haramayn, etc.) | Founder + counsel         |
| 2    | Draft a clear license-and-revenue-share term sheet (e.g., 10-20% of voice-clone revenue + audit rights + revocation clause + adab/sharia-compliance clauses)              | Counsel                   |
| 3    | Get fatwa support from a respected scholar before public launch (in-app advisory note: "voice cloning of [reciter] is permitted by [scholar], with [reciter consent]")    | Founder + scholar advisor |
| 4    | Pilot with one or two living reciters before adding deceased-reciter estates (cleaner consent path)                                                                       | Product                   |
| 5    | If formal licensing fails, ship Qalaam-house voice + opt-in user-cloning indefinitely                                                                                     | Product                   |

### 22.5 Bottom line

**Qalaam's v0.1 through v1.5 should ship with no reciter cloning at all.** The Qalaam-house voice (multi-reciter blend, unattributed) plus opt-in user voice cloning (Pro tier) is sufficient to deliver the teach-back vision while sidestepping legal risk. **Reciter licensing is a v2.5+ initiative,** parallel-tracked with legal/scholar engagement starting now.

---

## 23. JTBD Foundation — formal jobs, outcomes, opportunity scores

Per CLAUDE.md Principle 04 ("The Job is the Unit of Analysis"), this section defines Qalaam's market in JTBD/ODI terms. **Every feature in §15's roadmap must trace to one or more outcome statements below; every ADR in §25 must justify itself against an outcome with opportunity > 12.**

Opportunity scores below are **provisional Q1 2026 estimates** based on (a) Tarteel/Quranly App Store review thematic analysis, (b) `r/Quran` and `r/hifz` thread mining, and (c) the competitive gap analysis in §21. They will be replaced with survey-derived scores during v0.5 once we have ≥200 Hifdh-active beta users.

### 23.1 Core functional jobs (job-executor → verb + object + context)

**JOB-1: A Muslim parent → ensure consistent daily Hifdh practice across multiple children of varying ages and abilities, when they themselves are juggling work, prayer obligations, and household routines.**

**JOB-2: A Hifdh student (any age) → memorize a portion of Quran with high retention and tajweed accuracy, when access to a qualified teacher is intermittent or unavailable.**

**JOB-3: A Muslim adult → maintain regular Quran reading and listening throughout the day, when ambient distractions, prayer schedules, and device fragmentation interrupt the practice.**

**JOB-4: A Quran learner (convert / non-Arabic-speaker) → progressively learn correct recitation and meaning, when no native-speaker teacher is geographically accessible.**

**JOB-5: A family / community → coordinate a shared Quran-completion (khatm) on a fixed timeline, when participants are distributed across locations and schedules.**

**JOB-6: A Muslim with smart-home infrastructure → integrate Quran/adhan/azkar into automated routines (lights, speakers, displays), when existing media integrations don't understand Islamic context.**

### 23.2 Top 20 desired outcomes (with provisional opportunity scores)

Format: `[Direction] + [metric] + [object] + [context]` — `Importance / Satisfaction (Tarteel) / Satisfaction (Quranly) / Opportunity score`

| #    | Outcome                                                                                        | Importance | Tarteel Sat. | Quranly Sat. | Opportunity (vs best alt) |
| ---- | ---------------------------------------------------------------------------------------------- | ---------- | ------------ | ------------ | ------------------------- |
| O-01 | Minimize time to detect a recitation mistake during memorization session                       | 10         | 7            | 1            | **13**                    |
| O-02 | Minimize false-positive mistake flags during recitation                                        | 10         | 5            | n/a          | **15**                    |
| O-03 | Minimize need for internet connectivity during Hifdh session                                   | 9          | 2            | 4            | **16**                    |
| O-04 | Minimize cognitive load for parent supervising multiple children's daily wird                  | 10         | 4            | 3            | **16**                    |
| O-05 | Minimize confusion between mutashabihat (similar verses)                                       | 9          | 4            | 2            | **14**                    |
| O-06 | Maximize ability to hear how a specific reciter would recite any verse                         | 8          | 3            | 3            | **13**                    |
| O-07 | Maximize retention of memorized portions over 90+ days                                         | 10         | 6            | 2            | **14**                    |
| O-08 | Minimize time to coordinate a family/community khatm                                           | 7          | 1            | 1            | **13**                    |
| O-09 | Minimize time to integrate Quran playback into existing smart-home automations                 | 8          | 1            | 1            | **15**                    |
| O-10 | Minimize friction to count Quran reading done outside the app                                  | 7          | 1            | 1            | **13**                    |
| O-11 | Maximize confidence that AI feedback is theologically sound                                    | 10         | 7            | n/a          | **13**                    |
| O-12 | Minimize inappropriate gamification that distracts from sincerity (ikhlas)                     | 9          | 8            | 4            | **14**                    |
| O-13 | Maximize ability to listen passively to current memorization portion ambiently around the home | 8          | 1            | 1            | **15**                    |
| O-14 | Minimize disruption to prayer times by app activity                                            | 9          | 5            | 5            | **13**                    |
| O-15 | Maximize ability to share verses beautifully (cards/social)                                    | 6          | 7            | 8            | 6                         |
| O-16 | Maximize support for non-Madani mushaf (Indo-Pak 16-line)                                      | 7          | 7            | 6            | 7                         |
| O-17 | Minimize time for child to receive encouragement after completing a portion                    | 8          | 3            | 6            | **10**                    |
| O-18 | Maximize ability to compare recitation to a teacher's prosody/style                            | 8          | 2            | 1            | **15**                    |
| O-19 | Maximize accessibility for blind/low-vision users (vocal-only nav)                             | 6          | 2            | 1            | **11**                    |
| O-20 | Minimize time to recover from a missed-day streak break                                        | 7          | 3            | 1            | **13**                    |

**Outcomes with opportunity > 14 (greenfield innovation territory):**

- O-02 false-positive reduction (15)
- O-03 offline Hifdh (16)
- O-04 multi-child parent cognitive load (16)
- O-05 mutashabihat confusion (14)
- O-09 smart-home integration (15)
- O-13 ambient passive playback (15)
- O-18 prosody comparison to teacher (15)

**These seven outcomes are the strategic core of Qalaam.** Every v0.1-v1.5 feature must serve one of them, or be cut from scope.

### 23.3 Job-map step coverage

Every Qalaam feature also maps to one or more of the eight universal job-map steps. The table below shows which roadmap features serve which step; gaps signal missing systems.

| Step        | What the user does                                 | Primary Qalaam features                                            |
| ----------- | -------------------------------------------------- | ------------------------------------------------------------------ |
| 1. Define   | Set goal — what to memorize, on what timeline      | Range/Portion/Schedule trichotomy (§21.5), Plan entity (§7.2)      |
| 2. Locate   | Find the verses, reciter, mushaf                   | QUL data layer (§4.1), reciter picker, mushaf layout selector      |
| 3. Prepare  | Get into the right context (location, time, focus) | Adhan-aware scheduler (§10.4), per-room sabaq announcement (§10.1) |
| 4. Confirm  | Verify everything is ready                         | Hifdh-engine session generator (§7.3)                              |
| 5. Execute  | Recite the portion                                 | Verse-pause drill (§7.5), follow-along audio with highlighting     |
| 6. Monitor  | Track progress and quality                         | On-device ASR mistake detection (§7.5), prosody scoring (§8.5)     |
| 7. Modify   | Adjust based on monitoring                         | FSRS-6 scheduler (§7.3), mutashabihat-aware re-queueing (§7.2)     |
| 8. Conclude | Wrap up the session                                | Daily summary, streak update, parent-dashboard digest (§7.4)       |

### 23.4 The Job-Solution Mapping Rule

**Every PR description must include a single line:** `Outcome: O-XX (opportunity = N)`. PRs without an outcome reference are blocked at code review.

---

## 24. Data Flywheel Architecture — the AI moat strategy

Per CLAUDE.md Principle 07 ("Data is the moat, not the model") and §6.2 (AI architecture stack), Qalaam's defensibility is not which TTS or ASR model it uses — every contender (Habibi, VoxCPM2, CosyVoice 2, Whisper-Quran-LoRA) is openly available. **The moat is the proprietary data Qalaam generates from its own usage.** This section defines the data-flywheel strategy.

### 24.1 The four proprietary data streams Qalaam generates

| Stream                                 | Source                                                                             | Why it's defensible                                                                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Hifdh mistake graph**                | Every word-level error logged in `MistakeEvent` (§7.2) across all users            | Reveals which mutashabihat clusters confuse which demographics (age, mushaf, native-language); no other app captures this at scale  |
| **Reciter-prosody preference signals** | Which reciter each user picks for each portion + how long they stay; rating events | Reveals which reciter's prosody best supports retention for which verse types — informs "Qalaam-house voice" §22.2 training targets |
| **Family-coordination patterns**       | Khatm progress, parent-rating cadence, who-listens-to-whom                         | The first dataset of how families actually do Quran together at scale                                                               |
| **Smart-home Quran usage**             | Time-of-day, room, device, listen-mode duration, adhan-aware pauses                | The first dataset on ambient Quran consumption                                                                                      |

### 24.2 The reinforcement loops

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                       │
│   USERS RECITE → ON-DEVICE ASR LOGS WORD-LEVEL ERRORS                │
│        │                                                              │
│        ▼                                                              │
│   MISTAKE GRAPH ENRICHED → MUTASHABIHAT-CONFUSION MODEL IMPROVES     │
│        │                                                              │
│        ▼                                                              │
│   FSRS-6 + MUTASHABIHAT-AWARE SCHEDULER PRIORITIZES BETTER            │
│        │                                                              │
│        ▼                                                              │
│   USER RETENTION OF MEMORIZED PORTIONS RISES (O-07)                   │
│        │                                                              │
│        ▼                                                              │
│   HIGHER NRR + WORD-OF-MOUTH (TEACHER RECOMMENDATIONS)                │
│        │                                                              │
│        ▼                                                              │
│   MORE USERS RECITE — back to top                                     │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

**Cycle time:** 30-90 days from new-user signup to first measurable mutashabihat-model improvement (assumes 200+ users at signup).

### 24.3 The privacy-defensible data architecture

**The constraint:** ALL ASR audio stays on-device (per §2 pillar 8 and §7.5). We cannot ship raw recordings to cloud.

**The solution:** ASR runs locally; only **derived signals** (which word-index was wrong, what type of error, which reciter context) sync to cloud. This gives us the dataset without the privacy/copyright risk.

```
DEVICE                                    CLOUD
──────                                    ─────
[Mic input]
   │
   ▼
[Whisper-Quran-LoRA
 on-device]
   │
   ▼
[Forced alignment via
 ctc-forced-aligner]
   │
   ▼
[MistakeEvent objects:
 verse_key, word_index,
 type, timestamp, reciter] ──────────────►[Mistake graph]
                                                │
                                                ▼
                                           [Mutashabihat-
                                            confusion model
                                            retraining]
                                                │
                                                ▼
                                           [Updated FSRS-6
                                            scheduler weights]
                                                │
                                                ▼
                                           [Push back to
                                            device on next
                                            session]
```

### 24.4 Human-in-the-loop signal capture

Every user UI action that _corrects_ an AI judgment is a high-value training signal:

- Parent overrides ASR mistake flag → `(audio_was_actually_correct = true)`. This trains the false-positive reducer (O-02).
- User skips a flagged "weak" portion → `(scheduler_was_too_aggressive = true)`. This trains the FSRS difficulty parameter.
- User reports two verses they confused that aren't in the mutashabihat library → `(novel_cluster_candidate)`. This expands the cluster library.

**These corrections must be one-tap.** Friction kills the signal. Per CLAUDE.md Cog 4: "design the UX to capture these signals effortlessly."

### 24.5 Contributing back to QUL

Per §21.11.5, we contribute corrections back to QUL — specifically:

- New mutashabihat clusters identified by user data (with PII stripped).
- Audio-segment timing corrections caught by our forced alignment.
- Translation typo reports.

This is both ethical (community benefit) and strategic (deepens our partnership with Tarteel/QUL, which derisks our data substrate dependency in §4.1).

### 24.6 What we will NOT use the data for

Per QF ToS and our own privacy posture:

- No ML training on user audio. Period.
- No biometric profiling (voice fingerprinting for ID).
- No ad-profile use.
- No selling to third parties.
- No cross-user personality inference.

These constraints are **architectural** — enforced at the schema layer (§3 `packages/schema`), not just the privacy policy.

---

## 25. Decision Register — ADR Index

Per CLAUDE.md §11.1, every significant technical or strategic decision gets an ADR (Architecture Decision Record). ADRs live in `Docs/adrs/` and follow the template in `Docs/adrs/ADR-template.md`. This section is the master index.

| #        | Decision                                                                         | Status   | Outcome served             | ADR file                                          |
| -------- | -------------------------------------------------------------------------------- | -------- | -------------------------- | ------------------------------------------------- |
| ADR-0001 | Monorepo with pnpm/turbo + uv workspace                                          | Accepted | All (foundation)           | `adrs/ADR-0001-monorepo.md`                       |
| ADR-0002 | QUL as canonical Quran data substrate                                            | Accepted | O-01, O-05, O-07           | `adrs/ADR-0002-qul-canonical-data.md`             |
| ADR-0003 | Multi-protocol adapter pattern (HA is one of many)                               | Accepted | O-09, O-13                 | `adrs/ADR-0003-multi-protocol-adapters.md`        |
| ADR-0004 | FSRS-6 over SM-2 for Hifdh scheduling                                            | Accepted | O-04, O-07                 | `adrs/ADR-0004-fsrs6-scheduler.md`                |
| ADR-0005 | On-device ASR (Whisper-Quran-LoRA) for mistake detection                         | Accepted | O-02, O-03                 | `adrs/ADR-0005-on-device-asr.md`                  |
| ADR-0006 | Habibi-TTS-MSA (Apache-2.0) over F5-Emilia (NC) for voice cloning                | Accepted | O-06, O-18                 | `adrs/ADR-0006-habibi-tts-starting-checkpoint.md` |
| ADR-0007 | Qalaam-house voice (multi-reciter blend) over named-reciter cloning through v1.5 | Accepted | O-06, O-11 (legal/ethical) | `adrs/ADR-0007-qalaam-house-voice.md`             |
| ADR-0008 | JSON Schema as single source of truth → codegen TS + Python                      | Accepted | All (type safety)          | `adrs/ADR-0008-schema-source-of-truth.md`         |
| ADR-0009 | Node/Fastify backend; Python only for ML/device-bridge                           | Accepted | All (foundation)           | `adrs/ADR-0009-backend-language.md`               |
| ADR-0010 | Cloudflare R2 for audio storage; Postgres + Redis for app data                   | Accepted | All (foundation)           | `adrs/ADR-0010-storage-architecture.md`           |
| ADR-0011 | License: Apache-2.0 libraries, AGPL-3 SaaS backend                               | Proposed | All (legal)                | `adrs/ADR-0011-licensing.md`                      |
| ADR-0012 | Auth: Supabase Auth (consumer), WorkOS (B2B)                                     | Proposed | All (foundation)           | `adrs/ADR-0012-auth.md`                           |
| ADR-0013 | Mobile = Expo, deferred to v1.5                                                  | Proposed | All (foundation)           | `adrs/ADR-0013-mobile-stack.md`                   |
| ADR-0014 | Voice-cloning MVP: ElevenLabs API, switch to self-hosted Habibi at ~5K users     | Proposed | O-06 + economics           | `adrs/ADR-0014-tts-mvp-vs-selfhost.md`            |

Statuses: Proposed → Accepted → Deprecated → Superseded. New ADRs append to this table.

---

## 26. Refined success metrics & leading indicators

Per CLAUDE.md Principle 08 ("Strategy without execution is hallucination") and §10.1 step 6 ("specify the leading indicators that will tell us if it's working before the lagging indicators move"). This section refines §19 with specific lagging metrics, leading indicators, and side-effects to monitor.

### 26.1 v0.1 Foundation (4-6 weeks)

**Lagging:** Working monorepo, web reader plays a verse on a HA media_player; 5 internal alpha users.

**Leading indicators (weekly):**

- pnpm install + turbo build succeeds in <60s on cold cache.
- TypeScript strict mode + Pydantic strict + ruff/mypy all green in CI.
- JSON-Schema → TS + Python codegen produces matching types (round-trip test passes).
- HA dev container brings up `qalaam` integration without errors.
- One ADR per significant decision; ADR coverage ≥ 90%.

**Side-effects to monitor:**

- Build time creep (any single package > 10s incremental).
- Codegen drift (generated files not committed).
- Documentation rot (any ADR marked "Accepted" but referencing files that don't exist).

### 26.2 v0.5 Hifdh core (4-6 weeks)

**Lagging:** 50 Hifdh-active beta users; FSRS-6 scheduler producing daily sessions; parent dashboard live.

**Leading indicators (weekly):**

- Daily session generation latency < 200ms p95.
- Mutashabihat cluster lookup serves all 6,236 ayahs in < 500ms.
- FSRS-6 retention prediction accuracy ≥ 80% on synthetic Hifdh-trace dataset (built from QUL audio + simulated user error patterns).
- Parent-rating one-tap latency < 100ms.

**Side-effects to monitor:**

- FSRS due-date queue length growing unbounded (signals scheduler bug).
- Parents not opening dashboard within 7 days of inviting kids (signals UX failure on O-04).
- Streak grace-day usage > 50% (signals goal-defaults too aggressive).

### 26.3 v1.0 Smart-home & casting (6-8 weeks)

**Lagging:** HA integration on HACS with ≥ 4.5★; Cast/Sonos/AirPlay all working in real homes; verse-pause drill catches ≥ 80% of clear mistakes.

**Leading indicators:**

- Time-to-first-verse-played < 5s on cold-start HA install.
- ASR mistake-detection latency < 3s p95 after end-of-utterance.
- Adhan-aware scheduler suspends/resumes correctly across all 5 prayer windows daily.
- Family khatm completion rate ≥ 30% within target window.

**Side-effects to monitor:**

- HA users complaining about prayer-time false triggers (calculation method mismatch).
- ASR battery drain on mobile > 5%/hour during active session (need to throttle).
- Cast group announce-and-restore failure rate > 1%.

### 26.4 v1.5 Mobile + breadth (6-8 weeks)

**Lagging:** Expo apps in TestFlight + Play Internal; offline package ≤ 1.5 GB; 1,000 weekly-active users.

**Leading indicators:**

- Offline package download success rate ≥ 95%.
- Mobile app crash-free sessions ≥ 99.5%.
- Word-level mistake detection precision ≥ 90% (forced alignment + Quran lexicon).

**Side-effects to monitor:**

- Sync conflict frequency (multi-device users).
- Mobile vs web feature drift (more than 2 features missing on mobile).

### 26.5 v2.0 AI cloning + teach-back + curriculum (3-6 months)

**Lagging:** Voice cloning blind-test ≥ 4/5 by native speakers on Qalaam-house voice; Whisper-Quran fine-tune WER ≤ 5%; 100+ curriculum lessons; 10K registered, 2K paying.

**Leading indicators:**

- Cost-per-verse-generated trending down (cache hit rate ≥ 60%).
- Lesson completion rate L1→L2 ≥ 50% within 90 days.
- Pro-tier conversion ≥ 5% of Premium subscribers.

**Side-effects to monitor:**

- TTS quality regressions on tajweed-heavy verses (madd, ghunna).
- Reciter copyright complaints (legal escalation queue).
- AI-generated audio not properly watermarked.

### 26.6 The fail-safe metric

If at any point monthly active Hifdh-session users (defined: ≥ 3 sessions in past 30 days) drops below 30% of monthly active app users, **pause feature work and run a JTBD switch-interview round** with churned users. Hifdh is the moat; if it isn't sticking, no other feature compensates.

---

## 23. JTBD Foundation — formal jobs, outcomes, opportunity scores

Per CLAUDE.md Principle 04 ("The Job is the Unit of Analysis"), this section defines Qalaam's market in JTBD/ODI terms. **Every feature in §15's roadmap must trace to one or more outcome statements below; every ADR in §25 must justify itself against an outcome with opportunity > 12.**

Opportunity scores are **provisional Q1 2026 estimates** based on (a) Tarteel/Quranly App Store review thematic analysis, (b) `r/Quran` and `r/hifz` thread mining, and (c) the competitive gap analysis in §21. They will be replaced with survey-derived scores during v0.5 once we have ≥200 Hifdh-active beta users.

### 23.1 Core functional jobs

**JOB-1 — Parent supervision:** A Muslim parent → ensure consistent daily Hifdh practice across multiple children of varying ages and abilities, when they themselves are juggling work, prayer obligations, and household routines.

**JOB-2 — Self-directed Hifdh:** A Hifdh student (any age) → memorize a portion of Quran with high retention and tajweed accuracy, when access to a qualified teacher is intermittent or unavailable.

**JOB-3 — Daily Quran practice:** A Muslim adult → maintain regular Quran reading and listening throughout the day, when ambient distractions, prayer schedules, and device fragmentation interrupt the practice.

**JOB-4 — Progressive Arabic learning:** A Quran learner (convert / non-Arabic-speaker) → progressively learn correct recitation and meaning, when no native-speaker teacher is geographically accessible.

**JOB-5 — Group khatm coordination:** A family / community → coordinate a shared Quran-completion (khatm) on a fixed timeline, when participants are distributed across locations and schedules.

**JOB-6 — Smart-home Quran integration:** A Muslim with smart-home infrastructure → integrate Quran/adhan/azkar into automated routines (lights, speakers, displays), when existing media integrations don't understand Islamic context.

### 23.2 Top 20 desired outcomes (provisional opportunity scores)

Format: Importance / Tarteel Sat. / Quranly Sat. / Opportunity (vs best alternative).

| #    | Outcome                                                                        | Imp | Tar | Qly | Opp    |
| ---- | ------------------------------------------------------------------------------ | --- | --- | --- | ------ |
| O-01 | Minimize time to detect a recitation mistake during memorization session       | 10  | 7   | 1   | **13** |
| O-02 | Minimize false-positive mistake flags during recitation                        | 10  | 5   | n/a | **15** |
| O-03 | Minimize need for internet connectivity during Hifdh session                   | 9   | 2   | 4   | **16** |
| O-04 | Minimize cognitive load for parent supervising multiple children's daily wird  | 10  | 4   | 3   | **16** |
| O-05 | Minimize confusion between mutashabihat (similar verses)                       | 9   | 4   | 2   | **14** |
| O-06 | Maximize ability to hear how a specific reciter would recite any verse         | 8   | 3   | 3   | **13** |
| O-07 | Maximize retention of memorized portions over 90+ days                         | 10  | 6   | 2   | **14** |
| O-08 | Minimize time to coordinate a family/community khatm                           | 7   | 1   | 1   | **13** |
| O-09 | Minimize time to integrate Quran playback into existing smart-home automations | 8   | 1   | 1   | **15** |
| O-10 | Minimize friction to count Quran reading done outside the app                  | 7   | 1   | 1   | **13** |
| O-11 | Maximize confidence that AI feedback is theologically sound                    | 10  | 7   | n/a | **13** |
| O-12 | Minimize inappropriate gamification that distracts from sincerity              | 9   | 8   | 4   | **14** |
| O-13 | Maximize ability to listen passively to current memorization portion ambiently | 8   | 1   | 1   | **15** |
| O-14 | Minimize disruption to prayer times by app activity                            | 9   | 5   | 5   | **13** |
| O-15 | Maximize ability to share verses beautifully (cards/social)                    | 6   | 7   | 8   | 6      |
| O-16 | Maximize support for non-Madani mushaf (Indo-Pak 16-line)                      | 7   | 7   | 6   | 7      |
| O-17 | Minimize time for child to receive encouragement after completing a portion    | 8   | 3   | 6   | **10** |
| O-18 | Maximize ability to compare recitation to a teacher's prosody/style            | 8   | 2   | 1   | **15** |
| O-19 | Maximize accessibility for blind/low-vision users (vocal-only nav)             | 6   | 2   | 1   | **11** |
| O-20 | Minimize time to recover from a missed-day streak break                        | 7   | 3   | 1   | **13** |

**Outcomes with opportunity ≥ 14 (greenfield innovation territory):** O-02, O-03, O-04, O-05, O-09, O-13, O-18. **These seven are the strategic core.** Every v0.1-v1.5 feature must serve one, or be cut.

### 23.3 Job-map step coverage

| Step        | What the user does                                 | Primary Qalaam features                                         |
| ----------- | -------------------------------------------------- | --------------------------------------------------------------- |
| 1. Define   | Set goal — what to memorize, on what timeline      | Range/Portion/Schedule trichotomy (§21.5), `Plan` entity (§7.2) |
| 2. Locate   | Find verses, reciter, mushaf                       | QUL data layer (§4.1), reciter picker, mushaf selector          |
| 3. Prepare  | Get into the right context (location, time, focus) | Adhan-aware scheduler (§10.4), per-room sabaq announcement      |
| 4. Confirm  | Verify everything is ready                         | Hifdh-engine session generator (§7.3)                           |
| 5. Execute  | Recite the portion                                 | Verse-pause drill (§7.5), follow-along audio with highlighting  |
| 6. Monitor  | Track progress and quality                         | On-device ASR mistake detection (§7.5), prosody scoring (§8.5)  |
| 7. Modify   | Adjust based on monitoring                         | FSRS-6 scheduler, mutashabihat-aware re-queueing                |
| 8. Conclude | Wrap up the session                                | Daily summary, streak update, parent-dashboard digest           |

### 23.4 The Job-Solution Mapping Rule

**Every PR description must include a single line:** `Outcome: O-XX (opportunity = N)`. PRs without an outcome reference are blocked at code review. Enforced by `.github/PULL_REQUEST_TEMPLATE.md` + a CI lint check.

---

## 24. Data Flywheel Architecture — the AI moat strategy

Per CLAUDE.md Principle 07 ("Data is the moat, not the model"), Qalaam's defensibility is not which TTS or ASR model it uses — every contender (Habibi, VoxCPM2, CosyVoice 2, Whisper-Quran-LoRA) is openly available. **The moat is the proprietary data Qalaam generates from its own usage.**

### 24.1 Four proprietary data streams

| Stream                                 | Source                                                              | Why defensible                                                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Hifdh mistake graph**                | Word-level errors from `MistakeEvent` (§7.2) across all users       | Reveals which mutashabihat clusters confuse which demographics; no other app captures at scale                                      |
| **Reciter-prosody preference signals** | Reciter pick × portion × stay-duration × rating events              | Reveals which reciter's prosody best supports retention for which verse types — informs Qalaam-house voice (§22.2) training targets |
| **Family-coordination patterns**       | Khatm progress, parent-rating cadence, who-listens-to-whom          | First dataset of how families actually do Quran together at scale                                                                   |
| **Smart-home Quran usage**             | Time-of-day, room, device, listen-mode duration, adhan-aware pauses | First dataset on ambient Quran consumption                                                                                          |

### 24.2 The reinforcement loop

```
USERS RECITE → ON-DEVICE ASR LOGS WORD-LEVEL ERRORS
       │
       ▼
MISTAKE GRAPH ENRICHED → MUTASHABIHAT-CONFUSION MODEL IMPROVES
       │
       ▼
FSRS-6 + MUTASHABIHAT-AWARE SCHEDULER PRIORITIZES BETTER
       │
       ▼
RETENTION OF MEMORIZED PORTIONS RISES (O-07)
       │
       ▼
HIGHER NRR + WORD-OF-MOUTH (TEACHER RECOMMENDATIONS)
       │
       ▼
MORE USERS RECITE — back to top
```

**Cycle time:** 30-90 days from new-user signup to first measurable mutashabihat-model improvement (assumes 200+ users at signup).

### 24.3 Privacy-defensible architecture

**The constraint:** ALL ASR audio stays on-device (per §2 pillar 8). No raw recordings to cloud.

**The solution:** ASR runs locally; only **derived signals** sync to cloud. Schema-level enforcement (`packages/schema` rejects audio-bearing types in cloud-sync messages).

```
DEVICE                                    CLOUD
──────                                    ─────
[Mic input]
   │
   ▼
[Whisper-Quran-LoRA on-device]
   │
   ▼
[Forced alignment via ctc-forced-aligner]
   │
   ▼
[MistakeEvent: verse_key, word_index,
 type, timestamp, reciter_id]  ───────────►[Mistake graph]
                                                │
                                                ▼
                                           [Mutashabihat-confusion
                                            model retraining]
                                                │
                                                ▼
                                           [Updated FSRS-6
                                            scheduler weights]
                                                │
                                                ▼
                                           [Push to device on
                                            next session]
```

### 24.4 Human-in-the-loop signals

Every UI action that **corrects** AI judgment is a high-value training signal:

- Parent overrides ASR mistake flag → `(audio_was_actually_correct = true)`. Trains O-02 false-positive reducer.
- User skips a flagged "weak" portion → `(scheduler_was_too_aggressive)`. Trains FSRS difficulty.
- User reports two confused verses not in mutashabihat library → `(novel_cluster_candidate)`. Expands library.

**One-tap or it doesn't work.** Per CLAUDE.md Cog 4: "design the UX to capture these signals effortlessly."

### 24.5 Contributing back to QUL

Per §21.11.5: contribute corrections back upstream — new mutashabihat clusters, audio-segment timing fixes, translation typos. Ethical (community benefit) and strategic (deepens partnership; derisks data-substrate dependency).

### 24.6 What we will NOT use the data for

- No ML training on user audio. Period.
- No biometric voice fingerprinting.
- No ad-profile use.
- No third-party sale.
- No cross-user personality inference.

These constraints are **architectural** — enforced at `packages/schema`, not just policy.

---

## 25. Decision Register — ADR Index

Per CLAUDE.md §11.1, every significant decision gets an ADR. ADRs live in `Docs/adrs/` following `Docs/adrs/ADR-template.md`.

| #        | Decision                                                                             | Status   | Outcome served                                            | File                                          |
| -------- | ------------------------------------------------------------------------------------ | -------- | --------------------------------------------------------- | --------------------------------------------- |
| ADR-0001 | Monorepo with pnpm/turbo + uv workspace                                              | Accepted | All (foundation)                                          | `adrs/ADR-0001-monorepo.md`                   |
| ADR-0002 | QUL as canonical Quran data substrate                                                | Accepted | O-01, O-05, O-07                                          | `adrs/ADR-0002-qul-canonical-data.md`         |
| ADR-0003 | Multi-protocol adapter pattern (HA is one of many)                                   | Accepted | O-09, O-13                                                | `adrs/ADR-0003-multi-protocol-adapters.md`    |
| ADR-0004 | FSRS-6 over SM-2 for Hifdh scheduling                                                | Accepted | O-04, O-07                                                | `adrs/ADR-0004-fsrs6-scheduler.md`            |
| ADR-0005 | On-device ASR (Whisper-Quran-LoRA) for mistake detection                             | Accepted | O-02, O-03                                                | `adrs/ADR-0005-on-device-asr.md`              |
| ADR-0006 | Habibi-TTS-MSA (Apache-2.0) over F5-Emilia (NC) for voice cloning                    | Accepted | O-06, O-18                                                | `adrs/ADR-0006-habibi-tts-checkpoint.md`      |
| ADR-0007 | Qalaam-house voice (multi-reciter blend) over named-reciter cloning through v1.5     | Accepted | O-06, O-11, legal                                         | `adrs/ADR-0007-qalaam-house-voice.md`         |
| ADR-0008 | JSON Schema as single source of truth → codegen TS + Python                          | Accepted | All (type safety)                                         | `adrs/ADR-0008-schema-source-of-truth.md`     |
| ADR-0009 | Node/Fastify backend; Python only for ML/device-bridge                               | Accepted | All (foundation)                                          | `adrs/ADR-0009-backend-language.md`           |
| ADR-0010 | Cloudflare R2 for audio; Postgres + Redis for app data                               | Accepted | All (foundation)                                          | `adrs/ADR-0010-storage-architecture.md`       |
| ADR-0011 | License: Apache-2.0 libraries, AGPL-3 SaaS backend                                   | Proposed | All (legal)                                               | `adrs/ADR-0011-licensing.md`                  |
| ADR-0012 | Auth: Supabase Auth (consumer), WorkOS (B2B)                                         | Proposed | All (foundation)                                          | `adrs/ADR-0012-auth.md`                       |
| ADR-0013 | Mobile = Expo, deferred to v1.5                                                      | Proposed | All (foundation)                                          | `adrs/ADR-0013-mobile-stack.md`               |
| ADR-0014 | Voice-cloning MVP: ElevenLabs API → self-hosted Habibi at ~5K users                  | Proposed | O-06, economics                                           | `adrs/ADR-0014-tts-mvp-vs-selfhost.md`        |
| ADR-0015 | Sidecar transport: HTTP/JSON v0.1 → gRPC v1.0                                        | Accepted | All (latency budget for ASR)                              | `adrs/ADR-0015-sidecar-transport.md`          |
| ADR-0016 | Data flywheel architecture — corrections-only sync (no audio to cloud)               | Accepted | O-02, O-05, O-07                                          | `adrs/ADR-0016-data-flywheel-architecture.md` |
| ADR-0017 | i18n strategy — `next-intl` + RTL/LTR + dual-pipeline Voice                          | Proposed | O-04, O-19                                                | `adrs/ADR-0017-i18n-strategy.md`              |
| ADR-0018 | Cache invalidation policy — align HTTP cache-control with QF ToS 7-day cap           | Accepted | O-01, O-11                                                | `adrs/ADR-0018-cache-invalidation.md`         |
| ADR-0019 | TTS scope — app-voice only; Quranic verses NEVER synthesized by general-purpose TTS  | Accepted | O-06, O-08, O-13 (foundation; voice-quality + adab guard) | `adrs/ADR-0019-tts-scope-app-voice-only.md`   |
| ADR-0020 | QUL deep ingestion — license-aware, per-resource sub-readers under `qalaam_v1_qul_*` | Accepted | O-04, O-08, O-13, O-18, O-19                              | `adrs/ADR-0020-qul-deep-ingestion.md`         |

Statuses: Proposed → Accepted → Deprecated → Superseded.

---

## 26. Refined success metrics & leading indicators

Per CLAUDE.md Principle 08 and §10.1 ("specify the leading indicators that tell us if it's working before the lagging indicators move").

### 26.1 v0.1 Foundation (4-6 weeks)

**Lagging:** Working monorepo; web reader plays a verse on a HA media_player; 5 internal alpha users.

**Leading (weekly):**

- pnpm install + turbo build < 60s on cold cache
- TS strict + Pydantic strict + ruff + mypy all green in CI
- JSON-Schema → TS + Python codegen round-trip test passes
- HA dev container brings up `qalaam` integration with no errors
- ADR coverage ≥ 90% of significant decisions

**Side-effects:** build-time creep (any package > 10s incremental); codegen drift (generated files not committed); ADR rot (Accepted ADRs referencing missing files).

### 26.2 v0.5 Hifdh core (4-6 weeks)

**Lagging:** 50 Hifdh-active beta users; FSRS-6 scheduler producing daily sessions; parent dashboard live.

**Leading:**

- Daily session generation latency < 200ms p95
- Mutashabihat cluster lookup < 500ms for any of 6,236 ayahs
- FSRS-6 retention prediction ≥ 80% accuracy on synthetic Hifdh-trace dataset
- Parent-rating one-tap latency < 100ms

**Side-effects:** FSRS due-date queue growing unbounded (scheduler bug); parents not opening dashboard within 7 days of inviting kids (UX failure on O-04); streak grace-day usage > 50% (defaults too aggressive).

### 26.3 v1.0 Smart-home & casting (6-8 weeks)

**Lagging:** HA integration on HACS ≥ 4.5★; Cast/Sonos/AirPlay working in real homes; verse-pause drill catches ≥ 80% clear mistakes.

**Leading:**

- Time-to-first-verse-played < 5s on cold-start HA install
- ASR mistake-detection latency < 3s p95 after end-of-utterance
- Adhan-aware scheduler suspends/resumes correctly across all 5 daily prayer windows
- Family khatm completion ≥ 30% within target window

**Side-effects:** prayer-time false triggers (calculation method mismatch); ASR battery drain > 5%/hour mobile (throttle needed); Cast group announce-and-restore failure > 1%.

### 26.4 v1.5 Mobile + breadth (6-8 weeks)

**Lagging:** Expo apps in TestFlight + Play Internal; offline package ≤ 1.5 GB; 1,000 weekly-active users.

**Leading:**

- Offline package download success ≥ 95%
- Mobile crash-free sessions ≥ 99.5%
- Word-level mistake detection precision ≥ 90% (forced alignment + Quran lexicon)

**Side-effects:** sync conflict frequency (multi-device); mobile vs web feature drift > 2 features.

### 26.5 v2.0 AI cloning + teach-back + curriculum (3-6 months)

**Lagging:** Voice cloning ≥ 4/5 native-speaker blind test on Qalaam-house voice; Whisper-Quran fine-tune WER ≤ 5%; 100+ curriculum lessons; 10K registered, 2K paying.

**Leading:**

- Cost-per-verse-generated trending down (cache hit ≥ 60%)
- Lesson L1→L2 completion ≥ 50% within 90 days
- Pro-tier conversion ≥ 5% of Premium

**Side-effects:** TTS quality regressions on tajweed-heavy verses (madd, ghunna); reciter copyright complaints (legal queue); AI audio not properly watermarked.

### 26.6 The fail-safe metric

If monthly-active Hifdh-session users (≥ 3 sessions in past 30 days) drops below 30% of MAU, **pause feature work and run a JTBD switch-interview round** with churned users. Hifdh is the moat; no other feature compensates.

---

## 27. Upstream integrations map (added 2026-05-05)

This section tracks every external Quran-tech project we plan to consume,
embed, or learn from — so we don't reinvent. Sources:

- [Quran Foundation org repos (31 total)](https://github.com/orgs/quran/repositories)
- [QUL — Quranic Universal Library](https://qul.tarteel.ai/)
- [Quran Foundation API + SDKs](https://api-docs.quran.foundation/)
- [Tarteel AI](https://tarteel.ai/)
- [cpfair/quran-tajweed (MIT)](https://github.com/cpfair/quran-tajweed)
- [nuqayah/qpc-fonts](https://github.com/nuqayah/qpc-fonts)

### 27.1 Quran MCP server (mcp.quran.ai)

**Status:** Live + open-source, [quran/quran-mcp](https://github.com/quran/quran-mcp).

Provides `fetch_quran` / `search_tafsir` / morphology / mushaf rendering /
concordance to any AI assistant via MCP. 50+ translations, 30+ languages,
15+ tafsir scholars (Ibn Kathir, al-Tabari, al-Qurtubi…), Hafs/Warsh/Qaloon.

**Plan:**

- ✅ v0.5 — MCP CLIENT live in backend at `apps/backend/src/lib/mcp-quran-ai.ts`
  (JSON-RPC over HTTP+SSE, session-aware, lazy-init, grounding-nonce
  capture). Proxied via `/v1/mcp/tools` (list) + `/v1/mcp/call/:tool`
  (allowed-list invoke) + `/v1/mcp/search-tafsir?q=…` (convenience).
  ALLOWED_TOOLS gate prevents arbitrary tool invocation.
- v0.6 — publish our OWN `qalaam-mcp` exposing family-aware tools
  (hifdh-state, mutashabihat clusters, family bookmarks) ALONGSIDE
  the canonical fetch_quran/search_tafsir. Ours adds family + adab
  features; theirs covers depth of source material.

### 27.2 recite.quran.ai — voice mistake detection

Tarteel-style real-time mispronunciation flagger. Trained on 75K+ minutes
of curated Quran audio; <200ms latency on NVIDIA. No public weights.

**Our paths:**

- ✅ `/recite/[verseKey]` — WS to local `services/realtime-feedback`
  (faster-whisper stub).
- ✅ `/hifz-check/[verseKey]` — browser Web Speech API (no infra dep,
  audio stays on device).
- v0.6 — self-host `tarteelai/whisper-base-ar-quran` ONNX in
  `services/asr-worker` (~150MB, CPU-OK).
- v2.0 — Quran-fine-tuned Whisper-large-v3 for Pro tier.

ADR refs: ADR-0005 (on-device ASR), ADR-0007 (reciter licensing).

### 27.3 Tajweed annotation

- ✅ ingested cpfair/quran-tajweed (MIT, 60,057 annotations × 18 rules).
- 〰️ track quran/quran-tajweed (forked) for algorithm-tree updates.
- ❌ skip quran/tajweed (Java highlighter) — we have the data.

### 27.4 QPC fonts

- ✅ vendored 1208 page-fonts (v1 + v2) + UthmanicHafs Unicode at
  `apps/web/public/fonts/quran/`.
- ❌ v4 tajweed glyph font — license-respect outreach pending (ADR-0007).

### 27.5 QUL completeness — ingest scorecard

| Category                 | QUL total          | Qalaam                                                                                                                                                                                     | Status |
| ------------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| Recitations              | 152 (62 segmented) | **51** (14 segmented + 37 audio-only via EveryAyah CDN) ✅                                                                                                                                 | 〰️     |
| Translations             | 209 + 16 WBW       | **59 across 28 languages** ✅                                                                                                                                                              | 〰️     |
| Tafsirs                  | 115                | **7** (Muyassar, Ibn Kathir, Jalalayn, Qurtubi, Baghawi, Miqbas, Waseet — all AR) ✅                                                                                                       | 〰️     |
| Mushaf Layouts           | 27                 | 3                                                                                                                                                                                          | ❌     |
| Quran Scripts            | 28                 | 4 + Imlaei ayah-level                                                                                                                                                                      | 〰️     |
| Fonts                    | 18                 | UthmanicHafs + 1208 v1/v2 page-fonts                                                                                                                                                       | 〰️     |
| Quran Metadata           | 8                  | 6 + 15-row sajda                                                                                                                                                                           | ✅     |
| Transliteration          | 9                  | 0                                                                                                                                                                                          | ❌     |
| Surah Info               | 9 langs            | 4 (en/ml/ta/ur)                                                                                                                                                                            | 〰️     |
| **Topics & Concepts**    | **2,512**          | **53 curated topics across 8 categories with 803 verse mappings** (foundational taxonomy modeled on classical Islamic subject indexes — Mawdoo3, Hidayah Online, Bayan al-Quran themes) ✅ | 〰️     |
| **Grammar & Morphology** | **77,429 entries** | **128,219 tokens × 4,832 lemmas × 1,642 roots × 45 POS tags** ✅ (via Quranic Arabic Corpus v0.4 / Kais Dukes / GPL — superset of QUL's coverage)                                          | ✅     |
| Mutashabihat             | 5,277              | 814 clusters + 19,385 pairs                                                                                                                                                                | ✅     |
| Similar Ayahs            | 4,001              | 3,552                                                                                                                                                                                      | ✅     |
| Ayah Themes              | 1,049              | 0                                                                                                                                                                                          | ❌     |

**Highest-leverage gaps (priority order — updated 2026-05-05):**

1. ✅ **Morphology** — Quranic Arabic Corpus 128K tokens ingested.
2. ✅ **Translations + Tafsirs depth** — 59 + 7 ingested.
3. **Topics + Themes** (3,500+ entries) — semantic cross-reference UX.
4. **Reciters depth** (152 vs 14) — most by-count gap.
5. **Transliteration** (9 editions) — accessibility / recitation-learner UX.
6. **Mushaf Layouts** (27 vs 3) — IndoPak 16-line, Qatar 15-line, DigitalKhatt v1/v2.

### 27.6 Other quran org repos to track

| Repo                                                                        | Stars | Language | For us               |
| --------------------------------------------------------------------------- | ----- | -------- | -------------------- |
| [quran_android](https://github.com/quran/quran_android)                     | 2342  | Kotlin   | Android ref          |
| [quran-ios / QuranEngine](https://github.com/quran/quran-ios)               | 551   | Swift    | iOS ref              |
| [quran.com-frontend-next](https://github.com/quran/quran.com-frontend-next) | 1847  | TS       | Mushaf rendering ref |
| [audio.quran.com](https://github.com/quran/audio.quran.com)                 | 166   | Svelte   | /listen patterns     |
| [api-js / @quranjs/api](https://github.com/quran/api-js)                    | 49    | TS       | Drop-in client       |
| [ayah-detection](https://github.com/quran/ayah-detection)                   | 111   | Python   | Image-mushaf overlay |
| [waqt.org](https://github.com/quran/waqt.org)                               | 108   | PHP      | Prayer-times pattern |
| [common-components](https://github.com/quran/common-components)             | 41    | JS       | Component ref        |
| [mobile-sync](https://github.com/quran/mobile-sync)                         | 1     | Kotlin   | Bookmark sync        |

### 27.7 Implementation queue

1. ✅ **Translations + tafsirs depth-pull** — 59 / 7 ingested
   (`scripts/data/ingest-translations-deep.py` + `…-tafsirs-deep.py`).
2. ✅ **Hifz check MVP** — `/hifz-check/[verseKey]` (browser ASR).
3. ✅ **MCP client** — `apps/backend/src/lib/mcp-quran-ai.ts` + routes
   `/v1/mcp/tools` · `/v1/mcp/call/:tool` · `/v1/mcp/search-tafsir`.
4. ✅ **Morphology ingest + word-by-word /study** — 128K tokens; new
   /concordance/root/:root surface.
5. ✅ **Topics + Themes** — 53 curated topics × 803 verse mappings; backend
   `/v1/topics*` + frontend `/topics` browse + `/topics/:slug` detail
   - `<TopicsByVersePane/>` sidebar on /study.
6. ✅ **Reciters depth-pull** — 14 → **51** (37 added via EveryAyah CDN).
   `qul-license-registry.ts` carries 51/51 entries — 14 QUL-licensed
   (per-reciter via QUL) + 37 everyayah per-reciter (free non-commercial
   distribution). All 51 surface through `/v1/reciters` instead of the
   route fail-closing.
7. ✅ **Self-hosted ASR worker** — `services/asr-worker` v0.1.0 ships HTTP
   `/v1/transcribe` + WS `/v1/recite/ws` (init → audio chunks → partial
   frames every 2s → final). `Transcriber.partial_match()` runs greedy
   beam=1 for partials and full beam=2 for the final. Frontend
   `useAsrWebSocket` hook + `HifzCheckClient` mode-toggle (Self-hosted
   ASR ↔ Browser ASR) opt in via `NEXT_PUBLIC_ASR_WS_URL`. Audio is
   held in process memory only (per ADR-0005); session cap 180s, buffer
   cap 4MB. 19 worker tests green incl. WS init/audio/end roundtrip.
8. ✅ **`qalaam-mcp` server** — `apps/backend/src/routes/mcp-server.ts`
   exposes 7 family-aware tools at `/mcp` (JSON-RPC 2.0 over plain HTTP):
   `qalaam_hifdh_state`, `qalaam_mutashabihat_for_verse`,
   `qalaam_morphology_for_verse`, `qalaam_root_concordance`,
   `qalaam_topics_for_verse`, `qalaam_topic_verses`,
   `qalaam_search_topics`. Implements `initialize` + `notifications/
initialized` + `tools/list` + `tools/call` (single + batch). Tool
   handlers query SQLite directly (no HTTP self-call overhead). Verified:
   `tools/call qalaam_topics_for_verse {verse_key:"2:255"}` →
   `tawhid + names-of-allah + dua`; `qalaam_root_concordance {root:"rHm"}`
   → 339 mercy-root occurrences. Discovery endpoint `GET /mcp` for
   probing clients.
9. ✅ **Image-mushaf overlay** — `scripts/data/ingest-image-mushaf-overlays.py`
   ingests QUL `mushaf-layout-12` (Madani 16-line) into
   `qalaam_v1_qul_image_overlays` (610 pages × 83,668 word rectangles)
   and stages the 610 KFGQPC PNGs to `apps/web/public/mushaf-images/madani-16/`.
   Backend `/v1/image-mushaf/:layout/:page` returns image URL + word
   rectangles; `/v1/image-mushaf/:layout/page-for/:vk` resolves verse →
   page. Frontend `/mushaf-image/:page` (`ImageMushafCanvas`) renders the
   PNG with absolute-positioned, percentage-scaled word overlays —
   hover/tap an ayah to glow leaf-gold, tap to deep-link `/study/:s/:a`.
   PNGs are .gitignored (63MB) — re-run the script to repopulate.
10. **More mushaf layouts** — IndoPak 16-line, Qatar 15-line, DigitalKhatt.
11. ✅ **Transliteration ingest** — 3 alquran.cloud editions ingested
    (en.transliteration, tr.transliteration, ru.transliteration) into
    dedicated `qalaam_v1_transliterations` + `qalaam_v1_transliteration_meta`.
    Backend `/v1/transliterations` catalog + per-verse route. /read
    chip-row "Transliteration" (Off / Latin / Türkçe / Русский) +
    AyahCard phonetic-bridge rendering between Arabic and translation.
    3 × 6,236 = 18,708 rows. Future work: scrape additional Latin scholar
    transliterations (Lane, Pelly) once licensing clears.
12. **Mobile** — Kotlin / Swift apps borrowing from quran_android +
    QuranEngine patterns. (task #191)

### 27.8 Frontend↔backend wiring matrix (2026-05-05 audit)

The web app currently consumes ~22 of 47 backend routes. The HA
integration consumes 3. The matrix below pairs every uncovered route
with the task that wires it up. INTRO promises that lack a backend
route get a "build then wire" task instead.

#### Cluster A — Reading-surface enrichment

| Backend route                            | Web surface today              | Task |
| ---------------------------------------- | ------------------------------ | ---- |
| `/v1/surah-info/:surah`                  | not consumed                   | #155 |
| `/v1/tajweed/:vk` legend                 | colors render, legend missing  | #156 |
| `/v1/image-mushaf/:layout/page-for/:vk`  | route shipped, not in chip-row | #157 |
| `/v1/wbw/:vk` (multi-lang)               | en only, 22K/77K rows          | #158 |
| _new_ `/v1/search`                       | needs FTS5 index               | #159 |
| `/v1/topics/by-verse/:vk` (search merge) | shipped, not in /search        | #160 |
| _new_ `/v1/{bookmarks,highlights,notes}` | localStorage only              | #161 |
| _new_ `/api/og/ayah/:vk`                 | Satori built, not wired        | #162 |

#### Cluster B — Home Assistant catch-up

The HA coordinator currently fetches `/v1/reciters` +
`/v1/hifdh/state` + `/v1/now-playing/qalaam` only. Every route added
in the past 4 weeks is invisible to HA users.

| Gap                                                                                                       | Task |
| --------------------------------------------------------------------------------------------------------- | ---- |
| Coordinator: topics + morphology + mutashabihat + transliterations + image-mushaf                         | #163 |
| Sensors: word-of-day · topic-of-day · mutashabihat-count · prayer-window · active-reciter · active-layout | #164 |
| Conversation agent via `/mcp` (qalaam-mcp 7 tools, bilingual phrases)                                     | #165 |
| Lovelace panel: today's topic + image-mushaf preview + mutashabihat watchlist + now-playing controls      | #166 |
| Media-source tree: topics · mushaf-pages · today's session playlist                                       | #167 |
| Services: per-room sabaq · door-LED · adhan-window events                                                 | #168 |

#### Cluster C — Companion features

| Promise                 | Status       | Task |
| ----------------------- | ------------ | ---- |
| Adhan + 12 calc methods | not started  | #169 |
| Qibla + Hijri + events  | not started  | #170 |
| Hisn al-Muslim azkar    | catalog only | #171 |

#### Cluster D — Listening depth

| Promise                            | Task |
| ---------------------------------- | ---- |
| Speed / repeat-range / sleep timer | #172 |
| Multi-reciter A/B compare          | #173 |
| Offline downloads + service worker | #174 |
| Listen Mode ambient loop           | #175 |
| Cast/Sonos/AirPlay UI in /listen   | #176 |
| Background playback + lock-screen  | #177 |

#### Cluster E — Hifdh depth

| Promise                                   | Task |
| ----------------------------------------- | ---- |
| Per-page mistake heatmap                  | #178 |
| Per-child plan creator + parent dashboard | #179 |
| One-tap "I just heard them recite"        | #180 |
| Mutashabihat side-by-side drill           | #181 |
| Family voice notes + praise stickers      | #182 |
| Family khatm modes + wall display         | #183 |

#### Cluster F — Learning the language

| Promise                                      | Task |
| -------------------------------------------- | ---- |
| Quranic Arabic course bodies (Level 1-4)     | #184 |
| I'rab grammar surface (uses 128K morphology) | #185 |
| Children's mode + softer reciter defaults    | #186 |

#### Cluster G — Smart-home + ambient

| Promise                                                    | Task |
| ---------------------------------------------------------- | ---- |
| Ramadan-aware UI mode                                      | #187 |
| Friday Surah Kahf nudge                                    | #188 |
| Shazam-for-Quran (asr-worker + FTS5)                       | #189 |
| 3 more mushaf layouts (IndoPak 16, Qatar 15, DigitalKhatt) | #190 |
| Mobile native apps                                         | #191 |

#### Cluster H — Foundations

| Capability                                          | Task |
| --------------------------------------------------- | ---- |
| Auth + accounts (NextAuth, families, child consent) | #192 |
| Three-tier billing (Free/Premium/Pro + grant tier)  | #193 |
| Voice cloning v2 (consent vault + Habibi GPU run)   | #194 |
| Personal teacher voice cloning (Pro tier)           | #195 |

#### Cluster I — Hardening

| Capability                   | Task |
| ---------------------------- | ---- |
| /api proxy hardening         | #196 |
| Goto picker debug carry-over | #197 |
| Playwright e2e sweep         | #198 |

### 27.9 Dependency graph (highest-leverage paths)

```
#192 auth ──┬─ #179 plan creator + parent dashboard ── #180 rate ── #178 heatmap
            ├─ #182 family voice notes
            ├─ #183 khatm modes
            ├─ #186 children's mode
            └─ #193 billing ── #194 voice-cloning v2 ── #195 personal teacher

#159 search ──┬─ #160 topical search
              └─ #189 Shazam-for-Quran

#155 surah-info ── #163 HA coordinator extend ── #164 sensors
                                              ├─ #165 conversation agent
                                              ├─ #166 panel refresh
                                              ├─ #167 media-source
                                              └─ #168 services

#169 prayer-times ── #170 Qibla/Hijri ──┬─ #187 Ramadan mode
                                        └─ #188 Friday Kahf
```

The single highest-leverage unlock is **#192 (auth)** — it gates 7
downstream tasks across family, billing, and the children's mode that
the INTRO premises depend on. Ship that first, then parallelize the
rest by cluster.

### 27.10 Progress snapshot (2026-05-05)

Running tally against §27.7's task plan: **55 / 80 task-IDs done**
(up from 51 the previous session). Closed this session:

- **#121 / #197** Goto picker debug — keyboard arrow-nav, Enter-pick,
  listen-mode hash sync.
- **#162** Shareable ayah cards — Satori (`/og/ayah/[vk]`) shipped
  first, then a Puppeteer-screenshot replacement at
  `/og/ayah-pp/[vk]` over a chrome-free `/share-card/[vk]` page that
  reuses the real reader components for full Arabic/tajweed/HTML
  fidelity. ShareDialog modal with format pills (landscape/square/
  story), variant pills (minimal/translation/wbw/advanced), Insights
  switches (transliteration/grammar/tafsir), Sizing controls
  (fit-content + 1×/1.25×/1.5×). Active translation slug forwarded
  from /read.
- **#171** Hisn al-Muslim azkar — `/azkar` surface, 24 curated du'as
  across 6 categories, daily-resetting tap-counter, hadith refs.
- **#180** "I just heard them recite" — parent-facing log on /hifdh,
  client-only, family-private, 90-day cap.
- **#181** Mutashabihat side-by-side drill — `/drill/mutashabihat/
[vk]`, LCS word diff, Cover-partner mode.
- **#185** I'rab grammar surface — feature-key labels in
  `MorphologyPane`, new `/grammar` primer.
- **#186** Children's mode toggle on /read — muallim reciter preset,
  body[data-children="1"] CSS lift, advanced surfaces hidden.
- **#187** Ramadan-aware UI deepening — Suhoor/Iftar countdown +
  daily juz tracker in `HijriNudge`.
- **#188** Friday Kahf nudge + Hijri-aware events — `HijriNudge`
  on homepage.
- **#196** /api proxy hardening — scoped Permissions-Policy, HSTS,
  /api/internal/\* deny, immutable static cache.
- **#199** Server-side forced aligner — char-weighted apportionment
  for the 37 EveryAyah reciters with no QUL segments, persisted
  to `qalaam_v1_recitations_segments_aligned`.

Side-fixes shipped en route: WBW backend SQL bug (referenced
non-existent columns), tafsir HTML bleed in `AyahCard` (allowlist
sanitizer + `.tafsir-prose`), CompareClient hydration mismatch,
tajweed colorization in continuous mode (per-word so Arabic glyph
joining survives), salah 3-provider IP-geo fallback chain with
auto-fallback on insecure origins, salah compass listening to
`deviceorientationabsolute` + `webkitCompassHeading` for stable
heading, mushaf "Open image" URL-decode + retry-on-transient.

Remaining pending IDs (priority order for the next session):

1. **#192 auth foundation** — the single biggest unlock; gates
   #161, #179, #182, #183, #186-children-cloud-sync, #193-#195.
2. **#190** IndoPak 16-line + Qatar layouts — `textIndopak` is
   already in DB, needs a layout surface + mushaf renderer (small
   ship; high-delight for the South-Asian / Hanafi audience).
3. **#158** WBW translation backfill — 22k/83k words have glosses
   today; expand via QUL deep-pull to full 83k.
4. **#198** Playwright sweep — wraps everything; best last.
5. **#174 / #175 / #176** Listen depth (offline / ambient / Cast) —
   each is a multi-day infra ship.
6. **#165 / #166 / #167 / #168** HA depth — needs HA-side auth +
   media-source plumbing; queue after #192 + #163 stabilization.
7. **#178 / #179 / #182 / #183** Family-tier features — auth-gated.
8. **#184 / #191** Course bodies + mobile native apps — content +
   second codebase efforts; queue separately.
9. **#193 / #194 / #195** Billing + voice-cloning Pro tier — needs
   #192 + Stripe + Habibi GPU.

The next-session highest-leverage path: ship **#192** end-to-end
(NextAuth + Prisma + the bookmarks/highlights/notes server side
that #161 + #179 ride on), then parallelize the auth-unblocked
family features.

---

## §28. Comprehensive QUL ingest — completed substrate, 2026-05-06

**Parent task #122** — full QUL inventory + scrape + license-aware staging now done. Sub-tasks #201–#210 track the downstream ingest + UI wiring slices. Documented in detail in `Docs/research/qul-inventory.md` §5–§6.

### What was shipped (this session)

1. **Live QUL catalogue scrape (#201, 122a)** — every public resource enumerated across all 14 categories: `ayah-theme`, `ayah-topics`, `font`, `morphology`, `mushaf-layout`, `mutashabihat`, `quran-metadata`, `quran-script`, `recitation`, `similar-ayah`, `surah-info`, `tafsir`, `translation`, `transliteration` → **528 resources**, persisted to `/tmp/qul-inventory.json` and summarised in §5 of qul-inventory.md.

2. **Gap analysis (#202, 122b)** — per-category coverage table: 8 categories fully / mostly ingested (morphology, mushaf-layouts up to v4, mutashabihat, quran-metadata, similar-ayah, ayah-topics, tafsirs/translations partial); 6 categories with significant gaps (15 fonts, 26 quran-scripts incl. PUA-encoded V1/V2/V4, 82 recitations, 101 tafsirs, 139 translations, 5 transliterations, 5 surah-info languages, ayah-themes 100% missing).

3. **`scripts/data/scrape-qul-full.py`** — exhaustive QUL scraper, supersedes the curated 36-resource `scrape-qul.sh` priority list. Capabilities:
   - Authenticated session via `QUL_EMAIL` / `QUL_PASSWORD` env (credentials saved to claude-memory).
   - Walks every resource enumerated in `/tmp/qul-inventory.json`.
   - Handles all three QUL download patterns: direct CDN, Active-Storage redirect, hashed `/resources/<cat>/<sha>/download` 302-redirect.
   - Concurrency-capped (default 4) with `--resume` (idempotent re-run).
   - Sidecar `<file>.license.json` per ADR-0020 — every download carries `source_url`, `source_id`, `sha256`, `downloaded_at`, `license_tag: unverified` placeholder, and `attribution_required: true` default.
   - Filter knobs: `--categories a,b,c`, `--limit N`, `--dry-run`.

4. **Comprehensive scrape executed** — 1.3 GB across **2,580 staged files** with per-file SHA256 pins:

   | Category          | Files | Disk | Coverage                                                                                      |
   | ----------------- | ----: | ---: | --------------------------------------------------------------------------------------------- |
   | `ayah-theme`      |     2 | 104K | ✅ 1/1 (was 0)                                                                                |
   | `font`            |    30 | 6.8M | ✅ 15/17 (was 2) — V1/V2 single-file fonts 404; V4 page-by-page in 240                        |
   | `morphology`      |    12 | 2.9M | ✅ 6/6                                                                                        |
   | `mushaf-layout`   |    66 | 7.7M | ✅ 11/12 (was 4) — Indopak 9/13/15/16, KFGQPC v1/v2/v4, DigitalKhatt, Qatar, Nastaleeq        |
   | `mutashabihat`    |     2 |  48K | ✅ 1/1                                                                                        |
   | `quran-metadata`  |    32 | 956K | ✅ 8/8                                                                                        |
   | `quran-script`    |   168 |  20M | ✅ 28/28 — incl. **QPC V1 / V2 / V4 PUA-encoded scripts**                                     |
   | `recitation`      |   532 |  60M | ✅ 133/133 — full segmented + unsegmented recitation catalogue                                |
   | `similar-ayah`    |     4 |  80K | ✅ 1/1                                                                                        |
   | `surah-info`      |    36 | 3.7M | ✅ 6/6 — Tamil, Urdu, Indonesian, English, Italian, Malayalam                                 |
   | `tafsir`          |   430 | 576M | ✅ 108/108 — Ibn Kathir AR/EN/UR/BN, Tabari, Qurtubi, Saadi multilingual, Mukhtasar 30+ langs |
   | `translation`     | 1,224 | 323M | ✅ 198/198 — Sahih, Pickthall, Yusuf Ali, Mokhtasar, Maududi, multilingual                    |
   | `transliteration` |    40 | 6.9M | ✅ 8/8                                                                                        |
   | `ayah-topics`     |     0 |    — | 🟡 1/1 (HTTP 500 on detail; covered by existing topics ingest)                                |

5. **Inventory documentation refreshed** — `Docs/research/qul-inventory.md` now has §5 (live snapshot dated 2026-05-06) + §6 (per-sub-task action plan with ranked priority).

### What this UNLOCKS — capability ledger

Every capability below is now **substrate-ready** — the raw bytes are on disk with sidecars; the remaining work is license-tag review (manual gate per ADR-0020) plus the downstream ingest scripts that consume the raw files.

#### Reading + rendering (O-04 outcome)

- **Per-page KFGQPC V4 Tajweed rendering** (sub-tasks #203 + #204 + #205 + #206). The QUL `quran-script` ids 47 (V4 wbw), 80 (V2 ayah), 81 (V1 ayah) carry PUA-encoded text per verse. With 604 per-page COLR/CPAL color fonts, `/read` Tajweed mode drops the CSS-overlay tajweed approximation and renders the canonical KFGQPC V4 1441H mushaf — colors baked into the font, no shaping breakage. This is the rendering Quran.com / Tarteel use; we now match it bit-for-bit.
- **9 additional mushaf layouts** (#207, layout ids 8/10/11/12/15/19/21/236/313/570/571): Indopak 9-line Gaba, Indopak 13-line Qudratullah, Indopak 13-line Taj, Indopak 15-line Qudratullah, Indopak 16-line Taj, KFGQPC V1 1405H, KFGQPC V2 1421H, KFGQPC Nastaleeq 15-line, Digital Khatt KFGQPC V2 layout, Mushaf Qatar 15-line. Surfaces in `LayoutSwitcher` chip-row, paginated correctly via `qalaam_v1_qul_layouts_pages/lines/words`.
- **DigitalKhatt variable-font Madani layout** — the modern Madani 1420H mushaf with optical-axis variable typography (script id 48, 85; layout id 21).
- **IndoPak Naskh + Nastaleeq scripts** (script ids 55, 89, 90) — already rendered via AlQuranIndoPak font; now the per-script raw text is tagged.

#### Multilingual depth (O-18 + family-aware UX)

- **Translations: 198 → addressable, 59 → 198 reachable.** Long-tail languages (Bambara, Lingala, Filipino Iranionian, Kurdish Kurmanji, Khowar, Sindhi, Pashto, Bosnian, Albanian, Slovak, Polish, Hungarian, Czech, Bulgarian, Serbian) means a non-English-speaking family can use Qalaam in their mother tongue. Specific high-leverage entries already staged: Sahih International, Pickthall, Yusuf Ali, Clear Quran (Mustafa Khattab), Mufti Taqi Usmani, Maududi, Indonesian Kemenag, Urdu Junagarhi/Maududi, Turkish Yazir, French Rashid Maash + Montada, Spanish, German Zaidan, Malay, Tamil, Hindi Suhel, Farsi Makarem, Bengali Mokhtasar, Somali, Lingala, Filipino, Kurdish.
- **Tafsirs: 108 fully addressable.** The Mukhtasar series in 30+ languages unblocks the multilingual Tafsir-pane on `/study`. Saadi multilingual (AR/RU/UR/SQ/ID/FA/TR), Tabari + Qurtubi Arabic for advanced learners, Ibn Kathir EN/AR/UR/BN for the canonical English-Arabic-Urdu-Bengali bridge.
- **Surah-info: 5 new languages** (Tamil, Urdu, Indonesian, Italian, Malayalam). Currently only English. Each one is a small-but-felt UX win for a specific diaspora.
- **Transliterations: 8/8.** English wbw, English Tajweed, RTF-updated, Turkish, three syllable variants. Adds non-Arab family members to the reading flow.

#### Recitations (O-06 + O-13)

- **133 reciters fully addressable** (currently 51 ingested). Segmented audio + word timestamps for Husary Mujawwad, Abdul Basit Mujawwad, Khalifa al-Tunaiji, Madinah Taraweeh 1429–1442, Makkah Taraweeh 1437, Yasser al-Dosari, Maher al-Muaiqly, Saud al-Shuraim, Hani ar-Rifai, Saad al-Ghamdi, Abu Bakr ash-Shatri, Mishary Alafasy, Sudais, Minshawi Murattal + Mujawwad. The long-tail (~82 reciters) covers regional canonical voices (Ali Jaber, Khalil Habib, Adel Ryan, Tunaiji, etc.) — Hifdh students often pick obscure-but-authoritative reciters.

#### Hifdh + recitation feedback (O-08 + O-06)

- **Word-by-word translations expanded** (#158 unblocked) — script id 47 (V4 wbw) + id 312 (KFGQPC Hafs wbw) carry word-aligned glosses. Currently 22k/83k word-level glosses; full 83k available.
- **Mutashabihat full set ingested** (already 19,385 pairs in qul_mutashabihat_v2_pairs); validated against the live QUL state.
- **Similar ayahs** (3,552 pairs) already ingested.
- **Ayah-themes** (1,049 entries) — not yet in DB; raw ready for ingest.

#### License + attribution (ADR-0020 + #208 + #209)

- Every staged file carries a sidecar `.license.json` with SHA256 pin (per ADR-0002) and a `license_tag: unverified` placeholder.
- The ingest framework (`ingest-qul-from-scrape.ts`) refuses files with `unverified` tags — license review is a manual gate before bulk ingest.
- Auto-tagger candidate (next session): classify sidecars by tag/title (`KFGQPC` → `kfgqpc-redistributable`, `Mukhtasar` → `permissive-with-credit`, `Pickthall` / `Yusuf Ali` → `public-domain`, `Quranic Arabic Corpus` → `gpl-3.0-or-later`, etc.) so 80%+ of files can be batch-licensed in seconds.
- Once tagged, `/credits` page (#209) renders every attribution from `qalaam_v1_data_sources` grouped by category.

### Pipeline (capture → review → ingest → expose → render)

```
                         scrape-qul-full.py
QUL CMS  ───────────────────────────────────────►  data/qul-source/raw/<cat>/
(528 res)         auth + 302-aware downloader     <id>-<slug>-<hash>.<ext>
                                                  + .license.json sidecar (SHA256 pinned)

                         license-tag review (manual)
license_tag: unverified ──────────────────────────►  license_tag: <spdx>
                  (ADR-0020 ingest gate)              auto-tagger candidate per category

                         ingest-qul-from-scrape.ts + sibling scripts
data/qul-source/raw/  ────────────────────────────►  qalaam_v1_qul_*  +  qalaam_v1_data_sources

                         backend Fastify routes (apps/backend)
qalaam_v1_qul_*  ─────────────────────────────────►  /v1/<resource>/<key>  +  /v1/credits

                         frontend Next.js (apps/web)
/v1/<resource>  ──────────────────────────────────►  AyahCard / MushafLines / TafsirPane /
                                                     TranslationPane / SurahInfoPane / Credits page
```

### Pending ingest sub-tasks (this session opened, future sessions execute)

`#203 (122c)` ingest QPC v1/v2/v4 PUA scripts → new `text_qpc_v1/v2/v4` columns on qalaam_v1_verses
`#204 (122d)` self-host all 604 QPC V4 Tajweed page fonts (`https://verses.quran.foundation/fonts/quran/hafs/v4/colrv1/woff2/p{N}.woff2` — `font-display: block`, `unicode-range` PUA U+FC41-FC64 per page)
`#205 (122e)` backend `/v1/qpc-text/:vk?layout=v1|v2|v4` returns PUA text + page number + `fontFamily: "QPCv4Page50"`
`#206 (122f)` /read Tajweed mode renders PUA text with the matching per-page font (canonical KFGQPC tajweed)
`#207 (122g)` ingest 9 additional mushaf-layouts (Indopak 9/13/15/16, KFGQPC V1/V2 layouts, DigitalKhatt, Qatar, Nastaleeq) → expose via `LayoutSwitcher`
`#208 (122h)` license auto-tagger + `qalaam_v1_data_sources` backfill from sidecars
`#209 (122i)` `/credits` page surfacing every QUL attribution
`#210 (122j)` this section + DEV_CHECKLIST snapshot — ✅

### What "next session" looks like (post-comprehensive-ingest)

Three parallel tracks unblocked by this substrate:

1. **Tajweed font upgrade track** (#203 → #206): biggest user-visible rendering jump. Replaces our CSS-overlay tajweed colors with KFGQPC V4 native COLR/CPAL — bit-for-bit Quran.com parity. ~1 session.
2. **Multilingual breadth track** (#208 license auto-tagger → bulk ingest the 139 missing translations + 101 missing tafsirs + 5 missing surah-info languages): ~1 session for the auto-tagger + ingest pipeline run, then frontend chip-rows for language selection in `/study` + `/read`.
3. **Layout breadth track** (#207): 9 new mushaf layouts surfaced in the `LayoutSwitcher`. Each one bumps a regional Hifdh community into the platform. ~1 session.

After those three, the "Qalaam = entire QUL substrate, productionized" claim becomes literal-true rather than aspirational.

### How to re-run the scrape (idempotent)

```bash
QUL_EMAIL=... QUL_PASSWORD=... \
  uvx --from requests python3 scripts/data/scrape-qul-full.py
# resume default, concurrency 4, all 14 categories
# add --no-resume to force re-download, --limit N to throttle
```

Credentials saved to `~/.claude/projects/.../memory/reference_qul_credentials.md`.

---

## §29. SaaS substrate landed — H1 + family-tier + H2 (snapshot 2026-05-06 evening)

This section records the second half of 2026-05-06 — six commits on
top of §28's QUL substrate. The platform now has the SaaS surfaces
the strategy doc has been promising: real auth, the family-tier
features that auth gates, the HA + Listen Mode cross-cutting wiring,
and the pricing UI with an honest "I can't afford it" path. After
this we deploy to Dokploy/VPS before resuming development.

### 29.1 Commits + tasks closed

| Commit    | Tasks closed                                   | Lines |
| --------- | ---------------------------------------------- | ----- |
| `d630368` | #192 H1 + #161 A7                              | ~1.8K |
| `1036090` | #178 E1 + #179 E2 + #182 E5 + #183 E6          | ~5.2K |
| `d3ad383` | #167 B5 + #175 D4                              | ~0.2K |
| `bd4cb38` | #193 H2                                        | ~0.7K |
| `ee77bd0` | bug-fix bundle (visibility / hydration / cast) | ~0.3K |
| `5be3cb6` | per-user HA URL + multi-strategy Cast          | ~0.6K |

Total: 9 task IDs, ~9.5K lines, all type-clean + lint-clean,
18/18 smoke green.

### 29.2 Auth foundation (#192 H1) — what makes this self-host-friendly

The SaaS thesis (§17) called for "no external auth provider, single
mountable substrate so the same backend runs on Dokploy/VPS or
inside an HA add-on." H1 lands that:

- `data/qalaam.sqlite` — separate from read-only `qul.sqlite`.
  Single mutable file → one Dokploy volume mount.
- Node-built-in scrypt (N=16384, 64MB maxmem) — zero native-binding
  deps, runs identically on alpine/aarch64/x86_64.
- 64-char-hex opaque session token = PRIMARY KEY → O(1) lookup.
  Rolling 30-day expiry.
- SQL-backed sliding-window throttle (15-min) — survives restarts
  behind a load balancer; runs **before** password verify so timing
  oracles can't leak account existence.
- Auto-Family on signup → guardian role implicit; family-tier
  features unblocked without a separate onboarding flow.
- httpOnly + SameSite=Lax + Secure-in-production cookie. Manual
  Set-Cookie header so the dependency footprint stays minimal.

### 29.3 Family-tier (E1 + E2 + E5 + E6)

The flywheel from §15 ("Family-private Hifdh accountability + mutual
encouragement") is now end-to-end on `qalaam.sqlite`:

```
hifdh_plans  ◄── E2 per-child plan creator + parent dashboard
   │
   └─ hifdh_progress  (sabaq | sabqi | manzil | review)
mistakes     ◄── E1 ASR + parent-mark + self-mark, page-keyed via
                  qul.sqlite.qalaam_v1_verses.page_madani_15
family_khatm ◄── E6 multi-user khatm
   │
   └─ family_khatm_pages  (UNIQUE on khatm_id, page_number)
family_voice_notes ◄── E5 audio + sticker, b64 in JSON,
                         data/voice-notes/<id>.<ext>
```

Frontend surfaces:

- `/family` — parent dashboard (members tile row, per-child action
  card with active plan / portions-this-week / open mistakes,
  self-heatmap, voice-notes inbox)
- `/family/khatm` — list + start
- `/family/khatm/[id]` — 31-col page grid; claim per-page; mode-
  validated for sequential / distributed / by-juz
- `/family/khatm/[id]/wall` — kiosk view, SVG progress arc, recent
  contributions stream, 30s auto-refresh, chrome-less for shared TV
- `MistakeHeatmap` embedded on /hifdh + per-member on /family
- `HifzCheckClient` POSTs ASR mismatches to `/v1/mistakes` on stop;
  401 silently swallowed for anonymous

Adab-strict throughout: NO XP, NO trophies, NO leaderboards in this
surface (existing FamilyLeaderboard predates the adab pass and is
honest-time leaderboard with explicit ikhlas framing). Stickers are
6 explicit Islamic phrases (Subhan-Allah / Masha-Allah / Alhamdulillah
/ Jazak-Allah / Ahsanta / Baraka) with Arabic + meaning; not
collectibles.

### 29.4 HA + Listen Mode (#167 B5 + #175 D4)

- HA media-source split top-level into Recitation + Mushaf images.
  Image branch resolves `mushaf/<layout>/<page>` to an absolute
  PUBLIC_APP_URL/mushaf-images URL with mime image/png. Cast/photo-
  frame players render natively; speaker-only players gracefully
  fall back via HA's supported_features filter.
- MushafPagePlayer POSTs to `/v1/now-playing/web` on every verse
  change (debounced by verse-key). HA panel + sensors now reflect
  live current verse without manual coordinator polling.
- Transliteration audio half of B5 remains deferred (needs TTS
  pipeline + transliterating reciter — pairs with #194 H3 / #195 H4
  in the post-deploy GPU bring-up).

### 29.5 Pricing + intake (#193 H2)

Three-tier UI at `/pricing` with intentionally generous Free tier
(full Mushaf, every translation, recite-and-check, daily Hifdh,
bookmarks, audio + Cast/AirPlay/HA). Premium gates the family-tier
features that take ongoing maintenance work. Pro adds voice cloning
(deferred — H3/H4) + multi-household + per-student weekly reports.

`/v1/support` intake table records:

- `cant-afford` submissions (anonymous OK pre-signup)
- `upgrade` requests (kind + target_tier + free-text)
- `feedback`

These let the operator manually activate paid tiers via SQL
`UPDATE users SET tier='premium' WHERE email = ?` until Stripe
checkout lands in the deployment commit.

### 29.6 Per-user HA URL + multi-strategy Cast (`5be3cb6`)

Two user-reported issues fixed in one cycle:

- **HA URL ≠ env var**: `users.ha_url` column added; gated to
  premium/pro via PATCH `/v1/auth/me` (403 qalaam.auth.tier-required).
  /settings page surfaces it with a "Premium / Pro" badge for free.
  Players (ContinuousReaderPlayer + MiniPlayer) read `useUser().haUrl`.
- **Cast "SDK unavailable"**: rewritten to a multi-strategy click
  handler:
  - Path A: cast.framework + requestSession + loadMedia (best path)
  - Path B: HTMLMediaElement.remote.prompt() — Chromium per-element
    picker, works when SDK didn't init
  - Path C: detect `http://<lan-ip>` origin and surface "Cast needs
    HTTPS or localhost — open via http://localhost:3111"
  - Path D: retry SDK load + recurse

  Root cause was that Cast Sender + remote.prompt + Presentation API
  all silently refuse on `http://<lan-ip>` origins; only HTTPS or
  http://localhost work. This affects production too — deployment
  must serve over HTTPS for Cast to function (Cloudflare in front
  of Dokploy will give us that).

### 29.7 Visibility + theme defaults (`ee77bd0`)

Tailwind v4 PurgeCSS was dropping utilities I'd used but never
declared (`text-paper`, `bg-ink-strong`, `hover:*` of hand-rolled
classes, `bg-leaf/N` opacity tints). Hand-rolled the missing ones in
globals.css; added semantic `.btn-primary` / `.btn-ghost` / `.btn-leaf`
that flip via `--c-*` tokens (light: dark-on-cream, dark: white-on-
near-black, 18:1 contrast both ways). Bulk-replaced literal
`bg-white` → `bg-surface` so cards lift visibly in both themes.

SendToPicker hydration fixed via `mounted` gate (capability probes
read window/navigator synchronously → SSR/client mismatch). Theme
default now `'light'` (was `'system'`) to align the toggle UI with
the bootstrap script's pre-paint default.

### 29.8 Pending IDs after this session (post-deployment priority)

```
#174  D3  Offline downloads — service worker + per-surah/per-juz packs
#190  G4  More mushaf layouts — blocked on QUL auth-scrape of #236/#313/#569/#570/#571
#184  F1  Quranic Arabic course bodies (Level 1-4) — content authoring, multi-week
#194  H3  Voice cloning v2 — needs GPU container + Habibi-TTS
#195  H4  Personal teacher voice cloning (Pro tier) — needs GPU
#191  G5  Mobile native apps (Kotlin + Swift) — multi-week
```

Plus the deferred halves:

- B5 transliteration-audio half (pairs with H3/H4)
- D4 cross-page ambient auto-advance (current commit ships the
  now-playing wire; cross-page chain is a follow-up)
- Stripe checkout (pairs with deployment)

### 29.9 Deployment plan (next, before further development)

Per CLAUDE.md `New Project Setup Checklist` + `Sudo Access` sections:

1. **Dokploy project** on Hetzner `178.156.218.66`. App points at the
   monorepo, builds via the multi-stage Dockerfile pattern in CLAUDE.md.
2. **Single mountable volume** at `/app/data/`:
   - `qul.sqlite` (read-only Quran data)
   - `qalaam.sqlite` (writes — users / sessions / family / etc.)
   - `voice-notes/` (subdir for E5 audio uploads)
   - `mushaf-images/` (read-only, 63MB Madani-16 PNGs)
3. **DNS via Cloudflare**:
   - A `qalaam.app` → 178.156.218.66 (proxied)
   - CNAME `www` → `qalaam.app` (proxied)
4. **Domain on Dokploy**: Let's Encrypt via Traefik. HTTPS gives us
   secure cookie + Cast SDK eligibility (§29.6).
5. **Env vars (production)**:
   - `NODE_ENV=production` → flips Secure cookie
   - `PUBLIC_API_URL=https://qalaam.app`
   - `PUBLIC_APP_URL=https://qalaam.app`
   - `QUL_SQLITE_PATH=/app/data/qul.sqlite`
   - `QALAAM_AUTH_SQLITE_PATH=/app/data/qalaam.sqlite`
   - `QALAAM_VOICE_NOTES_DIR=/app/data/voice-notes`
   - `DATABASE_URL` + `DIRECT_DATABASE_URL` — only used for QF Tier B
     token cache; Postgres optional, primary store stays SQLite
   - `REDIS_URL` — optional rate-limit cache (Fastify rate-limit plugin)
6. **Stripe wiring** (H2 close — second deploy after first is up):
   `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, checkout success/
   cancel redirects, `/v1/billing/webhook` receiver.
7. **HA panel release**: tag a release of
   `integrations/homeassistant/custom_components/qalaam/` for HACS.
8. **Verification**: `curl -s https://qalaam.app/api/health | jq`,
   18/18 smoke against the production domain, signup → /family
   round-trip, /v1/now-playing visible in HA.

### 29.10 Next-development priorities (post-deploy)

In order of user-value-per-session:

1. **#174 D3 Offline downloads** — service worker + Cache API for
   `/mushaf-images/`, `/api/v1/qpc-text/`, `/api/v1/audio/`, plus an
   IndexedDB pack manifest. `/downloads` page with per-surah /
   per-juz pack picker. Network-first with cache fallback.
2. **Stripe close-out** — pricing tier enforcement at the API layer;
   replace manual SQL UPDATE.
3. **#190 G4 More mushaf layouts** — re-run the QUL auth-scrape
   with credentials for #236/#313/#569/#570/#571, ingest the layout
   tables, expose via `LayoutSwitcher`.
4. **#194 H3 + #195 H4 Voice cloning** — needs a separate
   `services/tts-worker/` container with GPU; consent + watermark
   flow on Premium settings page.
5. **#184 F1 Arabic course bodies** — content authoring; ship Level
   1 first to validate the pedagogy + lesson framework.
6. **#191 G5 Mobile native apps** — Kotlin + Swift; both consume the
   same `/v1/*` HTTP surface so there's no backend work, just
   client UI.

Once D3 lands the offline story is real (`add to home screen` on iOS
gives a near-native experience with bundled Quran + audio), and at
that point the platform is feature-complete for the Hifdh-first
audience the strategy was written for.
