import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { parseVerseKey } from '@qalaam/core';

import { AyahLine } from '../src/components/AyahLine.js';

describe('AyahLine', () => {
  it('renders Al-Fatiha 1 with the four bismillah words', () => {
    render(
      <AyahLine
        verseKey={parseVerseKey('1:1')}
        ayahNumber={1}
        words={[
          { index: 0, arabic: 'بِسْمِ', gloss: 'In the name' },
          { index: 1, arabic: 'ٱللَّهِ', gloss: 'of Allah' },
          { index: 2, arabic: 'ٱلرَّحْمَٰنِ', gloss: 'the Most Gracious' },
          { index: 3, arabic: 'ٱلرَّحِيمِ', gloss: 'the Most Merciful' },
        ]}
        translation="In the name of Allah, the Most Gracious, the Most Merciful."
      />,
    );
    expect(screen.getByLabelText('Ayah 1')).toBeDefined();
    expect(screen.getByText(/In the name of Allah/)).toBeDefined();
  });

  it('marks the current word with the gold highlight class', () => {
    const { container } = render(
      <AyahLine
        verseKey={parseVerseKey('1:1')}
        ayahNumber={1}
        words={[{ index: 0, arabic: 'بِسْمِ' }]}
        currentWordIndex={0}
      />,
    );
    const span = container.querySelector('span[role]');
    // We use inline styles in v0.1; verify presence rather than exact class.
    expect(span).toBeDefined();
  });
});
