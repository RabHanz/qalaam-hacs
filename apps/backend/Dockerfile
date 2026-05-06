# syntax=docker/dockerfile:1.7
# ==============================================================================
# qalaam-backend — Fastify + better-sqlite3 production image
# ==============================================================================
# Multi-stage so the runtime image carries only `dist/` + production deps.
# better-sqlite3 ships C++ bindings; we compile against alpine in `deps` then
# copy the built node_modules forward. Image targets ~300 MB compressed.
#
# Build context is the monorepo root (`infrastructure/docker/docker-compose.yml`
# uses `context: ../..`). All paths below are relative to the repo root.
# ==============================================================================

ARG NODE_VERSION=20-alpine

# ---- base ---------------------------------------------------------------------
FROM node:${NODE_VERSION} AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /repo

# ---- deps ---------------------------------------------------------------------
# Install workspace dependencies (incl. build toolchain for native modules).
# pnpm fetches lazily — we only fetch the backend + its workspace package deps,
# but easiest is `pnpm install --frozen-lockfile` from the root with all
# packages so pnpm's content-addressable store stays consistent.
FROM base AS deps
RUN apk add --no-cache python3 make g++ libc-dev linux-headers
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/backend/package.json ./apps/backend/
COPY packages ./packages
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prefer-offline

# ---- build --------------------------------------------------------------------
FROM deps AS build
COPY apps/backend ./apps/backend
COPY packages ./packages
# Build workspace packages the backend imports (TypeScript-only packages need
# their dist before the backend's tsc can consume them).
RUN pnpm --filter @qalaam/data-loader build || true \
 && pnpm --filter @qalaam/core build         || true \
 && pnpm --filter @qalaam/types-ts build     || true \
 && pnpm --filter @qalaam/api-client-ts build || true
# Compile the backend itself.
RUN pnpm --filter qalaam-backend build

# ---- runner -------------------------------------------------------------------
FROM node:${NODE_VERSION} AS runner
ENV NODE_ENV=production \
    PORT=4111 \
    HOSTNAME=0.0.0.0 \
    NPM_CONFIG_UPDATE_NOTIFIER=false
WORKDIR /app

# Non-root user matches the named-volume seed script's chown target.
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 --ingroup nodejs qalaam

# Bring forward only what the runtime needs.
COPY --from=build --chown=qalaam:nodejs /repo/node_modules ./node_modules
COPY --from=build --chown=qalaam:nodejs /repo/packages ./packages
COPY --from=build --chown=qalaam:nodejs /repo/apps/backend/dist ./apps/backend/dist
COPY --from=build --chown=qalaam:nodejs /repo/apps/backend/package.json ./apps/backend/package.json

# Volume mount target. Created with the right ownership so the
# qalaam-data named volume's first attach gets writable permissions.
RUN mkdir -p /app/data && chown -R qalaam:nodejs /app/data
VOLUME ["/app/data"]

USER qalaam
EXPOSE 4111

# Healthcheck duplicates the compose-level healthcheck so manual
# `docker run` (e.g. for migrations) still surfaces readiness.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --spider --quiet http://127.0.0.1:4111/healthz || exit 1

CMD ["node", "apps/backend/dist/server.js"]
