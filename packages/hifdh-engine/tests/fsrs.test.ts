import { describe, expect, it } from 'vitest';

import { applyGrade, initialReviewState, isDue } from '../src/fsrs/index.js';

describe('FSRS-6 wrapper', () => {
  it('initializes a brand-new portion as immediately due', () => {
    const now = new Date('2026-05-02T08:00:00.000Z');
    const r = initialReviewState({ now });
    expect(r.fsrsVersion).toBe('6.0');
    expect(r.reps).toBe(0);
    expect(r.lapses).toBe(0);
    expect(isDue(r, now)).toBe(true);
  });

  it('applying a Good grade pushes due date forward', () => {
    const now = new Date('2026-05-02T08:00:00.000Z');
    const r0 = initialReviewState({ now });
    const r1 = applyGrade({ now, review: r0, grade: 3 });
    expect(new Date(r1.due).getTime()).toBeGreaterThan(now.getTime());
    expect(r1.reps).toBe(1);
  });

  it('Again grade increments lapses', () => {
    const now = new Date('2026-05-02T08:00:00.000Z');
    const later = new Date('2026-05-03T08:00:00.000Z');
    const r0 = initialReviewState({ now });
    const r1 = applyGrade({ now, review: r0, grade: 3 });
    const r2 = applyGrade({ now: later, review: r1, grade: 1 });
    expect(r2.lapses).toBeGreaterThanOrEqual(1);
  });

  it('Easy spaces further out than Good', () => {
    const now = new Date('2026-05-02T08:00:00.000Z');
    const r0 = initialReviewState({ now });
    const rGood = applyGrade({ now, review: r0, grade: 3 });
    const rEasy = applyGrade({ now, review: r0, grade: 4 });
    expect(new Date(rEasy.due).getTime()).toBeGreaterThanOrEqual(
      new Date(rGood.due).getTime(),
    );
  });
});
