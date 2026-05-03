#!/usr/bin/env bash
# Bring up the full Qalaam-on-HA dev stack.
#
# Order:
#   1. backend (Postgres + Redis + Fastify)
#   2. ha-bootstrap (seeds /config)
#   3. ha-dev (Home Assistant)
#
# After:
#   - HA UI: http://localhost:8123
#   - Qalaam backend: http://localhost:4000  (Swagger at /docs)
#
# Then in HA: Settings → Devices & Services → Add Integration → "Qalaam"
#   API key:  any non-empty string (the backend's /healthz returns 200 unconditionally in dev).
#   Base URL: http://host.docker.internal:4000  (or http://127.0.0.1:4000 with --network host)

set -Eeuo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../.."

echo "→ Booting Postgres + Redis + minio + mailhog"
docker compose -f docker-compose.dev.yml up -d postgres redis minio mailhog

echo "→ Building + booting Qalaam backend"
docker compose -f docker-compose.dev.yml up -d --build || {
  echo "Backend image not yet wired into docker-compose. Run 'pnpm --filter qalaam-backend dev' in another terminal." >&2
}

echo "→ Bringing up Home Assistant (profile: ha)"
docker compose -f docker-compose.dev.yml --profile ha up -d

echo
echo "✓ HA dev stack is up."
echo "  HA UI: http://localhost:8123  (first-run wizard creates admin user)"
echo "  Backend: http://localhost:4000/docs"
echo "  After HA's first-run wizard, add the Qalaam integration via UI."
