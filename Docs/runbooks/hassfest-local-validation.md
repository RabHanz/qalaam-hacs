# Runbook — Pre-flight HACS / hassfest validation locally

**Outcome served:** O-09, O-13. Foundation. Per Phase 1 polish.

## When to run

Before pushing any change under `integrations/homeassistant/custom_components/qalaam/`:

- Manifest edits (version bump, new platform, new dependency)
- New entity / device class
- `strings.json` / `translations/en.json` changes
- `services.yaml` / `custom_sentences/*` changes
- New icons under `icons.json` or `icon` keys

The HACS submission gate runs the same checks; running locally catches issues
in seconds instead of after a PR round-trip.

## How to run

```bash
./scripts/ha/run-hassfest-local.sh
```

The script invokes two Docker images:

1. **`ghcr.io/home-assistant/hassfest:latest`** — official Home Assistant
   manifest validator. Checks: required manifest fields, async wiring, icon
   set sanity, integration quality scale signals, dependency declarations.
2. **`ghcr.io/hacs/action:main`** — HACS-store validator. Checks:
   `hacs.json` shape, `info.md` presence, content_in_root flag, name
   conflicts with the HA core integration list, version-tag consistency.

## Reading the output

Both images print colored sections per check. A clean run ends with a green
`PASS` summary. A failure shows the exact failing check name + a link to
the HA developer docs explaining the rule.

## Common failures and fixes

| Symptom                                                    | Likely cause                                                        | Fix                                                                 |
| ---------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `manifest.json` field missing                              | New platform added without bumping `version`                        | Bump `version` in manifest                                          |
| `iot_class` missing                                        | New release of HA tightened the field requirement                   | Set to `cloud_polling` (current default)                            |
| `strings.json` translation key without entity registration | Added a translation key for an entity that's not yet in `PLATFORMS` | Either register the platform or remove the orphan key               |
| HACS: `content_in_root: true` but no `qalaam.zip`          | We ship as a single-folder integration                              | Ensure `hacs.json` has `"content_in_root": false` (current setting) |
| Dependency in `requirements` not pinned                    | Floating versions banned per CLAUDE.md §11.2                        | Pin to exact version                                                |

## CI mirror

The same checks run in `.github/workflows/ci.yml` on PR + push. Local
hassfest validation is a strict subset, so a local pass guarantees a CI
pass for the integration job.

## Related

- `Docs/runbooks/ha-integration-not-discovered.md`
- `Docs/runbooks/ha-local-testing.md`
- ADR-0017 (i18n strategy — `strings.json` + `translations/`)
