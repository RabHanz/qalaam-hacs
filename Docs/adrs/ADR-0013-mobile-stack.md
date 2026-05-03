# ADR-0013: Mobile = Expo (React Native), deferred to v1.5

- **Status:** Proposed
- **Date:** 2026-05-02
- **Deciders:** Founder
- **Outcome served:** All (foundation; mobile reach is critical for family/Hifdh user base)
- **Consulted:** N/A
- **Informed:** Future contributors

## Context

The target user base (families with kids doing Hifdh; teachers; commuting adults listening to Quran) is mobile-first. However, v0.1-v1.0 prioritizes the standalone web app + HA integration to validate the core flywheel cheaply.

Mobile stack options in 2026:
- **Expo / React Native** — code-share with web (~60-80% UI logic reusable via `packages/ui`); Tailwind v4 + NativeWind v5; React Compiler 1.0 GA.
- **Native (Swift + Kotlin).** Best perf and platform fidelity but 2× engineering cost.
- **Flutter.** Decent perf, separate ecosystem from our TS frontend; loses code-share dividend.

## Decision

We will use **Expo (React Native)** for `apps/mobile`, deferred to **v1.5** (Phase 12 of `DEV_CHECKLIST.md`). Shared UI components live in `packages/ui`, `packages/ui-quran`, `packages/ui-hifdh`. Audio uses `expo-av`; on-device ASR via React Native bridge to `faster-whisper` (or `whisper.cpp` on Android; `mlx-whisper` on iOS via Metal backend).

## Alternatives considered

1. **Native (Swift + Kotlin).** **Rejected** because 2× cost; we don't yet have evidence that perf gaps matter for our use case (audio playback + reading — both well-served by RN).
2. **Flutter.** **Rejected** because loses TS code-share with web/backend.
3. **Web-only via PWA.** **Rejected** because iOS Safari PWA gaps (Background Audio, Push, lockscreen) compromise the smart-home + family use cases.
4. **Mobile in v0.1.** **Rejected** because forces premature commitment before web feedback; defer to v1.5.

## Consequences

### Positive

- Maximum code-share; fast time-to-market post v1.0.
- Expo handles the build/release pipeline; we don't maintain Xcode + Gradle setup ourselves.
- React Compiler 1.0 brings native-comparable React rendering perf.

### Negative

- RN audio + on-device ASR has quirks vs native; budget for platform-specific shim work.
- Expo lock-in (mitigated by EAS Bare Workflow as escape hatch).

### Neutral

- App Store + Play Store submission cycles add operational overhead.

## Risks & monitoring

- **Risk:** RN's on-device Whisper bridge underperforms native. **Leading indicator:** ASR latency > 4s on mid-tier Android; battery > 5%/hour. **Mitigation:** native module for ASR-only path; rest stays RN.
- **Risk:** App Store reviewers reject Hifdh ASR feature on privacy grounds. **Leading indicator:** rejection message. **Mitigation:** explicit privacy disclosure in app + Apple's privacy nutrition labels.

## References

- Strategy doc: §10 Open question #3 (mobile), §20.7 Frontend delta
- External: expo.dev, react.dev/blog/2025/10/07/react-compiler-1
- Related ADRs: ADR-0005 (on-device ASR)
