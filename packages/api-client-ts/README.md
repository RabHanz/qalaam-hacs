# `@qalaam/api-client-ts`

HTTP client for Quran.Foundation (Tier A — Content APIs, M2M) and the Qalaam SaaS backend. Per ADR-0002.

## QF auth (Tier A)

- `OAuth2 client_credentials` flow against `oauth2.quran.foundation/oauth2/token`.
- 1-hour tokens; we cache for **55 minutes** to leave a 5-minute safety margin.
- Every request carries `x-auth-token: <token>` + `x-client-id: <id>`.

**Tier B** (per-user OIDC + PKCE — bookmarks/notes/streaks) is deferred to v2 per ADR-0012 and the strategy doc; this package contains a placeholder interface so callers can compile against it.

## Caching

Per QF Developer ToS, content cache is capped at **1 week**. The built-in `LruCache` enforces a max TTL of `7 * 24 * 3600 * 1000` ms; passing a longer TTL throws.

## Use

```ts
import { createQfClient } from '@qalaam/api-client-ts/qf';

const qf = createQfClient({
  baseUrl: process.env.QF_BASE_URL!,
  oauthUrl: process.env.QF_OAUTH_URL!,
  clientId: process.env.QF_CLIENT_ID!,
  clientSecret: process.env.QF_CLIENT_SECRET!,
});

const verses = await qf.getVersesByChapter(1, { translations: [131], words: true });
```
