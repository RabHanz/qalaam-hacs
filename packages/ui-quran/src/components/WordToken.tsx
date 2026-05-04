/**
 * WordToken — a single Arabic word, optionally with WBW gloss popover and tajweed coloring.
 *
 * Per Tarteel UX research §21.4: Qalaam ships per-word tap-to-show glossary
 * (which neither Tarteel nor Quranly does cleanly).
 */
import { TAJWEED_COLORS } from '../tajweed/colors.js';

import type { TajweedRule } from '@qalaam/data-loader';
import type { CSSProperties, ReactNode } from 'react';



export interface WordTokenProps {
  readonly arabic: string;
  /** WBW gloss in the user's chosen language. Shown on tap. */
  readonly gloss?: string | undefined;
  readonly transliteration?: string | undefined;
  /** Per-character tajweed annotations (subset of word's range). */
  readonly tajweedRule?: TajweedRule | undefined;
  readonly isCurrent?: boolean;
  readonly onTap?: (() => void) | undefined;
}

export function WordToken({
  arabic,
  gloss,
  transliteration,
  tajweedRule,
  isCurrent = false,
  onTap,
}: WordTokenProps): ReactNode {
  const style: CSSProperties = {
    display: 'inline-block',
    margin: '0 0.15em',
    color: tajweedRule ? TAJWEED_COLORS[tajweedRule] : undefined,
    background: isCurrent ? 'rgba(214, 166, 87, 0.18)' : undefined, // gold-300 @ 18%
    borderRadius: '0.25rem',
    padding: isCurrent ? '0 0.1em' : undefined,
    cursor: onTap ? 'pointer' : 'inherit',
    transition: 'background-color 120ms cubic-bezier(0.2, 0, 0, 1)',
  };
  const accessibleLabel = transliteration ?? gloss ?? arabic;
  return (
    <span
      role={onTap ? 'button' : undefined}
      tabIndex={onTap ? 0 : undefined}
      aria-label={accessibleLabel}
      title={gloss}
      style={style}
      onClick={onTap}
      onKeyDown={(e) => {
        if (onTap && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onTap();
        }
      }}
    >
      {arabic}
    </span>
  );
}
