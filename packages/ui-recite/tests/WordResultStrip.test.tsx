import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WordResultStrip } from '../src/session/WordResultStrip.js';

describe('WordResultStrip', () => {
  it('renders each word with the right ARIA label', () => {
    render(
      <WordResultStrip
        words={[
          { index: 0, text: 'بِسْمِ', outcome: 'match' },
          { index: 1, text: 'ٱللَّهِ', outcome: 'error' },
          { index: 2, text: 'ٱلرَّحْمَٰنِ', outcome: 'tashkeel' },
        ]}
      />,
    );
    expect(screen.getByLabelText(/match/)).toBeDefined();
    expect(screen.getByLabelText(/error/)).toBeDefined();
    expect(screen.getByLabelText(/tashkeel/)).toBeDefined();
  });
});
