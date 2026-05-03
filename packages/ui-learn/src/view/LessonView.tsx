/**
 * LessonView — single-lesson content view.
 *
 * v0.5 wires lesson body content from Markdown stored in `data/lessons/`. v0.1
 * shows a structured skeleton: title, hint, and a "Mark complete" CTA.
 */
import type { ReactNode } from 'react';

import type { Lesson } from '@qalaam/curriculum';
import { Card, Heading, Text } from '@qalaam/ui';

export interface LessonViewProps {
  readonly lesson: Lesson;
  readonly onMarkComplete?: () => void;
  readonly children?: ReactNode;
}

export function LessonView({ lesson, onMarkComplete, children }: LessonViewProps): ReactNode {
  return (
    <article style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <header>
        <Text size="caption" tone="muted">
          Level {lesson.level.toString()} · Lesson {lesson.order.toString()} · {lesson.estimatedMinutes.toString()} min
        </Text>
        <Heading level={1} style={{ marginTop: '0.5rem' }}>
          {lesson.title.en}
        </Heading>
        {lesson.title.ar !== undefined ? (
          <Text arabic style={{ display: 'block', marginTop: '0.5rem' }}>
            {lesson.title.ar}
          </Text>
        ) : null}
      </header>
      <Card>
        {children ?? (
          <Text size="body" tone="muted">
            Lesson content will appear here. v0.5 wires Markdown bodies + audio prompts.
          </Text>
        )}
      </Card>
      {onMarkComplete ? (
        <button
          type="button"
          onClick={onMarkComplete}
          style={{
            alignSelf: 'flex-start',
            padding: '0.625rem 1.25rem',
            background: 'var(--color-teal-500, #1b4d5a)',
            color: '#fff',
            border: 'none',
            borderRadius: '0.625rem',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          Mark complete
        </button>
      ) : null}
    </article>
  );
}
