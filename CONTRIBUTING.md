# Contributing to Qalaam

Welcome. Read `CLAUDE.md` and `Docs/STRATEGY_AND_ROADMAP.md` before opening a PR. The high-level rules are below — the operating-system doc is the canonical source.

## Before you write code

1. **Find or open an issue** describing the desired outcome.
2. **Identify the JTBD outcome** it serves, from `Docs/STRATEGY_AND_ROADMAP.md` §23.2. If your work doesn't trace to an outcome with opportunity ≥ 12, it's probably not the right work — discuss before building.
3. **Check the ADR register** (`Docs/STRATEGY_AND_ROADMAP.md` §25). If your work touches a significant decision, write an ADR first.

## Writing the code

Follow the standards in `CLAUDE.md` §11 (non-negotiables):

- TypeScript strict, Pydantic strict, mypy strict. **No `any` / `Any` without justification.**
- Tests with the change. Coverage thresholds enforced in CI (≥ 80% for `packages/*`, ≥ 60% for `apps/*`).
- Structured logging only (`pino` in TS, `structlog` in Python). **No `console.log` / `print` in production code.**
- Loading / error / empty states for every async UI surface.
- Accessibility: WCAG 2.1 AA minimum.
- No secrets in code. `.env.example` is the canonical list.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/) — enforced by commitlint.

```
<type>(<scope>): <subject>

[optional body explaining WHY (not WHAT)]

[optional footer with breaking changes, ADR reference]
```

Allowed types: `feat | fix | docs | style | refactor | perf | test | build | ci | chore | revert | adr`.

Scopes are kebab-case package or app names: `hifdh-engine`, `web`, `backend`, `homeassistant`, `schema`, etc.

Examples:
```
feat(hifdh-engine): implement FSRS-6 scheduler (ADR-0004)
fix(asr): debounce live transcribe to avoid duplicate MistakeEvents
adr(licensing): accept ADR-0011 (Apache + AGPL split)
```

## Pull requests

Use `.github/PULL_REQUEST_TEMPLATE.md`. Mandatory:

- **`Outcome:`** line referencing an `O-XX` from `Docs/STRATEGY_AND_ROADMAP.md` §23.2 (lint-checked in CI).
- **`ADR:`** line referencing the relevant ADR(s) (or `n/a` with brief justification).
- Test plan.
- Side-effects to monitor (per CLAUDE.md §10.1 step 6).

## Code review

CLAUDE.md communication standard:

> Never "just do this." Always: "here's what I recommend, here's why, here's what I considered and rejected, and here's what could go wrong."

Review applies the same standard. Disagreements are resolved by adding context, citing an ADR or outcome, or escalating with a written ADR proposal.

## Documentation

- Every package has a `README.md` (purpose, install, API, examples).
- Every endpoint has an OpenAPI spec (auto-generated from `packages/schema`).
- Every breaking change has a `CHANGELOG.md` entry (Changesets-managed).
- Every ADR is in `Docs/adrs/` and indexed in `STRATEGY_AND_ROADMAP.md` §25.

## Local development

```bash
make bootstrap    # install deps, run codegen, build once
make dev          # bring up watch mode for everything
make test         # full test suite
make ci-local     # everything CI runs, locally
```

## Questions

Open a discussion on GitHub or check `Docs/onboarding/new-engineer.md`.
