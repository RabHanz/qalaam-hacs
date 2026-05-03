# `@qalaam/ui-hifdh`

Hifdh-specific UI primitives.

## Components

- `<ParentDashboard>` — per-child daily summary. **Daily-summary only — never real-time** (strategy §7.4 + §21.10 — surveillance vs pedagogy).
- `<RatingTrigger>` — one-tap fluency × accuracy rating (Tarteel-grade UX, ≤100ms p95).
- `<StreakCard>` — streak with grace days and a "welcome back" copy (never punish a missed day per §21.14).
- `<MutashabihatBadge>` — surfaces confusion-graph siblings inline with a portion (§7.2 + §24.1 data flywheel signal).

## Design rules

1. Daily summaries only. No real-time alerts on child activity.
2. Family-private; no public-leaderboard primitives.
3. Streak grace days surfaced as a feature, not a punishment.
4. Mistake-color vocabulary verbatim from Tarteel (§21.5).
