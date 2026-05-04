# Qalaam — C4 Level 2: Containers

![Qalaam — Containers (C4 Level 2)](./qalaam-c4-containers.png)

> **Diagram sources:** `c4-containers.puml` (re-render via `scripts/docs/render-c4-png.sh`); the Mermaid block below renders natively on GitHub.

```mermaid
%%{init: {'theme': 'neutral'}}%%
C4Container
    title Qalaam — Containers (C4 Level 2)

    Person(family, "Family member")

    System_Boundary(qalaam, "Qalaam") {
      Container(web, "apps/web", "Next.js 15 / React 19 / Tailwind v4", "Reader · Hifdh · Listen Mode · /study")
      Container(panel, "apps/ha-panel", "Vite + Preact bundle", "Lovelace panel served via HACS integration")
      Container(backend, "apps/backend", "Fastify v5 + Zod", "/v1/{verses,metadata,wbw,mutashabihat,recitations,layouts,hifdh,curriculum}")
      ContainerDb(qul, "data/qul.sqlite", "SQLite + WAL", "Verses · layouts · mutashabihat · wbw · morphology (gpl-gated)")
      ContainerDb(pg, "Postgres", "Hifdh state + family + audio cache index", "Per-user FSRS + plans")
      ContainerDb(redis, "Redis", "Sessions + cache headers (ADR-0010)")
      Container(asr, "services/asr-worker", "FastAPI + faster-whisper", "On-device transcription + Quran-aware aligner (ADR-0005)")
      Container(tts, "services/tts-worker", "FastAPI + httpx", "ElevenLabs + Habibi; cache + watermark + quranic-guard (ADR-0019)")
      Container(prosody, "services/prosody-worker", "FastAPI + numpy", "F0 / RMS / DTW for teach-back")
      Container(realtime, "services/realtime-feedback", "WebSocket")
      Container(bridge, "services/device-bridge", "FastAPI + pychromecast + pyatv")
      Container(ha, "integrations/homeassistant", "Python custom_component", "media_player + sensors + services + voice + panel")
    }

    System_Ext(qf, "Quran.Foundation")
    System_Ext(r2, "Cloudflare R2")
    System_Ext(speakers, "Speakers (Cast/Sonos/AirPlay/MQTT)")
    System_Ext(elevenlabs, "ElevenLabs API")

    Rel(family, web, "HTTPS")
    Rel(family, ha, "Home Assistant UI / Voice")
    Rel(ha, panel, "Static path")
    Rel(web, backend, "JSON / SSE")
    Rel(ha, backend, "Bearer")
    Rel(backend, qul, "better-sqlite3 RO")
    Rel(backend, pg, "Prisma")
    Rel(backend, redis, "ioredis")
    Rel(backend, qf, "OAuth2 client_credentials", "cache ≤ 7d")
    Rel(backend, r2, "S3 GET/HEAD")
    Rel(web, asr, "WebSocket (loopback)")
    Rel(web, prosody, "HTTP")
    Rel(web, realtime, "WebSocket")
    Rel(tts, elevenlabs, "POST /v1/text-to-speech", "env-gated")
    Rel(tts, r2, "S3 PUT/HEAD")
    Rel(ha, bridge, "HTTP (when self-hosted)")
    Rel(bridge, speakers, "Cast/pyatv/SoCo/MQTT")
```

ASCII fallback (for terminals where Mermaid doesn't render):

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                Web tier                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  apps/web (Next.js 15 + React 19 + React Compiler 1.0)                │  │
│  │   ├── React Server Components → backend HTTP                         │  │
│  │   ├── packages/ui (design system)                                    │  │
│  │   ├── packages/ui-quran (mushaf renderer + ayah card)                │  │
│  │   ├── packages/ui-hifdh (parent dashboard, rating, streak)           │  │
│  │   └── packages/adapter-web (browser-as-speaker)                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
                                      │ HTTPS
                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                            API tier (Fastify v5)                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  apps/backend                                                         │  │
│  │   ├── /healthz, /v1/verses/*, /v1/chapters/*, /v1/recitations        │  │
│  │   ├── packages/api-client-ts (QF Tier A; ToS ≤ 7d cache)             │  │
│  │   ├── packages/data-loader (QUL SQLite; falls back to fixtures)      │  │
│  │   ├── packages/hifdh-engine (FSRS-6 sessions)                        │  │
│  │   ├── packages/khatm + packages/azkar                                │  │
│  │   └── packages/adhan (prayer times, qibla, hijri)                    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
            │                            │                            │
            ▼                            ▼                            ▼
┌──────────────────────┐  ┌──────────────────────┐  ┌────────────────────────┐
│  Postgres (Supabase) │  │  Redis (Upstash)     │  │  Cloudflare R2          │
│   schema mirrors     │  │   FSRS due-queue     │  │   audio cache           │
│   packages/schema    │  │   session state      │  │   (zero-egress)         │
└──────────────────────┘  └──────────────────────┘  └────────────────────────┘
                                      │
                                      │ HTTP/JSON (LAN-only in dev/prod)
                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                          Sidecar tier (Python)                              │
│  ┌────────────────────────┐  ┌────────────────────────┐  ┌──────────────┐  │
│  │ services/device-bridge │  │  services/asr-worker   │  │ services/    │  │
│  │   pychromecast (Cast)  │  │  faster-whisper +      │  │ tts-worker   │  │
│  │   pyatv (AirPlay 2)    │  │  Tarteel-tuned model   │  │   ElevenLabs │  │
│  │                        │  │  AUDIO NEVER LEAVES    │  │   or Habibi  │  │
│  │                        │  │  THE DEVICE (ADR-0005) │  │   (post v2)  │  │
│  └────────────────────────┘  └────────────────────────┘  └──────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                        HA tier (optional, user-owned)                       │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  integrations/homeassistant/custom_components/qalaam                  │  │
│  │   ├── manifest.json (HACS-installable, hub, cloud_polling)           │  │
│  │   ├── coordinator.py → backend /v1/reciters                          │  │
│  │   ├── media_player.py → proxies to user-chosen target                │  │
│  │   ├── media_source.py → media-source://qalaam/...                    │  │
│  │   └── services.yaml (play_ayah, play_surah, start_session)           │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

## Deployment topologies

**SaaS:** apps/web on Vercel; apps/backend + Python sidecars on Hetzner; Postgres on Supabase; Redis on Upstash; R2 on Cloudflare. Browser tab is also a Speaker via the web adapter.

**Self-hosted:** all of the above as `docker compose up` on the user's own hardware. Uses the same Postgres + Redis services bundled in the compose file.

**HA-native:** the HA integration calls Qalaam SaaS for catalog metadata, then re-exposes it locally. ASR + Hifdh state still live on Qalaam's backend; HA is the routing surface.
