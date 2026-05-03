/**
 * RatingTrigger — one-tap (fluency × accuracy) rating.
 *
 * Per strategy §7.4: the parent / self / teacher rating UI must be one-tap
 * with ≤100ms p95 latency. The 4×4 grid here is the entire input surface.
 *
 * Per CLAUDE.md §11.3: keyboard-navigable with explicit aria labels.
 */
import { Card, Heading, Text } from '@qalaam/ui';
import { useState } from 'react';
import type { ReactNode } from 'react';

import {
  type Accuracy,
  type Fluency,
  type FsrsGrade,
  deriveFsrsGrade,
} from '@qalaam/hifdh-engine';

const FLUENCY_LABELS: Record<Fluency, string> = {
  0: 'Halted',
  1: 'Hesitant',
  2: 'Mostly smooth',
  3: 'Fluent',
};

const ACCURACY_LABELS: Record<Accuracy, string> = {
  0: 'Major errors',
  1: 'Minor errors',
  2: 'Tajweed nits',
  3: 'Clean',
};

export interface RatingTriggerProps {
  readonly portionLabel: string;
  readonly onSubmit: (fluency: Fluency, accuracy: Accuracy, grade: FsrsGrade) => void;
}

export function RatingTrigger({ portionLabel, onSubmit }: RatingTriggerProps): ReactNode {
  const [fluency, setFluency] = useState<Fluency | undefined>(undefined);
  const [accuracy, setAccuracy] = useState<Accuracy | undefined>(undefined);

  const ready = fluency !== undefined && accuracy !== undefined;

  return (
    <Card aria-label={`Rate recitation of ${portionLabel}`}>
      <Heading level={3}>How did the recitation go?</Heading>
      <Text size="caption" tone="muted" style={{ display: 'block', marginTop: '0.25rem' }}>
        {portionLabel}
      </Text>

      <fieldset style={{ border: 'none', padding: 0, margin: '1.25rem 0 0' }}>
        <legend style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Fluency</legend>
        <div role="radiogroup" aria-label="Fluency" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {([0, 1, 2, 3] as const).map((f) => (
            <Pill
              key={`f-${f.toString()}`}
              label={FLUENCY_LABELS[f]}
              selected={fluency === f}
              onSelect={() => setFluency(f)}
            />
          ))}
        </div>
      </fieldset>

      <fieldset style={{ border: 'none', padding: 0, margin: '1.25rem 0 0' }}>
        <legend style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Accuracy</legend>
        <div role="radiogroup" aria-label="Accuracy" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {([0, 1, 2, 3] as const).map((a) => (
            <Pill
              key={`a-${a.toString()}`}
              label={ACCURACY_LABELS[a]}
              selected={accuracy === a}
              onSelect={() => setAccuracy(a)}
            />
          ))}
        </div>
      </fieldset>

      <button
        type="button"
        disabled={!ready}
        onClick={() => {
          if (!ready) return;
          onSubmit(fluency, accuracy, deriveFsrsGrade(fluency, accuracy));
        }}
        style={{
          marginTop: '1.5rem',
          padding: '0.75rem 1.5rem',
          borderRadius: '0.75rem',
          border: 'none',
          background: ready ? 'var(--color-teal-500, #1b4d5a)' : '#cbd0d3',
          color: '#fff',
          cursor: ready ? 'pointer' : 'not-allowed',
          fontWeight: 500,
        }}
      >
        Save rating
      </button>
    </Card>
  );
}

function Pill({
  label,
  selected,
  onSelect,
}: {
  readonly label: string;
  readonly selected: boolean;
  readonly onSelect: () => void;
}): ReactNode {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      style={{
        padding: '0.5rem 0.875rem',
        borderRadius: '999px',
        border: '1px solid',
        borderColor: selected ? 'transparent' : 'rgba(16,56,64,0.15)',
        background: selected ? 'var(--color-teal-500, #1b4d5a)' : 'transparent',
        color: selected ? '#fff' : 'var(--color-teal-500, #1b4d5a)',
        cursor: 'pointer',
        fontSize: '0.875rem',
        transition: 'background-color 120ms cubic-bezier(0.2, 0, 0, 1)',
      }}
    >
      {label}
    </button>
  );
}
