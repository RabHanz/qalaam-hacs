'use client';

/**
 * Hooks shared across primitives.
 *
 * `useReducedMotion` is the gate for every animation we ship — per CLAUDE.md §11.3.
 */
import { useEffect, useSyncExternalStore } from 'react';

function subscribeMedia(query: string) {
  return (callback: () => void): (() => void) => {
    if (typeof window === 'undefined') return () => undefined;
    const mql = window.matchMedia(query);
    mql.addEventListener('change', callback);
    return () => { mql.removeEventListener('change', callback); };
  };
}

function getMediaSnapshot(query: string) {
  return (): boolean => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  };
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeMedia('(prefers-reduced-motion: reduce)'),
    getMediaSnapshot('(prefers-reduced-motion: reduce)'),
    () => false,
  );
}

export function usePrefersDarkMode(): boolean {
  return useSyncExternalStore(
    subscribeMedia('(prefers-color-scheme: dark)'),
    getMediaSnapshot('(prefers-color-scheme: dark)'),
    () => false,
  );
}

/** Returns the `dir` of the closest enclosing element with `dir` set. SSR-safe. */
export function useDirection(): 'ltr' | 'rtl' {
  // For SSR hydration, default to ltr; client-side correction happens after mount.
  // A more precise implementation would walk the DOM; we use the documentElement
  // attribute which Next sets via the root <html dir="...">.
  if (typeof document === 'undefined') return 'ltr';
  const dir = document.documentElement.getAttribute('dir');
  return dir === 'rtl' ? 'rtl' : 'ltr';
}

/** Cleanup helper — runs the supplied effect once, on mount. */
type EffectFn = () => undefined | (() => void);
export function useEffectOnce(effect: EffectFn): void {
   
  useEffect(effect, []);
}
