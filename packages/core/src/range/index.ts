/**
 * `AyahRange` — branded readonly tuple `[startVerseKey, endVerseKey]`.
 * Inclusive on both ends. Mushaf-agnostic.
 */
import { QalaamError } from '../errors/index.js';
import {
  type VerseKey,
  compareVerseKeys,
  partsOf,
  verseCount,
  walkVerseKeys,
} from '../verse-key/index.js';

declare const ayahRangeBrand: unique symbol;

export type AyahRange = readonly [VerseKey, VerseKey] & { readonly [ayahRangeBrand]: 'AyahRange' };

/**
 * Construct a validated `AyahRange`. Throws if `start` is after `end` (use
 * `reverse` if you mean the other direction).
 */
export function ayahRange(start: VerseKey, end: VerseKey): AyahRange {
  if (compareVerseKeys(start, end) > 0) {
    throw new QalaamError(
      'qalaam.range.start-after-end',
      `AyahRange: start (${start}) must precede or equal end (${end}).`,
    );
  }
  return [start, end] as AyahRange;
}

export function startOf(r: AyahRange): VerseKey {
  return r[0];
}

export function endOf(r: AyahRange): VerseKey {
  return r[1];
}

/** True if `verseKey` is inside the inclusive range. */
export function contains(r: AyahRange, key: VerseKey): boolean {
  return compareVerseKeys(r[0], key) <= 0 && compareVerseKeys(key, r[1]) <= 0;
}

/** True if two ranges share at least one verse. */
export function overlaps(a: AyahRange, b: AyahRange): boolean {
  return compareVerseKeys(a[0], b[1]) <= 0 && compareVerseKeys(b[0], a[1]) <= 0;
}

/** Intersection of two ranges, or `undefined` if disjoint. */
export function intersect(a: AyahRange, b: AyahRange): AyahRange | undefined {
  if (!overlaps(a, b)) return undefined;
  const start = compareVerseKeys(a[0], b[0]) >= 0 ? a[0] : b[0];
  const end = compareVerseKeys(a[1], b[1]) <= 0 ? a[1] : b[1];
  return ayahRange(start, end);
}

/**
 * Union of two ranges. Throws if they are disjoint and don't touch
 * (caller should split into multiple ranges if disjoint is expected).
 */
export function union(a: AyahRange, b: AyahRange): AyahRange {
  if (!overlaps(a, b) && !touches(a, b)) {
    throw new QalaamError(
      'qalaam.range.empty',
      `union: ranges ${formatRange(a)} and ${formatRange(b)} are disjoint and don't touch.`,
    );
  }
  const start = compareVerseKeys(a[0], b[0]) <= 0 ? a[0] : b[0];
  const end = compareVerseKeys(a[1], b[1]) >= 0 ? a[1] : b[1];
  return ayahRange(start, end);
}

/** True if two ranges are adjacent (one ends immediately before the other starts). */
export function touches(a: AyahRange, b: AyahRange): boolean {
  return adjacent(a[1], b[0]) || adjacent(b[1], a[0]);
}

/** True if `next` immediately follows `prev` in mushaf order. */
function adjacent(prev: VerseKey, next: VerseKey): boolean {
  const p = partsOf(prev);
  const n = partsOf(next);
  // Same surah, ayah+1
  if (p.surah === n.surah && n.ayah === p.ayah + 1) return true;
  // Surah boundary
  return n.surah === p.surah + 1 && n.ayah === 1;
}

/** Number of verses in the range (inclusive). */
export function size(r: AyahRange): number {
  return verseCount(r[0], r[1]);
}

/** Iterate every verse key in the range in mushaf order. */
export function walk(r: AyahRange): Generator<VerseKey, void, void> {
  return walkVerseKeys(r[0], r[1]);
}

/** Stable string for diagnostics: `"1:1 → 1:7"`. */
export function formatRange(r: AyahRange): string {
  return `${r[0]} → ${r[1]}`;
}
