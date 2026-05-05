'use client';

/**
 * Layout switcher — pill segmented control. RSC-friendly: flips the
 * `?layout=` search param so the reader re-renders against a different
 * mushaf layout (per Phase 17 §17.5).
 *
 * Visually: small-caps labels, horizontal pill row, gold underline on
 * the active layout. Restrained, not chunky toggle-buttons.
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
      className="inline-flex flex-wrap items-center gap-1"
    >
      <span className="smallcaps text-leaf mr-3 text-xs">Layout</span>
      {availableLayouts.map((slug) => {
        const isCurrent = slug === currentLayout;
        return (
          <button
            key={slug}
            type="button"
            onClick={() => {
              setLayout(slug);
            }}
            aria-pressed={isCurrent}
            className={`smallcaps rounded-sm px-3 py-1.5 text-xs transition-colors ${
              isCurrent ? 'bg-ink text-paper' : 'text-ink-muted hover:bg-paper-100 hover:text-ink'
            }`}
          >
            {LAYOUT_LABELS[slug] ?? slug}
          </button>
        );
      })}
    </div>
  );
}
