/**
 * LessonCard — single-lesson tile with prereq lock state.
 */
import type { ReactNode } from 'react';

import type { Lesson } from '@qalaam/curriculum';
import { Card, Text } from '@qalaam/ui';

export type LessonStatus = 'locked' | 'available' | 'in-progress' | 'completed';

export interface LessonCardProps {
  readonly lesson: Lesson;
  readonly status: LessonStatus;
  readonly href: string;
}

const STATUS_BADGE: Record<LessonStatus, string> = {
  locked: '🔒',
  available: '·',
  'in-progress': '▶',
  completed: '✓',
};

export function LessonCard({ lesson, status, href }: LessonCardProps): ReactNode {
  const interactive = status !== 'locked';
  return (
    <a
      href={interactive ? href : undefined}
      aria-disabled={!interactive || undefined}
      style={{
        textDecoration: 'none',
        color: 'inherit',
        display: 'block',
        cursor: interactive ? 'pointer' : 'not-allowed',
        opacity: status === 'locked' ? 0.55 : 1,
      }}
    >
      <Card
        style={{
          padding: '1rem 1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
          <Text size="caption" tone="muted">
            Lesson {lesson.order.toString()}
          </Text>
          <span aria-label={`Status: ${status}`} style={{ opacity: 0.7 }}>
            {STATUS_BADGE[status]}
          </span>
        </header>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, lineHeight: 1.35 }}>
          {lesson.title.en}
        </h3>
        {lesson.title.ar !== undefined ? (
          <Text size="body" arabic>
            {lesson.title.ar}
          </Text>
        ) : null}
        <footer style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', opacity: 0.7 }}>
          <span>{lesson.estimatedMinutes.toString()} min</span>
          {lesson.tajweedRule !== undefined ? <span>· {lesson.tajweedRule}</span> : null}
          {lesson.kind === 'surah-mastery' ? <span>· surah mastery</span> : null}
        </footer>
      </Card>
    </a>
  );
}
