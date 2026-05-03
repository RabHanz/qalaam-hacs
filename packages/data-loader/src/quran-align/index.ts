/**
 * Loader for cpfair/quran-align JSON timing files (CC-BY-4.0).
 *
 * Used as a fallback for reciters that QUL doesn't cover. Per ADR-0002:
 * QUL is preferred when it has human-corrected segments; quran-align fills the
 * long tail (~73 ms reference accuracy).
 *
 * On-disk format (one JSON file per reciter):
 *   { "1:1": [[0, 850], [851, 1500], ...], "1:2": [...], ... }
 * Where each tuple is [startMs, endMs] for word index N (0-indexed).
 */
import { readFileSync } from 'node:fs';

import { QalaamError, type VerseKey, parseVerseKey } from '@qalaam/core';

export interface QuranAlignSegment {
  readonly verseKey: VerseKey;
  readonly wordIndex: number;
  readonly startMs: number;
  readonly endMs: number;
}

export interface QuranAlignReciterIndex {
  /** Reciter's quran-align identifier (e.g., "alafasy", "husary"). */
  readonly reciterId: string;
  /** Map: verseKey → array of [startMs, endMs] tuples (word-indexed). */
  readonly verses: ReadonlyMap<VerseKey, readonly (readonly [number, number])[]>;
}

/** Load and validate a quran-align reciter file. */
export function loadQuranAlignFile(reciterId: string, jsonPath: string): QuranAlignReciterIndex {
  let raw: string;
  try {
    raw = readFileSync(jsonPath, 'utf-8');
  } catch (cause) {
    throw new QalaamError(
      'qalaam.data.not-loaded',
      `quran-align file not found: ${jsonPath}`,
      { cause },
    );
  }
  const parsed = JSON.parse(raw) as Record<string, [number, number][]>;
  const verses = new Map<VerseKey, readonly (readonly [number, number])[]>();
  for (const [keyStr, tuples] of Object.entries(parsed)) {
    const key = parseVerseKey(keyStr); // throws on malformed input — preserves error code
    for (const t of tuples) {
      if (!Array.isArray(t) || t.length !== 2 || typeof t[0] !== 'number' || typeof t[1] !== 'number') {
        throw new QalaamError(
          'qalaam.data.not-loaded',
          `quran-align: malformed tuple at ${keyStr} in ${jsonPath}`,
        );
      }
    }
    verses.set(key, tuples.map(([a, b]) => [a, b] as readonly [number, number]));
  }
  return Object.freeze({ reciterId, verses });
}

/** Convert a loaded reciter index into normalized AudioSegment-like rows for one verse. */
export function getQuranAlignSegments(
  index: QuranAlignReciterIndex,
  verseKey: VerseKey,
): QuranAlignSegment[] {
  const tuples = index.verses.get(verseKey) ?? [];
  return tuples.map((t, i) => ({
    verseKey,
    wordIndex: i,
    startMs: t[0],
    endMs: t[1],
  }));
}
