/**
 * LevelProgressBar — one segment per lesson, painted by completion state.
 */
import type { ReactNode } from 'react';

import type { LessonStatus } from '../cards/LessonCard.js';

export interface LevelProgressBarProps {
  readonly statuses: readonly LessonStatus[];
}

const COLOR: Record<LessonStatus, string> = {
  locked: 'rgba(16, 56, 64, 0.12)',
  available: 'rgba(27, 77, 90, 0.35)',
  'in-progress': 'var(--color-gold-500, #b6862c)',
  completed: 'var(--color-mistake-correct, #2e7d4f)',
};

export function LevelProgressBar({ statuses }: LevelProgressBarProps): ReactNode {
  const completed = statuses.filter((s) => s === 'completed').length;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={statuses.length}
      aria-valuenow={completed}
      style={{
        display: 'flex',
        gap: '2px',
        height: '6px',
        borderRadius: '3px',
        overflow: 'hidden',
        background: 'rgba(16, 56, 64, 0.06)',
      }}
    >
      {statuses.map((s, i) => (
        <span
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          aria-hidden="true"
          style={{ flex: 1, background: COLOR[s] }}
        />
      ))}
    </div>
  );
}
