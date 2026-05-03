# ADR-0018: Cache invalidation policy — align HTTP cache-control with QF ToS 7-day cap

- **Status:** Accepted
- **Date:** 2026-05-02
- **Deciders:** Founder
- **Outcome served:** O-01 (latency), O-11 (theological soundness via fresh data)
- **Consulted:** N/A
- **Informed:** Future contributors

## Context

The Quran.Foundation Developer ToS caps content cache at **7 days** (per §6.3).
HTTP cache-control headers across `apps/backend` need to honor this without
being so conservative that we tank the latency / cost win caching enables.

Different resource classes have different staleness tolerances:

| Resource | Mutability | Caller cache target |
|---|---|---|
| Quran text (Uthmani, Indo-Pak) | Immutable | 7 days (ToS cap) |
| Word-level audio segments (QUL) | Quasi-immutable (corrections) | 7 days |
| Reciter MP3 audio (everyayah) | Immutable | 30 days (zero-egress R2 cache) |
| Translations + tafsir | Versioned editions; rare changes | 7 days |
| Reciter list / metadata | Updated on QUL releases | 24 hours |
| Hifdh session (per-user) | High-mutability | no-store |
| User Hifdh state | High-mutability | no-store; ETag |
| Recitation status / now-playing | Real-time | no-store |

## Decision

Per-route cache-control per the table above:

```ts
// Long-cached, ToS-aware
cache-control: public, max-age=604800, immutable   // 7 days, audio segments
cache-control: public, max-age=604800              // 7 days, Quran text + translations
cache-control: public, max-age=2592000             // 30 days, audio MP3 (R2 zero-egress)
cache-control: public, max-age=86400               // 24 hours, reciter metadata

// Per-user, no caching
cache-control: no-store                            // /v1/hifdh/*
```

**The LRU cache in `@qalaam/api-client-ts` enforces the 7-day ToS cap at the
type level** (per ADR-0008 schema enforcement) — passing a longer TTL throws
`QalaamError("qalaam.data.not-loaded")`. This is intentional: any caller who
needs longer-than-7-day caching MUST switch to the QUL/Tanzil/everyayah
substrate (which carries permissive licenses for redistribution) rather than
caching QF responses.

**ETag policy:** every per-user response includes `ETag` derived from the
Postgres row `updated_at + id`. Web clients send `If-None-Match` on revisit;
backend returns 304 when stale.

**Cache busting:** content versioning is via `?v=<dataset-release-tag>`
parameter (e.g., `?v=qul-2026.05`) for the rare cases where we *want* to bust
caches without waiting 7 days. Backend reads it, varies the cache key.

## Alternatives considered

1. **Cache forever on the client.** **Rejected** — violates QF ToS.
2. **No client cache; backend-only.** **Rejected** — would burn the QF rate
   limit and tank latency.
3. **Service-worker + IndexedDB on the client.** Considered. **Defer to v1.0**
   once mobile lands; the SW gives us reliable offline read for the most-read
   surahs.

## Consequences

### Positive

- Latency wins from aggressive caching where allowed.
- QF ToS compliance is architectural (LRU cap enforced at the type level).
- Clear staleness contract per resource class.

### Negative

- Two cache layers (HTTP + Redis) means careful key design — done in
  `apps/backend/src/lib/cache-keys.ts` (v0.5 deliverable).

### Neutral

- We accept that audio MP3s are immutable for 30 days; if a corruption is
  discovered mid-window, we issue a `?v=` bust.

## Risks & monitoring

- **Risk:** A bug ships a `Cache-Control: public, max-age=999999` somewhere.
  **Leading indicator:** add a CI lint that scans backend response headers.
  **Mitigation:** v0.5 task — `tooling/scripts/check-cache-control.ts`.
- **Risk:** QF tightens ToS to ≤ 1 hour. **Leading indicator:** ToS diff alert.
  **Mitigation:** the `LruCache` constant is one line; flip and ship.

## References

- Strategy doc: §6.3 (QF ToS), §11.5 (sharing performance budgets)
- Related ADRs: ADR-0002 (QUL canonical store), ADR-0008 (schema enforcement),
  ADR-0010 (storage architecture — R2 30-day audio cache)
