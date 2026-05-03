/**
 * RecordButton — single button toggling between idle / recording / processing.
 *
 * Per CLAUDE.md design non-negotiables: reduced-motion-aware (the recording
 * pulse degrades to a static glow); aria-pressed for screen readers.
 *
 * The hot path is in the parent (`<FeedbackSession>`) — this component is pure
 * presentational.
 */
import type { ReactNode } from 'react';

import { useReducedMotion } from '@qalaam/ui';

export type RecordingState = 'idle' | 'recording' | 'processing';

export interface RecordButtonProps {
  readonly state: RecordingState;
  readonly onToggle: () => void;
  readonly label?: string;
}

const COLORS: Record<RecordingState, { bg: string; ring: string }> = {
  idle: { bg: 'var(--color-teal-500, #1b4d5a)', ring: 'rgba(27, 77, 90, 0.18)' },
  recording: { bg: 'var(--color-mistake-error, #c0392b)', ring: 'rgba(192, 57, 43, 0.32)' },
  processing: { bg: 'var(--color-gold-500, #b6862c)', ring: 'rgba(182, 134, 44, 0.32)' },
};

export function RecordButton({ state, onToggle, label }: RecordButtonProps): ReactNode {
  const reduced = useReducedMotion();
  const c = COLORS[state];
  const accessibleLabel =
    label ??
    (state === 'idle'
      ? 'Start recording'
      : state === 'recording'
        ? 'Stop recording'
        : 'Processing recording');
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={state === 'processing'}
      aria-pressed={state === 'recording'}
      aria-label={accessibleLabel}
      style={{
        position: 'relative',
        width: '4.5rem',
        height: '4.5rem',
        borderRadius: '999px',
        border: 'none',
        background: c.bg,
        boxShadow: `0 0 0 8px ${c.ring}`,
        cursor: state === 'processing' ? 'not-allowed' : 'pointer',
        transition: 'background-color 220ms cubic-bezier(0.2,0,0,1)',
      }}
    >
      {!reduced && state === 'recording' ? (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '999px',
            border: `2px solid ${c.bg}`,
            animation: 'qalaam-record-pulse 1.4s ease-out infinite',
          }}
        />
      ) : null}
      <span
        aria-hidden="true"
        style={{
          display: 'inline-block',
          width: state === 'recording' ? '1.25rem' : '1.5rem',
          height: state === 'recording' ? '1.25rem' : '1.5rem',
          borderRadius: state === 'recording' ? '0.25rem' : '999px',
          background: '#fff',
        }}
      />
      <style>{`
        @keyframes qalaam-record-pulse {
          0%   { transform: scale(1);    opacity: 0.8; }
          100% { transform: scale(1.6);  opacity: 0; }
        }
      `}</style>
    </button>
  );
}
