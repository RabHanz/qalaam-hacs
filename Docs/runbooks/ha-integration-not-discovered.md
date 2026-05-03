# Runbook — HA integration "Qalaam" not discovered

## Symptom

User installs the integration via HACS, restarts HA, and "Qalaam" does not appear under Settings → Devices & Services → Add Integration.

## Likely cause

1. Restart was incomplete (HA needs a full restart, not a config reload).
2. `manifest.json` failed `hassfest` validation.
3. The integration was installed into the wrong directory (HA expects `config/custom_components/qalaam/`).
4. HACS cache served a stale release.

## Diagnosis

```bash
# In the HA container / VM:
ls /config/custom_components/qalaam/manifest.json
cat /config/custom_components/qalaam/manifest.json | jq .domain   # must be "qalaam"

# Check HA logs:
grep -i 'qalaam' /config/home-assistant.log
grep -i 'invalid' /config/home-assistant.log

# Verify hassfest locally:
cd integrations/homeassistant && uv run python -m homeassistant.scripts.hassfest --requirements
```

## Mitigation

- Confirm the directory layout. If wrong, `mv` and full restart.
- If `hassfest` fails: read the error; fix manifest; bump version; reinstall.
- HACS stale cache: HACS → 3-dot menu → "Reload data".

## Long-term fix

- Add a CI smoke test that boots HA with the integration mounted (`docker-compose.dev.yml` already includes `ha-dev` profile) and asserts the integration loads. Cover this in `.github/workflows/ci.yml` `ha-integration-validation` job.

## Outcome impacted

- O-09 (smart-home integration). Acceptable downtime: 24 hours per user; > 24 hours triggers an emergency point-release.
