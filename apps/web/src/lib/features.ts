/**
 * Feature catalog — frontend mirror.
 *
 * Mirrors apps/backend/src/auth/features.ts. The server is the
 * authoritative gate. This mirror is for **UX only** — disabling
 * buttons, surfacing upgrade-CTA copy, and routing 403s into a
 * tier-aware /pricing prompt.
 *
 * Hot reload: the backend exposes /v1/features which returns the
 * authoritative catalog at runtime. We type-pin the keys here so a
 * typo is a compile error, but `loadCatalog()` fetches the live
 * minTier + label so an admin-side flip (#214) propagates without
 * a frontend rebuild.
 *
 * Anti-bypass posture: hiding a button in the UI does NOT prevent a
 * crafted curl call. The server still gates. UX hints are belt-and-
 * suspenders, never security.
 */

// ─── compile-time keys ────────────────────────────────────────────

export type FeatureKey =
  // Free-tier
  | 'mushaf.read'
  | 'mushaf.layouts.standard'
  | 'listen.basic'
  | 'recite-and-check.browser'
  | 'bookmarks'
  | 'hifdh.dashboard.personal'
  // Premium
  | 'family.members.multiple'
  | 'family.plans'
  | 'family.mistakes.heatmap'
  | 'family.khatm'
  | 'family.voice-notes'
  | 'listen.self-hosted-asr'
  | 'listen.cast.advanced'
  | 'ha.integration'
  | 'ha.url-config'
  // Pro
  | 'voice.cloning.v2'
  | 'voice.cloning.teacher'
  | 'pro.weekly-review-reports'
  | 'pro.multi-household';

export type Tier = 'free' | 'premium' | 'pro';

const TIER_ORDER: Record<Tier, number> = {
  free: 0,
  premium: 1,
  pro: 2,
};

export interface FeatureSpec {
  readonly minTier: Tier;
  readonly requiresAuth: boolean;
  readonly label: string;
}

/**
 * Compile-time fallback catalog — used as the initial value before
 * /v1/features loads. The values here are the same as the backend's
 * source-of-truth at the time this file was last updated; if they
 * drift, the runtime fetch corrects the UI.
 */
export const FALLBACK_CATALOG: Record<FeatureKey, FeatureSpec> = {
  'mushaf.read': { minTier: 'free', requiresAuth: false, label: 'Read the Mushaf' },
  'mushaf.layouts.standard': {
    minTier: 'free',
    requiresAuth: false,
    label: 'Standard Mushaf layouts',
  },
  'listen.basic': { minTier: 'free', requiresAuth: false, label: 'Listen with any reciter' },
  'recite-and-check.browser': {
    minTier: 'free',
    requiresAuth: false,
    label: 'Recite-and-check',
  },
  bookmarks: { minTier: 'free', requiresAuth: true, label: 'Bookmarks, highlights, notes' },
  'hifdh.dashboard.personal': {
    minTier: 'free',
    requiresAuth: true,
    label: 'Daily Hifdh dashboard',
  },
  'family.members.multiple': {
    minTier: 'premium',
    requiresAuth: true,
    label: 'Multiple family member profiles',
  },
  'family.plans': {
    minTier: 'premium',
    requiresAuth: true,
    label: 'Per-child plans + parent dashboard',
  },
  'family.mistakes.heatmap': {
    minTier: 'premium',
    requiresAuth: true,
    label: 'Per-page mistake heatmap',
  },
  'family.khatm': {
    minTier: 'premium',
    requiresAuth: true,
    label: 'Family khatm + wall display',
  },
  'family.voice-notes': {
    minTier: 'premium',
    requiresAuth: true,
    label: 'Family voice notes + praise stickers',
  },
  'listen.self-hosted-asr': {
    minTier: 'premium',
    requiresAuth: true,
    label: 'Self-hosted ASR worker',
  },
  'listen.cast.advanced': {
    minTier: 'premium',
    requiresAuth: true,
    label: 'Cast / AirPlay multi-room',
  },
  'ha.integration': {
    minTier: 'premium',
    requiresAuth: true,
    label: 'Home Assistant integration',
  },
  'ha.url-config': {
    minTier: 'premium',
    requiresAuth: true,
    label: 'Home Assistant URL in profile',
  },
  'voice.cloning.v2': { minTier: 'pro', requiresAuth: true, label: 'Voice cloning v2' },
  'voice.cloning.teacher': {
    minTier: 'pro',
    requiresAuth: true,
    label: 'Personal teacher voice clone',
  },
  'pro.weekly-review-reports': {
    minTier: 'pro',
    requiresAuth: true,
    label: 'Weekly review reports',
  },
  'pro.multi-household': {
    minTier: 'pro',
    requiresAuth: true,
    label: 'Multi-household (up to 30 members)',
  },
};

export function tierSatisfies(actual: string | null | undefined, required: Tier): boolean {
  if (!actual) return required === 'free';
  const norm: Tier = actual === 'premium' || actual === 'pro' ? actual : 'free';
  return TIER_ORDER[norm] >= TIER_ORDER[required];
}

/**
 * Computes whether a user (or anonymous visitor) currently has access
 * to a feature, given the live catalog.
 *
 * `userTier`:
 *   - null  → anonymous / signed-out
 *   - 'free' / 'premium' / 'pro' → authenticated
 */
export function userHasFeature(
  feature: FeatureKey,
  userTier: string | null,
  catalog: Record<FeatureKey, FeatureSpec> = FALLBACK_CATALOG,
): boolean {
  const spec = catalog[feature];
  if (!userTier) {
    // Anonymous: feature must be free AND not require auth.
    return spec.minTier === 'free' && !spec.requiresAuth;
  }
  return tierSatisfies(userTier, spec.minTier);
}

/**
 * Pretty-print a tier name for customer-voice copy. Always
 * capitalized; "free" never shown explicitly to avoid implying
 * limitation.
 */
export function tierLabel(tier: Tier): string {
  switch (tier) {
    case 'pro':
      return 'Pro';
    case 'premium':
      return 'Premium';
    default:
      return 'Free';
  }
}
