/**
 * /learn/[level] — list of lessons in a level.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';

import {
  LEVEL_META,
  type CurriculumLevel,
  lessonsByLevel,
  levelDurationMinutes,
} from '@qalaam/curriculum';
import { LessonCard, LevelProgressBar } from '@qalaam/ui-learn';

import { EmptyState } from '../../../components/EmptyState.js';

interface PageProps {
  readonly params: Promise<{ level: string }>;
}

const VALID: ReadonlySet<CurriculumLevel> = new Set([1, 2, 3, 4]);

function isValidLevel(n: number): n is CurriculumLevel {
  return VALID.has(n as CurriculumLevel);
}

export default async function LearnLevelPage({ params }: PageProps): Promise<ReactNode> {
  const { level: raw } = await params;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || !isValidLevel(n)) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <EmptyState title="Unknown level" hint={`Got "${raw}". Levels are 1-4.`} />
      </div>
    );
  }
  const meta = LEVEL_META[n];
  const lessons = lessonsByLevel(n);
  // v0.5 wires per-user completion from /v1/curriculum/progress; v0.1 marks the
  // first lesson "available" and the rest "locked" so the prereq UX is visible.
  const statuses = lessons.map((_, i) => (i === 0 ? 'available' : 'locked')) as (
    | 'available'
    | 'locked'
  )[];
  const minutes = levelDurationMinutes(n);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-12">
      <nav className="text-sm opacity-70">
        <Link href="/learn" className="hover:underline">
          ← All levels
        </Link>
      </nav>
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          Level {n.toString()} — {meta.title}
        </h1>
        <p className="mt-2 max-w-2xl opacity-80">{meta.description}</p>
        <p className="mt-3 text-xs opacity-70">
          {lessons.length.toString()} lessons · ≈ {Math.round(minutes / 60).toString()} hours
        </p>
        <div className="mt-3">
          <LevelProgressBar statuses={statuses} />
        </div>
      </header>
      <section className="grid gap-4 md:grid-cols-2">
        {lessons.map((lesson, i) => (
          <LessonCard
            key={lesson.id}
            lesson={lesson}
            status={statuses[i] ?? 'locked'}
            href={`/learn/${n.toString()}/${lesson.slug}`}
          />
        ))}
      </section>
    </div>
  );
}
