# syntax=docker/dockerfile:1.7
# ==============================================================================
# qalaam-web — Next.js 15 (App Router, RSC) production image
# ==============================================================================
# Uses Next's `output: 'standalone'` (set in apps/web/next.config.mjs) so the
# runtime stage carries only `.next/standalone/` + `.next/static/` + `public/`.
# Image targets ~250 MB compressed.
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
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json ./apps/web/
COPY packages ./packages
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prefer-offline

# ---- build --------------------------------------------------------------------
FROM deps AS build
# Public env vars must be present at build time — Next inlines them into the
# client bundle. Use args so docker-compose can supply them per-environment.
ARG NEXT_PUBLIC_APP_URL
ARG QALAAM_REACT_COMPILER
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    QALAAM_REACT_COMPILER=$QALAAM_REACT_COMPILER \
    NEXT_TELEMETRY_DISABLED=1

COPY apps/web ./apps/web
COPY packages ./packages

# Build workspace packages the web app imports.
RUN pnpm --filter @qalaam/core build         || true \
 && pnpm --filter @qalaam/types-ts build     || true \
 && pnpm --filter @qalaam/api-client-ts build || true \
 && pnpm --filter @qalaam/ui build            || true \
 && pnpm --filter @qalaam/ui-hifdh build      || true \
 && pnpm --filter @qalaam/ui-quran build      || true \
 && pnpm --filter @qalaam/ui-recite build     || true \
 && pnpm --filter @qalaam/ui-learn build      || true \
 && pnpm --filter @qalaam/curriculum build    || true

# Build Next standalone bundle. Output ends up at
#   /repo/apps/web/.next/standalone/...   (server)
#   /repo/apps/web/.next/static/...        (static assets)
#   /repo/apps/web/public/                 (public assets)
RUN pnpm --filter @qalaam/web build

# ---- runner -------------------------------------------------------------------
FROM node:${NODE_VERSION} AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1 \
    NPM_CONFIG_UPDATE_NOTIFIER=false
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 --ingroup nodejs qalaam

# `output: 'standalone'` writes a self-contained server.js + node_modules
# subset into `.next/standalone/`. The pnpm-monorepo `outputFileTracingRoot`
# in next.config.mjs places the workspace root inside that bundle, so we
# preserve the directory structure on copy.
COPY --from=build --chown=qalaam:nodejs /repo/apps/web/.next/standalone ./
COPY --from=build --chown=qalaam:nodejs /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=qalaam:nodejs /repo/apps/web/public ./apps/web/public

# Mushaf-image volume mount target — image PNGs come from a read-only
# named volume (qalaam-mushaf-images) that lives outside the image to
# keep the bundle small (~63 MB delta otherwise).
RUN mkdir -p /app/apps/web/public/mushaf-images \
 && chown -R qalaam:nodejs /app/apps/web/public/mushaf-images

USER qalaam
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget --spider --quiet http://127.0.0.1:3000/healthz || exit 1

# Standalone server is at apps/web/server.js relative to the workspace
# root preserved by the standalone build.
CMD ["node", "apps/web/server.js"]
