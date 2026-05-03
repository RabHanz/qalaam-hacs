/**
 * `@qalaam/khatm` — group khatm engine.
 *
 * Pure & deterministic. Persistence lives upstream (Postgres via apps/backend).
 *
 * The juz boundary table is hard-coded for v0.1 (canonical, immutable). Page
 * and ruku slicing variants come in v1.5 when we wire QUL's mushaf_layouts.
 */
import { type AyahRange, ayahRange, parseVerseKey, verseKey } from '@qalaam/core';

/** Canonical first-verse-of-juz table (1-indexed; index 0 unused). */
export const JUZ_FIRST_VERSE: readonly (readonly [number, number])[] = Object.freeze([
  [0, 0], // unused
  [1, 1],   [2, 142], [2, 253], [3, 92],  [4, 24],
  [4, 148], [5, 82],  [6, 111], [7, 88],  [8, 41],
  [9, 93],  [11, 6],  [12, 53], [15, 2],  [17, 1],
  [18, 75], [21, 1],  [23, 1],  [25, 21], [27, 56],
  [29, 46], [33, 31], [36, 28], [39, 32], [41, 47],
  [46, 1],  [51, 31], [58, 1],  [67, 1],  [78, 1],
]);

const LAST_VERSE: readonly [number, number] = [114, 6];

export interface KhatmSlice {
  readonly juz: number;
  readonly range: AyahRange;
}

/** Produce 30 juz-shaped slices spanning the entire Quran. */
export function sliceByJuz(): readonly KhatmSlice[] {
  const out: KhatmSlice[] = [];
  for (let j = 1; j <= 30; j += 1) {
    const startTuple = JUZ_FIRST_VERSE[j];
    const start = startTuple ? verseKey(startTuple[0], startTuple[1]) : verseKey(1, 1);
    const next = JUZ_FIRST_VERSE[j + 1];
    const end = next
      ? predecessorVerse(next[0], next[1])
      : verseKey(LAST_VERSE[0], LAST_VERSE[1]);
    out.push({ juz: j, range: ayahRange(start, end) });
  }
  return Object.freeze(out);
}

function predecessorVerse(surah: number, ayah: number): ReturnType<typeof verseKey> {
  if (ayah > 1) return verseKey(surah, ayah - 1);
  // Cross-surah: walk back to the previous surah's last ayah.
  // We import lazily to avoid a circular dep with @qalaam/core/verse-key's table.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { SURAH_AYAH_COUNTS } = require('@qalaam/core/verse-key') as { SURAH_AYAH_COUNTS: readonly number[] };
  const prevSurah = surah - 1;
  return verseKey(prevSurah, SURAH_AYAH_COUNTS[prevSurah] ?? 1);
}

export interface KhatmClaim {
  readonly id: string;
  readonly userId: string;
  readonly juz: number;
  readonly range: AyahRange;
  readonly completedAt?: string;
}

/** Build a claim object for a user + juz. */
export function allocateClaim(
  slices: readonly KhatmSlice[],
  userId: string,
  juz: number,
  id: string = `${userId}-juz-${juz.toString()}`,
): KhatmClaim {
  const slice = slices.find((s) => s.juz === juz);
  if (!slice) {
    throw new Error(`Khatm: no slice for juz ${juz.toString()}`);
  }
  return { id, userId, juz, range: slice.range };
}

/** Aggregate progress across claims: 0..1. Each completed juz contributes 1/30. */
export function computeProgress(claims: readonly KhatmClaim[]): number {
  const completed = claims.filter((c) => c.completedAt !== undefined).length;
  return Math.min(1, completed / 30);
}

/** True when every juz has been claimed AND completed. */
export function isComplete(claims: readonly KhatmClaim[]): boolean {
  const claimed = new Set(claims.map((c) => c.juz));
  if (claimed.size < 30) return false;
  return claims.every((c) => c.completedAt !== undefined);
}
