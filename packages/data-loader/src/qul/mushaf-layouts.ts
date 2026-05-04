/**
 * Mushaf-layouts loader (QUL `/resources/mushaf-layout`, 27 layouts; 12
 * actively curated — KFGQPC V1/V2/V4, Indopak 9/13/15/16-line, Qatar,
 * Nastaleeq, DigitalKhatt, Ligature SVG).
 *
 * Hifdh users memorize *to a specific page layout* — the visual rhythm of
 * which line a verse sits on, where the page break falls, which words
 * begin a line. Page-faithful rendering across multiple layouts is the
 * O-19 unlock that the v0.1 substrate (basic Madani 15-line only) blocks.
 *
 * Per ADR-0020. Schema: `qalaam_v1_qul_layouts_*`.
 *
 * **License:** layout SOURCE matters: KFGQPC V1/V2/V4 are `kfgqpc-terms`
 * (permitted for non-commercial Quran apps; required attribution: "King
 * Fahd Glorious Quran Printing Complex"); DigitalKhatt is
 * `digitalkhatt-anane` (Dr. Amin Anane attribution required); Indopak +
 * Madani layouts are typically `permissive-with-credit`. The caller
 * passes the right `LicenseMetadata` per layout slug.
 */

import type { LicenseMetadata } from './license.js';
import type { Database as DB, Statement } from 'better-sqlite3';

/**
 * Stable layout slug. The QUL upstream slugs are reused verbatim so a
 * future "show me KFGQPC V4" call site doesn't have to translate.
 */
export type MushafLayoutSlug =
  | 'madani_15'
  | 'madani_16'
  | 'indopak_9'
  | 'indopak_13'
  | 'indopak_15'
  | 'indopak_16'
  | 'kfgqpc_v1'
  | 'kfgqpc_v2'
  | 'kfgqpc_v4'
  | 'qatar_15'
  | 'nastaleeq_15'
  | 'digitalkhatt_v1'
  | 'digitalkhatt_v2'
  | 'ligature_svg';

export type LineType = 'ayah' | 'surah_name' | 'basmallah';
export type LineAlignment = 'left' | 'right' | 'center' | 'justify';

export interface LayoutPage {
  readonly layout: MushafLayoutSlug;
  readonly pageNumber: number;
  readonly linesPerPage: number;
  readonly lines: readonly LayoutLine[];
}

export interface LayoutLine {
  readonly lineNumber: number;
  readonly lineType: LineType;
  readonly alignment: LineAlignment;
  /** First word_id (1-based, mushaf-global) on this line. Null for non-ayah lines. */
  readonly firstWordId: number | null;
  /** Last word_id on this line. Null for non-ayah lines. */
  readonly lastWordId: number | null;
  /** Surah number for surah_name lines; null otherwise. */
  readonly surah: number | null;
}

export interface LayoutWord {
  readonly wordId: number;
  readonly wordIndex: number;
  readonly verseKey: string;
  readonly text: string;
}

export interface MushafLayoutsReader {
  readonly meta: LicenseMetadata;
  /** Total page count for the given layout. */
  pageCount(layout: MushafLayoutSlug): number;
  /** All lines on a page. */
  page(layout: MushafLayoutSlug, pageNumber: number): LayoutPage | undefined;
  /** Words on a single line — for fine-grained word rendering. */
  wordsOnLine(
    layout: MushafLayoutSlug,
    pageNumber: number,
    lineNumber: number,
  ): readonly LayoutWord[];
  /** Reverse lookup: which (page, line) does this verse_key start on? */
  pageForVerse(
    layout: MushafLayoutSlug,
    verseKey: string,
  ): { page: number; line: number } | undefined;
}

interface RawPage {
  page_number: number;
  line_number: number;
  line_type: LineType;
  alignment: LineAlignment;
  first_word_id: number | null;
  last_word_id: number | null;
  surah: number | null;
  lines_per_page: number;
}

interface RawWord {
  word_id: number;
  word_index: number;
  verse_key: string;
  text: string;
}

export function buildMushafLayoutsReader(db: DB, meta: LicenseMetadata): MushafLayoutsReader {
  const stmt = {
    pageCount: db.prepare<[string], { c: number }>(
      `SELECT MAX(page_number) AS c FROM qalaam_v1_qul_layouts_pages WHERE layout = ?`,
    ),
    page: db.prepare<[string, number], RawPage>(
      `SELECT page_number, line_number, line_type, alignment,
              first_word_id, last_word_id, surah, lines_per_page
       FROM qalaam_v1_qul_layouts_pages
       WHERE layout = ? AND page_number = ?
       ORDER BY line_number ASC`,
    ),
    wordsOnLine: db.prepare<[string, number, number], RawWord>(
      // Order by word_id (global mushaf-order, 1..N over the whole
      // Quran) — NOT by word_index. word_index is per-verse, so a line
      // that spans two verses (e.g. last word of 2:2 + first words of
      // 2:3) would sort 2:3's index-0 word before 2:2's index-6 word,
      // causing visual word reordering and apparent verse mixing.
      `SELECT word_id, word_index, verse_key, text
       FROM qalaam_v1_qul_layouts_words
       WHERE layout = ? AND page_number = ? AND line_number = ?
       ORDER BY word_id ASC`,
    ),
    pageForVerse: db.prepare<[string, string], { page_number: number; line_number: number }>(
      `SELECT page_number, line_number
       FROM qalaam_v1_qul_layouts_words
       WHERE layout = ? AND verse_key = ?
       ORDER BY word_index ASC
       LIMIT 1`,
    ),
  } satisfies Record<string, Statement>;

  return {
    meta,
    pageCount(layout) {
      return stmt.pageCount.get(layout)?.c ?? 0;
    },
    page(layout, pageNumber) {
      const rows = stmt.page.all(layout, pageNumber);
      const head = rows[0];
      if (!head) return undefined;
      return {
        layout,
        pageNumber,
        linesPerPage: head.lines_per_page,
        lines: rows.map((r) => ({
          lineNumber: r.line_number,
          lineType: r.line_type,
          alignment: r.alignment,
          firstWordId: r.first_word_id,
          lastWordId: r.last_word_id,
          surah: r.surah,
        })),
      };
    },
    wordsOnLine(layout, pageNumber, lineNumber) {
      return stmt.wordsOnLine.all(layout, pageNumber, lineNumber).map((r) => ({
        wordId: r.word_id,
        wordIndex: r.word_index,
        verseKey: r.verse_key,
        text: r.text,
      }));
    },
    pageForVerse(layout, verseKey) {
      const r = stmt.pageForVerse.get(layout, verseKey);
      return r ? { page: r.page_number, line: r.line_number } : undefined;
    },
  };
}
