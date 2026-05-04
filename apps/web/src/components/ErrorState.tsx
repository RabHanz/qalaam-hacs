/**
 * Error state with recovery action. CLAUDE.md §11.3 non-negotiable.
 *
 * Friendly tone — never blame the user (per Quranly anti-pattern noted
 * in `reference_competitive_ux.md`). Editorial style: cream card with
 * a left rule in the mistake-red, but the body type stays calm.
 */
import type { ReactNode } from 'react';

export interface ErrorStateProps {
  readonly title?: string;
  readonly message?: string;
  readonly recoveryAction?: ReactNode;
}

export function ErrorState({
  title = 'Something went wrong',
  message = "Don't worry — your progress is safe. Try again in a moment.",
  recoveryAction,
}: ErrorStateProps): ReactNode {
  return (
    <div
      role="alert"
      className="paper-card-raised flex flex-col items-start gap-3 px-8 py-10 border-l-4"
      style={{ borderLeftColor: 'var(--color-mistake-error)' }}
    >
      <h3
        className="font-display text-xl font-light tracking-tight"
        style={{ color: 'var(--color-mistake-error)' }}
      >
        {title}
      </h3>
      <p className="max-w-prose text-sm leading-relaxed text-ink">{message}</p>
      {recoveryAction ? <div className="mt-2">{recoveryAction}</div> : null}
    </div>
  );
}
