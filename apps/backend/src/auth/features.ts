/**
 * Feature catalog + authoritative gate.
 *
 * Every customer-visible capability flows through this module. There
 * is exactly one place to flip a feature's required tier — even
 * features that are currently Free go through the gate, so when the
 * admin panel (#214) is wired up an operator can move any feature
 * to Premium / Pro from a UI without a code deploy.
 *
 * Anti-bypass posture (production rule):
 *   - Tier comes from `users.tier` in qalaam.sqlite, fetched fresh
 *     on every request via findUserBySession. Never trusted from a
 *     header, cookie field, query string, or request body.
 *   - The frontend mirror (apps/web/src/lib/features.ts) is for UX
 *     only — disabled buttons, upgrade-CTA cards, /pricing redirects.
 *     It is NEVER the gate. A crafted curl with no session must hit
 *     the same authoritative gate any browser does.
 *   - Tier hierarchy is monotone: anonymous < free < premium < pro.
 *     Never compare with strict equality. `tier === 'premium'` is
 *     a code smell — use `tierSatisfies(actual, 'premium')` so a
 *     pro user always inherits premium access too.
 *   - Closed-by-default for unknown features: a typo in a feature
 *     key (which is a TypeScript-typed string union) is a compile
 *     error; a missing catalog row is a runtime "feature not in
 *     catalog" 500 — fail-loud, never silently allow.
 *
 * Future override path: ADR-0024 + task #214 outline a DB-backed
 * `feature_overrides` table that lets the admin UI flip a feature's
 * minTier at runtime. Until that lands the catalog below is the
 * single source of truth.
 */
import {
  SESSION_COOKIE_NAME,
  findUserByApiKey,
  findUserBySession,
  type AuthUser,
} from './sessions.js';

import type { FastifyReply, FastifyRequest } from 'fastify';

// ─── tier model ────────────────────────────────────────────────────

export type Tier = 'free' | 'premium' | 'pro';

const TIER_ORDER: Record<Tier, number> = {
  free: 0,
  premium: 1,
  pro: 2,
};

/** Anonymous gets order -1 — strictly below free, so any
 *  tier-gated feature (including the free ones) can require
 *  authentication when its minTier is bumped. */
const ANONYMOUS_ORDER = -1;

export function tierSatisfies(actual: string, required: Tier): boolean {
  const norm: Tier = actual === 'premium' || actual === 'pro' ? actual : 'free';
  return TIER_ORDER[norm] >= TIER_ORDER[required];
}

// ─── catalog ───────────────────────────────────────────────────────

/**
 * Public surface. Every customer-visible capability has a key here.
 * Adding a new capability: append a key, append a row in
 * FEATURE_CATALOG, and append the same key in
 * apps/web/src/lib/features.ts. Three places, type-checked end-
 * to-end, so we cannot ship an undeclared feature.
 */
export type FeatureKey =
  // Free — Mushaf reading + word-by-word
  | 'mushaf.read'
  | 'mushaf.layouts.standard'
  | 'mushaf.image'
  | 'mushaf.qpc-text'
  // Free — listening + audio
  | 'listen.basic'
  | 'listen.now-playing'
  // Free — study tools
  | 'study.translations'
  | 'study.transliterations'
  | 'study.morphology'
  | 'study.topics'
  | 'study.tajweed-rules'
  | 'study.mutashabihat'
  | 'study.surah-info'
  | 'study.wbw'
  // Free — recite-and-check (on-device ASR)
  | 'recite-and-check.browser'
  // Free — search + credits
  | 'search.cross-corpus'
  // Free — salah + azkar
  | 'salah.prayer-times'
  | 'salah.qibla-hijri'
  // Free — Hifdh personal dashboard + curriculum
  | 'hifdh.dashboard.personal'
  | 'learn.curriculum'
  // Free — bookmarks (auth-required)
  | 'bookmarks'
  // Free — Quran MCP server (open for third-party AI clients)
  | 'mcp.tools'
  // Free — cross-device playback session (ADR-0025 Phase 2).
  // Read is anon-friendly so unauthenticated users can still listen
  // locally; write requires auth so only the owner can mutate the
  // backend session row.
  | 'playback.session.read'
  | 'playback.session.write'
  // Premium — programmatic access (HA + MCP clients + third-party
  // automations). Minting keys is a Premium-tier feature; the
  // resulting key carries the user's tier on every request the gate
  // resolves it for.
  | 'auth.api-keys'
  // Premium — family-tier
  | 'family.members.multiple'
  | 'family.plans'
  | 'family.mistakes.heatmap'
  | 'family.khatm'
  | 'family.voice-notes'
  // Premium — listen / smart-home
  | 'listen.self-hosted-asr'
  | 'listen.cast.advanced'
  | 'ha.integration'
  | 'ha.url-config'
  // Pro — voice + organizational
  | 'voice.cloning.v2'
  | 'voice.cloning.teacher'
  | 'pro.weekly-review-reports'
  | 'pro.multi-household';

/**
 * One feature row.
 *
 * `requiresAuth=true` means: even if minTier='free', the request
 * must carry a session. Used for features where we need to scope
 * the response to the user (bookmarks, personal Hifdh dashboard,
 * etc.) — anonymous users get 401 even though the feature is
 * "Free."
 *
 * `requiresAuth=false` (default) means: anonymous users hit the
 * feature with no auth, and authenticated users get the same
 * surface plus their personalized data layered on top.
 */
interface FeatureSpec {
  readonly minTier: Tier;
  readonly requiresAuth: boolean;
  readonly description: string;
  /** Customer-voice label — surfaced verbatim in upgrade prompts. */
  readonly label: string;
}

export const FEATURE_CATALOG: Record<FeatureKey, FeatureSpec> = {
  'mushaf.read': {
    minTier: 'free',
    requiresAuth: false,
    description: 'Read the Mushaf in any standard layout',
    label: 'Read the Mushaf',
  },
  'mushaf.layouts.standard': {
    minTier: 'free',
    requiresAuth: false,
    description: 'Madinah / Tajweed / IndoPak layouts',
    label: 'Standard Mushaf layouts',
  },
  'mushaf.image': {
    minTier: 'free',
    requiresAuth: false,
    description: 'Image-mushaf with overlay coords (for visual hifz)',
    label: 'Image Mushaf',
  },
  'mushaf.qpc-text': {
    minTier: 'free',
    requiresAuth: false,
    description: 'KFGQPC PUA-encoded text + per-page tajweed font',
    label: 'KFGQPC tajweed text',
  },
  'listen.basic': {
    minTier: 'free',
    requiresAuth: false,
    description: 'Reciter playback + basic Cast / AirPlay',
    label: 'Listen with any reciter',
  },
  'listen.now-playing': {
    minTier: 'free',
    requiresAuth: false,
    description: 'Now-playing state (verse + reciter + position)',
    label: 'Now-playing state',
  },
  'study.translations': {
    minTier: 'free',
    requiresAuth: false,
    description: 'Translations (Pickthall, Sahih, etc.)',
    label: 'Translations',
  },
  'study.transliterations': {
    minTier: 'free',
    requiresAuth: false,
    description: 'Latin transliteration of the Arabic',
    label: 'Transliterations',
  },
  'study.morphology': {
    minTier: 'free',
    requiresAuth: false,
    description: "Word-level grammar (i'rab) + lemma + root",
    label: 'Grammar + morphology',
  },
  'study.topics': {
    minTier: 'free',
    requiresAuth: false,
    description: 'Browse the Quran by theme / topic',
    label: 'Topical browsing',
  },
  'study.tajweed-rules': {
    minTier: 'free',
    requiresAuth: false,
    description: 'Tajweed rule legend + per-rule explainer',
    label: 'Tajweed rules',
  },
  'study.mutashabihat': {
    minTier: 'free',
    requiresAuth: false,
    description: 'Similar-ayah pairs + mutashabihat watchlist',
    label: 'Mutashabihat watchlist',
  },
  'study.surah-info': {
    minTier: 'free',
    requiresAuth: false,
    description: 'Per-surah introductions + meta',
    label: 'Surah introductions',
  },
  'study.wbw': {
    minTier: 'free',
    requiresAuth: false,
    description: 'Word-by-word translations + glosses',
    label: 'Word-by-word study',
  },
  'recite-and-check.browser': {
    minTier: 'free',
    requiresAuth: false,
    description: 'Browser-side ASR (Web Speech API)',
    label: 'Recite-and-check',
  },
  'search.cross-corpus': {
    minTier: 'free',
    requiresAuth: false,
    description: 'Search across Arabic + translations + topics',
    label: 'Search the Quran',
  },
  'salah.prayer-times': {
    minTier: 'free',
    requiresAuth: false,
    description: 'Prayer times for any location',
    label: 'Prayer times',
  },
  'salah.qibla-hijri': {
    minTier: 'free',
    requiresAuth: false,
    description: 'Qibla direction + Hijri calendar + Islamic events',
    label: 'Qibla + Hijri calendar',
  },
  bookmarks: {
    minTier: 'free',
    requiresAuth: true,
    description: 'Per-user bookmarks, highlights, notes',
    label: 'Bookmarks, highlights, notes',
  },
  'hifdh.dashboard.personal': {
    minTier: 'free',
    requiresAuth: true,
    description: 'Personal Hifdh dashboard for the signed-in user',
    label: 'Daily Hifdh dashboard',
  },
  'learn.curriculum': {
    minTier: 'free',
    requiresAuth: false,
    description: 'Quranic Arabic / tajweed curriculum lessons',
    label: 'Learn — curriculum',
  },
  'mcp.tools': {
    minTier: 'free',
    requiresAuth: false,
    description: 'qalaam-mcp server (third-party AI clients)',
    label: 'MCP tools',
  },
  'playback.session.read': {
    minTier: 'free',
    requiresAuth: true,
    description:
      'Read the cross-device playback session — what the user is listening to, where, and on which device. Per-user isolated; no cross-account leakage.',
    label: 'Cross-device playback',
  },
  'playback.session.write': {
    minTier: 'free',
    requiresAuth: true,
    description:
      'Mutate the playback session (play / pause / seek / load / transfer). Auth-required so only the owner can drive their own session.',
    label: 'Control playback across devices',
  },
  'auth.api-keys': {
    minTier: 'premium',
    requiresAuth: true,
    description:
      'Mint and manage API keys for non-browser clients (HA integration, MCP, automations). Premium-tier feature; the resulting Bearer token authenticates as the owner with their tier.',
    label: 'Programmatic API keys',
  },
  'family.members.multiple': {
    minTier: 'premium',
    requiresAuth: true,
    description: 'Add child profiles beyond the auto-Family seat',
    label: 'Multiple family member profiles',
  },
  'family.plans': {
    minTier: 'premium',
    requiresAuth: true,
    description: 'Per-child plan creator + parent dashboard',
    label: 'Per-child plans + parent dashboard',
  },
  'family.mistakes.heatmap': {
    minTier: 'premium',
    requiresAuth: true,
    description: 'Per-page mistake heatmap',
    label: 'Per-page mistake heatmap',
  },
  'family.khatm': {
    minTier: 'premium',
    requiresAuth: true,
    description: 'Multi-user family khatm + wall display',
    label: 'Family khatm + wall display',
  },
  'family.voice-notes': {
    minTier: 'premium',
    requiresAuth: true,
    description: 'Family voice notes + praise stickers',
    label: 'Family voice notes + praise stickers',
  },
  'listen.self-hosted-asr': {
    minTier: 'premium',
    requiresAuth: true,
    description: 'Self-hosted Tarteel-tuned ASR worker',
    label: 'Self-hosted ASR worker',
  },
  'listen.cast.advanced': {
    minTier: 'premium',
    requiresAuth: true,
    description: 'Cast + AirPlay multi-room sync, ambient loop',
    label: 'Cast / AirPlay multi-room',
  },
  'ha.integration': {
    minTier: 'premium',
    requiresAuth: true,
    description: 'HA panel + sensors + services + media-source',
    label: 'Home Assistant integration',
  },
  'ha.url-config': {
    minTier: 'premium',
    requiresAuth: true,
    description: 'Set personal Home Assistant URL in settings',
    label: 'Home Assistant URL in profile',
  },
  'voice.cloning.v2': {
    minTier: 'pro',
    requiresAuth: true,
    description: 'Voice cloning v2 — your reciter, watermarked',
    label: 'Voice cloning v2',
  },
  'voice.cloning.teacher': {
    minTier: 'pro',
    requiresAuth: true,
    description: 'Personal teacher voice clone with consent',
    label: 'Personal teacher voice clone',
  },
  'pro.weekly-review-reports': {
    minTier: 'pro',
    requiresAuth: true,
    description: 'Per-student weekly review reports for halaqah leaders',
    label: 'Weekly review reports',
  },
  'pro.multi-household': {
    minTier: 'pro',
    requiresAuth: true,
    description: 'Up to 30 family members across multiple households',
    label: 'Multi-household (up to 30 members)',
  },
};

// ─── gates ─────────────────────────────────────────────────────────

function readSessionCookie(req: FastifyRequest): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const piece of header.split(';')) {
    const [k, ...rest] = piece.trim().split('=');
    if (k === SESSION_COOKIE_NAME) return rest.join('=');
  }
  return null;
}

/**
 * Outcome of `gateFeature`.
 *
 *   - `{ ok: true,  user: AuthUser }`   authenticated + tier-satisfied
 *   - `{ ok: true,  user: null }`        anonymous, feature allows anon
 *   - `{ ok: false }`                    response already sent (401 or 403)
 *
 * Caller pattern:
 *
 *     const gate = gateFeature(req, reply, 'family.khatm');
 *     if (!gate.ok) return;
 *     const user = gate.user;  // AuthUser | null
 *
 * For premium-tier features `gate.user` is non-null on `gate.ok`.
 * For free features it can be null when the request is anonymous.
 */
export type FeatureGateResult = { ok: true; user: AuthUser | null } | { ok: false; user: null };

export function gateFeature(
  req: FastifyRequest,
  reply: FastifyReply,
  feature: FeatureKey,
): FeatureGateResult {
  const spec = FEATURE_CATALOG[feature];

  // Resolve the request's user from EITHER:
  //   1. The session cookie (browser flow — Qalaam web UI)
  //   2. An `Authorization: Bearer qk_<key>` header (API-key flow —
  //      HA integration, MCP clients, third-party automations).
  // Cookie wins when both are present so a browser session is never
  // demoted by a stale Authorization header from a fetch helper.
  const sessionId = readSessionCookie(req);
  const cookieUser = sessionId ? findUserBySession(sessionId) : null;
  let user = cookieUser;
  if (!user) {
    const authHeader = req.headers.authorization;
    if (authHeader && /^Bearer\s+qk_/i.test(authHeader)) {
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      user = findUserByApiKey(token);
    }
  }

  // Anon path — only allowed when feature is free AND doesn't
  // require auth (e.g. mushaf.read, listen.basic). Anything that
  // scopes to a specific user (bookmarks, hifdh) is requiresAuth=true.
  if (!user) {
    if (spec.minTier === 'free' && !spec.requiresAuth) {
      return { ok: true, user: null };
    }
    void reply.code(401).send({
      code: 'qalaam.feature.auth-required',
      feature,
      featureLabel: spec.label,
      requiredTier: spec.minTier,
    });
    return { ok: false, user: null };
  }

  // Authenticated — verify tier satisfies the feature's minimum.
  if (!tierSatisfies(user.tier, spec.minTier)) {
    void reply.code(403).send({
      code: 'qalaam.feature.tier-required',
      feature,
      featureLabel: spec.label,
      requiredTier: spec.minTier,
      currentTier: user.tier,
    });
    return { ok: false, user: null };
  }

  return { ok: true, user };
}

/**
 * Convenience for routes that always need a user (i.e. every
 * feature row with requiresAuth=true). Returns AuthUser on success
 * and null on 401/403 (response already sent).
 *
 * Equivalent to gateFeature() with a runtime assertion that the
 * feature has requiresAuth=true; for features with requiresAuth=false
 * (anon-allowed) callers must use gateFeature so they can branch
 * on the anon case.
 */
export function requireFeature(
  req: FastifyRequest,
  reply: FastifyReply,
  feature: FeatureKey,
): AuthUser | null {
  const spec = FEATURE_CATALOG[feature];
  if (!spec.requiresAuth) {
    // Programmer error — they should have used gateFeature().
    // Fail loud rather than silently allow anonymous through.
    throw new Error(
      `requireFeature('${feature}') called for a feature that allows anonymous access; use gateFeature() instead`,
    );
  }
  const result = gateFeature(req, reply, feature);
  return result.ok ? result.user : null;
}

// ─── helpers / introspection ───────────────────────────────────────

export function userHasFeature(user: AuthUser | null, feature: FeatureKey): boolean {
  const spec = FEATURE_CATALOG[feature];
  if (!user) {
    return spec.minTier === 'free' && !spec.requiresAuth;
  }
  return tierSatisfies(user.tier, spec.minTier);
}

export function anonymousOrder(): number {
  return ANONYMOUS_ORDER;
}

/**
 * Public catalog snapshot — surfaced via /v1/features so the web
 * client can mirror it without recompiling. Strips the dev-facing
 * `description` field. Customer-voice `label` + machine-readable
 * `minTier` + `requiresAuth` are exposed.
 */
export function publicCatalog(): Record<
  FeatureKey,
  { minTier: Tier; requiresAuth: boolean; label: string }
> {
  const out = {} as Record<FeatureKey, { minTier: Tier; requiresAuth: boolean; label: string }>;
  for (const key of Object.keys(FEATURE_CATALOG) as FeatureKey[]) {
    const spec = FEATURE_CATALOG[key];
    out[key] = { minTier: spec.minTier, requiresAuth: spec.requiresAuth, label: spec.label };
  }
  return out;
}
