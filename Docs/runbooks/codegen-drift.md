# Runbook — Codegen drift (CI failure)

## Symptom

CI fails on the `pnpm codegen && git diff --exit-code` step. Local `pnpm build` works fine.

## Likely cause

1. Engineer edited a generated file (`packages/types-ts/dist/**` or `packages/types-py/qalaam_types/**`) by hand instead of editing the schema.
2. A schema was edited but `pnpm codegen` wasn't run before commit.
3. A codegen tool version drifted between the local machine and CI (lockfile not regenerated).

## Diagnosis

```bash
# Reproduce locally
pnpm codegen
git diff --stat

# Compare codegen tool versions
pnpm list --depth 0 | grep -E '(json-schema-to-typescript|datamodel-code-generator)'
```

## Mitigation

```bash
# Regenerate, commit, push.
pnpm codegen
git add packages/types-ts/dist packages/types-py/qalaam_types
git commit -m "chore(codegen): regenerate types"
git push
```

If the regenerated diff is huge or unexpected:
- Confirm only schema changes drove the diff. Anything else in `dist/` is a hand-edit that needs reverting.
- If a dependency bumped, pin it: edit the codegen tool version in `tooling/codegen/package.json` to the known-good version.

## Long-term fix

- The husky pre-commit hook already runs `pnpm codegen` for staged schema files (`.lintstagedrc.json`). Verify hooks are installed: `ls .git/hooks/pre-commit` should show the husky link. Re-run `pnpm prepare` if missing.
- Pin codegen tool versions in `tooling/codegen/package.json` (no `^`) — already done.

## Outcome impacted

- All (foundation; broken codegen blocks every PR). Resolution time SLA: ≤ 10 minutes for a contributor at their keyboard.
