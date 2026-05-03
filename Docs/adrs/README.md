# Architecture Decision Records (ADRs)

Every significant technical or strategic decision in Qalaam is captured here, per `CLAUDE.md` §11.1. The master index lives in `Docs/STRATEGY_AND_ROADMAP.md` §25 — keep it in sync.

## How to write a new ADR

1. Copy `ADR-template.md` to `ADR-NNNN-short-kebab-name.md`. Number is monotonic.
2. Fill in every section. If a section is N/A, write "N/A — reason."
3. Set `Status: Proposed`.
4. Add a row to §25 of the strategy doc.
5. Open a PR. Status moves to `Accepted` on merge.
6. If a later ADR overrides this one, mark `Status: Superseded by ADR-NNNN`.

## Status lifecycle

`Proposed → Accepted → Deprecated → Superseded`

Never delete an ADR. Append, supersede, or deprecate.

## Outcome traceability

Every ADR must reference at least one outcome from `Docs/STRATEGY_AND_ROADMAP.md` §23.2 in its `Outcome served` line. ADRs that justify themselves only on "best practice" or "team preference" without an outcome reference are blocked at review.
