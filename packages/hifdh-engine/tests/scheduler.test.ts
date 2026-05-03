import { describe, expect, it } from 'vitest';

import { ayahRange, parseVerseKey } from '@qalaam/core';

import { initialReviewState } from '../src/fsrs/index.js';
import { generateDailySession, type PortionLike } from '../src/scheduler/index.js';

const k = parseVerseKey;

function makePortion(
  id: string,
  start: string,
  end: string,
  status: PortionLike['status'],
  due: Date,
): PortionLike {
  const now = new Date('2026-05-01T00:00:00.000Z');
  return {
    id,
    range: ayahRange(k(start), k(end)),
    status,
    reviewState: { ...initialReviewState({ now }), due: due.toISOString(), reps: 1 },
  };
}

describe('generateDailySession', () => {
  it('produces a session with sabaq + due sabqi + due manzil', () => {
    const now = new Date('2026-05-02T08:00:00.000Z');
    const past = new Date('2026-05-01T08:00:00.000Z');
    const future = new Date('2026-06-01T08:00:00.000Z');
    const portions: PortionLike[] = [
      makePortion('p1', '2:1', '2:5', 'new', now),
      makePortion('p2', '1:1', '1:7', 'sabqi', past),
      makePortion('p3', '3:1', '3:10', 'manzil', past),
      makePortion('p4', '4:1', '4:5', 'manzil', future), // not due
    ];
    const session = generateDailySession({ now, portions });
    expect(session.date).toBe('2026-05-02');
    expect(session.stats.newCount).toBe(1);
    expect(session.stats.sabqiCount).toBe(1);
    expect(session.stats.manzilCount).toBeGreaterThanOrEqual(1);
    expect(session.items.map((i) => i.portionId)).toContain('p1');
    expect(session.items.map((i) => i.portionId)).toContain('p2');
  });

  it('honors the 80/20 ratio by surfacing extra manzil portions', () => {
    const now = new Date('2026-05-02T08:00:00.000Z');
    const past = new Date('2026-05-01T08:00:00.000Z');
    const future = new Date('2026-06-01T08:00:00.000Z');
    // Two new portions, no sabqi, no due manzil — naive ratio would be 0.
    // The scheduler should surface manzil extras to lift revision share.
    const portions: PortionLike[] = [
      makePortion('n1', '2:1', '2:5', 'new', now),
      makePortion('n2', '2:6', '2:10', 'new', now),
      makePortion('m1', '5:1', '5:5', 'manzil', future),
      makePortion('m2', '6:1', '6:5', 'manzil', future),
      makePortion('m3', '7:1', '7:5', 'manzil', future),
      makePortion('m4', '8:1', '8:5', 'manzil', future),
    ];
    const session = generateDailySession({ now, portions, maxSabaq: 2 });
    expect(session.stats.revisionRatio).toBeGreaterThanOrEqual(0.8 - 1e-9);
  });

  it('attaches mutashabihat siblings when lookup is provided', () => {
    const now = new Date('2026-05-02T08:00:00.000Z');
    const portions: PortionLike[] = [makePortion('p1', '2:1', '2:5', 'new', now)];
    const session = generateDailySession({
      now,
      portions,
      mutashabihatLookup: () => [k('3:2'), k('3:5')],
    });
    expect(session.items[0]?.mutashabihatSiblings).toEqual([k('3:2'), k('3:5')]);
  });
});
