import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { QalaamError } from '../src/errors/index.js';
import {
  SURAH_AYAH_COUNTS,
  TOTAL_VERSES,
  compareVerseKeys,
  formatVerseKey,
  parseVerseKey,
  partsOf,
  verseCount,
  verseKey,
  walkVerseKeys,
} from '../src/verse-key/index.js';

describe('parseVerseKey / verseKey / partsOf — round-trip', () => {
  it('parses Al-Fatiha 1', () => {
    const k = parseVerseKey('1:1');
    expect(partsOf(k)).toEqual({ surah: 1, ayah: 1 });
    expect(formatVerseKey(partsOf(k))).toBe('1:1');
  });

  it('parses Al-Baqarah 286 (longest surah)', () => {
    const k = parseVerseKey('2:286');
    expect(partsOf(k)).toEqual({ surah: 2, ayah: 286 });
  });

  it('rejects unknown surah', () => {
    expect(() => parseVerseKey('115:1')).toThrowError(QalaamError);
  });

  it('rejects ayah beyond surah max', () => {
    expect(() => parseVerseKey('1:8')).toThrowError(QalaamError); // Al-Fatiha has 7 ayahs
  });

  it('rejects malformed strings', () => {
    for (const bad of ['', 'x', '1', '1:', ':1', '0:1', '1:0', '1:abc']) {
      expect(() => parseVerseKey(bad), `expected throw for "${bad}"`).toThrowError(QalaamError);
    }
  });

  it('property: every (surah, ayah) within bounds round-trips', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 114 }).chain((surah) =>
          fc.tuple(
            fc.constant(surah),
            fc.integer({ min: 1, max: SURAH_AYAH_COUNTS[surah] ?? 1 }),
          ),
        ),
        ([surah, ayah]) => {
          const k = verseKey(surah, ayah);
          expect(partsOf(k)).toEqual({ surah, ayah });
        },
      ),
    );
  });
});

describe('compareVerseKeys', () => {
  it('orders by surah then ayah', () => {
    expect(compareVerseKeys(parseVerseKey('1:1'), parseVerseKey('1:2'))).toBeLessThan(0);
    expect(compareVerseKeys(parseVerseKey('2:1'), parseVerseKey('1:7'))).toBeGreaterThan(0);
    expect(compareVerseKeys(parseVerseKey('5:5'), parseVerseKey('5:5'))).toBe(0);
  });
});

describe('walkVerseKeys', () => {
  it('walks within a single surah', () => {
    const seen = [...walkVerseKeys(parseVerseKey('1:1'), parseVerseKey('1:7'))];
    expect(seen).toHaveLength(7);
    expect(seen[0]).toBe('1:1');
    expect(seen[6]).toBe('1:7');
  });

  it('walks across a surah boundary', () => {
    const seen = [...walkVerseKeys(parseVerseKey('1:6'), parseVerseKey('2:2'))];
    expect(seen).toEqual(['1:6', '1:7', '2:1', '2:2']);
  });

  it('throws if from > to', () => {
    expect(() => [...walkVerseKeys(parseVerseKey('2:1'), parseVerseKey('1:1'))]).toThrowError(
      QalaamError,
    );
  });
});

describe('verseCount', () => {
  it('within surah', () => {
    expect(verseCount(parseVerseKey('1:1'), parseVerseKey('1:7'))).toBe(7);
  });

  it('cross-surah', () => {
    expect(verseCount(parseVerseKey('1:1'), parseVerseKey('2:286'))).toBe(7 + 286);
  });

  it('whole Quran sums to 6236', () => {
    expect(verseCount(parseVerseKey('1:1'), parseVerseKey('114:6'))).toBe(TOTAL_VERSES);
  });
});

describe('SURAH_AYAH_COUNTS — canonical', () => {
  it('has 115 entries (1-indexed; index 0 unused)', () => {
    expect(SURAH_AYAH_COUNTS.length).toBe(115);
    expect(SURAH_AYAH_COUNTS[0]).toBe(0);
  });

  it('sums to 6236 (total verses in the Quran)', () => {
    const total = SURAH_AYAH_COUNTS.reduce((acc, n) => acc + n, 0);
    expect(total).toBe(TOTAL_VERSES);
  });

  it('Al-Baqarah is 286', () => {
    expect(SURAH_AYAH_COUNTS[2]).toBe(286);
  });

  it('Ayat al-Kursi (2:255) parses cleanly', () => {
    expect(() => parseVerseKey('2:255')).not.toThrow();
  });
});
