/**
 * AyahLine — a single ayah row with optional translation and current-word highlight.
 */
import type { ReactNode } from 'react';

import type { VerseKey } from '@qalaam/core';

import { WordToken, type WordTokenProps } from './WordToken.js';

export interface AyahWord extends Omit<WordTokenProps, 'isCurrent' | 'onTap'> {
  readonly index: number;
}

export interface AyahLineProps {
  readonly verseKey: VerseKey;
  readonly ayahNumber: number;
  readonly words: readonly AyahWord[];
  readonly translation?: string;
  /** Index of the currently-playing word, for follow-along highlight. */
  readonly currentWordIndex?: number;
  readonly onWordTap?: (wordIndex: number) => void;
}

export function AyahLine({
  verseKey,
  ayahNumber,
  words,
  translation,
  currentWordIndex,
  onWordTap,
}: AyahLineProps): ReactNode {
  return (
    <article
      data-verse-key={verseKey}
      aria-label={`Ayah ${String(ayahNumber)}`}
      style={{ padding: '1rem 0' }}
    >
      <div
        style={{
          fontFamily: "'KFGQPC HAFS Uthmanic Script V2', 'Amiri Quran', serif",
          fontSize: '2rem',
          lineHeight: 2,
          direction: 'rtl',
          unicodeBidi: 'plaintext',
          textAlign: 'right',
        }}
      >
        {words.map((w) => (
          <WordToken
            key={w.index}
            arabic={w.arabic}
            gloss={w.gloss}
            transliteration={w.transliteration}
            tajweedRule={w.tajweedRule}
            isCurrent={w.index === currentWordIndex}
            onTap={onWordTap ? () => onWordTap(w.index) : undefined}
          />
        ))}{' '}
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: '1.5em',
            height: '1.5em',
            border: '1px solid currentColor',
            borderRadius: '50%',
            textAlign: 'center',
            fontSize: '0.65em',
            lineHeight: '1.5em',
            verticalAlign: 'middle',
            margin: '0 0.4em',
          }}
        >
          {ayahNumber}
        </span>
      </div>
      {translation ? (
        <p
          dir="auto"
          style={{ marginTop: '0.5rem', fontSize: '1rem', opacity: 0.85, lineHeight: 1.6 }}
        >
          {translation}
        </p>
      ) : null}
    </article>
  );
}
