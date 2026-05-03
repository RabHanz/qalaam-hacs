'use client';

/**
 * Tiny client-side switcher that flips the `?layout=` search param so the
 * RSC reader re-renders against a different mushaf layout (per Phase 17 §17.5).
 *
 * Per CLAUDE.md "build for the foundation, not the demo": we surface only
 * the licensed layouts the backend's /v1/layouts route returns. The full
 * list is filtered server-side by `LICENSE_METADATA.scriptsBySlug`.
 */
import { useRouter, useSearchParams } from 'next/navigation';

import type { ReactNode } from 'react';

const LAYOUT_LABELS: Record<string, string> = {
  madani_15: 'Madani 15-line',
  madani_16: 'Madani 16-line',
  indopak_13: 'Indopak 13-line',
  indopak_15: 'Indopak 15-line',
  indopak_16: 'Indopak 16-line',
  kfgqpc_v4: 'KFGQPC V4',
  nastaleeq_15: 'Nastaleeq',
};

export interface LayoutSwitcherProps {
  readonly availableLayouts: readonly string[];
  readonly currentLayout: string;
}

export function LayoutSwitcher({
  availableLayouts,
  currentLayout,
}: LayoutSwitcherProps): ReactNode {
  const router = useRouter();
  const params = useSearchParams();

  function setLayout(slug: string): void {
    const next = new URLSearchParams(params.toString());
    next.set('layout', slug);
    router.replace(`?${next.toString()}`, { scroll: false });
  }

  return (
    <div
      role="group"
      aria-label="Mushaf layout"
      style={{
        display: 'inline-flex',
        gap: '0.25rem',
        padding: '0.25rem',
        background: 'var(--color-surface-2, rgba(0,0,0,0.04))',
        borderRadius: '999px',
      }}
    >
      {availableLayouts.map((slug) => {
        const isCurrent = slug === currentLayout;
        return (
          <button
            key={slug}
            type="button"
            onClick={() => { setLayout(slug); }}
            aria-pressed={isCurrent}
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: '999px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              fontWeight: isCurrent ? 600 : 400,
              background: isCurrent ? 'var(--color-surface-raised, #fff)' : 'transparent',
              color: 'inherit',
              boxShadow: isCurrent ? '0 1px 2px rgba(16,56,64,0.06)' : 'none',
            }}
          >
            {LAYOUT_LABELS[slug] ?? slug}
          </button>
        );
      })}
    </div>
  );
}
