/**
 * SiteFooter — minimal global footer surfaced on every page via the
 * root layout. Carries the secondary navigation that doesn't belong
 * in the top SiteNav: credits + about + privacy + the QUL upstream
 * link. Editorial register: small-caps, tracked, ink-muted, hairline-
 * separated. No overflow on 375px viewports.
 *
 * Per CLAUDE.md §11.3 + memory `feedback_quranic_authenticity.md`:
 * the credits/attribution link belongs in a single dedicated surface
 * (this footer + the /credits page), never leaked through error paths
 * or in-product copy.
 */
import Link from 'next/link';

import type { ReactNode } from 'react';

const SECONDARY = [
  { href: '/credits', label: 'Credits' },
  { href: '/about', label: 'About' },
  { href: '/topics', label: 'Topics' },
  { href: '/learn', label: 'Learn' },
] as const;

export function SiteFooter(): ReactNode {
  return (
    <footer className="border-hairline bg-paper-100/40 mt-12 border-t">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-4 py-8 sm:flex-row sm:items-center sm:px-6">
        <div className="flex items-baseline gap-3">
          <span
            className="font-arabic text-leaf text-xl"
            dir="rtl"
            lang="ar"
            style={{ lineHeight: 1, unicodeBidi: 'plaintext' }}
          >
            كَلَام
          </span>
          <p className="text-ink-muted text-xs italic leading-snug">
            Built on the{' '}
            <Link
              href="https://qul.tarteel.ai"
              className="text-leaf hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Quranic Universal Library
            </Link>
            {' '}by Tarteel AI.
          </p>
        </div>
        <nav aria-label="Secondary" className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {SECONDARY.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="smallcaps text-ink-muted hover:text-leaf text-[10px] tracking-widest transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
