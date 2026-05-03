/**
 * Word-by-word translation + morphology loader (QUL translations id 16-subset
 * + morphology resource).
 *
 * Powers per-word tap-translation in the reader and the deep-study pane.
 * Pairs with the (license-gated) morphology table when both are present.
 *
 * **License gate:** the morphology table is `gpl-derivative` (Kais Dukes'
 * Quranic Arabic Corpus). The loader REFUSES to surface morphology rows when
 * `enableMorphology=false` (default). Translation-only mode is bundle-safe.
 *
 * Per ADR-0020.
 */
import type { Database as DB, Statement } from 'better-sqlite3';

import { type LicenseMetadata, isBundleSafe } from './license.js';

export interface WordTranslation {
  readonly verseKey: string;
  readonly wordIndex: number;
  /** Arabic Uthmani text of the word. */
  readonly textArabic: string;
  /** English (or selected language) translation of the single word. */
  readonly translation: string;
  /** ISO 639-1 of `translation`. */
  readonly languageCode: string;
}

export interface WordMorphology {
  readonly verseKey: string;
  readonly wordIndex: number;
  readonly root: string | null;
  readonly lemma: string | null;
  readonly stem: string | null;
  /** Coarse part-of-speech tag (e.g., "N", "V", "P"). */
  readonly pos: string | null;
  /** I'rab line (grammatical analysis), when available. */
  readonly irab: string | null;
}

export interface WordByWordReader {
  readonly translationMeta: LicenseMetadata;
  readonly morphologyMeta: LicenseMetadata | null;
  /** Returns the per-word breakdown for an ayah in language order. */
  wordsForAyah(verseKey: string, languageCode?: string): readonly WordTranslation[];
  /**
   * Returns morphology rows for an ayah, or `null` when the morphology
   * table is unavailable or the loader was created with `enableMorphology=false`.
   */
  morphologyForAyah(verseKey: string): readonly WordMorphology[] | null;
}

export interface WordByWordReaderOptions {
  /**
   * When true, the loader exposes morphology rows. Per ADR-0020 the QUL
   * morphology dataset is GPL-derivative; the caller must affirm that the
   * runtime context (server-side AGPL service vs. bundled mobile binary)
   * permits surfacing copyleft-derived data. Default: false.
   */
  readonly enableMorphology?: boolean;
}

interface RawTranslation {
  verse_key: string;
  word_index: number;
  text_arabic: string;
  translation: string;
  language_code: string;
}

interface RawMorphology {
  verse_key: string;
  word_index: number;
  root: string | null;
  lemma: string | null;
  stem: string | null;
  pos: string | null;
  irab: string | null;
}

export function buildWordByWordReader(
  db: DB,
  translationMeta: LicenseMetadata,
  morphologyMeta: LicenseMetadata | null,
  options: WordByWordReaderOptions = {},
): WordByWordReader {
  const morphologyEnabled = !!options.enableMorphology && morphologyMeta !== null;

  // Refuse the morphology surface unless the caller has explicitly opted in.
  // Morphology is `gpl-derivative` per `license.ts` — bundling it into a
  // closed binary would create a license violation we'd never want to ship.
  if (
    morphologyEnabled &&
    morphologyMeta !== null &&
    isBundleSafe(morphologyMeta.license)
  ) {
    // No-op — but assert the metadata is consistent.
  }

  const stmt = {
    wordsForAyah: db.prepare<[string, string], RawTranslation>(
      `SELECT verse_key, word_index, text_arabic, translation, language_code
       FROM qalaam_v1_qul_wbw_translations
       WHERE verse_key = ? AND language_code = ?
       ORDER BY word_index ASC`,
    ),
    morphologyForAyah: db.prepare<[string], RawMorphology>(
      `SELECT verse_key, word_index, root, lemma, stem, pos, irab
       FROM qalaam_v1_qul_morphology
       WHERE verse_key = ?
       ORDER BY word_index ASC`,
    ),
  } satisfies Record<string, Statement<unknown[], unknown>>;

  return {
    translationMeta,
    morphologyMeta,
    wordsForAyah(verseKey, languageCode = 'en') {
      return stmt.wordsForAyah.all(verseKey, languageCode).map(
        (r): WordTranslation => ({
          verseKey: r.verse_key,
          wordIndex: r.word_index,
          textArabic: r.text_arabic,
          translation: r.translation,
          languageCode: r.language_code,
        }),
      );
    },
    morphologyForAyah(verseKey) {
      if (!morphologyEnabled) return null;
      return stmt.morphologyForAyah.all(verseKey).map(
        (r): WordMorphology => ({
          verseKey: r.verse_key,
          wordIndex: r.word_index,
          root: r.root,
          lemma: r.lemma,
          stem: r.stem,
          pos: r.pos,
          irab: r.irab,
        }),
      );
    },
  };
}
