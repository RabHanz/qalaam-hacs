# ADR-0012: Auth — Supabase Auth (consumer) + WorkOS (B2B/madrasa tier)

- **Status:** Proposed
- **Date:** 2026-05-02
- **Deciders:** Founder
- **Outcome served:** All (foundation)
- **Consulted:** N/A
- **Informed:** Future contributors

## Context

Qalaam needs auth for two distinct user populations:
- **Consumer** (individual users, families): email magic-link → optional Apple/Google OAuth → optional QF Tier B passthrough for Quran.com bookmark sync (deferred to v2).
- **B2B/madrasa** (Pro tier, post-v1.5): SSO, SCIM provisioning, admin portal, audit logs.

Per §20.6, the 2026 auth landscape:
- **Clerk** = best DX for React-shaped consumer SaaS.
- **WorkOS** = best for B2B (SSO/SCIM/admin portal); has been the breakout in 2025.
- **Supabase Auth** = bundled with Supabase Postgres + RLS (we already chose Supabase per ADR-0010).
- **Better-Auth** = open-source self-hostable.
- **Auth0** = enterprise compliance.

## Decision

- **Consumer tier:** **Supabase Auth** — bundled with our Postgres + RLS choice (ADR-0010); reduces moving parts; supports magic-link, OTP, OAuth (Apple, Google, GitHub), and password-less by default.
- **B2B/madrasa tier (post-v1.5):** **WorkOS** — best-in-class SSO + SCIM + audit; layered on top so consumer accounts and B2B orgs coexist.
- **QF Tier B passthrough (v2.0+):** PKCE + OIDC flow, separate from app auth — the user's Qalaam account links to their Quran.com identity for bookmark sync.

## Alternatives considered

1. **Clerk for consumer.** Better DX than Supabase Auth in some areas. **Rejected** because adds a vendor; Supabase Auth is sufficient and bundles cleanly.
2. **Better-Auth (self-host).** Considered for the AGPL self-host bundle. **Defer** to v2.0+; ship Supabase Auth in v0.1.
3. **Auth0.** Enterprise overkill for v0.1.
4. **Roll-our-own.** **Rejected categorically** — auth is one of the three things you should never roll yourself (with crypto and date math).

## Consequences

### Positive

- One vendor for Postgres + Auth + Storage + Realtime in v0.1 (Supabase) → simple ops.
- WorkOS layered later doesn't disrupt consumer flows.
- QF Tier B opt-in remains independent.

### Negative

- Two auth providers eventually (Supabase + WorkOS); reconciliation logic needed.
- Vendor lock-in to Supabase deepens; mitigation per ADR-0010.

### Neutral

- For self-hosters, eventual Better-Auth path required.

## Risks & monitoring

- **Risk:** Supabase Auth lacks an SSO path needed by an early B2B prospect. **Leading indicator:** sales conversation. **Mitigation:** WorkOS migration is the v1.5 plan; accelerate if needed.
- **Risk:** QF Tier B PKCE flow rejected by their team for our use case. **Leading indicator:** application response. **Mitigation:** ship without sync; bookmarks live in Qalaam.

## References

- Strategy doc: §10 Open question #5 (Tier B), §20.6 Auth landscape
- External: supabase.com/auth, workos.com
- Related ADRs: ADR-0010 (storage), ADR-0009 (backend)
