'use client';

/**
 * OrientationCard — first-time "First steps" surface in the Today
 * right rail.
 *
 * Visible when BOTH are true:
 *   1. The canonical playback store has no last-played verse
 *      (qalaam-verse-key is empty).
 *   2. The user hasn't explicitly dismissed it
 *      (qalaam-orientation-dismissed is empty).
 *
 * Once the user takes any of the three pillar actions (listen,
 * memorize, family) — or explicitly dismisses — the card stays
 * hidden across sessions. Returning to "no playback + no plan"
 * does NOT re-show it; if they wiped their state, the dismissal
 * stays set, which is the right default for a power user.
 *
 * Aesthetic: a miniature mushaf table of contents. Three steps
 * stacked vertically, connected by a single hairline rule on the
 * left. Each step has a Glyph + smallcaps label + Fraunces display
 * title + short Arabic caption + thin lead-in. Restrained — this is
 * NOT a wizard, it's a TOC.
 */
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { dismissOrientation, shouldShowOrientation } from '../../lib/orientation-state.js';
import { BookGlyph, CrescentGlyph, ThreadGlyph } from '../Glyph.js';

import type { ReactNode } from 'react';

interface Step {
  href: string;
  label: string;
  title: string;
  arabic: string;
  caption: string;
  Icon: typeof BookGlyph;
  delay: 1 | 2 | 3 | 4 | 5;
}

const STEPS: readonly Step[] = [
  {
    href: '/listen',
    label: 'Listen',
    arabic: 'إِسْتِمَاع',
    title: 'Pick a reciter',
    caption: 'Stream any of fifty reciters to your phone, your speakers, or your TV.',
    Icon: CrescentGlyph,
    delay: 1,
  },
  {
    href: '/hifdh',
    label: 'Memorize',
    arabic: 'حِفْظ',
    title: 'Begin a Hifdh plan',
    caption: 'Sabaq + sabqi + manzil with FSRS-6 spacing — for you, your child, your circle.',
    Icon: ThreadGlyph,
    delay: 2,
  },
  {
    href: '/family',
    label: 'Family',
    arabic: 'عَائِلَة',
    title: 'Invite the household',
    caption: 'Khatm wall, parent dashboard, voice notes — family-private, never gamified.',
    Icon: BookGlyph,
    delay: 3,
  },
];

interface Props {
  /** Force visibility for design review (URL ?orientation=1). */
  readonly forceShow?: boolean;
}

export function OrientationCard({ forceShow = false }: Props): ReactNode {
  const [show, setShow] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    setShow(shouldShowOrientation(forceShow));
  }, [forceShow]);

  function dismiss(): void {
    dismissOrientation();
    setShow(false);
  }

  if (!hydrated || !show) return null;

  return (
    <article
      className="paper-card-raised relative overflow-hidden p-5 sm:p-6"
      aria-label="First steps for new accounts"
    >
      <header className="flex items-baseline justify-between gap-3">
        <p className="smallcaps text-leaf text-[10px] tracking-widest">
          First steps · أَوَّل خُطْوَة
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="text-ink-muted hover:text-ink-strong text-xs"
        >
          ×
        </button>
      </header>

      <p className="text-ink-muted mt-3 text-xs leading-relaxed">
        Three small openings into Qalaam. Pick whichever feels closest to where you are.
      </p>

      <ol
        className="relative mt-4 space-y-1"
        // The hairline rule down the left, anchored to the icons.
        // Drawn as a thin vertical line via background-gradient so it
        // works in both themes without an extra DOM node per row.
        style={{
          backgroundImage:
            'linear-gradient(to bottom, transparent 0, transparent 18px, var(--color-hairline) 18px, var(--color-hairline) calc(100% - 18px), transparent calc(100% - 18px))',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: '13px 0',
          backgroundSize: '1px 100%',
        }}
      >
        {STEPS.map((step) => (
          <li key={step.href} className={`reveal reveal-${step.delay.toString()} relative`}>
            <Link
              href={step.href}
              className="hover:bg-paper-100/60 group flex items-start gap-4 rounded-md px-1 py-3 transition-colors"
            >
              <span
                aria-hidden
                className="bg-paper border-hairline group-hover:border-leaf/40 group-hover:text-leaf inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors"
              >
                <step.Icon size={14} className="text-ink-muted group-hover:text-leaf" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-baseline justify-between gap-2">
                  <span className="smallcaps text-leaf text-[10px] tracking-widest">
                    {step.label}
                  </span>
                  <span
                    dir="rtl"
                    lang="ar"
                    className="font-arabic text-ink-muted text-xs"
                    style={{ unicodeBidi: 'plaintext' }}
                  >
                    {step.arabic}
                  </span>
                </p>
                <p className="font-display text-ink-strong group-hover:text-leaf-700 mt-0.5 text-base font-light leading-tight tracking-tight transition-colors">
                  {step.title}
                </p>
                <p className="text-ink-muted mt-1 text-[12px] leading-relaxed">{step.caption}</p>
              </div>
              <span
                aria-hidden
                className="text-ink-muted group-hover:text-leaf rtl-flip mt-3 shrink-0 text-sm transition-colors"
              >
                →
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </article>
  );
}
