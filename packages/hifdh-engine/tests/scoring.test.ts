import { describe, expect, it } from 'vitest';

import { adjustForMutashabihat, deriveFsrsGrade } from '../src/scoring/index.js';

describe('deriveFsrsGrade', () => {
  it('clean fluent recitation = Easy', () => {
    expect(deriveFsrsGrade(3, 3)).toBe(4);
  });

  it('halted with errors = Again', () => {
    expect(deriveFsrsGrade(0, 0)).toBe(1);
  });

  it('hesitant but accurate = Hard', () => {
    expect(deriveFsrsGrade(1, 2)).toBe(2);
  });

  it('fluent but with minor errors = Hard (drifts conservative)', () => {
    expect(deriveFsrsGrade(3, 1)).toBe(2);
  });

  it('all 16 cells produce a valid grade in {1,2,3,4}', () => {
    for (let f = 0 as 0 | 1 | 2 | 3; f <= 3; f = (f + 1) as typeof f) {
      for (let a = 0 as 0 | 1 | 2 | 3; a <= 3; a = (a + 1) as typeof a) {
        const g = deriveFsrsGrade(f, a);
        expect(g).toBeGreaterThanOrEqual(1);
        expect(g).toBeLessThanOrEqual(4);
      }
    }
  });
});

describe('adjustForMutashabihat', () => {
  it('drops grade by one when swap detected', () => {
    expect(adjustForMutashabihat(4, true)).toBe(3);
    expect(adjustForMutashabihat(3, true)).toBe(2);
    expect(adjustForMutashabihat(2, true)).toBe(1);
  });

  it('caps at 1 (Again)', () => {
    expect(adjustForMutashabihat(1, true)).toBe(1);
  });

  it('no-op when no swap', () => {
    expect(adjustForMutashabihat(4, false)).toBe(4);
  });
});
