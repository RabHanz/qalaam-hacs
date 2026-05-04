/**
 * /learn/[level] — list of lessons in a level.
 *
 * Editorial layout: dense table-of-contents on the right (Arabic letter
 * + small-caps lesson name + duration), running header with level
 * Arabic name + numeral on the left. Locked lessons rendered with leaf
 * lozenge prefix; available lessons get a hairline-bordered hover state.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';

import {
  LEVEL_META,
  type CurriculumLevel,
  lessonsByLevel,
  levelDurationMinutes,
} from '@qalaam/curriculum';

import { EmptyState } from '../../../components/EmptyState.js';
import { LozengeGlyph, RosetteGlyph } from '../../../components/Glyph.js';
import { SiteNav } from '../../../components/SiteNav.js';

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
  return n.toString().split('').map((d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)] ?? d).join('');
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

      <header className="border-b border-hairline">
        <div className="mx-auto flex max-w-6xl items-end justify-between gap-6 px-6 py-12 flex-wrap">
          <div>
            <Link href="/learn" className="smallcaps text-ink-muted text-xs hover:text-leaf">
              ← All levels
            </Link>
            <p className="smallcaps text-leaf text-xs mt-4">Level {arabicNumeral(n)}</p>
            <h1 className="font-display mt-2 text-5xl md:text-6xl font-light tracking-tight text-ink-strong">
              {meta.title}
            </h1>
            <p className="mt-3 max-w-2xl text-base text-ink-muted leading-relaxed">
              {meta.description}
            </p>
            <p className="mt-4 text-xs smallcaps text-ink-muted">
              {lessons.length.toString()} lessons · ≈ {hours.toString()} hours
              {meta.isPro ? ' · Pro tier' : ' · Free'}
            </p>
          </div>
          <div className="text-right">
            <p
              dir="rtl"
              className="font-arabic text-7xl md:text-8xl text-ink-strong"
              style={{ lineHeight: 1, unicodeBidi: 'plaintext' }}
            >
              {LEVEL_ARABIC[n]}
            </p>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <ol className="paper-card-raised divide-y divide-hairline">
          {lessons.map((lesson, i) => {
            const status = statuses[i];
            const available = status === 'available';
            const ar = lesson.title.ar;
            return (
              <li key={lesson.id} className="reveal">
                {available ? (
                  <Link
                    href={`/learn/${n.toString()}/${lesson.slug}`}
                    className="grid grid-cols-12 gap-4 px-6 py-5 md:px-10 md:py-6 hover:bg-paper-100 transition-colors"
                  >
                    <span className="col-span-1 smallcaps text-leaf text-xs tabular-nums self-center">
                      {(i + 1).toString().padStart(2, '0')}
                    </span>
                    <span className="col-span-7 md:col-span-8 self-center">
                      <span className="font-display text-lg md:text-xl text-ink-strong">
                        {lesson.title.en}
                      </span>
                      {lesson.tajweedRule ? (
                        <span className="smallcaps ml-3 text-xs text-leaf">
                          {lesson.tajweedRule}
                        </span>
                      ) : null}
                    </span>
                    <span className="col-span-3 md:col-span-2 self-center text-right">
                      <span className="smallcaps text-ink-muted text-xs">
                        {lesson.estimatedMinutes.toString()} min
                      </span>
                    </span>
                    <span className="col-span-1 self-center text-right">
                      {ar ? (
                        <span
                          dir="rtl"
                          className="font-arabic text-2xl text-ink-strong"
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
                  <div className="grid grid-cols-12 gap-4 px-6 py-5 md:px-10 md:py-6 opacity-50">
                    <span className="col-span-1 smallcaps text-ink-muted text-xs tabular-nums self-center">
                      {(i + 1).toString().padStart(2, '0')}
                    </span>
                    <span className="col-span-7 md:col-span-8 self-center">
                      <LozengeGlyph
                        size={10}
                        className="inline-block text-ink-muted mr-2 align-middle"
                      />
                      <span className="font-display text-lg text-ink">{lesson.title.en}</span>
                    </span>
                    <span className="col-span-3 md:col-span-2 self-center text-right">
                      <span className="smallcaps text-ink-muted text-xs">
                        {lesson.estimatedMinutes.toString()} min
                      </span>
                    </span>
                    <span className="col-span-1 self-center text-right">
                      {ar ? (
                        <span
                          dir="rtl"
                          className="font-arabic text-2xl text-ink-muted"
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

        <p className="mt-8 text-xs text-ink-muted italic max-w-prose">
          Lessons unlock in order. Locked lessons aren't withheld — they're
          waiting for the foundation underneath them. Complete the lesson
          above and the next opens.
        </p>
      </section>
    </>
  );
}
