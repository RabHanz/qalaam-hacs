/**
 * /learn — overview of all four curriculum levels.
 *
 * Editorial design language: SiteNav + editorial running header + Fraunces
 * level numerals as oversized display, Arabic level subtitles, hairline
 * rules between sections, paper-card-raised level cells with leaf accent
 * for the active path, gold rosette glyphs for prereq connectors.
 *
 * Per CLAUDE.md adab: no XP/coins/leaderboards. "Pro" tier flagged
 * subtly via small-caps, never shouty. Per strategy §9.1.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';

import { LEVEL_META, lessonsByLevel, levelDurationMinutes } from '@qalaam/curriculum';

import { BookGlyph, HairlineDivider, LanternGlyph, RosetteGlyph } from '../../components/Glyph.js';
import { SiteNav } from '../../components/SiteNav.js';

export const metadata = {
  title: 'Learn · Qalaam',
  description: 'Progressive Quranic Arabic curriculum — alphabet to mastery.',
};

const LEVELS = [1, 2, 3, 4] as const;

const LEVEL_ARABIC: Record<(typeof LEVELS)[number], { ar: string; gloss: string }> = {
  1: { ar: 'حُرُوف', gloss: 'Letters' },
  2: { ar: 'تَجْوِيد', gloss: 'Tajweed' },
  3: { ar: 'تِلَاوَة', gloss: 'Recitation' },
  4: { ar: 'إِتْقَان', gloss: 'Mastery' },
};

function arabicNumeral(n: number): string {
  return n
    .toString()
    .split('')
    .map((d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)] ?? d)
    .join('');
}

export default function LearnIndexPage(): ReactNode {
  return (
    <>
      <SiteNav />

      <header className="border-b border-hairline">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex items-center gap-3">
            <LanternGlyph size={20} className="text-leaf" />
            <span className="smallcaps text-leaf text-xs">Learn · تَعَلُّم</span>
          </div>
          <h1 className="font-display mt-4 text-5xl md:text-6xl font-light tracking-tight text-ink-strong">
            Begin at the alphabet,<br />
            <span className="italic text-leaf">walk to mastery.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base text-ink-muted leading-relaxed">
            Four levels, 113 lessons. Each builds on the previous — no skipping
            ahead, no shortcuts. The goal is not completion. The goal is the
            relationship you grow with the words along the way.
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-10">
          {LEVELS.map((level, idx) => {
            const meta = LEVEL_META[level];
            const lessons = lessonsByLevel(level);
            const arabic = LEVEL_ARABIC[level];
            const minutes = levelDurationMinutes(level);
            const hours = Math.round((minutes / 60) * 10) / 10;
            const isLast = idx === LEVELS.length - 1;

            return (
              <article key={level} className={`reveal reveal-${(idx + 1).toString()} relative`}>
                <Link
                  href={`/learn/${level.toString()}`}
                  className="block paper-card-raised hover:-translate-y-0.5 transition-transform"
                >
                  <div className="grid grid-cols-12 gap-8 p-10 md:p-12">
                    <div className="col-span-12 md:col-span-3 flex md:flex-col items-baseline md:items-start gap-4 md:gap-2 border-b md:border-b-0 md:border-r border-hairline pb-6 md:pb-0 md:pr-8">
                      <p className="smallcaps text-leaf text-xs">Level</p>
                      <p
                        className="font-display text-7xl md:text-8xl font-light tracking-tight text-ink-strong tabular-nums"
                        style={{ lineHeight: 0.85 }}
                      >
                        {level}
                      </p>
                      <p
                        dir="rtl"
                        className="font-arabic text-3xl md:text-4xl text-leaf"
                        style={{ lineHeight: 1, unicodeBidi: 'plaintext' }}
                      >
                        {arabic.ar}
                      </p>
                      <p className="smallcaps text-ink-muted text-xs">{arabic.gloss}</p>
                    </div>

                    <div className="col-span-12 md:col-span-9">
                      <header className="flex items-baseline justify-between gap-4 flex-wrap">
                        <h2 className="font-display text-3xl md:text-4xl font-medium tracking-tight">
                          {meta.title}
                        </h2>
                        {meta.isPro ? (
                          <span className="smallcaps text-leaf text-xs border border-hairline rounded-full px-3 py-1">
                            Pro tier
                          </span>
                        ) : (
                          <span className="smallcaps text-ink-muted text-xs">Free</span>
                        )}
                      </header>
                      <p className="mt-3 text-base text-ink-muted leading-relaxed max-w-prose">
                        {meta.description}
                      </p>

                      <HairlineDivider />

                      <dl className="grid grid-cols-3 gap-6 mt-6">
                        <div>
                          <dt className="smallcaps text-ink-muted text-xs">Lessons</dt>
                          <dd className="font-display text-2xl mt-1 text-ink-strong tabular-nums">
                            {lessons.length.toString()}
                          </dd>
                        </div>
                        <div>
                          <dt className="smallcaps text-ink-muted text-xs">Approx</dt>
                          <dd className="font-display text-2xl mt-1 text-ink-strong tabular-nums">
                            {hours.toString()} h
                          </dd>
                        </div>
                        <div>
                          <dt className="smallcaps text-ink-muted text-xs">In Arabic</dt>
                          <dd
                            dir="rtl"
                            className="font-arabic text-2xl mt-1 text-ink-strong"
                            style={{ lineHeight: 1.2, unicodeBidi: 'plaintext' }}
                          >
                            {arabicNumeral(lessons.length)}
                          </dd>
                        </div>
                      </dl>

                      <p className="mt-8 inline-flex items-center gap-2 text-sm text-leaf smallcaps">
                        <BookGlyph size={14} />
                        Open level {arabicNumeral(level)} →
                      </p>
                    </div>
                  </div>
                </Link>

                {!isLast ? (
                  <div className="flex justify-center -my-2 relative z-10">
                    <span className="bg-paper p-1.5 rounded-full">
                      <RosetteGlyph size={20} className="text-leaf opacity-60" />
                    </span>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-6 py-12 border-t border-hairline">
        <p className="text-sm text-ink-muted leading-relaxed max-w-prose italic">
          No XP, no streaks for the curriculum, no leaderboards. The order is
          the lesson — every level earns from the previous, and the prerequisite
          chain ensures the foundation is in place before the next stone is set.
        </p>
      </footer>
    </>
  );
}
