# Runbook — Quran.Foundation API rate-limiting (429)

## Symptom

Backend logs show `QalaamError(code=qalaam.data.not-loaded)` with detail
"QF rate-limited for ..." Affected endpoints: anything that falls through to
`@qalaam/api-client-ts` (live overlay paths).

## Likely cause

1. A new client deployment busted the LRU cache and re-fetched a hot key set.
2. Spike in user activity (e.g., Ramadan Friday Maghrib reading peak).
3. QF tightened published rate limits.

## Diagnosis

```bash
# Recent 429s (Pino structured logs)
kubectl logs deployment/qalaam-backend --since=15m | jq 'select(.msg=="request" and .statusCode==503)'

# QF token freshness
docker compose exec qalaam-backend node -e \
  "import('@qalaam/api-client-ts').then(m=>m.qf.createQfClient({...}).getRecitations()).then(console.log)"
```

## Mitigation

**Short-circuit:** raise `defaultCacheTtlMs` in the client up to the 7-day cap
(per ADR-0018):

```ts
// apps/backend/src/server.ts — temporarily, then revert
createQfClient({ ..., defaultCacheTtlMs: 7 * 24 * 60 * 60 * 1000 });
```

**Reduce churn:** the QUL canonical store (per ADR-0002) covers 99% of static
reads. Verify `data/qul.sqlite` is present and not corrupted:

```bash
sqlite3 data/qul.sqlite 'PRAGMA integrity_check;'
```

If QUL is missing/corrupted, restore from R2 mirror:

```bash
make data-fetch
```

## Long-term fix

- Background-warm the QF cache for the top-100 verses × 36 reciters at deploy
  time. Eliminates the cold-deploy spike entirely.
- Move all "quasi-immutable" QF reads to the QUL substrate; QF should ONLY
  be hit for genuinely live data (currently: nothing in the v0.1 hot path).
- Negotiate a higher rate-limit tier with QF (their developer support is
  responsive; documentation acknowledges per-credential tuning).

## Outcome impacted

- O-01 (latency budget for verse lookup).
- O-11 (theological soundness — users see errors instead of authoritative text).
