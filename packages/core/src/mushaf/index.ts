/**
 * Mushaf-page math.
 *
 * Per ADR-0002 + strategy §7.1 same-mushaf rule: data is stored as ayah ranges
 * (mushaf-agnostic). Page boundaries differ across mushaf layouts (Madani 15-line
 * has 604 pages; Indo-Pak 16-line has different boundaries entirely).
 *
 * Page-boundary tables are loaded by `@qalaam/data-loader` from QUL and passed
 * into the functions below. This module is pure (no I/O) so it can be reused
 * everywhere.
 */
import { QalaamError } from '../errors/index.js';
import { type AyahRange, ayahRange } from '../range/index.js';
import { type VerseKey, compareVerseKeys, partsOf, verseKey } from '../verse-key/index.js';

/**
 * A page-layout descriptor. The `firstVerseOfPage` array maps page number (1-indexed)
 * to the first verse on that page. Page count is `firstVerseOfPage.length - 1`.
 */
export interface PageLayout {
  readonly layout: 'madani_15' | 'indopak_16' | 'uthmani_v1' | 'uthmani_v2';
  /** Index 0 unused; index P holds the first VerseKey on page P. */
  readonly firstVerseOfPage: readonly VerseKey[];
  readonly linesPerPage: number;
}

/**
 * Find the page number containing the given verse, given a `PageLayout`.
 * Returns 1-indexed page number. Throws if `verse` falls outside the layout.
 */
export function pageNumberOf(layout: PageLayout, verse: VerseKey): number {
  const pages = layout.firstVerseOfPage;
  if (pages.length < 2) {
    throw new QalaamError(
      'qalaam.mushaf.unknown-layout',
      `PageLayout for ${layout.layout} has no pages.`,
    );
  }
  // Binary search for the largest page whose first verse is ≤ `verse`.
  let lo = 1;
  let hi = pages.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    const first = pages[mid];
    if (first === undefined) {
      throw new QalaamError(
        'qalaam.mushaf.no-coverage',
        `PageLayout has gap at page ${mid.toString()}.`,
      );
    }
    if (compareVerseKeys(first, verse) <= 0) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Range of verses contained on a single page. */
export function rangeForPage(layout: PageLayout, page: number): AyahRange {
  const pages = layout.firstVerseOfPage;
  const lastPage = pages.length - 1;
  if (page < 1 || page > lastPage) {
    throw new QalaamError(
      'qalaam.mushaf.no-coverage',
      `Page ${page.toString()} out of range for ${layout.layout} (1..${lastPage.toString()}).`,
    );
  }
  const start = pages[page];
  if (start === undefined) {
    throw new QalaamError(
      'qalaam.mushaf.no-coverage',
      `PageLayout missing first verse for page ${page.toString()}.`,
    );
  }
  // End = ayah immediately before the next page's start, OR last ayah of the Quran.
  const next = pages[page + 1];
  const end = next === undefined ? predecessor(verseKey(114, 6)) : predecessor(next);
  return ayahRange(start, end);
}

/** Pages spanned by an `AyahRange` (inclusive on both ends). */
export function pageBoundsForRange(layout: PageLayout, range: AyahRange): { firstPage: number; lastPage: number } {
  return {
    firstPage: pageNumberOf(layout, range[0]),
    lastPage: pageNumberOf(layout, range[1]),
  };
}

/**
 * Compute the predecessor of a verse key in mushaf order. Used internally for
 * page-end calculation. Throws on `1:1` (no predecessor).
 */
function predecessor(key: VerseKey): VerseKey {
  const { surah, ayah } = partsOf(key);
  if (surah === 1 && ayah === 1) {
    throw new QalaamError(
      'qalaam.range.empty',
      'predecessor of 1:1 does not exist.',
    );
  }
  if (ayah > 1) return verseKey(surah, ayah - 1);
  // Walk into previous surah's last ayah — requires SURAH_AYAH_COUNTS, imported transitively.
  // We import lazily to avoid a circular reference at module load.
  const counts = (loadCounts as () => readonly number[])();
  const prevSurah = surah - 1;
  const prevAyah = counts[prevSurah] ?? 0;
  return verseKey(prevSurah, prevAyah);
}

let cachedCounts: readonly number[] | undefined;
function loadCounts(): readonly number[] {
  if (cachedCounts !== undefined) return cachedCounts;
  // Late import to break circular dep at module-init time.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('../verse-key/index.js') as { SURAH_AYAH_COUNTS: readonly number[] };
  cachedCounts = mod.SURAH_AYAH_COUNTS;
  return cachedCounts;
}
