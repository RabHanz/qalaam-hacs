import { describe, expect, it } from 'vitest';

import { allocateClaim, computeProgress, isComplete, sliceByJuz } from '../src/index.js';

describe('@qalaam/khatm', () => {
  it('produces 30 contiguous juz slices', () => {
    const slices = sliceByJuz();
    expect(slices).toHaveLength(30);
    expect(slices[0]?.range[0]).toBe('1:1');
    expect(slices[29]?.range[1]).toBe('114:6');
  });

  it('allocates a claim for a known juz', () => {
    const slices = sliceByJuz();
    const c = allocateClaim(slices, 'u1', 1);
    expect(c.juz).toBe(1);
    expect(c.range[0]).toBe('1:1');
  });

  it('rejects a claim for a juz that does not exist', () => {
    expect(() => allocateClaim(sliceByJuz(), 'u1', 99)).toThrow();
  });

  it('aggregates progress across completed claims', () => {
    const slices = sliceByJuz();
    const claims = slices.slice(0, 6).map((s) => ({
      id: `c-${String(s.juz)}`,
      userId: 'u',
      juz: s.juz,
      range: s.range,
      completedAt: '2026-05-02T00:00:00Z',
    }));
    expect(Math.round(computeProgress(claims) * 100) / 100).toBe(0.2);
  });

  it('detects full khatm completion', () => {
    const slices = sliceByJuz();
    const claims = slices.map((s) => ({
      id: `c-${String(s.juz)}`,
      userId: 'u',
      juz: s.juz,
      range: s.range,
      completedAt: '2026-05-02T00:00:00Z',
    }));
    expect(isComplete(claims)).toBe(true);
  });

  it('not complete if even one juz is unfinished', () => {
    const slices = sliceByJuz();
    const claims = slices.map((s, i) => ({
      id: `c-${String(s.juz)}`,
      userId: 'u',
      juz: s.juz,
      range: s.range,
      ...(i < 29 ? { completedAt: '2026-05-02T00:00:00Z' } : {}),
    }));
    expect(isComplete(claims)).toBe(false);
  });
});
