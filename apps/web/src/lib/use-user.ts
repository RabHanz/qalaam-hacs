'use client';

/**
 * useUser — React hook + module-level cache for the current Qalaam
 * authenticated user.
 *
 * Single source of truth for "who am I right now" across the whole
 * web app. Backed by /v1/auth/me. The first hook mount fires the
 * fetch; subsequent mounts read from the in-memory cache. A
 * `qalaam:auth-changed` window event invalidates the cache so
 * sign-in / sign-out / sign-up redraw every consumer simultaneously.
 *
 * Status states:
 *   'loading'        — fetch in flight, no cached value yet
 *   'authenticated'  — user is signed in, payload available
 *   'anonymous'      — fetch returned 401, no user
 */
import { useCallback, useEffect, useState } from 'react';

import { resolveApiBase } from './api-base.js';
import { userHasFeature, type FeatureKey } from './features.js';

export interface QalaamUser {
  readonly id: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly tier: string;
  readonly isMinor: boolean;
  readonly haUrl: string | null;
}

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthState {
  status: AuthStatus;
  user: QalaamUser | null;
}

let cache: AuthState = { status: 'loading', user: null };
let inflight: Promise<AuthState> | null = null;
const subscribers = new Set<() => void>();

function notify(): void {
  for (const cb of subscribers) cb();
}

async function fetchMe(): Promise<AuthState> {
  if (inflight) return inflight;
  inflight = (async (): Promise<AuthState> => {
    try {
      const res = await fetch(`${resolveApiBase()}/v1/auth/me`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (res.status === 401) {
        cache = { status: 'anonymous', user: null };
      } else if (res.ok) {
        const body = (await res.json()) as { user: QalaamUser };
        cache = { status: 'authenticated', user: body.user };
      } else {
        // 5xx — leave the cache where it was. Better to keep showing
        // the last-known state than to flap to anonymous.
      }
    } catch {
      // Network error — same reasoning as 5xx.
    } finally {
      inflight = null;
      notify();
    }
    return cache;
  })();
  return inflight;
}

if (typeof window !== 'undefined') {
  window.addEventListener('qalaam:auth-changed', () => {
    void fetchMe();
  });
}

export function useUser(): {
  status: AuthStatus;
  user: QalaamUser | null;
  refresh: () => Promise<void>;
  /**
   * Local UX hint — does the current user (or anonymous visitor) have
   * access to a feature? Mirrors the backend's userHasFeature().
   *
   * NEVER use this for security gating. The backend is the gate.
   * Anything we hide via hasFeature() can be re-fetched with a
   * crafted curl call; the server still returns 401 / 403 with
   * `qalaam.feature.tier-required` and the requiredTier.
   */
  hasFeature: (feature: FeatureKey) => boolean;
} {
  const [, setVersion] = useState(0);
  useEffect(() => {
    const cb = (): void => {
      setVersion((v) => v + 1);
    };
    subscribers.add(cb);
    if (cache.status === 'loading') void fetchMe();
    return (): void => {
      subscribers.delete(cb);
    };
  }, []);
  const refresh = useCallback(async (): Promise<void> => {
    cache = { status: 'loading', user: null };
    await fetchMe();
  }, []);
  const hasFeature = useCallback(
    (feature: FeatureKey): boolean => {
      // While the /v1/auth/me fetch is in flight we treat the visitor
      // as anonymous — UX hides the gated affordance until we know
      // for sure. This is "fail closed" for premium features.
      const tier = cache.status === 'authenticated' ? (cache.user?.tier ?? null) : null;
      return userHasFeature(feature, tier);
    },
    // cache is module-scope, but listen to setVersion bumps via the
    // subscribe-on-mount above so re-render picks up the latest tier.
    [],
  );
  return { status: cache.status, user: cache.user, refresh, hasFeature };
}

/** Force-invalidate the cache after a mutation (signin / signout / signup). */
export function invalidateUserCache(): void {
  cache = { status: 'loading', user: null };
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('qalaam:auth-changed'));
  }
}
