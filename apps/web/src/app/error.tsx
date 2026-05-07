'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import { HairlineDivider } from '../components/Glyph.js';
import { SiteNav } from '../components/SiteNav.js';

import type { ReactNode } from 'react';

/**
 * Global error boundary — when a client throws and React unmounts
 * the failing tree, this is what the user sees. Composed in the
 * same editorial register as /not-found, but with a different
 * verse: ash-Sharḥ 94:5–6 ("with hardship comes ease") + a "Try
 * again" affordance that calls reset() before the generic links.
 *
 * NOT using EditorialErrorPage directly because the "Try again"
 * button is unique to this surface — the user can recover in place
 * without a navigation, which is what the error boundary's reset()
 * is for. Otherwise the visual register matches.
 */
export default function GlobalError({
  error,
  reset,
}: {
  readonly error: Error;
  readonly reset: () => void;
}): ReactNode {
  useEffect(() => {
    // Production error monitoring will hook in here (Sentry is on
    // the deferred list per the production rules).
    console.error('app:error-boundary', error);
  }, [error]);

  return (
    <>
      <SiteNav />
      <main className="mx-auto flex max-w-2xl flex-col items-center px-6 py-20 text-center sm:py-32">
        <p className="smallcaps text-leaf flex items-baseline gap-3 text-[10px] tracking-widest">
          <span>500 · we hit a snag</span>
          <span className="text-ink-muted opacity-50">·</span>
          <span dir="rtl" lang="ar" className="font-arabic text-sm tracking-normal">
            مَشَقَّة
          </span>
        </p>

        <p
          dir="rtl"
          lang="ar"
          className="font-arabic text-ink-strong mt-10 text-3xl leading-[2] sm:mt-12 sm:text-4xl md:text-5xl md:leading-[1.9]"
          style={{ unicodeBidi: 'plaintext', fontWeight: 600 }}
        >
          فَإِنَّ مَعَ ٱلْعُسْرِ يُسْرًا · إِنَّ مَعَ ٱلْعُسْرِ يُسْرًا
        </p>

        <p
          className="text-ink/85 mt-6 max-w-prose text-base italic leading-relaxed sm:mt-8 sm:text-lg"
          style={{ fontFamily: 'Fraunces, Georgia, serif' }}
        >
          So, surely with hardship comes ease. Surely with hardship comes ease.
        </p>

        <p className="smallcaps text-ink-muted mt-3 font-mono text-[11px] tracking-widest">
          Sūrat ash-Sharḥ · 94:5–6
        </p>

        <div className="my-10 w-32 sm:my-14">
          <HairlineDivider />
        </div>

        <p className="text-ink-muted max-w-prose text-sm leading-relaxed sm:text-base">
          Something on this page didn’t load right. Your data is safe. Try once more, or step back
          home.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4 sm:mt-10">
          <button
            type="button"
            onClick={reset}
            className="bg-ink hover:bg-ink-strong text-paper group inline-flex items-center gap-2 rounded-sm px-6 py-3 transition-colors sm:px-7 sm:py-3.5"
          >
            <span className="text-sm font-medium sm:text-base">Try again</span>
            <span
              aria-hidden
              className="text-leaf-soft rtl-flip transition-transform group-hover:translate-x-0.5"
            >
              →
            </span>
          </button>
          <Link
            href="/"
            className="smallcaps text-ink-muted hover:text-leaf text-xs underline-offset-4 hover:underline sm:text-sm"
          >
            Return home
          </Link>
        </div>
      </main>
    </>
  );
}
