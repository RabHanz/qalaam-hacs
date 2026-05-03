<!--
  Qalaam PR template — required fields are enforced by .github/workflows/ci.yml
  via tooling/check-pr-outcome.ts.
-->

## Summary

<!-- One paragraph: what changes, why now. -->

## Outcome

<!--
  Reference the JTBD outcome served (Docs/STRATEGY_AND_ROADMAP.md §23.2).
  Format: Outcome: O-XX (opportunity = N)
  Multiple outcomes: separate with comma.
  No outcome? Explain why this work is necessary anyway (foundational, security, dependency, etc.).
-->

Outcome: O-XX (opportunity = N)

## ADR

<!-- ADR(s) this PR implements or relates to. Use 'n/a' with brief justification if none. -->

ADR: ADR-NNNN, ADR-MMMM

## Type of change

- [ ] feat — new functionality
- [ ] fix — bug fix
- [ ] perf — performance improvement
- [ ] refactor — no functional change
- [ ] test — adding/updating tests
- [ ] docs — documentation only
- [ ] build / ci — tooling, CI, infra
- [ ] chore — maintenance
- [ ] adr — proposes or accepts an Architecture Decision Record

## Test plan

<!--
  - What did you test, how?
  - What's the riskiest part of this change, and how did you de-risk it?
-->

## Side-effects to monitor

<!--
  Per CLAUDE.md §10.1 step 6: every change has potential side-effects.
  Name the ones we should watch (metrics, alerts, user feedback patterns).
-->

## Checklist

- [ ] Code follows `CLAUDE.md` quality standards
- [ ] Tests added/updated; coverage thresholds met
- [ ] `pnpm ci:all` passes locally
- [ ] Docs updated (README / package READMEs / ADRs / `STRATEGY_AND_ROADMAP.md` §25 if a new ADR)
- [ ] `Docs/DEV_CHECKLIST.md` updated to reflect completed items
- [ ] No `console.log` / `print` in production code
- [ ] No secrets committed
- [ ] Backward-compatible (or migration plan documented)
- [ ] Accessibility check (if UI): keyboard nav, screen-reader labels, color contrast
