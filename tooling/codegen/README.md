# `@qalaam/codegen`

Codegen runner — `pnpm codegen` from the repo root invokes `run.ts` here, which:

1. Walks `packages/schema/schemas/**/*.schema.json`.
2. Generates `packages/types-ts/dist/**/*.ts` via `json-schema-to-typescript`.
3. Invokes `tooling/codegen/run_python.py` (via `uv run`) for Pydantic generation.
4. Runs the **privacy-boundary check** (per ADR-0005): any schema with `$comment: "LOCAL-ONLY"` is rejected if it lives under `schemas/api/`.

Per ADR-0008.
