# New engineer — 1-day ramp

> Goal: by end of day 1, you've shipped a green PR that touches one outcome from `STRATEGY_AND_ROADMAP.md` §23.2 and got it through CI.

## Hour 0 — read these in order

1. **`CLAUDE.md`** — the operating system. Non-negotiable quality / process / decision rules.
2. **`Docs/STRATEGY_AND_ROADMAP.md`** §0 (executive summary), §23 (JTBD), §24 (data flywheel), §25 (ADR index). The rest is reference; don't try to read it linearly.
3. **`Docs/DEV_CHECKLIST.md`** — find the phase we're in; identify the next 1-2 items.
4. **`Docs/adrs/README.md`** — how ADRs work; skim the Accepted ADRs to absorb the architectural shape.

## Hour 1-2 — environment

```bash
git clone https://github.com/qalaam-org/qalaam.git
cd qalaam
git lfs install && git lfs pull   # data substrate (per ADR-0002)

corepack enable
make bootstrap                    # pnpm install + uv sync + codegen + initial build
make docker-up                    # postgres + redis + mailhog + minio
make data-fetch                   # QUL + quran-align + quran-tajweed
```

If anything fails: copy the error into `Docs/runbooks/onboarding-issues.md` (create if absent) — your contribution to the next engineer.

## Hour 3-4 — verify

```bash
make ci-local       # runs everything CI runs; should be all green
pnpm --filter qalaam-backend dev    # → http://localhost:4000/docs
pnpm --filter qalaam-web dev        # → http://localhost:3000
```

Open the web app and visit `/read/1`. You should see Surah Al-Fatiha rendered (from the bundled fixture or QUL).

## Hour 5-6 — pick something to ship

Open `Docs/DEV_CHECKLIST.md`, find the lowest-numbered `[ ]` item in the current phase. Pick one. Outcome it serves comes from the task description; reference it in your PR.

Quality bar:

- TypeScript strict / Pydantic strict — no `any` / `Any`.
- Tests with the change. Coverage thresholds enforced in CI.
- `Outcome:` line in PR description (CI-checked by `tooling/scripts/check-pr-outcome.ts`).
- ADR if the change is significant. Use `Docs/adrs/ADR-template.md`.

## Hour 7 — tooling pointers

| Surface | Where it lives |
|---|---|
| Schemas (source of truth) | `packages/schema/schemas/` |
| Codegen runner | `tooling/codegen/run.ts` |
| Shared ESLint | `tooling/eslint-config/` |
| Shared TS configs | `tooling/tsconfig/` |
| CI checks | `.github/workflows/ci.yml` + `tooling/scripts/*.ts` |
| Privacy boundary check | `tooling/scripts/check-privacy-boundaries.ts` |
| Domain primitives | `packages/core/` (TS) + `packages/core-py/` (Python mirror) |
| Adapter contract | `packages/adapter-interface/` |
| Hifdh engine | `packages/hifdh-engine/` (FSRS-6) |

## Communication standard (CLAUDE.md §10)

> Never "just do this." Always: "here's what I recommend, here's why, here's what I considered and rejected, and here's what could go wrong."

This applies in PR descriptions, code review, ADRs, and commit messages.

## Common pitfalls (collected from earlier engineers)

- **Don't commit generated `dist/` for `types-ts`/`types-py` by hand** — run `pnpm codegen`.
- **Don't add `any` to silence a type error** — write the right type or open a PR proposing a schema change first.
- **Don't ship a feature without an outcome** — the CI gate will fail you, but more importantly: if it doesn't trace to an outcome with opportunity ≥ 12, it probably shouldn't ship at all (per CLAUDE.md §9.2).
- **Don't add audio fields to a cloud-sync schema** — the privacy boundary check will fail. If you genuinely need to (you don't), write an ADR proposing a change to ADR-0005.
