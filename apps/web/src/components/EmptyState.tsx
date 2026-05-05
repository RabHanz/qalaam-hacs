/**
 * Empty state — CLAUDE.md §11.3 non-negotiable.
 *
 * Editorial empty state: centered hairline-rule frame, lozenge glyph,
 * heading in Fraunces, hint in IBM Plex Sans. NOT a Lottie illustration
 * or a giant smiley.
 */
import { LozengeGlyph } from './Glyph.js';

import type { ReactNode } from 'react';

export interface EmptyStateProps {
  readonly icon?: ReactNode;
  readonly title: string;
  readonly hint?: string;
  readonly action?: ReactNode;
}

export function EmptyState({ icon, title, hint, action }: EmptyStateProps): ReactNode {
  return (
    <div
      role="status"
      className="paper-card-raised flex flex-col items-center justify-center gap-4 px-8 py-16 text-center"
    >
      <div aria-hidden className="text-leaf">
        {icon ?? <LozengeGlyph size={20} />}
      </div>
      <h3 className="font-display text-ink text-xl font-light tracking-tight">{title}</h3>
      {hint ? <p className="text-ink-muted max-w-md text-sm leading-relaxed">{hint}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
