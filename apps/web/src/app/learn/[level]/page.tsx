/**
 * /learn/[level] — list of lessons in a level.
 *
 * Editorial layout: dense table-of-contents on the right (Arabic letter
 * + small-caps lesson name + duration), running header with level
 * Arabic name + numeral on the left. Locked lessons rendered with leaf
 * lozenge prefix; available lessons get a hairline-bordered hover state.
 */

import {
  lessonsByLevel,
  LEVEL_META,
  levelDurationMinutes,
  type CurriculumLevel,
} from '@qalaam/curriculum';
import Link from 'next/link';

import { EmptyState } from '../../../components/EmptyState.js';
import { LozengeGlyph, RosetteGlyph } from '../../../components/Glyph.js';
import { SiteNav } from '../../../components/SiteNav.js';

import type { ReactNode } from 'react';

interface PageProps {
  readonly params: Promise<{ level: string }>;
}

const VALID: ReadonlySet<CurriculumLevel> = new Set([1, 2, 3, 4]);
function isValidLevel(n: number): n is CurriculumLevel {
  return VALID.has(n as CurriculumLevel);
}

const LEVEL_ARABIC: Record<CurriculumLevel, string> = {
  1: 'حُرُوف',
  2: 'تَجْوِيد',
  3: 'تِلَاوَة',
  4: 'إِتْقَان',
};

function arabicNumeral(n: number): string {
  return n
    .toString()
    .split('')
    .map((d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)] ?? d)
    .join('');
}

export default async function LearnLevelPage({ params }: PageProps): Promise<ReactNode> {
  const { level: raw } = await params;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || !isValidLevel(n)) {
    return (
      <>
        <SiteNav />
        <div className="mx-auto max-w-3xl px-6 py-20">
          <EmptyState title="Unknown level" hint={`Got "${raw}". Levels are 1–4.`} />
        </div>
      </>
    );
  }
  const meta = LEVEL_META[n];
  const lessons = lessonsByLevel(n);
  // v0.5 wires per-user completion via /v1/curriculum/progress; v0.1 unlocks
  // the first lesson and locks the rest so the prereq UX is visible.
  const statuses = lessons.map((_, i) => (i === 0 ? 'available' : 'locked'));
  const minutes = levelDurationMinutes(n);
  const hours = Math.round((minutes / 60) * 10) / 10;

  return (
    <>
      <SiteNav />

      <header className="border-hairline border-b">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-6 px-6 py-12">
          <div>
            <Link href="/learn" className="smallcaps text-ink-muted hover:text-leaf text-xs">
              ← All levels
            </Link>
            <p className="smallcaps text-leaf mt-4 text-xs">Level {arabicNumeral(n)}</p>
            <h1 className="font-display text-ink-strong mt-2 text-5xl font-light tracking-tight md:text-6xl">
              {meta.title}
            </h1>
            <p className="text-ink-muted mt-3 max-w-2xl text-base leading-relaxed">
              {meta.description}
            </p>
            <p className="smallcaps text-ink-muted mt-4 text-xs">
              {lessons.length.toString()} lessons · ≈ {hours.toString()} hours
              {meta.isPro ? ' · Pro tier' : ' · Free'}
            </p>
          </div>
          <div className="text-right">
            <p
              dir="rtl"
              className="font-arabic text-ink-strong text-7xl md:text-8xl"
              style={{ lineHeight: 1, unicodeBidi: 'plaintext' }}
            >
              {LEVEL_ARABIC[n]}
            </p>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <ol className="paper-card-raised divide-hairline divide-y">
          {lessons.map((lesson, i) => {
            const status = statuses[i];
            const available = status === 'available';
            const ar = lesson.title.ar;
            return (
              <li key={lesson.id} className="reveal">
                {available ? (
                  <Link
                    href={`/learn/${n.toString()}/${lesson.slug}`}
                    className="hover:bg-paper-100 grid grid-cols-12 gap-4 px-6 py-5 transition-colors md:px-10 md:py-6"
                  >
                    <span className="smallcaps text-leaf col-span-1 self-center text-xs tabular-nums">
                      {(i + 1).toString().padStart(2, '0')}
                    </span>
                    <span className="col-span-7 self-center md:col-span-8">
                      <span className="font-display text-ink-strong text-lg md:text-xl">
                        {lesson.title.en}
                      </span>
                      {lesson.tajweedRule ? (
                        <span className="smallcaps text-leaf ml-3 text-xs">
                          {lesson.tajweedRule}
                        </span>
                      ) : null}
                    </span>
                    <span className="col-span-3 self-center text-right md:col-span-2">
                      <span className="smallcaps text-ink-muted text-xs">
                        {lesson.estimatedMinutes.toString()} min
                      </span>
                    </span>
                    <span className="col-span-1 self-center text-right">
                      {ar ? (
                        <span
                          dir="rtl"
                          className="font-arabic text-ink-strong text-2xl"
                          style={{ lineHeight: 1, unicodeBidi: 'plaintext' }}
                        >
                          {ar}
                        </span>
                      ) : (
                        <RosetteGlyph size={18} className="text-leaf inline-block" />
                      )}
                    </span>
                  </Link>
                ) : (
                  <div className="grid grid-cols-12 gap-4 px-6 py-5 opacity-50 md:px-10 md:py-6">
                    <span className="smallcaps text-ink-muted col-span-1 self-center text-xs tabular-nums">
                      {(i + 1).toString().padStart(2, '0')}
                    </span>
                    <span className="col-span-7 self-center md:col-span-8">
                      <LozengeGlyph
                        size={10}
                        className="text-ink-muted mr-2 inline-block align-middle"
                      />
                      <span className="font-display text-ink text-lg">{lesson.title.en}</span>
                    </span>
                    <span className="col-span-3 self-center text-right md:col-span-2">
                      <span className="smallcaps text-ink-muted text-xs">
                        {lesson.estimatedMinutes.toString()} min
                      </span>
                    </span>
                    <span className="col-span-1 self-center text-right">
                      {ar ? (
                        <span
                          dir="rtl"
                          className="font-arabic text-ink-muted text-2xl"
                          style={{ lineHeight: 1, unicodeBidi: 'plaintext' }}
                        >
                          {ar}
                        </span>
                      ) : null}
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        <p className="text-ink-muted mt-8 max-w-prose text-xs italic">
          Lessons unlock in order. Locked lessons aren't withheld — they're waiting for the
          foundation underneath them. Complete the lesson above and the next opens.
        </p>
      </section>
    </>
  );
}
