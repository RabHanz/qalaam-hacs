/**
 * Empty state — CLAUDE.md §11.3 non-negotiable.
 * Every async surface MUST ship empty / loading / error states.
 */
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
      className="flex flex-col items-center justify-center gap-3 rounded-[var(--radius-md)] bg-[var(--color-surface-raised)] p-12 text-center"
      role="status"
    >
      {icon ? <div aria-hidden="true">{icon}</div> : null}
      <h3 className="text-lg font-medium">{title}</h3>
      {hint ? <p className="max-w-md text-sm opacity-70">{hint}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
