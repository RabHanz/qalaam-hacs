'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';

import { ErrorState } from '../components/ErrorState.js';

export default function GlobalError({
  error,
  reset,
}: {
  readonly error: Error;
  readonly reset: () => void;
}): ReactNode {
  useEffect(() => {
    // In production this would report to Sentry; v0.1 logs only.
    // eslint-disable-next-line no-console
    console.error('app:error-boundary', error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl p-12">
      <ErrorState
        title="We hit a snag"
        message="Your data is safe. Try again, or return home."
        recoveryAction={
          <button
            type="button"
            onClick={reset}
            className="rounded-[var(--radius-md)] bg-[var(--color-teal-500)] px-5 py-2 text-white"
          >
            Try again
          </button>
        }
      />
    </div>
  );
}
