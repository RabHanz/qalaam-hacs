/**
 * WordResultStrip — Tarteel-style colored word ribbon.
 *
 * Per strategy §21.5 + §21.11.2: red error / green correct / yellow tashkeel
 * / brown peeked. The vocabulary is inherited verbatim — users coming from
 * Tarteel already know what it means.
 */
import type { ReactNode } from 'react';

export type WordOutcome = 'pending' | 'match' | 'error' | 'tashkeel' | 'peeked';

export interface Word {
  readonly index: number;
  readonly text: string;
  readonly outcome: WordOutcome;
}

export interface WordResultStripProps {
  readonly words: readonly Word[];
}

const COLORS: Record<WordOutcome, string> = {
  pending: 'rgba(16, 56, 64, 0.45)',
  match: 'var(--color-mistake-correct, #2e7d4f)',
  error: 'var(--color-mistake-error, #c0392b)',
  tashkeel: 'var(--color-mistake-tashkeel, #c8a536)',
  peeked: 'var(--color-mistake-peeked, #8a6d3b)',
};

const STYLE_OUTCOME: Record<WordOutcome, React.CSSProperties> = {
  pending: { textDecoration: 'none' },
  match: { textDecoration: 'none' },
  error: { textDecoration: 'underline dashed' },
  tashkeel: { textDecoration: 'underline dotted' },
  peeked: { textDecoration: 'none', fontStyle: 'italic' },
};

export function WordResultStrip({ words }: WordResultStripProps): ReactNode {
  return (
    <div
      dir="rtl"
      role="list"
      aria-label="Word-by-word recitation result"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.4em',
        fontFamily: "'KFGQPC HAFS Uthmanic Script V2', 'Amiri Quran', serif",
        fontSize: '2rem',
        lineHeight: 1.9,
        unicodeBidi: 'plaintext',
        textAlign: 'right',
      }}
    >
      {words.map((w) => (
        <span
          key={w.index}
          role="listitem"
          aria-label={`${w.text}: ${w.outcome}`}
          style={{
            color: COLORS[w.outcome],
            ...STYLE_OUTCOME[w.outcome],
            transition: 'color 220ms cubic-bezier(0.2,0,0,1)',
          }}
        >
          {w.text}
        </span>
      ))}
    </div>
  );
}
