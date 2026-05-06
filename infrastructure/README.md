# Qalaam Production Infrastructure

Single-source-of-truth for the production deploy. Hetzner host
`178.156.218.66`, Dokploy-managed, Traefik fronted, Cloudflare DNS.

> **Operating principle:** Qalaam co-hosts on the same box as
> themarginapp.com / signzart.com but shares **zero** containers,
> volumes, or networks with them. Cherry-pick the operational pattern
> (compose layout, Traefik labels, named volumes, modular `${DOMAIN}`),
> never the product DNA. See ADR-0023 for the architecture rationale.

## Layout

```
infrastructure/
├── README.md                       # this file
├── DEPLOY-PLAN.md                  # the plan you're executing from
├── docker/
│   ├── docker-compose.yml          # the deploy contract — Dokploy reads this
│   └── .env.example                # env template; copy to .env (gitignored)
└── scripts/
    └── seed-host-data.sh           # one-shot SCP of qul.sqlite + mushaf-images
```

The Dockerfiles themselves live with the apps they describe:

```
apps/backend/Dockerfile              # Fastify + better-sqlite3
apps/web/Dockerfile                  # Next.js 15 standalone
```

## Architecture in one diagram

```
                         Cloudflare (themarginapp.com zone)
                         qalaam → 178.156.218.66 (proxied)
                                       │
                                       ▼
                           dokploy-traefik (host)
                                       │
                          Host(`qalaam.themarginapp.com`)
                                       │
            ┌──────────────────────────┴───────────────────────────┐
            │                                                       │
            │   dokploy-network (overlay, swarm, external)          │
            │                                                       │
            ▼                                                       │
       qalaam-web         ◄── /healthz                              │
        (:3000)                                                     │
            │                                                       │
            │ /api/* rewrite                                         │
            ▼                                                       │
    qalaam-backend  ◄── /healthz                                    │
       (:4111)                                                      │
            │                                                       │
            └──────────────── qalaam-network (bridge, internal) ────┘

Volumes:
  qalaam-data            /app/data      qul.sqlite, qalaam.sqlite, voice-notes/
  qalaam-mushaf-images   /app/.../mushaf-images   ~63 MB PNGs (read-only)
```

## First-deploy runbook

Pre-requisites: SSH to host works (`ssh root@178.156.218.66`),
Cloudflare token + Dokploy API token loaded into your shell, the qalaam
repo is pushed to `RabHanz/qalaam:main` on GitHub.

```bash
# 0. From the qalaam repo root, smoke the build locally first
docker compose -f infrastructure/docker/docker-compose.yml build

# 1. Add Cloudflare A record qalaam → 178.156.218.66 (proxied)
#    via cloudflare API or dashboard

# 2. Seed the named volumes (one-shot)
./infrastructure/scripts/seed-host-data.sh

# 3. Create the Dokploy compose application
#    DURL="https://deploy.signzart.com"
#    curl … project.create  → projectId
#    curl … compose.create  → composeId
#    curl … compose.update  → bind GitHub source + composePath
#    curl … compose.update  → set env (DOMAIN, ACME_EMAIL, …)
#    curl … domain.create   → register qalaam.themarginapp.com
#    curl … compose.deploy  → trigger build + start

# 4. Verify
curl -fsS https://qalaam.themarginapp.com/healthz | jq
curl -fsS https://qalaam.themarginapp.com/api/health | jq   # backend round-trip via /api proxy
```

## Operational tasks

### View live logs

```bash
ssh root@178.156.218.66 'docker logs qalaam-web    -f --tail 100'
ssh root@178.156.218.66 'docker logs qalaam-backend -f --tail 100'
```

### Rollback

In the Dokploy dashboard → Compose `qalaam-stack` → Deployments tab →
click "Rollback" on the previous successful deployment. Same flow
the-margin uses.

### Backup the writable volume (qalaam-data)

```bash
ssh root@178.156.218.66 'docker run --rm \
  -v qalaam-data:/src \
  -v /root/backups:/bak \
  alpine \
  tar czf /bak/qalaam-data-$(date +%F-%H%M).tar.gz -C /src .'
```

A nightly cron of the above is documented in
`Docs/STRATEGY_AND_ROADMAP.md` §29.9 — set it up after first
successful deploy.

### Restore (only when explicitly needed)

```bash
ssh root@178.156.218.66 'docker run --rm \
  -v qalaam-data:/dst \
  -v /root/backups:/bak \
  alpine \
  sh -c "cd /dst && tar xzf /bak/qalaam-data-YYYY-MM-DD-HHMM.tar.gz"'
```

### Re-seed qul.sqlite (after upstream Quran data update)

The same script is idempotent — re-run it; it overwrites the existing
file in the volume. The backend will pick up the new file on next
restart (better-sqlite3 caches the open handle until the process
exits, so a restart is required).

```bash
./infrastructure/scripts/seed-host-data.sh
ssh root@178.156.218.66 'docker restart qalaam-backend'
```

### Change the deployed URL

Single-variable flip:

1. Update Cloudflare DNS for the new hostname.
2. `compose.update` env: `DOMAIN=<new-host>`.
3. `compose.deploy` to trigger Traefik label update + cert reissue.

No code or git changes required.

## Health endpoints

| Endpoint                                        | What it checks                         | Used by               |
| ----------------------------------------------- | -------------------------------------- | --------------------- |
| `https://qalaam.themarginapp.com/healthz`       | qalaam-web Node process is up          | Traefik, uptime probe |
| `https://qalaam.themarginapp.com/api/health`    | qalaam-web → qalaam-backend round-trip | manual smoke          |
| (internal) `http://qalaam-backend:4111/healthz` | qalaam-backend Fastify process is up   | container healthcheck |

## Resource footprint

| Service        | CPU limit | Memory limit | Memory reservation |
| -------------- | --------- | ------------ | ------------------ |
| qalaam-backend | 1.0       | 1024 MB      | 256 MB             |
| qalaam-web     | 1.0       | 1024 MB      | 256 MB             |
| **Total**      | 2.0       | 2.0 GB       | 0.5 GB             |

Plenty of headroom on the host (~21 GB free at planning time).

## What this deploy explicitly excludes

These are real product features that ship in follow-up commits — they
are not stubs in the current codebase:

- **Stripe checkout** — H2 pricing UI ships now with manual activation
  via the `support_requests` table. Stripe wiring lands when the
  payment processor account is ready.
- **TTS / voice cloning (#194 H3, #195 H4)** — needs a separate
  GPU container; ships as `services/tts-worker/` with its own compose
  stanza when GPU host bring-up happens.
- **D3 offline downloads** — service worker + Cache API + IndexedDB
  pack manifest. Independent feature, ships separately.
- **HA HACS release** — `integrations/homeassistant/custom_components/qalaam/`
  needs a tagged GitHub release for HACS install. Independent task.

See `Docs/DEV_CHECKLIST.md` "Pending tasks remaining" for the full
priority order.
