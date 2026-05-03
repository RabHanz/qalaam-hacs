# Runbook — Local end-to-end test of the Qalaam HA integration

## Goal

Stand up the Qalaam backend + Home Assistant in dev mode + the Lovelace panel
on the same host, add the integration via HA's UI, and verify play_ayah →
target speaker round-trip.

## Prerequisites

- Docker + Docker Compose v2.
- Node 20 / pnpm 9 (for backend dev mode).
- An HA-controllable media_player on your LAN (a Chromecast / Sonos / Echo /
  any HA media_player entity will do). For pure software testing, a `vlc`
  media_player or the `media_player.universal` is fine.

## Steps

```bash
# From repo root
make bootstrap              # one-time: install deps + codegen + initial build

# 1) Bring up Postgres + Redis + minio + mailhog (no HA yet)
docker compose -f docker-compose.dev.yml up -d postgres redis minio mailhog

# 2) Run the Qalaam backend in dev mode (separate terminal)
pnpm --filter qalaam-backend dev
# → http://localhost:4000/docs (Swagger)

# 3) Build the Lovelace panel (so HA mounts a real bundle, not the stub)
pnpm --filter qalaam-ha-panel build

# 4) Bring up Home Assistant with our integration mounted
docker compose -f docker-compose.dev.yml --profile ha up -d

# 5) Open HA: http://localhost:8123 — first-run wizard creates an admin user.
```

In HA:

1. **Settings → Devices & Services → Add Integration → "Qalaam"**.
2. API key: any non-empty string (the backend's `/healthz` is open in dev).
3. Base URL: `http://host.docker.internal:4000` on Docker Desktop, or
   `http://127.0.0.1:4000` if you used `--network host`.
4. The integration creates `media_player.qalaam` + the sensors/buttons/etc.
5. **Settings → Devices & Services → Qalaam → Configure** → set Target media
   player to your real speaker (e.g., `media_player.living_room`).

## Verify

```yaml
# Developer Tools → Services
service: qalaam.play_ayah
data:
  surah: 1
  ayah: 1
  target: media_player.qalaam
```

Expected:
- The configured target speaker plays Al-Fatiha verse 1 from Mishary Alafasy.
- `binary_sensor.qalaam_is_reciting` flips to `on`.
- `sensor.qalaam_current_verse` reads `1:1`.
- HA logbook shows a `qalaam_ayah_completed` event.

Voice (Settings → Voice assistants → Default → "Test"):

```
"Play surah Al-Fatiha"
```

Expected: `QalaamPlaySurah` intent fires, `media_player.qalaam` plays the surah.

## Common failures

See:
- `Docs/runbooks/ha-integration-not-discovered.md` — install / discovery issues.
- `Docs/runbooks/qf-rate-limited.md` — backend slowdown.
- `Docs/runbooks/codegen-drift.md` — CI/dev type-check failures.

## Outcome served

This runbook materializes O-09 (smart-home integration) end-to-end. If it works
on a developer's laptop in < 15 minutes, the v1 ship gate for HA is met.
