# Qalaam Deployment Plan — `qalaam.themarginapp.com`

**Author:** generated 2026-05-06 by the deploy-plan exercise
**Server:** Hetzner CCX23 → live as ~30GB RAM (likely upgraded), `178.156.218.66`
**Pattern source:** `Docs/infrastructure-margin-example/` (the-margin-stack
on Dokploy compose `Fv4OP-Dql0hN0BEMNOnHJ`)
**Status:** plan only — nothing executed. Awaiting approval.

---

## 1. Operating principles

> **Scope guardrail.** The Margin example is referenced as an
> _operational_ template only — Dokploy compose pattern, Traefik
> label syntax, GitHub-bound autoDeploy, naming + volume conventions,
> resource-limit shape. Qalaam's strategy and vision are NOT shaped
> by Margin's stack. We ignore everything margin-specific
> (PowerSync / Postgres / pgvector / Metabase / agent-runtime / MCP
> federation / NextAuth / OAuth / Resend / R2 / etc.) wherever
> Qalaam already chose differently. Cherry-pick, don't conform.

1. **Zero impact on existing apps.** No shared DB, no shared Redis, no
   reused container/network/volume names. Qalaam is fully self-contained.
2. **Borrow the operational pattern, not the product surface.** Same
   Dokploy compose-application workflow + Traefik label conventions +
   `${DOMAIN}`-modular env — that's the cherry-pick. Qalaam stays
   SQLite-only, no Postgres, no Redis, no auth provider, no
   PowerSync, no agent-runtime, no MCP federation gateway. Family-
   private + adab-strict + Hifdh-first per the existing strategy
   (§7, §15, §17 above). Two services (web + backend) — that's it.
3. **URL is one variable.** `${DOMAIN}` in compose env → flips with one
   change. Today: `qalaam.themarginapp.com`. Tomorrow: `qalaam.app` or
   anything else, no code changes required.
4. **HTTPS in production unblocks Cast.** Cast Sender SDK refuses
   `http://<lan-ip>` origins (we proved this in the bug-fix cycle).
   Cloudflare → Traefik → Let's Encrypt gives Qalaam HTTPS automatically.
5. **Single mountable volume.** All mutable Qalaam state lives under one
   named Docker volume — trivial backup, trivial restore, no Postgres
   ops burden.

## 2. Reality check on the host

```
Hetzner    178.156.218.66   30 GB RAM, ~92 GB free disk, swarm mode active
Traefik    dokploy-traefik (v3.6.1) on overlay network `dokploy-network`
Existing   the-margin (web, agent-runtime, mcp-master, mcp-db, sync-worker, redis, postgres)
           the-margin-staging (web, agent-runtime, realtime, sync-worker, redis)
           signzart (web, postgres, redis)
           dokploy (postgres, redis, traefik, dokploy-app)
           openclaw (browser, gateway, n8n, ollama)
           mockupry (frontend, backend, 4 workers, scheduler, postgres, minio)
           CCS / app-program-* (3 misc small services)
```

No `qalaam-*` anything yet — clean slate. We won't collide.

## 3. URL + DNS

- Subdomain: `qalaam.themarginapp.com`
- Cloudflare zone (margin): `23da97750dad88a11a8bebc707724aab`
- Action: add **A** record `qalaam` → `178.156.218.66` (proxied,
  TTL=auto). The cloudflare zone already has the `themarginapp.com`
  apex working through the same orange-cloud + Traefik chain.

Modular path for future change:

- one env-var flip in Dokploy: `DOMAIN=qalaam.app` (or whatever)
- DNS update in Cloudflare
- redeploy → Traefik picks up new Host(`${DOMAIN}`) labels, Let's
  Encrypt issues a fresh cert
- no code changes; no git changes

## 4. Compose architecture

Named, prefixed, isolated. **Two service containers** + a backend-
internal network + a Traefik-facing network:

```
qalaam-network         (bridge, internal)   ← service-to-service
dokploy-network        (overlay, external)   ← Traefik routing

qalaam-backend  ──┐    Fastify on :4111, internal-only (no Traefik label)
                  │    Volume: qalaam-data → /app/data
                  │    Reads: qul.sqlite, mushaf-images/, .well-known/
                  │    Writes: qalaam.sqlite, voice-notes/

qalaam-web      ──┴──► Traefik:443/Host(${DOMAIN}) → Next.js standalone :3000
                       Same volume read-only for mushaf-images/
                       Proxies /api/* → http://qalaam-backend:4111
                       Env: PUBLIC_APP_URL=https://${DOMAIN}
                            BACKEND_INTERNAL_URL=http://qalaam-backend:4111
```

No Postgres, no Redis. Qalaam's H1 design uses SQLite-only for
authentication/family-tier/bookmarks/etc. (DATABASE_URL in the schema
is a leftover placeholder — we'll relax it to optional or set a stub
default in compose env.)

## 5. Storage — single named volume

```
qalaam-data    Docker named volume (driver: local)
└── /app/data
    ├── qul.sqlite             read-only Quran data (~150MB), seeded once
    ├── qalaam.sqlite          users + sessions + family-tier (~1MB → grows)
    ├── qalaam.sqlite-shm
    ├── qalaam.sqlite-wal
    └── voice-notes/           E5 audio uploads (mp3/webm)

qalaam-mushaf-images  Docker named volume (read-only after seed)
└── /app/public/mushaf-images
    └── madani-16/{1..610}.png   ~63MB total, image-mushaf overlays
```

Seeding: one-time SSH copy after first deploy:

```bash
# from local machine
scp data/qul.sqlite root@178.156.218.66:/tmp/qul.sqlite
scp -r apps/web/public/mushaf-images root@178.156.218.66:/tmp/mushaf-images

# on the host, into the named volumes
docker run --rm -v qalaam-data:/dst -v /tmp:/src alpine \
  sh -c 'cp /src/qul.sqlite /dst/qul.sqlite && chown 1001:1001 /dst/qul.sqlite'

docker run --rm -v qalaam-mushaf-images:/dst -v /tmp/mushaf-images:/src alpine \
  sh -c 'cp -r /src/. /dst/ && chown -R 1001:1001 /dst'
```

Backups: `docker run --rm -v qalaam-data:/src -v $(pwd):/bak alpine
tar czf /bak/qalaam-data-$(date +%F).tar.gz -C /src .` — same pattern
the margin uses for postgres-data.

## 6. Repo changes (commit-ready, no infra changes)

### 6.1 New files

```
apps/web/Dockerfile                                Multi-stage Next.js standalone
apps/backend/Dockerfile                            Multi-stage Fastify
infrastructure/docker/docker-compose.yml           The deploy contract
infrastructure/docker/.env.example                 Env var template
infrastructure/scripts/seed-host-data.sh           One-shot qul.sqlite + mushaf-images upload
infrastructure/scripts/deploy.sh                   Manual trigger (Dokploy autoDeploy is primary)
infrastructure/README.md                           Runbook
.dockerignore                                      Exclude node_modules, .next, etc.
```

### 6.2 Code changes (small, targeted)

- `apps/backend/src/config.ts` — make `DATABASE_URL` optional (nothing
  consumes it; relax the zod schema). Or keep required + set a stub
  default in compose env.
- Next.js `next.config.js` — confirm `output: 'standalone'`. If absent,
  add it (Dockerfile assumes it).
- `apps/web/src/lib/api-base.ts` (server-side) — when running inside
  the qalaam-web container, the `/api/*` proxy should target
  `process.env.BACKEND_INTERNAL_URL ?? 'http://localhost:4111'`. Audit
  where the Next API route handler currently forwards.
- `apps/backend/src/routes/health.ts` — confirm shape matches the
  Traefik healthcheck (HTTP 200 at `/api/health`). It exists but the
  Traefik label expects `/api/health`, not `/v1/health` — verify the
  path.

### 6.3 Build context

Compose `context: ../..` (so it sees the monorepo root from
`infrastructure/docker/`). Each service's Dockerfile gets its own
context-relative path. Same as the margin pattern.

## 7. Dokploy setup (via API)

```bash
DURL="https://deploy.signzart.com"
TOK="${DOKPLOY_API_TOKEN}"

# 1. Create new project
curl -s -X POST "${DURL}/api/project.create" \
  -H "x-api-key: $TOK" -H 'Content-Type: application/json' \
  -d '{"name":"Qalaam Production","description":"qalaam.themarginapp.com"}'
# → returns projectId (let's call it Q_PID)

# 2. Get default environmentId (Dokploy creates one per project)
curl -s -H "x-api-key: $TOK" \
  "${DURL}/api/project.one?projectId=$Q_PID"
# → grab environments[0].environmentId as Q_EID

# 3. Create a compose application
curl -s -X POST "${DURL}/api/compose.create" \
  -H "x-api-key: $TOK" -H 'Content-Type: application/json' \
  -d "{
    \"name\": \"qalaam-stack\",
    \"environmentId\": \"$Q_EID\",
    \"composeType\": \"docker-compose\"
  }"
# → returns composeId (Q_CID)

# 4. Bind to GitHub
curl -s -X POST "${DURL}/api/compose.update" \
  -H "x-api-key: $TOK" -H 'Content-Type: application/json' \
  -d "{
    \"composeId\": \"$Q_CID\",
    \"sourceType\": \"github\",
    \"githubId\": \"Gjon1h6vbkMyhrscwH0dY\",
    \"repository\": \"qalaam\",
    \"owner\": \"RabHanz\",
    \"branch\": \"main\",
    \"composePath\": \"./infrastructure/docker/docker-compose.yml\",
    \"autoDeploy\": true
  }"

# 5. Set env vars (same shape as margin's compose.update env: payload)
curl -s -X POST "${DURL}/api/compose.update" \
  -H "x-api-key: $TOK" -H 'Content-Type: application/json' \
  -d "{
    \"composeId\": \"$Q_CID\",
    \"env\": \"DOMAIN=qalaam.themarginapp.com\nNODE_ENV=production\nNEXTAUTH_SECRET=...\n...\"
  }"

# 6. Trigger first deploy
curl -s -X POST "${DURL}/api/compose.deploy" \
  -H "x-api-key: $TOK" -H 'Content-Type: application/json' \
  -d "{\"composeId\": \"$Q_CID\"}"
```

GitHub access: the `Gjon1h6vbkMyhrscwH0dY` GitHub binding belongs to
`RabHanz` org (same owner as `the-margin`). Confirm `RabHanz/qalaam`
is reachable through that binding (it's already pushed at
`https://github.com/RabHanz/qalaam.git`). If access is gated, either
add the qalaam repo to the binding's scope in Dokploy UI or generate a
new GitHub App install scoped to qalaam.

## 8. Environment variables

Bare-minimum compose env (set via Dokploy `compose.update`):

```bash
# Domain — single source of truth, change to flip URL
DOMAIN=qalaam.themarginapp.com
ACME_EMAIL=admin@themarginapp.com

# App
NODE_ENV=production
NEXTAUTH_SECRET=<openssl rand -base64 32>          # session-cookie sign for auth.ts
QALAAM_AUTH_SQLITE_PATH=/app/data/qalaam.sqlite
QUL_SQLITE_PATH=/app/data/qul.sqlite
QALAAM_VOICE_NOTES_DIR=/app/data/voice-notes

# Public — embedded in the client bundle at build time
NEXT_PUBLIC_APP_URL=https://${DOMAIN}              # used for absolute URL building
NEXT_PUBLIC_API_BASE=                              # empty → same-origin /api proxy

# Backend internal target (Next.js /api proxy resolves via service name)
BACKEND_INTERNAL_URL=http://qalaam-backend:4111

# Postgres stub — config.ts requires it but no route consumes it
DATABASE_URL=postgresql://unused:unused@localhost:5432/unused
DIRECT_DATABASE_URL=postgresql://unused:unused@localhost:5432/unused

# Quran.Foundation Tier A — optional; enables QF API parity for routes
# that fall back to QF when local QUL data is missing
QF_BASE_URL=https://apis.quran.foundation
QF_OAUTH_URL=https://oauth2.quran.foundation
QF_CLIENT_ID=
QF_CLIENT_SECRET=
```

Add later (post-deploy):

```bash
# H2 Stripe wiring (manual activation interim works until then)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PUBLISHABLE_KEY=

# H3/H4 voice cloning — needs separate GPU container, deploy later
TTS_WORKER_URL=
HABIBI_GPU_ENDPOINT=
```

## 9. Compose file structure (preview)

```yaml
name: qalaam-production

services:
  qalaam-backend:
    build:
      context: ../..
      dockerfile: apps/backend/Dockerfile
    container_name: qalaam-backend
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 4111
      QALAAM_AUTH_SQLITE_PATH: /app/data/qalaam.sqlite
      QUL_SQLITE_PATH: /app/data/qul.sqlite
      QALAAM_VOICE_NOTES_DIR: /app/data/voice-notes
      DATABASE_URL: ${DATABASE_URL}
      DIRECT_DATABASE_URL: ${DIRECT_DATABASE_URL}
      QF_BASE_URL: ${QF_BASE_URL:-https://apis.quran.foundation}
      QF_CLIENT_ID: ${QF_CLIENT_ID:-}
      QF_CLIENT_SECRET: ${QF_CLIENT_SECRET:-}
      PUBLIC_API_URL: https://${DOMAIN}
      PUBLIC_APP_URL: https://${DOMAIN}
    volumes:
      - qalaam-data:/app/data
    networks:
      - qalaam-network
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1024M
        reservations:
          memory: 512M
    healthcheck:
      test: ['CMD', 'wget', '--spider', '-q', 'http://127.0.0.1:4111/api/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s

  qalaam-web:
    build:
      context: ../..
      dockerfile: apps/web/Dockerfile
      args:
        NEXT_PUBLIC_APP_URL: https://${DOMAIN}
    container_name: qalaam-web
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 3000
      HOSTNAME: 0.0.0.0
      BACKEND_INTERNAL_URL: http://qalaam-backend:4111
      PUBLIC_APP_URL: https://${DOMAIN}
    volumes:
      - qalaam-mushaf-images:/app/public/mushaf-images:ro
    depends_on:
      qalaam-backend:
        condition: service_healthy
    networks:
      - qalaam-network
      - dokploy-network
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1024M
        reservations:
          memory: 512M
    healthcheck:
      test: ['CMD', 'wget', '--spider', '-q', 'http://127.0.0.1:3000/api/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    labels:
      - 'traefik.enable=true'
      - 'traefik.http.routers.qalaam-web.rule=Host(`${DOMAIN}`)'
      - 'traefik.http.routers.qalaam-web.entrypoints=websecure'
      - 'traefik.http.routers.qalaam-web.tls.certresolver=letsencrypt'
      - 'traefik.http.services.qalaam-web.loadbalancer.server.port=3000'
      - 'traefik.http.services.qalaam-web.loadbalancer.healthcheck.path=/api/health'
      - 'traefik.http.services.qalaam-web.loadbalancer.healthcheck.interval=30s'
      - 'traefik.docker.network=dokploy-network'

volumes:
  qalaam-data:
    driver: local
  qalaam-mushaf-images:
    driver: local

networks:
  qalaam-network:
    driver: bridge
  dokploy-network:
    external: true
```

(Final compose will be checked into the repo — this is the reference
shape so we agree on the contract before I write it.)

## 10. Resource footprint vs available

CCX23 spec says 16GB; the host is reporting ~30GB used+free
(suggesting CCX33 actually). Our reservations:

| Service        | CPU limit | Memory limit | Memory reserve |
| -------------- | --------- | ------------ | -------------- |
| qalaam-backend | 1.0       | 1024M        | 512M           |
| qalaam-web     | 1.0       | 1024M        | 512M           |
| **Total**      | 2.0       | 2.0 GB       | 1.0 GB         |

Margin's compose currently uses ~5.5 GB reservations, signzart ~2 GB,
dokploy ~1.5 GB, openclaw + mockupry ~3 GB. Adding 1 GB reservation
leaves plenty of headroom on a 30 GB host (current free: ~21 GB).

## 11. Step-by-step deploy sequence

**Phase 0 — repo prep (in this codebase, no infra changes)**

1. Create `apps/web/Dockerfile`, `apps/backend/Dockerfile`,
   `infrastructure/docker/docker-compose.yml`,
   `infrastructure/docker/.env.example`,
   `infrastructure/scripts/{seed-host-data.sh,deploy.sh}`,
   `infrastructure/README.md`, `.dockerignore`.
2. Audit + relax `apps/backend/src/config.ts` (DATABASE_URL optional
   or stub-default in compose env).
3. Confirm `apps/web/next.config.js` emits `output: 'standalone'`.
4. Audit Next.js `/api/*` proxy to use `BACKEND_INTERNAL_URL` in
   production.
5. Add `process.env.PUBLIC_APP_URL` as the single absolute-URL helper
   in Qalaam (audit `apps/web/src/lib/api-base.ts` + components that
   build absolute URLs).
6. Local smoke: `docker compose -f infrastructure/docker/docker-compose.yml
build` from the repo root to confirm both Dockerfiles build clean
   on the dev machine.
7. Commit + push to GitHub `main`.

**Phase 1 — host bootstrap (one-time)**

1. Cloudflare: add A record `qalaam` → `178.156.218.66` (proxied).
   Verify via `dig qalaam.themarginapp.com`.
2. SSH to host. Confirm `dokploy-network` exists (it does).
3. Pre-create the named volumes via `docker volume create qalaam-data
qalaam-mushaf-images` so the seed step can run before first deploy.
4. Run `infrastructure/scripts/seed-host-data.sh` from local machine —
   uploads `qul.sqlite` (~150MB) + `mushaf-images/` (~63MB) into the
   named volumes.

**Phase 2 — Dokploy app creation (via API)**

1. Create project `Qalaam Production` (`project.create`).
2. Create compose application `qalaam-stack` (`compose.create`).
3. Bind to GitHub `RabHanz/qalaam:main`, composePath
   `./infrastructure/docker/docker-compose.yml`, autoDeploy=true.
4. Set env vars (`compose.update`).
5. Add domain via `domain.create` (Dokploy attaches the cert lifecycle).

**Phase 3 — first deploy + verify**

1. Trigger `compose.deploy`.
2. Watch build logs.
3. After build completes:
   - `curl -s https://qalaam.themarginapp.com/api/health | jq` → 200
   - Sign up flow round-trip works
   - `/family` renders
   - Cast eligible (we're on HTTPS now)
   - HA Listen Mode: `/v1/now-playing/web` POST round-trip
4. Confirm zero impact on other apps via `docker ps` — count of
   running containers should equal `(prior count) + 2`.

**Phase 4 — wrap-up**

1. Update `Docs/STRATEGY_AND_ROADMAP.md` §29.9 with the actual
   Q_PID/Q_CID + DNS record + first-deploy timestamp.
2. Append `Docs/DEV_CHECKLIST.md` with rollback runbook.
3. Add a smoke-test workflow that runs against
   `https://qalaam.themarginapp.com` on every push.

## 12. Rollback strategy

- **App-level**: in Dokploy UI → Compose application → Deployments
  tab → click "Rollback" on previous successful deployment. Same as
  margin.
- **Data-level**: nightly cron on host taking
  `docker run ... tar czf qalaam-data-$(date +%F).tar.gz` of both
  volumes; restore via reverse `tar xzf`.
- **DNS-level**: flip Cloudflare A record back if hard rollback needed
  (no other app uses `qalaam.themarginapp.com`).

## 13. What's intentionally NOT in this deploy

- **Stripe checkout** — H2 ships pricing UI + manual activation via
  `support_requests`. Stripe lands as a follow-up commit + redeploy.
- **TTS / voice cloning** — H3/H4 needs a GPU container; separate
  service deployed later.
- **HA HACS release** — `integrations/homeassistant/custom_components/qalaam/`
  needs a tagged GitHub release for HACS install. Independent task.
- **D3 offline downloads** — service worker + Cache API; post-deploy
  iteration per the user's "deploy first" directive.
- **G4 mushaf layouts** — blocked on QUL auth-scrape; orthogonal.

## 14. Risks + mitigations

| Risk                                                         | Mitigation                                                                                                        |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| GitHub binding doesn't have access to RabHanz/qalaam repo    | Dokploy UI → GitHub App → install on qalaam repo OR use Custom Git URL with deploy key                            |
| qul.sqlite seed step fails / volume permissions wrong        | seed-host-data.sh runs `chown 1001:1001` after copy; container UID matches                                        |
| Cloudflare proxy + Cast Sender SDK conflict                  | We tested locally — Cast over HTTPS works. Cloudflare orange-cloud is pure HTTPS so no issue                      |
| DATABASE_URL required but Postgres absent                    | stub it in compose env to make zod happy; route handlers don't actually consume it                                |
| /api proxy from Next standalone hits localhost:4111          | Use BACKEND_INTERNAL_URL=http://qalaam-backend:4111 — service-discovery via Docker DNS                            |
| Image-mushaf 63MB volume seed slow on first deploy           | One-time SCP from local; done before Phase 3                                                                      |
| Build time too long (Next + Fastify + monorepo)              | pnpm Docker layer caching via separate `deps` stage, same as margin's pattern                                     |
| Existing margin/signzart traffic regressed by Traefik reload | Traefik picks up new labels via Docker socket events — no restart of existing routes. Watched in margin's deploys |

## 15. After approval, what I'll execute (in order)

```
1. write the 8 new files (Dockerfile×2, compose.yml, .env.example,
   2 scripts, README.md, .dockerignore)
2. small code patches (config.ts DATABASE_URL relax, next.config
   standalone confirm, api-base BACKEND_INTERNAL_URL)
3. local docker compose build smoke
4. git commit + push to main
5. add Cloudflare A record (only when you say go)
6. SSH host: pre-create volumes + run seed-host-data.sh
7. Dokploy API: project.create → compose.create → bind → env → deploy
8. verify https://qalaam.themarginapp.com/api/health
9. update DEV_CHECKLIST + STRATEGY_AND_ROADMAP §29.9 with actuals
```

I won't take any of these steps without your green light. Tell me if
you want changes (different domain, different volume strategy,
splitting web+backend differently, etc.) and I'll revise the plan
before starting.
