# `@qalaam/tajweed-detector`

Heuristic scorers for the **measurable** tajweed rules. Per ADR-0007 § risks-and-monitoring: **never marketed as authoritative.** This package produces *signals*, not verdicts. The teach-back UI surfaces the signals as opt-in "experimental" feedback so the user can decide.

## What it scores

| Rule | What's measurable | How |
|---|---|---|
| **Madd Tabīʿī** (2 beats) | Duration of a long-vowel hold | Frame-level energy plateau detection |
| **Madd Munfasil / Wajib** (4-5 beats) | Same, with longer expected window | Same |
| **Madd Lāzim** (6 beats) | Same, with longest expected window | Same |
| **Ghunna** | Nasalization on noon/meem | Spectral tilt + low-freq energy ratio |
| **Qalqalah** | Discrete echo on qalqalah letters at sukoon | Onset-detection on qalqalah-marked positions |

## What it does NOT score (research-grade — explicitly out of scope)

- Real-time tajweed *judgment* (correct vs wrong) — no public model has the precision needed.
- Maqamat / melodic system identification.
- Fine-grained articulation-point (makhraj) verification.

These are research areas where Qalaam declines to ship until reliability is provable.

## Use

```ts
import { scoreMadd, scoreGhunna, compositeTajweedScore } from '@qalaam/tajweed-detector';

const result = compositeTajweedScore({
  samples: pcmFloat32, // 16kHz mono normalized
  expectedRules: [
    { type: 'madd_2', startMs: 1200, endMs: 1500 },
    { type: 'ghunna', startMs: 2400, endMs: 2700 },
  ],
});
// { overallScore: 0.84, perRule: [...], confidence: 0.62 }
```

The `confidence` value is critical. We deliberately keep it conservative so the UI can hide low-confidence signals.
