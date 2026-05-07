/**
 * EditorialErrorPage — shared shell for /not-found, /error, and any
 * future status-page surface. Treats the page like a small editorial
 * artifact, NOT a 1990s "Oops!" with a broken-link icon.
 *
 * Composition:
 *   - SiteNav stays at the top so the user can leave
 *   - Centered column, generous whitespace
 *   - Smallcaps status tag (e.g. "404 · ضَلَال", "500 · مَشَقَّة")
 *   - A single relevant verse — large Naskh Arabic, RTL, calm
 *   - English translation in italic Fraunces, muted
 *   - Surah:ayah reference in mono tabular-nums smallcaps
 *   - Hairline divider
 *   - One short body line in customer voice ("This page isn't here…")
 *   - Two restrained CTAs: home + the 114-surah index
 *
 * Reduced-motion safe (no animation). Mobile-first.
 */
import Link from 'next/link';

import { HairlineDivider } from './Glyph.js';
import { SiteNav } from './SiteNav.js';

import type { ReactNode } from 'react';

interface Props {
  readonly tag: string;
  readonly arabicTag: string;
  readonly arabic: string;
  readonly translation: string;
  readonly reference: string;
  readonly body: string;
  /**
   * Optional secondary CTA. The primary is always "Return home";
   * the secondary defaults to "The 114 surahs" (anchors to the
   * index on /). Pass `null` to hide it.
   */
  readonly secondary?: { href: string; label: string } | null;
}

export function EditorialErrorPage({
  tag,
  arabicTag,
  arabic,
  translation,
  reference,
  body,
  secondary = { href: '/#index', label: 'Open the 114 surahs' },
}: Props): ReactNode {
  return (
    <>
      <SiteNav />
      <main className="mx-auto flex max-w-2xl flex-col items-center px-6 py-20 text-center sm:py-32">
        <p className="smallcaps text-leaf flex items-baseline gap-3 text-[10px] tracking-widest">
          <span>{tag}</span>
          <span className="text-ink-muted opacity-50">·</span>
          <span dir="rtl" lang="ar" className="font-arabic text-sm tracking-normal">
            {arabicTag}
          </span>
        </p>

        <p
          dir="rtl"
          lang="ar"
          className="font-arabic text-ink-strong mt-10 text-3xl leading-[2] sm:mt-12 sm:text-4xl md:text-5xl md:leading-[1.9]"
          style={{ unicodeBidi: 'plaintext', fontWeight: 600 }}
        >
          {arabic}
        </p>

        <p
          className="text-ink/85 mt-6 max-w-prose text-base italic leading-relaxed sm:mt-8 sm:text-lg"
          style={{ fontFamily: 'Fraunces, Georgia, serif' }}
        >
          {translation}
        </p>

        <p className="smallcaps text-ink-muted mt-3 font-mono text-[11px] tracking-widest">
          {reference}
        </p>

        <div className="my-10 w-32 sm:my-14">
          <HairlineDivider />
        </div>

        <p className="text-ink-muted max-w-prose text-sm leading-relaxed sm:text-base">{body}</p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4 sm:mt-10">
          <Link
            href="/"
            className="bg-ink hover:bg-ink-strong text-paper group inline-flex items-center gap-2 rounded-sm px-6 py-3 transition-colors sm:px-7 sm:py-3.5"
          >
            <span className="text-sm font-medium sm:text-base">Return home</span>
            <span
              aria-hidden
              className="text-leaf-soft rtl-flip transition-transform group-hover:translate-x-0.5"
            >
              →
            </span>
          </Link>
          {secondary ? (
            <Link
              href={secondary.href}
              className="smallcaps text-ink-muted hover:text-leaf text-xs underline-offset-4 hover:underline sm:text-sm"
            >
              {secondary.label}
            </Link>
          ) : null}
        </div>
      </main>
    </>
  );
}
