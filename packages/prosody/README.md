# `@qalaam/prosody`

Pure-TS prosody primitives — used both client-side (Web Audio API + AudioWorklet
for live recitation cadence) and server-side (offline batch via Node).

## Functions

- `rms(samples)` — root-mean-square energy envelope per frame.
- `zeroCrossingRate(samples)` — fast voicedness proxy.
- `pitchAutocorr(samples, sampleRate, opts)` — F0 via autocorrelation. CPU-budget-friendly.
- `dtwDistance(a, b, opts)` — dynamic time warping distance for sequence alignment.
- `prosodyScore({ user, target })` — composite score 0..1 used by the teach-back UI.

## Why pure TS

Per ADR-0009: heavy ML in Python (services/prosody-worker — coming v2.0), but
the *live* feedback loop runs in the browser via AudioWorklet. We reach the
target latency (≤ 200ms TTFB for the visual feedback bar) only by avoiding a
WASM/Python bridge for the hot path.

Per strategy §8.5: feature set mirrors librosa's primitives; the algorithms here
are deliberately simple — sophistication comes from how the teach-back UI uses
them.
