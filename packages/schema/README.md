# `@qalaam/schema`

**The single source of truth for every cross-language entity in Qalaam.** Per ADR-0008.

## What's here

- `schemas/` — JSON Schema (Draft 2020-12) source files, organized by domain:
  - `common/` — shared primitives (`VerseKey`, `LangCode`, etc.)
  - `quran/` — `Verse`, `Reciter`, `AudioSegment`, `Translation`, `Tafsir`, `Mushaf`, `MutashabihatCluster`
  - `hifdh/` — `Plan`, `Portion`, `ReviewState` (FSRS-6), `RatingEvent`, `MistakeEvent`
  - `device/` — `Speaker`, `Adapter`, `PlayCommand`
  - `user/` — `User`, `Family`, `FamilyMember`
  - `khatm/` — `Khatm`, `KhatmClaim`
  - `curriculum/` — `Lesson`, `LessonProgress`
  - `asr/` — local-only types (audio buffers); cloud-sync rejection enforced architecturally
  - `api/` — request/response envelopes
- `src/` — Ajv validators + barrel exports
- `tests/` — round-trip + fixture validation

## How codegen works

```
schemas/*.schema.json
        │
        ├─→ json-schema-to-typescript ─→ packages/types-ts/dist/
        └─→ datamodel-code-generator ──→ packages/types-py/qalaam_types/
```

Run `pnpm codegen` from the repo root. CI gate (`pnpm codegen && git diff --exit-code`) blocks merge if generated artifacts drift.

## How to add a new schema

1. Add `schemas/<domain>/<EntityName>.schema.json` using Draft 2020-12.
2. Reference shared primitives via `$ref: "../common/Primitives.schema.json#/$defs/<Type>"`.
3. Run `pnpm --filter @qalaam/schema codegen` to regenerate downstream types.
4. Add a fixture under `tests/fixtures/` and a round-trip test if non-trivial.
5. Update `README.md` if it's a new domain.

## Privacy guarantee (per ADR-0005)

Audio-bearing types live ONLY in `schemas/asr/` and have a `$comment: "LOCAL-ONLY: must not appear in cloud-sync transport schemas"` directive. The `tooling/codegen/check-privacy-boundaries.ts` script enforces this at codegen time and in CI.
