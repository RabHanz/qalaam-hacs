# `@qalaam/ui-recite`

Recording UI primitives — RecordButton, WaveformViz, WordResultStrip, FeedbackSession. Per strategy §8.7 + §21.5.

Critical UX principles inherited verbatim:

- **Post-hoc feedback** — never interrupt the user mid-recitation. Visualizations update *after* a session, not during.
- **Tarteel mistake-color vocabulary** — red (error), green (correct), yellow (tashkeel), brown (peeked).
- **Reduced-motion aware** — animations degrade to instant for users with the OS setting on.
- **Privacy-by-default** — the user controls a single button: tap to start, tap to stop. Audio never auto-records.

## Components

- `<RecordButton>` — toggle between idle / recording / processing states.
- `<WaveformViz>` — compact bar visualizer driven by the live audio stream during recording, calm passive bar after.
- `<WordResultStrip>` — Tarteel-style colored word ribbon showing per-word match results.
- `<FeedbackSession>` — composed component wrapping the WS connection to `services/realtime-feedback`.
