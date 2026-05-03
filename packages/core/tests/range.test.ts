import { describe, expect, it } from 'vitest';

import { QalaamError } from '../src/errors/index.js';
import {
  ayahRange,
  contains,
  formatRange,
  intersect,
  overlaps,
  size,
  touches,
  union,
  walk,
} from '../src/range/index.js';
import { parseVerseKey } from '../src/verse-key/index.js';

const k = parseVerseKey;

describe('ayahRange', () => {
  it('constructs and queries', () => {
    const r = ayahRange(k('1:1'), k('1:7'));
    expect(formatRange(r)).toBe('1:1 → 1:7');
    expect(size(r)).toBe(7);
    expect(contains(r, k('1:4'))).toBe(true);
    expect(contains(r, k('2:1'))).toBe(false);
  });

  it('rejects start > end', () => {
    expect(() => ayahRange(k('2:1'), k('1:1'))).toThrowError(QalaamError);
  });
});

describe('overlap / intersect / union', () => {
  it('overlap detection', () => {
    const a = ayahRange(k('1:1'), k('1:5'));
    const b = ayahRange(k('1:4'), k('1:7'));
    const c = ayahRange(k('2:1'), k('2:10'));
    expect(overlaps(a, b)).toBe(true);
    expect(overlaps(a, c)).toBe(false);
  });

  it('intersect', () => {
    const a = ayahRange(k('1:1'), k('1:5'));
    const b = ayahRange(k('1:4'), k('1:7'));
    const i = intersect(a, b);
    expect(i).toBeDefined();
    expect(formatRange(i!)).toBe('1:4 → 1:5');
  });

  it('intersect of disjoint ranges is undefined', () => {
    const a = ayahRange(k('1:1'), k('1:3'));
    const b = ayahRange(k('1:5'), k('1:7'));
    expect(intersect(a, b)).toBeUndefined();
  });

  it('union of overlapping ranges', () => {
    const a = ayahRange(k('1:1'), k('1:5'));
    const b = ayahRange(k('1:4'), k('1:7'));
    expect(formatRange(union(a, b))).toBe('1:1 → 1:7');
  });

  it('union of touching ranges across surah boundary', () => {
    const a = ayahRange(k('1:6'), k('1:7'));
    const b = ayahRange(k('2:1'), k('2:5'));
    expect(touches(a, b)).toBe(true);
    expect(formatRange(union(a, b))).toBe('1:6 → 2:5');
  });

  it('union of disjoint, non-touching ranges throws', () => {
    const a = ayahRange(k('1:1'), k('1:3'));
    const b = ayahRange(k('2:1'), k('2:5'));
    expect(() => union(a, b)).toThrowError(QalaamError);
  });
});

describe('walk', () => {
  it('iterates all verses in mushaf order', () => {
    const r = ayahRange(k('1:6'), k('2:2'));
    expect([...walk(r)]).toEqual(['1:6', '1:7', '2:1', '2:2']);
  });
});
