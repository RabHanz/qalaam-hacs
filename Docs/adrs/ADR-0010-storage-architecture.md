# ADR-0010: Cloudflare R2 for audio; PostgreSQL + Redis for application data

- **Status:** Accepted
- **Date:** 2026-05-02
- **Deciders:** Founder
- **Outcome served:** All (foundation; egress-cost economics critically impact gross margin)
- **Consulted:** N/A
- **Informed:** Future contributors

## Context

Qalaam's storage profile:
- **Heavy audio egress.** Reciter MP3s + generated TTS audio + Hifdh playback streams. A single user listening to one full Quran in a month at 64 kbps ≈ 700 MB egress.
- **Modest relational data.** Users, families, plans, portions, ratings, mistakes, khatms, lessons.
- **Hot cache.** TTS-generated audio cache (top 100 verses × all reciters); session state; FSRS due-queue per user.

S3 charges $0.09/GB egress. At 1,000 active monthly users averaging 1 GB/month audio = $90/month egress on S3 alone. At 10K users = $900/month. This is gross-margin destroying.

Cloudflare R2 charges **$0.00 egress** (durable differentiator), $0.015/GB-month standard storage, $0.01/GB-month infrequent-access. 10 GB free.

## Decision

- **Cloudflare R2** for all audio assets (reciter MP3s, generated TTS cache, user voice-clone training samples in encrypted form).
- **PostgreSQL via Supabase** (consumer tier) for relational app data: users, families, plans, portions, ratings, mistakes, khatms, lessons, audio-cache index.
- **Redis** (Upstash or self-host) for hot cache: session state, FSRS due-queue per user, rate limits, TTS-generation deduplication locks.
- **Schema migrations via Prisma v6.**

## Alternatives considered

1. **AWS S3 + RDS.** **Rejected because** S3 egress cost ($0.09/GB) destroys gross margin at our usage profile.

2. **Cloudflare R2 + Cloudflare D1 (SQLite-on-edge).** Tempting for full-Cloudflare integration. **Rejected** because D1 is too new (still beta-grade for some features), Postgres has Prisma v6 + ecosystem maturity, and our access patterns include geographic spread without strong edge-locality requirements.

3. **Supabase Storage instead of R2.** **Rejected** because Supabase's egress pricing tracks AWS; R2 wins decisively on egress economics.

4. **Self-host Postgres on Hetzner.** Tempting for cost. **Rejected for v1.0** because Supabase auth + storage + realtime + RLS bundled is meaningfully faster to ship; revisit at scale.

5. **DynamoDB / FaunaDB / other NoSQL.** **Rejected** because our schema is relational (families, plans, ratings, mistakes — joins everywhere); PostgreSQL is the right shape.

## Consequences

### Positive

- Zero audio egress cost — gross margin protected as we scale.
- Supabase bundles auth + storage + realtime + RLS, accelerating v0.1.
- Prisma v6 + Postgres = best-in-class TS migration + query ergonomics.
- Redis hot cache absorbs read amplification on FSRS due-queue lookups.

### Negative

- Two storage providers (Cloudflare for blobs, Supabase for relational) — two billing dashboards, two failure modes.
- R2 latency to non-Cloudflare regions is occasionally higher than S3-in-region.

### Neutral

- We accept Cloudflare lock-in for blobs; portability via S3-compatible API remains.

## Risks & monitoring

- **Risk:** R2 outage during a Hifdh session. **Leading indicator:** 5xx rate from R2. **Mitigation:** offline-first design (audio downloads to device once); cached locally for the session.
- **Risk:** Supabase pricing changes erode the cost win. **Leading indicator:** Supabase pricing-page changes. **Mitigation:** Prisma keeps us portable; Hetzner self-host is the fallback.
- **Risk:** Postgres scales become a bottleneck. **Leading indicator:** p95 query > 100ms; row count > 100M. **Mitigation:** read replicas; partition tables (RatingEvent, MistakeEvent are time-series shaped).

## References

- Strategy doc: §12.2 Database schema, §20.6 Backend stack delta
- External: developers.cloudflare.com/r2/pricing, supabase.com/pricing
- Related ADRs: ADR-0009 (Node/Fastify backend), ADR-0012 (auth)
