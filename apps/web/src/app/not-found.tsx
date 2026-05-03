import Link from 'next/link';
import type { ReactNode } from 'react';

import { EmptyState } from '../components/EmptyState.js';

export default function NotFound(): ReactNode {
  return (
    <div className="mx-auto max-w-2xl p-12">
      <EmptyState
        title="Page not found"
        hint="The link you followed may be broken or this page is yet to be built."
        action={
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-teal-500)] px-5 py-2 text-white hover:bg-[var(--color-teal-700)]"
          >
            Return home
          </Link>
        }
      />
    </div>
  );
}
