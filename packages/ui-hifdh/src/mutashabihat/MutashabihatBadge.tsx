/**
 * MutashabihatBadge — surfaces confusion-graph siblings for a portion.
 *
 * The strategy core: O-05 (mutashabihat confusion, opportunity = 14). No
 * competitor surfaces sibling verses inline.
 */
import type { VerseKey } from '@qalaam/core';
import type { ReactNode } from 'react';

export interface MutashabihatBadgeProps {
  readonly siblings: readonly VerseKey[];
  readonly onTapSibling?: (verseKey: VerseKey) => void;
}

export function MutashabihatBadge({ siblings, onTapSibling }: MutashabihatBadgeProps): ReactNode {
  if (siblings.length === 0) return null;
  return (
    <aside
      aria-label="Similar-verse siblings"
      style={{
        marginTop: '0.5rem',
        padding: '0.5rem 0.75rem',
        borderRadius: '0.5rem',
        background: 'rgba(214, 166, 87, 0.12)',
        border: '1px solid rgba(214, 166, 87, 0.4)',
        fontSize: '0.875rem',
      }}
    >
      <strong>Mutashabihat watch:</strong>{' '}
      {siblings.map((s, i) => (
        <span key={s}>
          {onTapSibling ? (
            <button
              type="button"
              onClick={() => onTapSibling(s)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-gold-500, #b6862c)',
                textDecoration: 'underline',
                cursor: 'pointer',
                padding: 0,
                font: 'inherit',
              }}
            >
              {s}
            </button>
          ) : (
            s
          )}
          {i < siblings.length - 1 ? ', ' : ''}
        </span>
      ))}
    </aside>
  );
}
