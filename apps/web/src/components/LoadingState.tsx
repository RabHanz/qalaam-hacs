/**
 * Loading state. Skeleton, not spinner (per CLAUDE.md §11.3).
 */
import type { ReactNode } from 'react';

export interface LoadingStateProps {
  readonly label: string;
  readonly lines?: number;
}

export function LoadingState({ label, lines = 3 }: LoadingStateProps): ReactNode {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="flex flex-col gap-3 p-6">
      <span className="sr-only">{label}</span>
      {Array.from({ length: lines }).map((_, i) => (
        // Index keys are fine here: skeletons are positionally identified.
        // eslint-disable-next-line react/no-array-index-key
        <div key={i} className="skeleton h-4 w-full" />
      ))}
    </div>
  );
}
