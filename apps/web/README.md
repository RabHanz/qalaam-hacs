# `qalaam-web`

Standalone Qalaam web app. Next.js 15 + React 19 (with React Compiler 1.0) + Tailwind v4. AGPL-3 per ADR-0011.

## Run

```bash
pnpm --filter qalaam-web dev   # http://localhost:3000
```

## Status (v0.1)

Shell only — RTL-aware layout, empty/loading/error states wired to the design tokens, surah-reader stub. Phase 5 of `Docs/DEV_CHECKLIST.md` wires the data layer.

## Design

Default to **Tarteel-grade calm** (cream / teal / gold). Reserve Quranly-style expressiveness for kids' mode. Inherit Tarteel's mistake-color vocabulary verbatim (red/green/yellow/brown). Per `Docs/STRATEGY_AND_ROADMAP.md` §21.14.
