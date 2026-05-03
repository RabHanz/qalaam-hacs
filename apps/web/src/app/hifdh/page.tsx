/**
 * /hifdh — family-private daily Hifdh dashboard.
 *
 * Per CLAUDE.md §11.3 design non-negotiables: empty / loading / error states.
 * Per strategy §7.4 + §21.10: daily summary only — no real-time alerts.
 */
import { Suspense } from 'react';
import type { ReactNode } from 'react';

import { EmptyState } from '../../components/EmptyState.js';
import { LoadingState } from '../../components/LoadingState.js';

export const metadata = {
  title: 'Hifdh — Family',
  description: 'Daily Hifdh summary. Family-private — never shared.',
};

async function HifdhContent(): Promise<ReactNode> {
  // v0.5: load real session via qalaamClient. v0.1 stub.
  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <article
        style={{
          background: 'var(--color-surface-raised, #fff)',
          borderRadius: '1rem',
          padding: '1.5rem',
          boxShadow: '0 1px 2px rgba(16,56,64,0.06)',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Today</h2>
        <p style={{ marginTop: '0.5rem', opacity: 0.85 }}>
          Today's session will assemble sabaq + sabqi + manzil portions when you create your first Hifdh plan.
        </p>
      </article>
      <EmptyState
        title="No Hifdh plan yet"
        hint="Create a plan with a Range, Portion, and Schedule (Tarteel-borrowed trichotomy per §21.5). The 80/20 revision-vs-new rule keeps retention high."
      />
    </div>
  );
}

export default function HifdhPage(): ReactNode {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-12">
      <header>
        <h1 className="text-2xl font-semibold">Hifdh</h1>
        <p className="text-sm opacity-70">Daily summary. Family-private — never shared.</p>
      </header>
      <Suspense fallback={<LoadingState label="Loading Hifdh state…" lines={6} />}>
        {/* @ts-expect-error: server-component async */}
        <HifdhContent />
      </Suspense>
    </div>
  );
}
