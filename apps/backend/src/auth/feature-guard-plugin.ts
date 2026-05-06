/**
 * featureGuardPlugin — fastify hook that gates EVERY /v1/* path
 * through the feature catalog.
 *
 * The route → feature mapping is one centralized table (ROUTE_RULES
 * below). Closed-by-default: any /v1/* URL that doesn't match an
 * exempt pattern AND doesn't match a feature pattern is refused
 * with 404 — we never silently allow access to a feature that
 * hasn't been catalogued.
 *
 * The hook runs as `onRequest` (the earliest hook). On a successful
 * gate it attaches the resolved AuthUser (or null for anon-allowed)
 * to `request.qalaamUser` so handlers can read it without
 * re-authenticating.
 *
 * Per-route handlers may STILL call requireFeature() / gateFeature()
 * for redundancy — defense-in-depth — but they don't have to.
 */
import fastifyPlugin from 'fastify-plugin';

import { gateFeature, type FeatureKey } from './features.js';

import type { AuthUser } from './sessions.js';
import type { FastifyInstance } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    /** Resolved user from the feature-guard hook. Available in any
     *  /v1/* handler whose route was mapped to a feature. Null when
     *  the feature is anon-allowed and the request was unauthenticated. */
    qalaamUser?: AuthUser | null;
  }
}

/**
 * Method-aware route → feature key map. Order matters: first match wins.
 *
 * `methods` of '*' matches any HTTP verb. Use a specific list when a
 * single URL family routes different verbs to different features
 * (e.g. PATCH /v1/auth/me vs GET /v1/auth/me).
 */
interface RouteRule {
  readonly methods: '*' | readonly string[];
  readonly pattern: RegExp;
  readonly feature: FeatureKey;
}

const ROUTE_RULES: readonly RouteRule[] = [
  // ─── Mushaf reading ────────────────────────────────────────────
  // Real registered paths (verified against /docs/json):
  //   /v1/verses/by_key/:verseKey   /v1/chapters/:id/verses
  //   /v1/qpc-text/:verseKey        /v1/metadata/...
  //   /v1/layouts                   /v1/layouts/:layout/...
  //   /v1/image-mushaf/:layout/:page
  { methods: '*', pattern: /^\/v1\/verses(\/|$)/, feature: 'mushaf.read' },
  { methods: '*', pattern: /^\/v1\/chapters(\/|$)/, feature: 'mushaf.read' },
  { methods: '*', pattern: /^\/v1\/qpc-text(\/|$)/, feature: 'mushaf.qpc-text' },
  { methods: '*', pattern: /^\/v1\/metadata(\/|$)/, feature: 'mushaf.read' },
  { methods: '*', pattern: /^\/v1\/layouts(\/|$)/, feature: 'mushaf.layouts.standard' },
  { methods: '*', pattern: /^\/v1\/surah-info(\/|$)/, feature: 'study.surah-info' },
  { methods: '*', pattern: /^\/v1\/wbw(\/|$)/, feature: 'study.wbw' },
  { methods: '*', pattern: /^\/v1\/mutashabihat(\/|$)/, feature: 'study.mutashabihat' },
  { methods: '*', pattern: /^\/v1\/image-mushaf(\/|$)/, feature: 'mushaf.image' },

  // ─── Listen / audio ────────────────────────────────────────────
  { methods: '*', pattern: /^\/v1\/recitations(\/|$)/, feature: 'listen.basic' },
  { methods: '*', pattern: /^\/v1\/reciters(\/|$)/, feature: 'listen.basic' },
  { methods: '*', pattern: /^\/v1\/audio(\/|$)/, feature: 'listen.basic' },
  { methods: '*', pattern: /^\/v1\/now-playing(\/|$)/, feature: 'listen.now-playing' },

  // ─── Study tools ───────────────────────────────────────────────
  { methods: '*', pattern: /^\/v1\/translations(\/|$)/, feature: 'study.translations' },
  { methods: '*', pattern: /^\/v1\/transliterations(\/|$)/, feature: 'study.transliterations' },
  { methods: '*', pattern: /^\/v1\/morphology(\/|$)/, feature: 'study.morphology' },
  { methods: '*', pattern: /^\/v1\/topics(\/|$)/, feature: 'study.topics' },
  { methods: '*', pattern: /^\/v1\/tajweed(\/|$)/, feature: 'study.tajweed-rules' },
  { methods: '*', pattern: /^\/v1\/tafsirs(\/|$)/, feature: 'study.translations' },

  // ─── Search ────────────────────────────────────────────────────
  { methods: '*', pattern: /^\/v1\/search(\/|$)/, feature: 'search.cross-corpus' },

  // ─── Salah / azkar ─────────────────────────────────────────────
  { methods: '*', pattern: /^\/v1\/prayer-times(\/|$)/, feature: 'salah.prayer-times' },
  { methods: '*', pattern: /^\/v1\/qibla(\/|$)/, feature: 'salah.qibla-hijri' },
  { methods: '*', pattern: /^\/v1\/hijri(\/|$)/, feature: 'salah.qibla-hijri' },

  // ─── Hifdh dashboard + curriculum ──────────────────────────────
  { methods: '*', pattern: /^\/v1\/hifdh(\/|$)/, feature: 'hifdh.dashboard.personal' },
  { methods: '*', pattern: /^\/v1\/curriculum(\/|$)/, feature: 'learn.curriculum' },

  // ─── MCP server ────────────────────────────────────────────────
  { methods: '*', pattern: /^\/v1\/mcp(\/|$)/, feature: 'mcp.tools' },

  // ─── Premium — family-tier ─────────────────────────────────────
  // Note: the per-handler `requireFeature` calls in these route files
  // remain — this hook is defense-in-depth + future-proofing for
  // routes added later that forget the per-handler gate.
  // /v1/family/khatm/* must be matched BEFORE /v1/family/* for the
  // correct feature key.
  { methods: '*', pattern: /^\/v1\/family\/khatm(\/|$)/, feature: 'family.khatm' },
  { methods: '*', pattern: /^\/v1\/family\/dashboard$/, feature: 'family.members.multiple' },
  {
    methods: ['POST', 'PATCH', 'DELETE'],
    pattern: /^\/v1\/family\/members(\/|$)/,
    feature: 'family.members.multiple',
  },
  { methods: ['GET'], pattern: /^\/v1\/family$/, feature: 'hifdh.dashboard.personal' },
  { methods: '*', pattern: /^\/v1\/plans(\/|$)/, feature: 'family.plans' },
  { methods: '*', pattern: /^\/v1\/mistakes(\/|$)/, feature: 'family.mistakes.heatmap' },
  { methods: '*', pattern: /^\/v1\/voice-notes(\/|$)/, feature: 'family.voice-notes' },
  { methods: '*', pattern: /^\/v1\/bookmarks(\/|$)/, feature: 'bookmarks' },
];

/**
 * Paths exempted from the gate entirely. Each has its own auth /
 * security model (or is genuinely public).
 */
const EXEMPT_PATTERNS: readonly RegExp[] = [
  /^\/v1\/auth(\/|$)/, // signup / signin / signout / me / patch
  /^\/v1\/features(\/|$)/, // public catalog (the catalog itself is non-secret)
  /^\/v1\/support(\/|$)/, // pricing intake (auth optional by design)
  /^\/v1\/credits(\/|$)/, // public attribution surface
  /^\/healthz(\/|$)?/, // liveness
  /^\/readyz(\/|$)?/, // readiness
  /^\/api\/health(\/|$)?/, // backwards-compat alias
  /^\/docs(\/|$)?/, // swagger UI
  /^\/documentation(\/|$)?/, // swagger
  /^\/$/, // root
];

function matchRule(method: string, url: string): RouteRule | null {
  // Strip query string so patterns match on path only.
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

/**
 * The hook is wrapped in `fastify-plugin` so it escapes encapsulation
 * — meaning the `onRequest` hook applies to ALL routes registered on
 * the parent fastify instance (siblings + children), not just routes
 * registered inside this plugin's scope. Without this wrapper, sibling
 * routes registered after `app.register(featureGuardPlugin)` would
 * bypass the gate entirely.
 */
export const featureGuardPlugin = fastifyPlugin(
  (app: FastifyInstance): void => {
    app.addHook('onRequest', async (req, reply) => {
      const url = req.url;
      const path = url.split('?')[0] ?? url;

      // Exempt + non-/v1 paths skip the gate. Static assets, health
      // probes, root, etc. don't go through the catalog.
      if (isExempt(path)) return;
      if (!path.startsWith('/v1/')) return;

      const rule = matchRule(req.method, path);
      if (!rule) {
        // Closed-by-default: any /v1/* URL that doesn't match a rule
        // is treated as "feature not catalogued" → 404. This is the
        // single most important property of this guard — we never
        // silently allow access to a feature we forgot to catalogue.
        await reply.code(404).send({
          code: 'qalaam.feature.uncatalogued',
          message: 'This route has no feature gate; treat as not-found.',
        });
        return reply;
      }

      const result = gateFeature(req, reply, rule.feature);
      if (!result.ok) {
        // gateFeature already sent the 401 / 403 response.
        return reply;
      }
      // Stash the user (or null for anon-allowed free routes) so the
      // route handler can read it without re-authenticating.
      req.qalaamUser = result.user;
      return undefined;
    });
  },
  { name: 'feature-guard' },
);
