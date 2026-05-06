# Feature gates — a portable pattern for tier-flippable SaaS

A reusable design for putting every customer-visible capability behind
a server-authoritative gate that can be flipped between tiers without
touching route code. Written project-agnostic; concrete examples
reference Qalaam where useful but the pattern works for any
TypeScript / Node SaaS.

## What problem this solves

Every SaaS that has tiers (Free / Premium / Pro, Free / Pro / Team,
trial vs paid, etc.) hits the same five problems on the day a price
or packaging changes:

1. **Inline tier checks scatter through routes.** `if (user.tier !== 'pro')`
   gets duplicated in 30 handlers. To move a feature from Pro → Premium,
   you grep + edit 30 places, redeploy, hope you didn't miss one.
2. **The frontend disagrees with the backend.** UI hides a button for
   free users; backend silently allows the request anyway. A crafted
   curl call bypasses the paywall.
3. **Anonymous-allowed features are different code.** Some features
   serve anonymous browsers (e.g. public landing data); some require
   auth even at the Free tier (e.g. personal bookmarks). Mixed
   handling = mixed bugs.
4. **Tier hierarchy gets compared wrong.** `tier === 'premium'` is a
   common bug — a Pro user fails the check because their tier is
   `'pro'` not `'premium'`. Gate logic should always be monotone.
5. **A typo in a feature key kills the gate.** `'family.heatmaq'` (typo)
   compiles, hits production, silently allows everything.

The pattern below addresses all five.

## Architecture

```
                 ┌─────────────────────────────────────────────┐
                 │ apps/backend/src/auth/features.ts           │
                 │                                             │
                 │   FeatureKey       string-literal union     │
                 │   FEATURE_CATALOG  Record<FeatureKey, Spec> │
                 │   tierSatisfies()  monotone tier compare    │
                 │   gateFeature()    auth + tier + reply      │
                 │   requireFeature() auth-required convenience│
                 │   publicCatalog()  strip dev fields → JSON  │
                 └─────────────┬───────────────────────────────┘
                               │
            ┌──────────────────┼─────────────────────┐
            │                  │                     │
            ▼                  ▼                     ▼
   ┌────────────────┐  ┌────────────────┐  ┌────────────────┐
   │ Route handlers │  │ /v1/features   │  │ Future admin   │
   │                │  │ public surface │  │ DB overrides   │
   │ const u =      │  │                │  │                │
   │  requireFeature│  │ JSON catalog   │  │ feature_       │
   │   (req,reply,  │  │ for the web    │  │ overrides      │
   │   'family.    '│  │ client mirror  │  │ table          │
   │   khatm');     │  │                │  │                │
   │ if (!u) return;│  │                │  │                │
   └────────────────┘  └───────┬────────┘  └────────────────┘
                               │
                               ▼
                ┌──────────────────────────────────┐
                │ apps/web/src/lib/features.ts     │
                │                                  │
                │   FeatureKey  same union         │
                │   FALLBACK_CATALOG               │
                │   userHasFeature()               │
                │   tierSatisfies()                │
                │                                  │
                │ Mirror only — UX hints, never   │
                │ the security boundary.           │
                └─────────────┬────────────────────┘
                              │
                              ▼
              ┌─────────────────────────────────┐
              │ <FeatureGate feature="...">     │
              │   <PremiumThing />              │
              │ </FeatureGate>                  │
              │                                 │
              │ <UpgradeCard feature="..." />   │
              │                                 │
              │ useUser().hasFeature(key)       │
              └─────────────────────────────────┘
```

## The catalog

Single source of truth in one file. Keys are a TypeScript string-literal
union — a typo is a compile error. Specs name the minimum tier and
whether anonymous access is allowed.

```ts
// apps/backend/src/auth/features.ts (sketch)
export type FeatureKey =
  | 'mushaf.read' // free, anon-allowed
  | 'bookmarks' // free, requires auth
  | 'family.khatm' // premium
  | 'voice.cloning.v2'; // pro

interface FeatureSpec {
  readonly minTier: 'free' | 'premium' | 'pro';
  readonly requiresAuth: boolean;
  readonly description: string; // dev-facing
  readonly label: string; // customer-voice
}

export const FEATURE_CATALOG: Record<FeatureKey, FeatureSpec> = {
  'mushaf.read': {
    minTier: 'free',
    requiresAuth: false,
    description: '...',
    label: 'Read the Mushaf',
  },
  bookmarks: { minTier: 'free', requiresAuth: true, description: '...', label: 'Bookmarks' },
  'family.khatm': {
    minTier: 'premium',
    requiresAuth: true,
    description: '...',
    label: 'Family khatm',
  },
  'voice.cloning.v2': {
    minTier: 'pro',
    requiresAuth: true,
    description: '...',
    label: 'Voice cloning',
  },
};
```

### Why customer-voice label is in the catalog

Upgrade prompts show `"Premium feature: <label>"`. Putting the label
next to the spec keeps copy + tier in sync — moving a feature between
tiers updates the prompt automatically. Never use the key as fallback
display text (`'family.khatm'` is dev jargon).

## Tier hierarchy — monotone compare

Tiers form a linear order. Higher tiers always include lower-tier
features. Never strict-equal compare.

```ts
const TIER_ORDER = { free: 0, premium: 1, pro: 2 } as const;

export function tierSatisfies(actual: string, required: 'free' | 'premium' | 'pro'): boolean {
  // Normalize unknown / stale tier strings to the lowest level.
  // Closed-by-default: an attacker setting tier = 'enterprise' should
  // not accidentally satisfy any check.
  const norm = actual === 'premium' || actual === 'pro' ? actual : 'free';
  return TIER_ORDER[norm] >= TIER_ORDER[required];
}
```

A Pro user passes every Premium check. A Premium user fails Pro
checks. The catalog never has features that are "premium-only and
not pro-allowed" — that would not be a hierarchy.

## The gate function

Single helper handles auth + tier + reply in one call:

```ts
type FeatureGateResult =
  | { ok: true; user: AuthUser | null } // anon-allowed free feature
  | { ok: false; user: null }; // 401 / 403 already sent

export function gateFeature(
  req: FastifyRequest,
  reply: FastifyReply,
  feature: FeatureKey,
): FeatureGateResult {
  const spec = FEATURE_CATALOG[feature];
  if (!spec) {
    // Closed-by-default for unknown keys. Type system makes this
    // unreachable; the runtime check is belt-and-suspenders.
    void reply.code(500).send({ code: 'feature.unknown', feature });
    return { ok: false, user: null };
  }

  const sessionId = readSessionCookie(req);
  const user = sessionId ? findUserBySession(sessionId) : null;

  // Anon path — only if feature is free AND doesn't require auth.
  if (!user) {
    if (spec.minTier === 'free' && !spec.requiresAuth) {
      return { ok: true, user: null };
    }
    void reply.code(401).send({
      code: 'feature.auth-required',
      feature,
      featureLabel: spec.label,
      requiredTier: spec.minTier,
    });
    return { ok: false, user: null };
  }

  // Authenticated — verify tier.
  if (!tierSatisfies(user.tier, spec.minTier)) {
    void reply.code(403).send({
      code: 'feature.tier-required',
      feature,
      featureLabel: spec.label,
      requiredTier: spec.minTier,
      currentTier: user.tier,
    });
    return { ok: false, user: null };
  }
  return { ok: true, user };
}
```

For routes that always require auth (every premium feature), expose a
convenience wrapper that asserts on the spec to fail loud if a caller
tries to use it for an anon-allowed feature:

```ts
export function requireFeature(req, reply, feature: FeatureKey): AuthUser | null {
  const spec = FEATURE_CATALOG[feature];
  if (!spec.requiresAuth) {
    throw new Error(
      `requireFeature('${feature}') called for anon-allowed feature; use gateFeature()`,
    );
  }
  const result = gateFeature(req, reply, feature);
  return result.ok ? result.user : null;
}
```

## Route handler shape

```ts
fastify.get('/v1/family/khatm', async (req, reply) => {
  const user = requireFeature(req, reply, 'family.khatm');
  if (!user) return; // 401 or 403 already sent
  // …handler …
});

fastify.get('/v1/listen/recite/:vk', async (req, reply) => {
  // Anon-allowed free feature — branches on whether we got a user.
  const gate = gateFeature(req, reply, 'listen.basic');
  if (!gate.ok) return;
  const audio = gate.user
    ? loadPersonalRecitation(gate.user.id, req.params.vk)
    : loadPublicRecitation(req.params.vk);
  return reply.send(audio);
});
```

One line per route. Tier-flips happen in the catalog only.

## The central guard — closed-by-default URL→feature map

Per-handler gates are not enough on their own. Two failure modes
slip past them:

1. **A new route ships without the gate call.** `requireFeature` is a
   convention, not a contract. A handler missing it is wide open.
2. **A route that looks free but has hidden cost.** Some routes are
   anon-allowed only as a future affordance — when they later become
   paid, you have to grep again.

A single `onRequest` hook running before every request closes both.
It carries a method-aware rule table mapping URL patterns to feature
keys; anything that lands on `/v1/*` and doesn't match a rule is
refused with 404 — closed by default.

```ts
// apps/backend/src/auth/feature-guard-plugin.ts
import fastifyPlugin from 'fastify-plugin';

interface RouteRule {
  readonly methods: '*' | readonly string[];
  readonly pattern: RegExp;
  readonly feature: FeatureKey;
}

const ROUTE_RULES: readonly RouteRule[] = [
  // Order matters — first match wins. Put narrower patterns first
  // when a URL family routes to different features by sub-path
  // (e.g. /v1/family/khatm/* before /v1/family/*).
  { methods: '*', pattern: /^\/v1\/family\/khatm(\/|$)/, feature: 'family.khatm' },
  {
    methods: ['POST', 'PATCH', 'DELETE'],
    pattern: /^\/v1\/family\/members(\/|$)/,
    feature: 'family.members.multiple',
  },

  { methods: '*', pattern: /^\/v1\/verses(\/|$)/, feature: 'mushaf.read' },
  { methods: '*', pattern: /^\/v1\/translations(\/|$)/, feature: 'study.translations' },
  { methods: '*', pattern: /^\/v1\/morphology(\/|$)/, feature: 'study.morphology' },
  { methods: '*', pattern: /^\/v1\/voice-notes(\/|$)/, feature: 'family.voice-notes' },
  // …one row per feature surface in the API…
];

const EXEMPT_PATTERNS: readonly RegExp[] = [
  /^\/v1\/auth(\/|$)/, // signup / signin / me — has its own auth model
  /^\/v1\/features(\/|$)/, // public catalog (the catalog itself is non-secret)
  /^\/v1\/support(\/|$)/, // pricing intake (auth optional by design)
  /^\/v1\/credits(\/|$)/, // public attribution surface
  /^\/healthz(\/|$)?/, // liveness
  /^\/readyz(\/|$)?/, // readiness
  /^\/docs(\/|$)?/, // swagger UI
  /^\/$/, // root
];

function matchRule(method: string, url: string): RouteRule | null {
  const path = url.split('?')[0] ?? url;
  for (const rule of ROUTE_RULES) {
    if (rule.methods !== '*' && !rule.methods.includes(method)) continue;
    if (rule.pattern.test(path)) return rule;
  }
  return null;
}

function isExempt(url: string): boolean {
  const path = url.split('?')[0] ?? url;
  return EXEMPT_PATTERNS.some((p) => p.test(path));
}

export const featureGuardPlugin = fastifyPlugin(
  (app: FastifyInstance): void => {
    app.addHook('onRequest', async (req, reply) => {
      const path = req.url.split('?')[0] ?? req.url;

      // Exempt + non-/v1 paths skip the gate.
      if (isExempt(path)) return;
      if (!path.startsWith('/v1/')) return;

      const rule = matchRule(req.method, path);
      if (!rule) {
        // Closed-by-default: any /v1/* URL that doesn't match a rule
        // is refused. The single most important property of this
        // guard — a feature that wasn't catalogued is unreachable.
        await reply.code(404).send({
          code: 'feature.uncatalogued',
          message: 'This route has no feature gate; treat as not-found.',
        });
        return reply;
      }

      const result = gateFeature(req, reply, rule.feature);
      if (!result.ok) return reply;
      // Stash the resolved user so handlers don't re-authenticate.
      req.qalaamUser = result.user;
    });
  },
  { name: 'feature-guard' },
);
```

### Why `fastify-plugin` (the encapsulation gotcha)

Hooks added inside a plugin only apply to that plugin's scope and
its children. Routes registered as **siblings** at the parent
instance bypass the hook entirely. A guard plugin without
`fastify-plugin` will silently let everything through — every
non-trivial review will miss this.

`fastifyPlugin(fn, { name: 'feature-guard' })` flags the plugin as
not-encapsulated; the `onRequest` hook then runs for every request
on the parent instance. Without it, the gate is a no-op.

This is the kind of bug that ships, looks fine on the smoke test
that hits a route registered inside the plugin, and fails open on
every actual route. Verify with:

```bash
# Should hit the guard's "uncatalogued" branch, NOT Fastify's
# default 404 "No route GET /v1/totally-bogus". Different bodies:
#   guard:    {"code":"feature.uncatalogued",...}
#   bypass:   {"type":"about:blank","title":"Not Found",...}
curl -s http://localhost:4111/v1/totally-bogus | head -c 200
```

If you see Fastify's default 404, the hook is bypassed — wrap with
`fastify-plugin`.

### Per-handler gates as defense-in-depth

With the central guard in place, per-handler `requireFeature()` /
`gateFeature()` calls become defense-in-depth:

- **Keep them on premium routes.** A route file is the wrong place
  to hide a tier rule, but having a second copy means a refactor
  that accidentally drops the route from the rule table still
  fails closed.
- **Drop them on free anon-allowed routes.** The central guard
  handles attach-user; the handler can read `req.qalaamUser`.
- **The catalog is still the source of truth.** Tier flips happen
  in `FEATURE_CATALOG` — the rule table maps URL→key, not URL→tier.

### Adding a new route — the development rule

Every new feature follows four steps. Skipping any of them ships
a route that's either ungated or tier-flipped only by code deploy.

1. **Catalog entry** in `apps/backend/src/auth/features.ts`:
   add the `FeatureKey`, `FEATURE_CATALOG` row with `minTier`,
   `requiresAuth`, customer-voice `label`, dev-facing `description`.
2. **Frontend mirror entry** in `apps/web/src/lib/features.ts`.
3. **Route-rule entry** in `feature-guard-plugin.ts` mapping the
   URL pattern (and methods if relevant) to the new key.
4. **Admin panel surface** appears automatically once the panel
   reads `publicCatalog()` — no extra work.

The closed-by-default 404 is the enforcement mechanism. A route
without a rule entry returns `feature.uncatalogued` — review will
spot it on the smoke pass.

## Public catalog endpoint

Strip dev-facing `description`, expose `minTier` + `label` + `requiresAuth`.
Web client mirrors this for UX.

```ts
fastify.get('/v1/features', async (_req, reply) => {
  void reply.header('cache-control', 'public, max-age=60');
  return reply.send({ catalog: publicCatalog() });
});
```

## Frontend mirror

The mirror is **UX only** — disabling buttons, surfacing upgrade-CTA
cards, redirecting 403s into a tier-aware /pricing prompt. The server
is always the gate. Hide a button → still gated by the server. Skip
the mirror → the UI is uglier but still secure.

```ts
// apps/web/src/lib/features.ts
export type FeatureKey = /* same union as backend */;
export const FALLBACK_CATALOG: Record<FeatureKey, FeatureSpec> = { ... };

export function userHasFeature(
  feature: FeatureKey,
  userTier: string | null,
  catalog = FALLBACK_CATALOG,
): boolean {
  const spec = catalog[feature];
  if (!userTier) return spec.minTier === 'free' && !spec.requiresAuth;
  return tierSatisfies(userTier, spec.minTier);
}
```

```ts
// useUser hook gains a hasFeature helper
const { user, hasFeature } = useUser();
if (hasFeature('family.khatm')) {
  // render the affordance
}
```

```tsx
// FeatureGate component
<FeatureGate feature="family.khatm" fallback={<UpgradeCard feature="family.khatm" />}>
  <KhatmList />
</FeatureGate>
```

## Handling 403 from premium routes

Components that fetch premium routes catch 403 and render the
UpgradeCard inline:

```ts
mistakesApi.heatmap(args).catch((err: { status?: number }) => {
  if (err.status === 403) setNeedsUpgrade(true);
  else setError('Could not load.');
});

if (needsUpgrade) return <UpgradeCard feature="family.mistakes.heatmap" />;
```

This keeps the UX clean — a free user navigating to a premium surface
sees a tier-aware upgrade prompt, not an error toast.

## Anti-bypass posture

These rules are absolute:

1. **Server is authoritative.** The frontend mirror is a UX hint.
   Hiding a button does not prevent a `curl` call.
2. **Tier comes from the database, fresh per request.** Never trust
   `req.headers['x-user-tier']` or anything client-supplied. Resolve
   from the session ID → users.tier on every gated request.
3. **Closed by default.** Unknown feature keys, unknown tier values,
   missing catalog rows all produce a refused response (500 / 403),
   never an accidental allow.
4. **Type the keys.** `FeatureKey` as a string-literal union means a
   typo is a compile error. The catalog is `Record<FeatureKey, …>` so
   missing rows are also compile errors.
5. **Single source of truth.** Two catalogs (backend + web mirror)
   that drift are a bug; the public `/v1/features` endpoint lets the
   frontend self-correct at runtime if it ever does.

## Tier flips without a redeploy (DB-backed overrides)

When the in-code catalog isn't enough — when an admin needs to flip a
feature's tier in production without a deploy — add a thin override
layer:

```sql
CREATE TABLE feature_overrides (
  feature_key   TEXT PRIMARY KEY,
  min_tier      TEXT NOT NULL,
  requires_auth INTEGER NOT NULL,
  effective_at  TEXT NOT NULL DEFAULT (datetime('now')),
  set_by        TEXT NOT NULL,
  reason        TEXT
);
```

Resolve the effective spec at request time:

```ts
function effectiveSpec(feature: FeatureKey): FeatureSpec {
  const override = db
    .prepare(`SELECT min_tier, requires_auth FROM feature_overrides WHERE feature_key = ?`)
    .get(feature) as { min_tier: string; requires_auth: number } | undefined;
  const baseline = FEATURE_CATALOG[feature];
  if (!override) return baseline;
  return {
    ...baseline,
    minTier: override.min_tier as Tier,
    requiresAuth: override.requires_auth === 1,
  };
}
```

The admin panel writes to `feature_overrides`. The catalog is the
default; overrides win at runtime. Audit trail in the table itself.

## Testing the gate

Unit tests for the matrix:

```ts
import { gateFeature, FEATURE_CATALOG, tierSatisfies } from './features';

describe('tier hierarchy', () => {
  for (const [user, required, expected] of [
    ['free', 'free', true],
    ['free', 'premium', false],
    ['premium', 'free', true],
    ['premium', 'premium', true],
    ['premium', 'pro', false],
    ['pro', 'free', true],
    ['pro', 'premium', true],
    ['pro', 'pro', true],
    // unknown / hostile tier values normalize to free
    ['enterprise', 'premium', false],
    ['', 'free', true],
  ] as const) {
    it(`${user} satisfies ${required} → ${expected}`, () => {
      expect(tierSatisfies(user, required)).toBe(expected);
    });
  }
});
```

E2E for routes (verify the matrix end-to-end):

```bash
EMAIL=test_$(date +%s)@example.com
COOKIE=$(curl -s -i -X POST http://localhost:4111/v1/auth/signup \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"hunter22test\"}" \
  | grep -i set-cookie | head -1 | sed 's/.*: *//' | cut -d';' -f1)

# Free user — premium route returns 403 with the full body shape:
curl -s -b "$COOKIE" http://localhost:4111/v1/family/khatm
# {"code":"feature.tier-required","feature":"family.khatm","featureLabel":"Family khatm","requiredTier":"premium","currentTier":"free"}

sqlite3 ./qalaam.sqlite "UPDATE users SET tier='premium' WHERE email='$EMAIL';"

# Premium-bumped — same route → 200
curl -s -b "$COOKIE" http://localhost:4111/v1/family/khatm
```

## What you get

- **One-line route gating.** `requireFeature(req, reply, 'x')` → done.
- **Tier-flips are catalog edits.** No grep across routes.
- **No bypass.** UI hints + server authority + closed-by-default
  catalog + monotone compare = no clever curl gets through.
- **Type-safe.** Typos are compile errors; missing catalog rows are
  compile errors.
- **Customer-voice copy lives next to the gate.** Upgrade prompts
  always carry the right label.
- **Anonymous + authenticated unified.** One pattern, two outcomes.
- **Observable.** Audit log every 401/403 to see attempted-bypass
  patterns.
- **Hot-flippable** (when DB overrides are added). Admin can move a
  feature between tiers without a deploy.

## When to NOT use this pattern

- **Per-user feature flags / experiments.** Use a flag service
  (LaunchDarkly, Unleash, or a flag table) — different concern,
  different invalidation rules, different audit trail.
- **Per-route ACL with non-tier dimensions** (org membership, project
  role). This pattern is for tier hierarchy. ACL is orthogonal —
  combine them: `requireFeature(...)` then `if (!isMemberOf(orgId)) return 403`.
- **Soft limits** (5 bookmarks free, unlimited Premium). Different
  pattern — gate the _count_ not the _capability_.

## Drop-in to a new project

The pattern is two files on the backend, two files on the frontend,
plus one endpoint and the central hook. Half-day setup; pays for
itself the first time you flip a feature between tiers.

1. **Backend catalog** — copy `apps/backend/src/auth/features.ts`
   (~150 LOC). Replace `FeatureKey` union + `FEATURE_CATALOG` with
   your features. Replace `findUserBySession()` with your session
   resolver. Replace `Tier` with your tier enum.
2. **Backend central guard** — copy `apps/backend/src/auth/feature-guard-plugin.ts`
   (~80 LOC). Replace the `ROUTE_RULES` table and `EXEMPT_PATTERNS`
   list with your URL space. Wrap with `fastifyPlugin` (Fastify) or
   the equivalent escape-encapsulation primitive in your framework.
3. **Register the guard** before any route registration. Verify the
   `feature.uncatalogued` 404 fires on a deliberately-missing path.
4. **Public catalog endpoint** at `/v1/features` (or equivalent) that
   returns `publicCatalog()` — the version with dev fields stripped.
5. **Frontend mirror** in `apps/web/src/lib/features.ts`. Same
   `FeatureKey` union, `FALLBACK_CATALOG` of last-known specs, and a
   `userHasFeature()` helper for UX-only checks.
6. **`<FeatureGate>` + `<UpgradeCard>` components** wrapping any
   premium UI surface. Components that fetch premium routes catch
   the 403 and render `<UpgradeCard>` inline.
7. **Tier-flip drill** — pick one feature, flip its `minTier` from
   `premium` → `free` in the catalog, redeploy, watch the upgrade
   prompts disappear and the routes start serving anonymous users.
   No grep, no per-route changes.

### Framework adapters

The pattern is framework-agnostic. The primitives map cleanly:

| Concept               | Fastify                     | Express              | NestJS                | Hono                |
| --------------------- | --------------------------- | -------------------- | --------------------- | ------------------- |
| Escape encapsulation  | `fastify-plugin`            | n/a (single tree)    | global guard          | `app.use()` root    |
| Pre-route hook        | `onRequest`                 | `app.use(mw)`        | `@UseGuards`          | `app.use()`         |
| Send + halt from hook | `reply.send + return reply` | `res.json(); return` | `throw HttpException` | `c.json()` + return |
| Per-handler gate      | `requireFeature()` helper   | same                 | guard decorator       | helper              |

The catalog file is unchanged across all four — pure TypeScript, no
framework imports.

### Total upfront cost

~Half a day. Long-term: every tier flip goes from a code-grep +
redeploy to a one-line catalog edit (or a DB-override row once the
admin layer is in place). Every new feature gets a catalog row +
rule map row — and the closed-by-default guard catches the case
where someone forgets.
