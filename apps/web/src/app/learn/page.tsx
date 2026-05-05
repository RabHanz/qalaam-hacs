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

import { LEVEL_META, lessonsByLevel, levelDurationMinutes } from '@qalaam/curriculum';
import Link from 'next/link';

import { BookGlyph, HairlineDivider, LanternGlyph, RosetteGlyph } from '../../components/Glyph.js';
import { SiteNav } from '../../components/SiteNav.js';

import type { ReactNode } from 'react';

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

      <header className="border-hairline border-b">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex items-center gap-3">
            <LanternGlyph size={20} className="text-leaf" />
            <span className="smallcaps text-leaf text-xs">Learn · تَعَلُّم</span>
          </div>
          <h1 className="font-display text-ink-strong mt-4 text-5xl font-light tracking-tight md:text-6xl">
            Begin at the alphabet,
            <br />
            <span className="text-leaf italic">walk to mastery.</span>
          </h1>
          <p className="text-ink-muted mt-6 max-w-2xl text-base leading-relaxed">
            Four levels, 113 lessons. Each builds on the previous — no skipping ahead, no shortcuts.
            The goal is not completion. The goal is the relationship you grow with the words along
            the way.
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
                  className="paper-card-raised block transition-transform hover:-translate-y-0.5"
                >
                  <div className="grid grid-cols-12 gap-8 p-10 md:p-12">
                    <div className="border-hairline col-span-12 flex items-baseline gap-4 border-b pb-6 md:col-span-3 md:flex-col md:items-start md:gap-2 md:border-b-0 md:border-r md:pb-0 md:pr-8">
                      <p className="smallcaps text-leaf text-xs">Level</p>
                      <p
                        className="font-display text-ink-strong text-7xl font-light tabular-nums tracking-tight md:text-8xl"
                        style={{ lineHeight: 0.85 }}
                      >
                        {level}
                      </p>
                      <p
                        dir="rtl"
                        className="font-arabic text-leaf text-3xl md:text-4xl"
                        style={{ lineHeight: 1, unicodeBidi: 'plaintext' }}
                      >
                        {arabic.ar}
                      </p>
                      <p className="smallcaps text-ink-muted text-xs">{arabic.gloss}</p>
                    </div>

                    <div className="col-span-12 md:col-span-9">
                      <header className="flex flex-wrap items-baseline justify-between gap-4">
                        <h2 className="font-display text-3xl font-medium tracking-tight md:text-4xl">
                          {meta.title}
                        </h2>
                        {meta.isPro ? (
                          <span className="smallcaps text-leaf border-hairline rounded-full border px-3 py-1 text-xs">
                            Pro tier
                          </span>
                        ) : (
                          <span className="smallcaps text-ink-muted text-xs">Free</span>
                        )}
                      </header>
                      <p className="text-ink-muted mt-3 max-w-prose text-base leading-relaxed">
                        {meta.description}
                      </p>

                      <HairlineDivider />

                      <dl className="mt-6 grid grid-cols-3 gap-6">
                        <div>
                          <dt className="smallcaps text-ink-muted text-xs">Lessons</dt>
                          <dd className="font-display text-ink-strong mt-1 text-2xl tabular-nums">
                            {lessons.length.toString()}
                          </dd>
                        </div>
                        <div>
                          <dt className="smallcaps text-ink-muted text-xs">Approx</dt>
                          <dd className="font-display text-ink-strong mt-1 text-2xl tabular-nums">
                            {hours.toString()} h
                          </dd>
                        </div>
                        <div>
                          <dt className="smallcaps text-ink-muted text-xs">In Arabic</dt>
                          <dd
                            dir="rtl"
                            className="font-arabic text-ink-strong mt-1 text-2xl"
                            style={{ lineHeight: 1.2, unicodeBidi: 'plaintext' }}
                          >
                            {arabicNumeral(lessons.length)}
                          </dd>
                        </div>
                      </dl>

                      <p className="text-leaf smallcaps mt-8 inline-flex items-center gap-2 text-sm">
                        <BookGlyph size={14} />
                        Open level {arabicNumeral(level)} →
                      </p>
                    </div>
                  </div>
                </Link>

                {!isLast ? (
                  <div className="relative z-10 -my-2 flex justify-center">
                    <span className="bg-paper rounded-full p-1.5">
                      <RosetteGlyph size={20} className="text-leaf opacity-60" />
                    </span>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      {/* Sister surfaces — grammar primer + topics index, both driven
          by the 128k-row Quranic Arabic Corpus and the topics ingest.
          Surfaced here so the curriculum and the corpus reinforce each other. */}
      <section className="mx-auto mb-12 mt-8 max-w-6xl px-6">
        <p className="smallcaps text-leaf mb-3 text-[11px] tracking-widest">Reference</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link href="/grammar" className="paper-card hover-rise flex flex-col gap-1.5 px-5 py-5">
            <p className="smallcaps text-ink-muted text-[10px] tracking-widest">
              I&apos;rab · إعراب
            </p>
            <p className="font-display text-ink-strong text-lg">Grammar primer</p>
            <p className="text-ink-muted text-sm leading-relaxed">
              Case, mood, parts of speech — applied to every Quranic word via the Quranic Arabic
              Corpus.
            </p>
          </Link>
          <Link href="/topics" className="paper-card hover-rise flex flex-col gap-1.5 px-5 py-5">
            <p className="smallcaps text-ink-muted text-[10px] tracking-widest">
              Themes · مَوَاضِيع
            </p>
            <p className="font-display text-ink-strong text-lg">Topics index</p>
            <p className="text-ink-muted text-sm leading-relaxed">
              Browse the Quran by theme — tawḥīd, ākhirah, family, ethics, and more.
            </p>
          </Link>
        </div>
      </section>

      <footer className="border-hairline mx-auto max-w-6xl border-t px-6 py-12">
        <p className="text-ink-muted max-w-prose text-sm italic leading-relaxed">
          No XP, no streaks for the curriculum, no leaderboards. The order is the lesson — every
          level earns from the previous, and the prerequisite chain ensures the foundation is in
          place before the next stone is set.
        </p>
      </footer>
    </>
  );
}
