/**
 * Tiny locale + RTL helper. Per CLAUDE.md §11.3:
 *  - RTL baseline.
 *  - Bidi-correct mixed Arabic + English via `dir="auto"` and unicode-bidi: plaintext.
 *
 * Intentionally a 30-line stub for v0.1 — `next-intl` is wired in v0.5 (DEV_CHECKLIST.md Phase 5).
 */

export type Locale = 'en' | 'ar' | 'ur' | 'fr' | 'id' | 'tr' | 'ms';
export type Direction = 'ltr' | 'rtl';

const RTL_LOCALES: ReadonlySet<Locale> = new Set(['ar', 'ur']);

export function dirOf(locale: Locale): Direction {
  return RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';
}

export const DEFAULT_LOCALE: Locale = 'en';
