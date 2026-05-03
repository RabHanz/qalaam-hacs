# ADR-0004: FSRS-6 over SM-2 for Hifdh scheduling

- **Status:** Accepted
- **Date:** 2026-05-02
- **Deciders:** Founder
- **Outcome served:** O-04 (parent cognitive load), O-07 (long-term retention)
- **Consulted:** N/A
- **Informed:** Future contributors

## Context

Hifdh memorization is a spaced-repetition problem. The traditional sabaq/sabqi/manzil three-tier daily structure (per §7.1 of the strategy doc) is essentially manual SR with hand-tuned intervals: review at +1, +3, +7, +30 days.

Algorithm options in 2026:
- **SM-2 (SuperMemo 2, 1987)** — simple, well-understood, the original Anki default until 2024.
- **FSRS-4.5 / FSRS-5 / FSRS-6** — Free Spaced Repetition Scheduler. FSRS-6 shipped in Anki 25.07 (July 2025), reworks same-day-review stability with new params w17/w18 (grade weight) and w19 (S-saturation). FSRS benchmarks materially better than SM-2 (fewer reviews for same retention).
- **Leitner system** — too coarse; doesn't model difficulty asymmetry of mutashabihat-laden pages.

Surveying the 2025-2026 Hifdh-app landscape (§20.8): nobody publicly ships FSRS by name. Quoranize V2 and Quran IQ describe "smart" / "confidence-based" SR. Mutashabihat-aware drills exist statically in a few apps but no SR-integrated mutashabihat-aware engine. **No app advertises FSRS-6 by name — this is a defensible Qalaam wedge.**

## Decision

We will implement Hifdh scheduling with **FSRS-6**, using the Rust crate `fsrs-rs` for performance-critical paths and `py-fsrs` for the Python service. The unit of scheduling is **page or half-page** (configurable per user, defaulting to half-page for new memorizers per §7.1) — not per-ayah, because the Madani 15-line mushaf's fixed page layout is itself a memory cue.

We will rate on two axes — **fluency** (paused/hesitant/smooth, 0-3) and **accuracy** (errors/minor tajweed/clean, 0-3) — and derive a single FSRS grade for the algorithm.

## Alternatives considered

1. **SM-2.** **Rejected because** FSRS-6 published benchmarks show 15-30% fewer reviews for the same retention target; that's a meaningful UX gain.

2. **Custom algorithm.** **Rejected because** no published research justifies departing from FSRS for Quran-specific data; the right place to innovate is the **mutashabihat-aware re-queueing** layer (§7.2 / packages/hifdh-engine) on top of FSRS, not the SR algorithm itself.

3. **Per-ayah granularity.** **Rejected because** it destroys the visual page anchor that traditional teaching relies on (per Hifdh methodology research, §7.1).

4. **Per-juz granularity.** **Rejected because** too coarse to schedule meaningfully.

## Consequences

### Positive

- Defensible "FSRS-6 Hifdh scheduler" marketing wedge — no competitor advertises this.
- Better retention with fewer reviews → frees parent/student time → directly serves O-04 + O-07.
- `fsrs-rs` and `py-fsrs` are actively maintained and track the algorithm.

### Negative

- FSRS has more parameters than SM-2 (w0..w19), making explainability slightly harder. Mitigation: surface a simplified "ease" metric in the UI; expose full params only in advanced settings.
- FSRS-6 is newer than 5; library implementations may have early bugs. Mitigation: lock to a known-good version, write our own retention-prediction synthetic-trace tests.

### Neutral

- We do NOT distinguish short-term-memory from long-term-memory in FSRS-6 (the algorithm uses a heuristic); accept this in v0.5, revisit if retention metrics suggest otherwise.

## Risks & monitoring

- **Risk:** FSRS-6 over-prescribes review for mutashabihat-confused users. **Leading indicator:** users report queue feeling "endless" in feedback; daily session generation > 200ms p95. **Mitigation:** mutashabihat-aware grade penalty is calibrated separately from FSRS difficulty; A/B test in v0.5.
- **Risk:** Synthetic-trace test diverges from real-user behavior. **Leading indicator:** real-user retention < 80% of model prediction. **Mitigation:** retrain w-params per cohort once we have ≥ 200 Hifdh-active users (per §26.2).

## References

- Strategy doc: §7 Hifdh engine, §20.7 FSRS update
- Memory: `reference_hifdh_methodology.md`
- External: https://forums.ankiweb.net/t/fsrs6-and-short-term-memory/65951, https://github.com/open-spaced-repetition/fsrs-rs
- Related ADRs: ADR-0002 (QUL provides mutashabihat clusters)
