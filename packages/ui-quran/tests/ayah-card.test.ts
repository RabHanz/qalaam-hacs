import { describe, expect, it } from 'vitest';

import { renderAyahCardSvg } from '../src/ayah-card/render.js';

describe('renderAyahCardSvg', () => {
  it('produces a square SVG by default', () => {
    const svg = renderAyahCardSvg({
      arabic: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
      translation: 'In the name of Allah, the Most Gracious, the Most Merciful.',
      verseKey: '1:1',
    });
    expect(svg).toMatch(/<svg /);
    expect(svg).toMatch(/width="1080" height="1080"/);
    expect(svg).toMatch(/qalaam\.app/);
  });

  it('escapes XML entities in translation', () => {
    const svg = renderAyahCardSvg({
      arabic: 'x',
      translation: 'A & B < C',
      verseKey: '1:1',
    });
    expect(svg).toMatch(/A &amp; B &lt; C/);
  });

  it('switches to story aspect when requested', () => {
    const svg = renderAyahCardSvg({
      arabic: 'x',
      verseKey: '1:1',
      aspect: 'story',
    });
    expect(svg).toMatch(/width="1080" height="1920"/);
  });
});
