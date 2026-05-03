# Runbooks

Operational playbooks for Qalaam. Each file has the same structure:

1. **Symptom** — the user-visible problem.
2. **Likely cause** — the most common reason in our incident history.
3. **Diagnosis** — commands to run.
4. **Mitigation** — the smallest action to restore service.
5. **Long-term fix** — what to ship in code so this incident never happens again.
6. **Outcome impacted** — link to `STRATEGY_AND_ROADMAP.md` §23.2.

Per CLAUDE.md §11.1.

## Index

- [data-fetch failures](data-fetch-failure.md) — QUL / quran-align / quran-tajweed download fails or SHA mismatch.
- [ha-local-testing](ha-local-testing.md) — Stand up backend + HA + Lovelace panel locally and verify play_ayah end-to-end.
- [ha-integration-not-discovered](ha-integration-not-discovered.md) — "Qalaam" doesn't appear after HACS install.
- [tts-provider-failover](tts-provider-failover.md) — ElevenLabs returns 5xx; flip provider.
- [asr-battery-drain](asr-battery-drain.md) — Mobile ASR pulls > 5%/hour; tune VAD or fall back.
- [qf-rate-limited](qf-rate-limited.md) — Quran.Foundation 429s; raise cache or fall back to QUL.
- [codegen-drift](codegen-drift.md) — CI fails because `pnpm codegen` wasn't run before commit.
