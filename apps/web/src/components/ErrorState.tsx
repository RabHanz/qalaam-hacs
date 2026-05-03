/**
 * Error state with recovery action. CLAUDE.md §11.3 non-negotiable.
 * Friendly tone — never blame the user (per Quranly anti-pattern noted in §21.10).
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
      className="flex flex-col items-center gap-3 rounded-[var(--radius-md)] bg-[var(--color-mistake-error)]/10 p-8 text-center"
    >
      <h3 className="text-lg font-semibold text-[var(--color-mistake-error)]">{title}</h3>
      <p className="max-w-md text-sm">{message}</p>
      {recoveryAction ? <div>{recoveryAction}</div> : null}
    </div>
  );
}
