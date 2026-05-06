# ADR-0023 — Production stack stays SQLite-only (no Postgres / Redis / OAuth / PowerSync / agent-runtime)

**Status:** Accepted
**Date:** 2026-05-06
**Deciders:** Rabee
**Supersedes:** none

## Context

Qalaam ships its first production deploy on a Hetzner host that
already runs three other apps (themarginapp.com, signzart.com,
plus internal tools). Margin's stack uses Postgres + Redis + OAuth +
PowerSync + an in-house agent-runtime; it would be tempting to
inherit those services for "consistency" since they're sitting right
there.

The question: is Qalaam best served by adopting the same stack, or
by an explicitly different one driven by Qalaam's own
job-to-be-done?

## Decision

Qalaam's production stack is intentionally **smaller** than Margin's:

| Component                        | Margin uses                                       | Qalaam decision                                                                                                                                                    | Reason                                                                                                                                                                                                                                                                |
| -------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Postgres**                     | Yes — relational, vector, multi-tenant            | **No.** Use SQLite (qul.sqlite read-only + qalaam.sqlite for writes).                                                                                              | Self-host promise = single mountable file. Realistic load (1K families × 6 members × 50 writes/day = ~30K/day, peaks ~10/sec) is 1000× under SQLite WAL's capacity. Adding Postgres adds ops burden + breaks the self-host story without solving any current problem. |
| **Redis**                        | Yes — sessions, rate-limit, BullMQ                | **No.** Sessions are 64-char-hex PKs in qalaam.sqlite (O(1) lookup). Rate-limit is a SQL sliding window on `auth_audit` (survives restarts; Redis cache wouldn't). | Adding Redis = one more failure mode, ephemeral cache vs persistent throttle, and zero perf upside at current load. Add later only when a metric proves a bottleneck.                                                                                                 |
| **OAuth (Google/Apple)**         | Yes — onboarding                                  | **No.** Cookie + scrypt session — fully self-contained.                                                                                                            | The §15 privacy promise is "family-private — never shared with third parties." Putting Google between the user and their Quranic data violates the explicit contract. Magic-link email is a future option that preserves privacy + reduces friction.                  |
| **PowerSync**                    | Yes — local-first sync for productivity workflows | **No.** Offline story is service-worker + Cache API for Mushaf + audio (#174 D3).                                                                                  | PowerSync is for collaborative-document sync; Qalaam's offline need is "read the Quran on the plane" — that's a static-cache problem, not a sync problem. PowerSync would be a 10× overspec.                                                                          |
| **agent-runtime (in-house LLM)** | Yes                                               | **No.** Use the existing `mcp.quran.ai` MCP + third-party clients (Claude / Cursor) directly.                                                                      | MCP-first means Qalaam exposes tools, doesn't host an agent. Federation, not duplication.                                                                                                                                                                             |

## What we DO borrow from Margin

Operational pattern only:

- Dokploy compose-application workflow (GitHub-bound, autoDeploy on
  push, compose at `infrastructure/docker/docker-compose.yml`).
- Traefik label syntax (`traefik.http.routers.<name>.rule=Host(...)`,
  Let's Encrypt cert resolver, `dokploy-network` overlay external).
- Multi-stage Dockerfile + named-volume storage + service-prefix
  naming convention (`qalaam-*`).
- `${DOMAIN}`-as-source-of-truth env pattern.
- Resource-limits + healthchecks-per-service shape.

## Consequences

**Positive:**

- Self-host story stays real. A user spinning up Qalaam on a Pi
  copies one volume directory.
- Ops surface: 2 containers (web + backend), 2 named volumes, no
  database tier, no cache tier. Backups are `tar czf` of one volume.
- Privacy contract holds. No third party between user and data.
- Smaller blast radius if one container fails — no cross-app coupling.
- Faster builds, smaller images, faster cold starts.

**Negative / risks:**

- SQLite write contention if we hit ~10K writes/sec sustained.
  **Mitigation:** abstract writes behind a thin Repository layer
  if/when this becomes real; current code uses better-sqlite3
  directly which is fine at our scale and would be an invasive
  refactor only IF/WHEN we hit the limit.
- No replicas → host failure = downtime. **Mitigation:** nightly
  volume tarball backup (`infrastructure/scripts/backup-volumes.sh`
  TBD); add streaming replication when paying users justify the
  ops investment.
- No vector index for AI features. **Mitigation:** the search
  features Qalaam ships use FTS5 inside SQLite — perfect fit for
  Quranic text-corpus queries; no embedding-search needed for the
  current product surface.

## Migration trigger conditions

Move to Postgres when ANY of:

1. Sustained > 5K writes/sec for > 5 min (load metric).
2. Need for read replicas (e.g. HA / global edge).
3. Need cross-app shared identity / shared rows with another product
   that already runs Postgres (this is the Margin × Qalaam
   integration scenario in §30, but only IF we go past loose MCP
   federation into shared rows — which is not the current direction).

Move to Redis when:

1. Auth throttle SQL queries become a measurable hot path under load.
2. We ship features that genuinely need ephemeral cache (e.g.
   real-time presence on the family wall display).

These triggers go in observability dashboards (post-deploy) so the
decision is data-driven, not vibes-driven.

## Related

- Strategy doc §17 (SaaS substrate / self-host friendliness).
- Strategy doc §29.9 (deployment plan).
- ADR-0003 (HA-first deploy story).
- `infrastructure/README.md` (operational runbook).
- `infrastructure/DEPLOY-PLAN.md` (this deploy's plan-of-record).
