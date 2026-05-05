/**
 * /learn/[level]/[slug] — single-lesson view.
 *
 * Editorial spread: 8/12 main column with Fraunces lesson title +
 * Arabic glyph + body slot, 4/12 sidebar with prerequisite chain
 * and lesson metadata. Makhraj diagrams render inline; other lessons
 * fall back to a "body coming v0.5" hairline-bordered placeholder.
 */

import { lessonById } from '@qalaam/curriculum';
import { MakhrajDiagram } from '@qalaam/ui-learn';
import Link from 'next/link';

import { EmptyState } from '../../../../components/EmptyState.js';
import { HairlineDivider, LanternGlyph, RosetteGlyph } from '../../../../components/Glyph.js';
import { SiteNav } from '../../../../components/SiteNav.js';

import type { ReactNode } from 'react';

interface PageProps {
  readonly params: Promise<{ level: string; slug: string }>;
}

const LESSON_KIND_LABEL: Record<string, string> = {
  alphabet: 'Alphabet',
  tajweed: 'Tajweed Rule',
  recitation: 'Recitation',
  mastery: 'Mastery',
  makhraj: 'Place of articulation',
};

export default async function LearnLessonPage({ params }: PageProps): Promise<ReactNode> {
  const { level, slug } = await params;
  let lesson;
  try {
    lesson = lessonById(`${level}/${slug}`);
  } catch {
    return (
      <>
        <SiteNav />
        <div className="mx-auto max-w-3xl px-6 py-20">
          <EmptyState
            title="Lesson not found"
            hint={`Got "/learn/${level}/${slug}". Open the level list to find a valid lesson.`}
          />
        </div>
      </>
    );
  }

  const isMakhraj = lesson.slug.startsWith('makhraj-');
  let zone: 'throat' | 'tongue' | 'lips' | 'nasal' | 'all' | undefined;
  if (lesson.slug === 'makhraj-throat') zone = 'throat';
  else if (lesson.slug === 'makhraj-tongue') zone = 'tongue';
  else if (lesson.slug === 'makhraj-lips') zone = 'lips';
  else if (lesson.slug === 'makhraj-nasal') zone = 'nasal';
  else if (isMakhraj) zone = 'all';

  return (
    <>
      <SiteNav />

      <header className="border-hairline border-b">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <Link
            href={`/learn/${level}`}
            className="smallcaps text-ink-muted hover:text-leaf text-xs"
          >
            ← Level {level}
          </Link>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
            <div className="min-w-0 flex-1">
              <p className="smallcaps text-leaf text-xs">
                {LESSON_KIND_LABEL[lesson.kind] ?? lesson.kind} · Lesson{' '}
                {lesson.order.toString().padStart(2, '0')}
              </p>
              <h1 className="font-display text-ink-strong mt-3 text-4xl font-light tracking-tight md:text-5xl">
                {lesson.title.en}
              </h1>
              {lesson.tajweedRule ? (
                <p className="smallcaps text-ink-muted mt-2 text-xs">{lesson.tajweedRule}</p>
              ) : null}
            </div>
            {lesson.title.ar ? (
              <p
                dir="rtl"
                className="font-arabic text-ink-strong text-6xl md:text-7xl"
                style={{ lineHeight: 1, unicodeBidi: 'plaintext' }}
              >
                {lesson.title.ar}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <article className="mx-auto grid max-w-6xl grid-cols-12 gap-10 px-6 py-12">
        <main className="reveal col-span-12 md:col-span-8">
          <div className="paper-card-raised p-10 md:p-14">
            {isMakhraj && zone !== undefined ? (
              <div className="flex justify-center">
                <MakhrajDiagram highlight={zone} />
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-start gap-3">
                  <LanternGlyph size={18} className="text-leaf mt-1 shrink-0" />
                  <p className="smallcaps text-leaf text-xs">Lesson body</p>
                </div>
                <p className="font-display text-ink max-w-prose text-xl leading-relaxed">
                  This lesson's body — Markdown narrative with embedded recitation prompts and
                  mushaf snippets — arrives in v0.5.
                </p>
                <HairlineDivider />
                <p className="text-ink-muted max-w-prose text-sm leading-relaxed">
                  In the meantime, the <span className="text-leaf">prerequisite chain</span> on the
                  right shows where this lesson sits in the path. When you're ready to recite a
                  passage that uses this rule, head to{' '}
                  <Link
                    href={
                      lesson.verseRange
                        ? `/recite/${lesson.verseRange.startVerseKey}`
                        : '/recite/2:255'
                    }
                    className="text-leaf underline-offset-4 hover:underline"
                  >
                    /recite
                  </Link>{' '}
                  for verse-pause practice with live feedback.
                </p>
              </>
            )}
          </div>
        </main>

        <aside className="reveal reveal-2 col-span-12 md:col-span-4">
          <div className="paper-card sticky top-24 p-8">
            <p className="smallcaps text-leaf text-xs">About this lesson</p>
            <dl className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <dt className="smallcaps text-ink-muted text-xs">Duration</dt>
                <dd className="text-ink text-right text-sm tabular-nums">
                  {lesson.estimatedMinutes.toString()} min
                </dd>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <dt className="smallcaps text-ink-muted text-xs">Level</dt>
                <dd className="text-ink text-right text-sm">{lesson.level.toString()}</dd>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <dt className="smallcaps text-ink-muted text-xs">Kind</dt>
                <dd className="text-ink text-right text-sm">
                  {LESSON_KIND_LABEL[lesson.kind] ?? lesson.kind}
                </dd>
              </div>
              {lesson.verseRange ? (
                <div className="grid grid-cols-2 gap-2">
                  <dt className="smallcaps text-ink-muted text-xs">Verse range</dt>
                  <dd className="text-ink text-right text-sm tabular-nums">
                    {lesson.verseRange.startVerseKey} → {lesson.verseRange.endVerseKey}
                  </dd>
                </div>
              ) : null}
            </dl>

            <HairlineDivider />

            <p className="smallcaps text-leaf text-xs">Prerequisites</p>
            {lesson.prerequisiteLessonIds.length === 0 ? (
              <p className="text-ink-muted mt-3 text-sm italic">
                None — this is a starting lesson.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {lesson.prerequisiteLessonIds.map((pid) => (
                  <li key={pid} className="text-ink flex items-start gap-2 text-sm">
                    <RosetteGlyph size={12} className="text-leaf mt-1.5 shrink-0" />
                    <span className="text-ink-muted font-mono text-xs">{pid}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </article>
    </>
  );
}
