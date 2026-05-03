# Qalaam

> A family-aware, smart-home-aware, AI-augmented Quran and Hifdh platform.

Qalaam runs in three modes from one codebase:

1. **SaaS** — cloud-hosted backend + web/mobile clients + optional self-hosted device-bridge.
2. **Self-hosted** — all packages on user hardware (Pi/NAS), no cloud dependency.
3. **Home Assistant native** — runs inside HA via the integration; HA is one of many adapters.

It combines features that have never been combined in one product: verse-by-verse recitation playback on any speaker in the home, an FSRS-6 Hifdh memorization engine with mutashabihat-aware drills, on-device ASR for recall checking, voice-cloning for teach-back, a progressive Quranic Arabic curriculum, and adhan-aware ambient features — all respecting traditional Hifdh pedagogy and Islamic adab.

## Read first

| Document | Purpose |
|---|---|
| `CLAUDE.md` | The Rabee Operating System — quality, architecture, and process non-negotiables that govern every line of code. |
| `Docs/STRATEGY_AND_ROADMAP.md` | Product vision, JTBD foundation, data flywheel, ADR index, success metrics. **Single source of truth.** |
| `Docs/DEV_CHECKLIST.md` | Every task and gate from v0.1 through v2.0. |
| `Docs/adrs/README.md` | Architecture Decision Records — how to write one, the master index. |

## Quickstart

Prereqs: Node 20+, pnpm 9+, Python 3.11+, uv, Docker, Git LFS.

```bash
# Clone with LFS for vendored data
git clone https://github.com/qalaam-org/qalaam.git
cd qalaam
git lfs install && git lfs pull

# Bootstrap the workspace
make bootstrap

# Bring up dev services
make dev

# Run the full CI suite locally before pushing
make ci-local
```

## Repository layout

```
qalaam/
├── packages/        # Libraries (no main()) — TS and Python
├── apps/            # Deployables (web, backend, mobile, ha-panel, studio)
├── integrations/    # Third-party platform adapters (homeassistant)
├── services/        # Long-running daemon/worker processes
├── ml/              # Training, datasets, eval, checkpoints
├── data/            # Vendored offline datasets via Git LFS
├── tooling/         # Shared lint/format/codegen
├── Docs/            # Strategy, ADRs, runbooks, onboarding
├── scripts/         # Developer workflow scripts
└── .github/         # CI/CD workflows + templates
```

## Contributing

Read `CONTRIBUTING.md` first. Two non-negotiables for every PR:

1. **`Outcome: O-XX (opportunity = N)`** in the description, referencing `Docs/STRATEGY_AND_ROADMAP.md` §23.2.
2. **CI green:** lint + typecheck + test + build all passing.

Significant decisions require an ADR (`Docs/adrs/`).

## License

Mixed — per ADR-0011 (`Docs/adrs/ADR-0011-licensing.md`):
- `packages/*`, `integrations/homeassistant`: **Apache-2.0**
- `apps/*`, `services/*`: **AGPL-3.0**

See `LICENSE` and `THIRD_PARTY_NOTICES.md` for full details.

## Status

Pre-v0.1. See `Docs/DEV_CHECKLIST.md` for current phase.
