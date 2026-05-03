/**
 * Daily-session generator: assembles sabaq + sabqi + manzil portions for today.
 * Per strategy §7.1 + §7.3. Honors the 80/20 revision-vs-new-memorization rule.
 *
 * Determinism: `now` is always injected; no Date.now() calls.
 */
import { type AyahRange, type VerseKey } from '@qalaam/core';

import { isDue, type ReviewStateLike } from '../fsrs/index.js';

export type PortionStatus = 'new' | 'sabqi' | 'manzil' | 'weak' | 'locked';

export interface PortionLike {
  readonly id: string;
  readonly range: AyahRange;
  readonly status: PortionStatus;
  readonly reviewState: ReviewStateLike;
}

export interface SessionItem {
  readonly portionId: string;
  readonly range: AyahRange;
  readonly bucket: 'sabaq' | 'sabqi' | 'manzil';
  readonly mutashabihatSiblings?: readonly VerseKey[];
}

export interface DailySession {
  readonly date: string; // YYYY-MM-DD UTC
  readonly items: readonly SessionItem[];
  readonly stats: {
    readonly newCount: number;
    readonly sabqiCount: number;
    readonly manzilCount: number;
    readonly revisionRatio: number; // (sabqi + manzil) / total
  };
}

export interface GenerateOptions {
  readonly now: Date;
  readonly portions: readonly PortionLike[];
  /** Optional: cluster siblings for portions in today's session. */
  readonly mutashabihatLookup?: (range: AyahRange) => readonly VerseKey[];
  /** Cap on sabaq portions. Defaults to 1 (one new portion per day for kids/casual). */
  readonly maxSabaq?: number;
  /** Target ratio for revision (sabqi + manzil) — default 0.8 (the 80/20 rule). */
  readonly targetRevisionRatio?: number;
}

/**
 * Build today's session. Always includes:
 *   1. Up to `maxSabaq` portions whose status='new' (the new lesson).
 *   2. All portions with status in ('sabqi', 'weak') that are due per FSRS.
 *   3. Manzil portions that are due per FSRS, capped to honor the 80/20 ratio.
 *
 * If the result violates the target ratio, manzil count is increased (safe —
 * over-revision rarely hurts; under-revision is the documented #1 plateau cause).
 */
export function generateDailySession(opts: GenerateOptions): DailySession {
  const { now, portions, mutashabihatLookup } = opts;
  const maxSabaq = opts.maxSabaq ?? 1;
  const targetRevisionRatio = opts.targetRevisionRatio ?? 0.8;

  const newPortions = portions.filter((p) => p.status === 'new').slice(0, maxSabaq);
  const sabqiPortions = portions.filter(
    (p) => (p.status === 'sabqi' || p.status === 'weak') && isDue(p.reviewState, now),
  );
  const manzilPortions = portions.filter(
    (p) => p.status === 'manzil' && isDue(p.reviewState, now),
  );

  const sabaqItems = newPortions.map((p) => buildItem(p, 'sabaq', mutashabihatLookup));
  const sabqiItems = sabqiPortions.map((p) => buildItem(p, 'sabqi', mutashabihatLookup));
  let manzilItems = manzilPortions.map((p) => buildItem(p, 'manzil', mutashabihatLookup));

  // Enforce 80/20: if revision is short, surface additional manzil portions even
  // if not strictly due. We never trim sabqi (it's the most fragile bucket).
  let total = sabaqItems.length + sabqiItems.length + manzilItems.length;
  let revisionCount = sabqiItems.length + manzilItems.length;
  if (total > 0 && revisionCount / total < targetRevisionRatio) {
    const extras = portions
      .filter(
        (p) =>
          p.status === 'manzil' &&
          !manzilItems.some((mi) => mi.portionId === p.id),
      )
      .sort(
        (a, b) =>
          new Date(a.reviewState.due).getTime() - new Date(b.reviewState.due).getTime(),
      );
    while (total > 0 && revisionCount / total < targetRevisionRatio && extras.length > 0) {
      const extra = extras.shift();
      if (!extra) break;
      manzilItems = [...manzilItems, buildItem(extra, 'manzil', mutashabihatLookup)];
      total += 1;
      revisionCount += 1;
    }
  }

  const items = [...sabaqItems, ...sabqiItems, ...manzilItems];
  return {
    date: now.toISOString().slice(0, 10),
    items,
    stats: {
      newCount: sabaqItems.length,
      sabqiCount: sabqiItems.length,
      manzilCount: manzilItems.length,
      revisionRatio: total === 0 ? 0 : (sabqiItems.length + manzilItems.length) / total,
    },
  };
}

function buildItem(
  p: PortionLike,
  bucket: SessionItem['bucket'],
  lookup?: GenerateOptions['mutashabihatLookup'],
): SessionItem {
  const siblings = lookup?.(p.range);
  return siblings && siblings.length > 0
    ? { portionId: p.id, range: p.range, bucket, mutashabihatSiblings: siblings }
    : { portionId: p.id, range: p.range, bucket };
}
