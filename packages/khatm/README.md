# `@qalaam/khatm`

Group khatm engine. Per strategy §10.6.

## Modes

- **Funeral khatm** — one-time, urgent, often within 3 days.
- **Ramadan family khatm** — 1 juz/person × 30 days.
- **Rolling weekly khatm** — 1/7 manzil/day.
- **Hifdh-class khatm** — each student a juz they've memorized.

## Mechanics

- Slice the Quran into commitments (juz, manzil, page-range).
- Members claim ranges.
- Aggregate progress; emit completion event.
- Family-private only by default — no public sharing.

## Use

```ts
import { sliceByJuz, allocateClaim, computeProgress } from '@qalaam/khatm';

const slices = sliceByJuz();             // 30 ranges
const claim = allocateClaim(slices, 'user-uuid', 1); // claim juz 1
const pct = computeProgress(claims);     // 0..1
```
