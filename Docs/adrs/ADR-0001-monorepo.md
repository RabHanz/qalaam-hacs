# ADR-0001: Monorepo with pnpm/turbo + uv workspace

- **Status:** Accepted
- **Date:** 2026-05-02
- **Deciders:** Founder
- **Outcome served:** All (foundation; enables every outcome by reducing integration friction across packages)
- **Consulted:** N/A — solo founder decision
- **Informed:** Future contributors

## Context

Qalaam spans 25+ logical components across two language ecosystems (TypeScript and Python): shared libraries, multiple deployable apps (web, backend, future mobile, HA panel, internal studio), platform integrations (Home Assistant), long-running services (device-bridge, asr-worker, tts-worker, realtime-feedback), ML training pipelines, and vendored offline datasets.

These components must:
- Share a single source-of-truth schema (per ADR-0008) with both TypeScript and Python downstream consumers.
- Move at independent semver cadences (the HA integration must not be forced to bump when an internal service changes).
- Compile and test fast on developer laptops, even on cold cache.
- Be CI-built with maximal cache reuse to keep PR feedback under 5 minutes.

A polyrepo would impose cross-repo PR coordination overhead, drift between schema versions, duplicated tooling configs, and slow developer onboarding. A simple monorepo without build orchestration would suffer from full-graph rebuilds on every change.

## Decision

We will build Qalaam as a single Git monorepo using **pnpm workspaces + Turborepo** for the JS/TS graph and **uv workspace** for the Python graph, with **Changesets** for independent semver per package.

## Alternatives considered

1. **Polyrepo (one Git repo per package).** Tempting because it forces clean module boundaries. **Rejected because** schema-source-of-truth (ADR-0008) requires lock-step changes across 6+ packages per migration; cross-repo PR overhead would dominate engineering time.

2. **Nx (instead of Turborepo).** Nx has more features (graph visualization, generators, cloud cache). **Rejected because** Nx's complexity tax exceeds Turborepo's for a graph this size; Turborepo's narrower API matches CLAUDE.md Principle 03 ("Clarity over Complexity").

3. **Yarn or npm workspaces (instead of pnpm).** Both work. **Rejected because** pnpm's content-addressable store gives better disk usage and cold-install speed; pnpm's strict peer-dep handling catches integration bugs earlier.

4. **Poetry workspace (instead of uv).** Poetry is more mature. **Rejected because** uv is materially faster (10-100×) on resolve and install, has first-class workspace support since 2025, and is now the de-facto Python tooling default in 2026.

5. **Status quo (no monorepo, just folders).** **Rejected because** without workspace tooling, dependency hoisting and cross-package imports become brittle.

## Consequences

### Positive

- One `git clone` + `pnpm install` + `uv sync` bootstraps the entire stack.
- Schema changes propagate to all consumers in a single PR.
- Turborepo cache cuts CI time from ~15 min cold to ~2 min warm.
- Changesets enables independent semver — the HA integration can ship at its own cadence without forcing version bumps elsewhere.
- Onboarding for a new engineer: one repo, one README, one `make bootstrap`.

### Negative

- Repo grows large (mitigated by Git LFS for `data/`).
- New contributors unfamiliar with monorepos may need orientation.
- IDE indexing slower on cold open (mitigated by `.vscode/settings.json` with workspace excludes).

### Neutral

- All packages live in one issue tracker. This is a feature for product cohesion, a constraint for departmental separation (irrelevant for a solo founder).

## Risks & monitoring

- **Risk:** Build times balloon as packages multiply. **Leading indicator:** turbo `build` cold > 90s, incremental > 10s/package. **Mitigation:** investigate Turborepo Remote Cache; split slow packages.
- **Risk:** Python and TypeScript graphs drift in dependency conventions. **Leading indicator:** more than one place to define a shared constant. **Mitigation:** strict codegen pipeline (ADR-0008) is the only sanctioned cross-language sharing path.

## References

- Strategy doc: §3 Monorepo structure, §11.5 Documentation discipline
- External: pnpm.io, turbo.build, docs.astral.sh/uv
- Related ADRs: ADR-0008 (schema source of truth), ADR-0009 (backend language)
