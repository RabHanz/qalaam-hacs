# `@qalaam/hifdh-engine`

The Hifdh memorization core. Per ADR-0004 (FSRS-6) + strategy §7.

## Modules

- `fsrs` — wraps `ts-fsrs` (FSRS-6 algorithm); converts our `ReviewState` shape to/from the algorithm's internal state.
- `scoring` — derives a single FSRS grade from the (fluency, accuracy) two-axis rating per strategy §7.2.
- `scheduler` — assembles the daily session from the user's portions, honoring the **80/20 revision-vs-new rule** (strategy §7.1).
- `mutashabihat` — penalizes/promotes portions based on confusion-graph signals from `MistakeEvent` records (strategy §24.4).

## Design rules

1. **Pure & deterministic.** Pass `now` into every function — never call `Date.now()` directly. This is required by the synthetic-trace tests in `tests/scheduler-trace.test.ts`.
2. **Stateless.** State persists upstream (Postgres via `apps/backend`). The engine receives state, returns updated state.
3. **No I/O.** Mutashabihat clusters and portion data are passed in.
4. **Mushaf-agnostic.** Operates on `AyahRange` (per `@qalaam/core/range`).

## Use

```ts
import { generateDailySession, applyRating } from '@qalaam/hifdh-engine';

const session = generateDailySession({ now, plan, portions, options });
const updatedReview = applyRating({ now, review, rating, mutashabihatSignal });
```
