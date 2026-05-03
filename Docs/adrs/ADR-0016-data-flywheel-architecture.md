# ADR-0016: Data flywheel architecture — corrections-only sync

- **Status:** Accepted
- **Date:** 2026-05-02
- **Deciders:** Founder
- **Outcome served:** O-02 (false-positive reduction), O-05 (mutashabihat clusters), O-07 (retention)
- **Consulted:** N/A
- **Informed:** Future contributors

## Context

Per CLAUDE.md Principle 07 (Data is the moat) + strategy §24, Qalaam's
defensibility is the proprietary data generated from its own usage:

- **Hifdh mistake graph** — word-level errors per user.
- **Reciter-prosody preference signals** — which reciter best supports retention for which verse types.
- **Family-coordination patterns** — first dataset of how families do Quran together at scale.
- **Smart-home Quran usage** — first dataset on ambient Quran consumption.

The constraint per ADR-0005: **audio NEVER leaves the device**. So the data
flywheel must be built from **derived signals only**, not raw audio.

## Decision

The data flywheel architecture is:

1. **On-device:** `services/asr-worker` + `services/realtime-feedback` produce
   `MistakeEvent` and `RatingEvent` records. These are derived signals with
   NO audio fields.

2. **Cloud-sync transport:** Only `CloudSyncEnvelope`-shaped payloads cross
   the trust boundary. `tooling/scripts/check-privacy-boundaries.ts` rejects
   any cloud-sync schema that `$ref`s a LOCAL-ONLY type (per ADR-0005).

3. **Cloud aggregation:** `apps/backend` accumulates events. Background jobs
   compute:
   - **Mutashabihat-confusion graph** updates (per-user + global).
   - **FSRS-6 weight per cohort** retraining (offline batch).
   - **Reciter preference scores** (which reciter+verse combos drive retention).

4. **Re-deployment:** Updated FSRS weights + mutashabihat cluster expansions
   ship back to devices via `packages/hifdh-engine` parameters refreshed on
   each session start.

5. **Human-in-the-loop signals (per strategy §24.4):**
   - Parent overrides ASR mistake → `userOverridden: true` (trains FP reducer).
   - User skips a "weak" portion → trains FSRS difficulty.
   - User reports a novel cluster → expands the mutashabihat library.

   Every override is **one-tap** in the UI (per CLAUDE.md Cog 4).

6. **Explicit non-uses (per strategy §24.6):**
   - No ML training on user audio.
   - No biometric voice fingerprinting.
   - No ad-profile use.
   - No third-party sale.
   - No cross-user personality inference.

## Alternatives considered

1. **Send everything to the cloud (raw audio + transcripts).** Tempting for
   ML quality. **Rejected categorically** — violates ADR-0005 privacy posture
   and the family/parent trust the product is built on.

2. **No cloud sync at all (fully on-device).** **Rejected** because the
   defensible moat (mutashabihat-confusion graph at scale) needs aggregated
   data — but at the *derived-signal* layer, never audio.

3. **Differential privacy / federated learning.** Considered for the FSRS-weight
   re-training. **Defer** to v2.5+ once we have ≥ 10K active users; today the
   privacy posture (no audio + opt-in stats sharing per family member) is
   sufficient.

## Consequences

### Positive

- Proprietary moat compounds with usage (per CLAUDE.md Cog 4 flywheel).
- Audio never leaves device — uncompromisable family/parent trust.
- Clear architectural boundary between LOCAL-ONLY and cloud-syncable types.
- The privacy posture is a **first-class marketing asset** (no incumbent matches).

### Negative

- Slower feedback loop than "ship audio to cloud + train" — accept the trade.
- Mutashabihat cluster updates require N users seeing the same swap, not just
  one user submitting raw audio.

### Neutral

- We commit to publishing the privacy architecture publicly (transparency
  report, data-subject-access-request flow).

## Risks & monitoring

- **Risk:** A future contributor adds an audio field to a cloud-sync schema.
  **Leading indicator:** `check-privacy-boundaries.ts` CI gate fails.
  **Mitigation:** the gate is non-bypassable; PR cannot merge.
- **Risk:** Regulatory environment shifts to require us to log raw audio for
  some compliance reason. **Mitigation:** a new ADR overrides this one with
  full visibility; no silent change.

## References

- Strategy doc: §24 (data flywheel architecture)
- Related ADRs: ADR-0005 (on-device ASR), ADR-0008 (schema source of truth),
  ADR-0007 (Qalaam-house voice posture)
