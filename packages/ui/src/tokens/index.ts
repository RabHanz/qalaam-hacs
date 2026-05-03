/**
 * Qalaam design tokens. Single source of truth — `apps/web/src/styles/tokens.css`
 * is the CSS projection of this module.
 *
 * Per CLAUDE.md §11.3 design non-negotiable: tokens, not ad-hoc values.
 */

export const colors = {
  cream: {
    50: '#fbf9f4',
    100: '#f7f4ee',
    200: '#ece6d8',
  },
  teal: {
    50: '#e8f1f3',
    500: '#1b4d5a',
    700: '#103840',
  },
  gold: {
    300: '#d6a657',
    500: '#b6862c',
  },
  // Tarteel mistake-color vocabulary verbatim — pre-learned visual language (§21.5).
  mistake: {
    error: '#c0392b',
    correct: '#2e7d4f',
    tashkeel: '#c8a536',
    peeked: '#8a6d3b',
  },
} as const;

export const space = {
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  6: '1.5rem',
  8: '2rem',
  12: '3rem',
  16: '4rem',
} as const;

export const radius = {
  sm: '0.5rem',
  md: '1rem',
  lg: '1.5rem',
  pill: '9999px',
} as const;

export const text = {
  display: '2.25rem',
  heading: '1.5rem',
  body: '1rem',
  caption: '0.875rem',
  arabic: '2rem',
  arabicLarge: '2.75rem',
} as const;

export const fonts = {
  sans: "'Inter', system-ui, -apple-system, sans-serif",
  arabicUthmani: "'KFGQPC HAFS Uthmanic Script V2', 'Amiri Quran', serif",
  arabicIndopak: "'IndoPak', 'Scheherazade New', serif",
} as const;

export const motion = {
  fast: 120,
  normal: 220,
  slow: 380,
  easingStandard: 'cubic-bezier(0.2, 0, 0, 1)',
} as const;

export type ColorToken = typeof colors;
export type SpaceToken = keyof typeof space;
export type RadiusToken = keyof typeof radius;
