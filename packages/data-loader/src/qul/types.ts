/**
 * Local types for QUL access. Mirrors fields from `@qalaam/types-ts` that we
 * actually surface from the SQLite layer.
 */
import type { VerseKey } from '@qalaam/core';

export interface QulVerseRow {
  readonly verseKey: VerseKey;
  readonly surah: number;
  readonly ayah: number;
  readonly textUthmani: string;
  readonly textIndopak: string | null;
  readonly textImlaei: string | null;
  readonly textQpcHafs: string | null;
  readonly juz: number;
  readonly hizb: number;
  readonly rubElHizb: number;
  readonly ruku: number;
  readonly manzil: number;
  readonly pageMadani15: number;
  readonly wordCount: number;
  readonly isSajdah: boolean;
}

export interface QulAudioSegmentRow {
  readonly verseKey: VerseKey;
  readonly reciterId: string;
  readonly wordIndex: number;
  readonly startMs: number;
  readonly endMs: number;
}

export interface QulMutashabihatRow {
  readonly clusterId: string;
  readonly memberVerseKeys: readonly VerseKey[];
  readonly sharedPhrase: string;
}

export interface QulMushafLayoutRow {
  readonly layout: 'madani_15' | 'indopak_16' | 'uthmani_v1' | 'uthmani_v2';
  readonly page: number;
  readonly firstVerseKey: VerseKey;
  readonly linesPerPage: number;
}
