/**
 * `VerseKey` — branded string of the form `"surah:ayah"` (e.g., `"1:1"`, `"2:255"`).
 * The canonical identifier for a Quranic verse across Qalaam.
 *
 * Surah ∈ [1, 114]; ayah ∈ [1, max-ayah-of-surah]. The latter check requires
 * the SURAH_AYAH_COUNTS table (canonical, immutable, baked in).
 *
 * Per ADR-0008: this matches the regex in `packages/schema/schemas/common/Primitives.schema.json#/$defs/VerseKey`.
 */
import { QalaamError } from '../errors/index.js';

declare const verseKeyBrand: unique symbol;

/** A validated verse identifier. Construct only via `parseVerseKey` / `verseKey`. */
export type VerseKey = string & { readonly [verseKeyBrand]: 'VerseKey' };

const VERSE_KEY_PATTERN = /^([1-9]|[1-9][0-9]|10[0-9]|11[0-4]):([1-9][0-9]{0,2})$/;

/**
 * Canonical ayah counts per surah (1-indexed; index 0 unused).
 * Source: Madani Mushaf, Hafs riwayah (canonical). Frozen — never mutate.
 */
export const SURAH_AYAH_COUNTS: readonly number[] = Object.freeze([
  0,
  // 1-10
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109,
  // 11-20
  123, 111, 43, 52, 99, 128, 111, 110, 98, 135,
  // 21-30
  112, 78, 118, 64, 77, 227, 93, 88, 69, 60,
  // 31-40
  34, 30, 73, 54, 45, 83, 182, 88, 75, 85,
  // 41-50
  54, 53, 89, 59, 37, 35, 38, 29, 18, 45,
  // 51-60
  60, 49, 62, 55, 78, 96, 29, 22, 24, 13,
  // 61-70
  14, 11, 11, 18, 12, 12, 30, 52, 52, 44,
  // 71-80
  28, 28, 20, 56, 40, 31, 50, 40, 46, 42,
  // 81-90
  29, 19, 36, 25, 22, 17, 19, 26, 30, 20,
  // 91-100
  15, 21, 11, 8, 8, 19, 5, 8, 8, 11,
  // 101-110
  11, 8, 3, 9, 5, 4, 7, 3, 6, 3,
  // 111-114
  5, 4, 5, 6,
]);

/** Total verses in the Quran (canonical). */
export const TOTAL_VERSES = 6236;

/** Number of surahs (canonical). */
export const TOTAL_SURAHS = 114;

/** Parsed surah / ayah numeric pair. */
export interface VerseKeyParts {
  readonly surah: number;
  readonly ayah: number;
}

/**
 * Parse and validate a `"surah:ayah"` string into a `VerseKey`.
 * Throws `QalaamError` with a stable code on invalid input.
 */
export function parseVerseKey(raw: string): VerseKey {
  const match = VERSE_KEY_PATTERN.exec(raw);
  if (!match) {
    throw new QalaamError(
      'qalaam.verse-key.invalid-format',
      `Verse key must match "surah:ayah" with surah ∈ [1, 114]: got "${raw}"`,
    );
  }
  const surah = Number.parseInt(match[1] ?? '', 10);
  const ayah = Number.parseInt(match[2] ?? '', 10);
  validateBounds(surah, ayah);
  return raw as VerseKey;
}

/** Same as `parseVerseKey` but accepts numeric inputs. */
export function verseKey(surah: number, ayah: number): VerseKey {
  validateBounds(surah, ayah);
  return `${surah.toString()}:${ayah.toString()}` as VerseKey;
}

/** Decompose a `VerseKey` into its surah / ayah components. */
export function partsOf(key: VerseKey): VerseKeyParts {
  // Safe: a `VerseKey` is guaranteed valid by construction.
  const [s, a] = key.split(':');
  return { surah: Number.parseInt(s ?? '', 10), ayah: Number.parseInt(a ?? '', 10) };
}

/** Reverse of `verseKey` — formats a parts pair back into the canonical string. */
export function formatVerseKey({ surah, ayah }: VerseKeyParts): VerseKey {
  return verseKey(surah, ayah);
}

/**
 * Compare two verse keys lexicographically by mushaf order.
 * Returns negative, zero, or positive (sortable as standard `Array.sort` comparator).
 */
export function compareVerseKeys(a: VerseKey, b: VerseKey): number {
  const pa = partsOf(a);
  const pb = partsOf(b);
  if (pa.surah !== pb.surah) return pa.surah - pb.surah;
  return pa.ayah - pb.ayah;
}

/** True if `a` precedes `b` in mushaf order. */
export function isBefore(a: VerseKey, b: VerseKey): boolean {
  return compareVerseKeys(a, b) < 0;
}

/** True if `a` is `b` or precedes it. */
export function isBeforeOrEqual(a: VerseKey, b: VerseKey): boolean {
  return compareVerseKeys(a, b) <= 0;
}

/** True if both keys are equal. */
export function equals(a: VerseKey, b: VerseKey): boolean {
  return a === b;
}

/**
 * Yield every verse key in mushaf order between `from` and `to`, inclusive.
 * Walks across surah boundaries.
 */
export function* walkVerseKeys(from: VerseKey, to: VerseKey): Generator<VerseKey, void, void> {
  if (compareVerseKeys(from, to) > 0) {
    throw new QalaamError(
      'qalaam.range.start-after-end',
      `walkVerseKeys: from (${from}) is after to (${to}).`,
    );
  }
  let { surah, ayah } = partsOf(from);
  const end = partsOf(to);
  while (true) {
    yield verseKey(surah, ayah);
    if (surah === end.surah && ayah === end.ayah) return;
    const maxAyah = SURAH_AYAH_COUNTS[surah] ?? 0;
    if (ayah < maxAyah) {
      ayah += 1;
    } else {
      surah += 1;
      ayah = 1;
    }
  }
}

/** Number of verses between `from` and `to`, inclusive. O(surah-distance). */
export function verseCount(from: VerseKey, to: VerseKey): number {
  if (compareVerseKeys(from, to) > 0) {
    throw new QalaamError(
      'qalaam.range.start-after-end',
      `verseCount: from (${from}) is after to (${to}).`,
    );
  }
  const a = partsOf(from);
  const b = partsOf(to);
  if (a.surah === b.surah) return b.ayah - a.ayah + 1;
  let count = (SURAH_AYAH_COUNTS[a.surah] ?? 0) - a.ayah + 1;
  for (let s = a.surah + 1; s < b.surah; s += 1) {
    count += SURAH_AYAH_COUNTS[s] ?? 0;
  }
  count += b.ayah;
  return count;
}

function validateBounds(surah: number, ayah: number): void {
  if (!Number.isInteger(surah) || surah < 1 || surah > TOTAL_SURAHS) {
    throw new QalaamError(
      'qalaam.verse-key.surah-out-of-range',
      `Surah must be an integer in [1, ${TOTAL_SURAHS.toString()}]; got ${String(surah)}`,
    );
  }
  const max = SURAH_AYAH_COUNTS[surah] ?? 0;
  if (!Number.isInteger(ayah) || ayah < 1 || ayah > max) {
    throw new QalaamError(
      'qalaam.verse-key.ayah-out-of-range',
      `Ayah must be an integer in [1, ${max.toString()}] for surah ${surah.toString()}; got ${String(ayah)}`,
    );
  }
}
