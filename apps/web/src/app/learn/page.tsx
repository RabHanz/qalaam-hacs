/**
 * /learn — overview of all four curriculum levels.
 *
 * Per strategy §9.1.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';

import { LEVEL_META, lessonsByLevel, levelDurationMinutes } from '@qalaam/curriculum';

export const metadata = {
  title: 'Learn',
  description: 'Progressive Quranic Arabic curriculum — alphabet to mastery.',
};

const LEVELS = [1, 2, 3, 4] as const;

export default function LearnIndexPage(): ReactNode {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-12">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Learn</h1>
        <p className="mt-2 max-w-2xl opacity-80">
          A progressive Quranic Arabic curriculum. Start at the alphabet, build through
          tajweed, into connected recitation, and toward advanced mastery. Every level
          earns from the previous — no skipping ahead.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        {LEVELS.map((level) => {
          const meta = LEVEL_META[level];
          const lessons = lessonsByLevel(level);
          const minutes = levelDurationMinutes(level);
          const hours = Math.round((minutes / 60) * 10) / 10;
          return (
            <Link
              key={level}
              href={`/learn/${level.toString()}`}
              className="block rounded-2xl border border-[rgba(16,56,64,0.08)] bg-white p-6 transition-shadow hover:shadow-md"
              style={{ background: 'var(--color-surface-raised, #fff)' }}
            >
              <header className="flex items-baseline justify-between">
                <h2 className="text-xl font-semibold">
                  Level {level} — {meta.title}
                </h2>
                {meta.isPro ? (
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{ background: 'rgba(214, 166, 87, 0.18)' }}
                  >
                    Pro
                  </span>
                ) : null}
              </header>
              <p className="mt-2 text-sm opacity-80">{meta.description}</p>
              <footer className="mt-4 text-xs opacity-70">
                {lessons.length.toString()} lessons · ≈ {hours.toString()} hours
              </footer>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
