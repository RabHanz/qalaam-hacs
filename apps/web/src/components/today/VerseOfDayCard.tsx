/**
 * VerseOfDayCard — the editorial centerpiece of the Today surface.
 *
 * Server-rendered (the verse text is fetched and embedded into the
 * HTML) so the page paints instantly with full Quranic content even
 * with JS disabled — important for SEO and for the user's first
 * impression of "this is a serious mushaf, not a SaaS dashboard."
 *
 * Visual hierarchy:
 *   1. Tiny editorial label up top: "Verse of the day · آيَة اليَوْم"
 *   2. The Arabic verse, large, calm, RTL plaintext-bidi
 *   3. The English translation, italic Fraunces, muted
 *   4. The reference + a single restrained "Open in study" affordance
 *
 * No play button — this is a reading object, not a player. Tapping
 * the card takes you to /study/<verse> where every affordance lives.
 */
import Link from 'next/link';

import { HairlineDivider } from '../Glyph.js';

import type { ReactNode } from 'react';

interface Props {
  readonly verseKey: string;
  readonly title: string;
  readonly arabic: string;
  readonly translation: string | null;
  readonly translatorLabel?: string | null;
}

function parseSurahAyah(verseKey: string): { surah: string; ayah: string } {
  const [s, a] = verseKey.split(':');
  return { surah: s ?? '', ayah: a ?? '' };
}

export function VerseOfDayCard({
  verseKey,
  title,
  arabic,
  translation,
  translatorLabel,
}: Props): ReactNode {
  const { surah, ayah } = parseSurahAyah(verseKey);
  return (
    <article
      className="paper-card-raised relative overflow-hidden p-6 sm:p-10 md:p-12"
      aria-label={`Verse of the day, ${verseKey}`}
    >
      {/* Soft solar bloom in the upper-right — paint-only, no
          transform/filter so it never costs perf. Reduced-motion safe. */}
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-25"
        style={{
          background: 'radial-gradient(circle, var(--color-leaf-300) 0%, transparent 70%)',
        }}
        aria-hidden
      />
      <div className="relative">
        <div className="flex items-baseline justify-between gap-4">
          <p className="smallcaps text-leaf text-[11px] tracking-widest">
            Verse of the day · آيَة اليَوْم
          </p>
          <p className="text-ink-muted font-mono text-[11px] tabular-nums">
            {surah}:{ayah}
          </p>
        </div>

        <p className="text-ink-muted mt-3 text-sm italic leading-relaxed">{title}</p>

        <p
          dir="rtl"
          lang="ar"
          className="font-arabic text-ink-strong mt-8 text-3xl leading-[2] sm:mt-10 sm:text-4xl md:text-5xl md:leading-[1.9]"
          style={{ unicodeBidi: 'plaintext', fontWeight: 600 }}
        >
          {arabic}
        </p>

        {translation ? (
          <p
            className="text-ink/85 mt-6 max-w-prose text-base italic leading-relaxed sm:mt-8 sm:text-lg"
            style={{ fontFamily: 'Fraunces, Georgia, serif' }}
          >
            {translation}
          </p>
        ) : null}

        <HairlineDivider />

        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <p className="smallcaps text-ink-muted text-[10px] tracking-widest">
            {translatorLabel ?? 'Translation'}
          </p>
          <Link
            href={`/study/${surah}/${ayah}`}
            className="smallcaps text-leaf hover:text-leaf-700 group inline-flex items-center gap-2 text-xs tracking-widest"
          >
            Open in study
            <span aria-hidden className="rtl-flip transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </Link>
        </div>
      </div>
    </article>
  );
}
