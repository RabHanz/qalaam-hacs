/**
 * Loader for quran/quran-tajweed JSON (CC-BY-4.0).
 *
 * 5.5 MB single file: per-character tajweed-rule annotations indexed against
 * Tanzil Uthmani text. Loaded once at process start; in-memory map for lookups.
 *
 * Per ADR-0002: ship with the offline package; replaced by QUL tajweed when
 * QUL covers the coverage gap.
 */
import { readFileSync } from 'node:fs';

import { QalaamError, type VerseKey, parseVerseKey } from '@qalaam/core';

/** Per-character tajweed rule labels. Subset of the quran-tajweed catalog. */
export type TajweedRule =
  | 'ham_wasl'
  | 'laam_shamsiyah'
  | 'madda_normal'
  | 'madda_permissible'
  | 'madda_necessary'
  | 'madda_obligatory'
  | 'qalqalah'
  | 'ikhfa_shafawi'
  | 'ikhfa'
  | 'idgham_shafawi'
  | 'idgham_with_ghunnah'
  | 'idgham_without_ghunnah'
  | 'idgham_mutamathilain'
  | 'idgham_mutajanisain'
  | 'idgham_mutaqaribain'
  | 'iqlab'
  | 'silent';

export interface TajweedAnnotation {
  /** 0-based character offset within the ayah's Uthmani text. */
  readonly start: number;
  readonly end: number;
  readonly rule: TajweedRule;
}

export interface TajweedIndex {
  /** Map: verseKey → annotations sorted by `start`. */
  readonly verses: ReadonlyMap<VerseKey, readonly TajweedAnnotation[]>;
}

interface RawAnnotation {
  start: number;
  end: number;
  rule: string;
}
type RawFile = Record<string, RawAnnotation[]>;

/** Load and validate the quran-tajweed JSON file. */
export function loadQuranTajweed(jsonPath: string): TajweedIndex {
  let raw: string;
  try {
    raw = readFileSync(jsonPath, 'utf-8');
  } catch (cause) {
    throw new QalaamError(
      'qalaam.data.not-loaded',
      `quran-tajweed file not found: ${jsonPath}`,
      { cause },
    );
  }
  const parsed = JSON.parse(raw) as RawFile;
  const verses = new Map<VerseKey, readonly TajweedAnnotation[]>();
  for (const [keyStr, annotations] of Object.entries(parsed)) {
    const key = parseVerseKey(keyStr);
    const sorted = [...annotations]
      .map((a) => ({ start: a.start, end: a.end, rule: a.rule as TajweedRule }))
      .sort((a, b) => a.start - b.start);
    verses.set(key, sorted);
  }
  return Object.freeze({ verses });
}

export function getTajweedAnnotations(index: TajweedIndex, key: VerseKey): readonly TajweedAnnotation[] {
  return index.verses.get(key) ?? [];
}
