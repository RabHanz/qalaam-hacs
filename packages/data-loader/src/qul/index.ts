/**
 * QUL SQLite reader.
 *
 * Wraps `better-sqlite3` with prepared statements for the hot lookups Qalaam needs.
 * The SQLite file ships in `data/qul.sqlite` via Git LFS (per data/.gitattributes).
 *
 * Per ADR-0002: this is the canonical local store; online QF API is overlay only.
 *
 * **Note on schema:** the QUL upstream schema evolves. We pin reads to a
 * versioned view (`qalaam_v1_*` via `migrations/`) so a QUL bump can be
 * absorbed without rippling through every consumer.
 *
 * **Deep ingestion (ADR-0020):** in addition to the v0.1 verse + segment +
 * mutashabihat reads, this module re-exports the per-resource sub-readers
 * (metadata, mutashabihat-v2, word-by-word, etc.) so callers can compose
 * exactly the surface they need without pulling the whole QUL substrate.
 */
import { existsSync } from 'node:fs';

import { QalaamError, type VerseKey, parseVerseKey } from '@qalaam/core';
import Database, { type Database as DB, type Statement } from 'better-sqlite3';

import { type MushafLayoutsReader, buildMushafLayoutsReader } from './mushaf-layouts.js';
import {
  type MutashabihatExtendedReader,
  buildMutashabihatExtendedReader,
} from './mutashabihat-extended.js';
import { type QuranMetadataReader, buildQuranMetadataReader } from './quran-metadata.js';
import {
  type QuranScriptsReader,
  type ScriptSlug,
  buildQuranScriptsReader,
} from './quran-scripts.js';
import {
  type RecitationSegmentsReader,
  buildRecitationSegmentsReader,
} from './recitation-segments.js';
import { type SurahInfoReader, buildSurahInfoReader } from './surah-info.js';
import {
  type WordByWordReader,
  type WordByWordReaderOptions,
  buildWordByWordReader,
} from './word-by-word.js';

import type { LicenseMetadata } from './license.js';
import type {
  QulAudioSegmentRow,
  QulMushafLayoutRow,
  QulMutashabihatRow,
  QulVerseRow,
} from './types.js';

export * from './license.js';
export * from './mushaf-layouts.js';
export * from './mutashabihat-extended.js';
export * from './quran-metadata.js';
export * from './quran-scripts.js';
export * from './recitation-segments.js';
export * from './surah-info.js';
export * from './word-by-word.js';
export type { QulAudioSegmentRow, QulMushafLayoutRow, QulMutashabihatRow, QulVerseRow };

interface RawVerse {
  verse_key: string;
  surah: number;
  ayah: number;
  text_uthmani: string;
  text_indopak: string | null;
  text_imlaei: string | null;
  text_qpc_hafs: string | null;
  juz: number;
  hizb: number;
  rub_el_hizb: number;
  ruku: number;
  manzil: number;
  page_madani_15: number;
  word_count: number;
  is_sajdah: 0 | 1;
}

interface RawSegment {
  verse_key: string;
  reciter_id: string;
  word_index: number;
  start_ms: number;
  end_ms: number;
}

interface RawCluster {
  cluster_id: string;
  member_verse_keys: string; // JSON-encoded array
  shared_phrase: string;
}

export interface QulReader {
  getVerse(key: VerseKey): QulVerseRow | undefined;
  getAudioSegments(key: VerseKey, reciterId: string): QulAudioSegmentRow[];
  getMutashabihatCluster(key: VerseKey): QulMutashabihatRow[];
  getMushafLayout(layout: QulMushafLayoutRow['layout']): QulMushafLayoutRow[];
  /**
   * Per-resource sub-readers (ADR-0020). Callers attach the relevant
   * `LicenseMetadata` at open time so attribution is enforced consistently.
   */
  metadata(meta: LicenseMetadata): QuranMetadataReader;
  mutashabihatV2(meta: LicenseMetadata): MutashabihatExtendedReader;
  wordByWord(
    translationMeta: LicenseMetadata,
    morphologyMeta: LicenseMetadata | null,
    options?: WordByWordReaderOptions,
  ): WordByWordReader;
  mushafLayouts(meta: LicenseMetadata): MushafLayoutsReader;
  recitationSegments(
    reciterLicenses: ReadonlyMap<string, LicenseMetadata>,
  ): RecitationSegmentsReader;
  surahInfo(metaPerLanguage: ReadonlyMap<string, LicenseMetadata>): SurahInfoReader;
  quranScripts(scriptLicenses: ReadonlyMap<ScriptSlug, LicenseMetadata>): QuranScriptsReader;
  close(): void;
}

interface PreparedStatements {
  getVerse: Statement<[string], RawVerse | undefined>;
  getSegments: Statement<[string, string], RawSegment>;
  getClusters: Statement<[string], RawCluster>;
  getMushafLayout: Statement<
    [string],
    { layout: string; page: number; first_verse_key: string; lines_per_page: number }
  >;
}

class QulReaderImpl implements QulReader {
  private readonly db: DB;
  private readonly stmt: PreparedStatements;
  private closed = false;

  public constructor(dbPath: string) {
    if (!existsSync(dbPath)) {
      throw new QalaamError(
        'qalaam.data.not-loaded',
        `QUL SQLite not found at ${dbPath}. Run \`make data-fetch\` to download (per ADR-0002).`,
      );
    }
    this.db = new Database(dbPath, { readonly: true, fileMustExist: true });
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('temp_store = MEMORY');
    // Prepare hot statements once at open time — keeps lookups under 5ms p95.
    this.stmt = {
      getVerse: this.db.prepare<[string], RawVerse | undefined>(
        `SELECT
          verse_key, surah, ayah,
          text_uthmani, text_indopak, text_imlaei, text_qpc_hafs,
          juz, hizb, rub_el_hizb, ruku, manzil,
          page_madani_15, word_count, is_sajdah
         FROM qalaam_v1_verses
         WHERE verse_key = ?`,
      ),
      getSegments: this.db.prepare<[string, string], RawSegment>(
        `SELECT verse_key, reciter_id, word_index, start_ms, end_ms
         FROM qalaam_v1_audio_segments
         WHERE verse_key = ? AND reciter_id = ?
         ORDER BY word_index ASC`,
      ),
      getClusters: this.db.prepare<[string], RawCluster>(
        `SELECT cluster_id, member_verse_keys, shared_phrase
         FROM qalaam_v1_mutashabihat
         WHERE EXISTS (
           SELECT 1 FROM json_each(member_verse_keys) WHERE value = ?
         )`,
      ),
      getMushafLayout: this.db.prepare(
        `SELECT layout, page, first_verse_key, lines_per_page
         FROM qalaam_v1_mushaf_layouts
         WHERE layout = ?
         ORDER BY page ASC`,
      ),
    };
  }

  public getVerse(key: VerseKey): QulVerseRow | undefined {
    this.assertOpen();
    const row = this.stmt.getVerse.get(key);
    if (!row) return undefined;
    return {
      verseKey: parseVerseKey(row.verse_key),
      surah: row.surah,
      ayah: row.ayah,
      textUthmani: row.text_uthmani,
      textIndopak: row.text_indopak,
      textImlaei: row.text_imlaei,
      textQpcHafs: row.text_qpc_hafs,
      juz: row.juz,
      hizb: row.hizb,
      rubElHizb: row.rub_el_hizb,
      ruku: row.ruku,
      manzil: row.manzil,
      pageMadani15: row.page_madani_15,
      wordCount: row.word_count,
      isSajdah: row.is_sajdah === 1,
    };
  }

  public getAudioSegments(key: VerseKey, reciterId: string): QulAudioSegmentRow[] {
    this.assertOpen();
    return this.stmt.getSegments.all(key, reciterId).map((r) => ({
      verseKey: parseVerseKey(r.verse_key),
      reciterId: r.reciter_id,
      wordIndex: r.word_index,
      startMs: r.start_ms,
      endMs: r.end_ms,
    }));
  }

  public getMutashabihatCluster(key: VerseKey): QulMutashabihatRow[] {
    this.assertOpen();
    return this.stmt.getClusters.all(key).map((r) => ({
      clusterId: r.cluster_id,
      memberVerseKeys: (JSON.parse(r.member_verse_keys) as string[]).map(parseVerseKey),
      sharedPhrase: r.shared_phrase,
    }));
  }

  public getMushafLayout(layout: QulMushafLayoutRow['layout']): QulMushafLayoutRow[] {
    this.assertOpen();
    return this.stmt.getMushafLayout.all(layout).map((r) => ({
      layout: r.layout as QulMushafLayoutRow['layout'],
      page: r.page,
      firstVerseKey: parseVerseKey(r.first_verse_key),
      linesPerPage: r.lines_per_page,
    }));
  }

  public metadata(meta: LicenseMetadata): QuranMetadataReader {
    this.assertOpen();
    return buildQuranMetadataReader(this.db, meta);
  }

  public mutashabihatV2(meta: LicenseMetadata): MutashabihatExtendedReader {
    this.assertOpen();
    return buildMutashabihatExtendedReader(this.db, meta);
  }

  public wordByWord(
    translationMeta: LicenseMetadata,
    morphologyMeta: LicenseMetadata | null,
    options?: WordByWordReaderOptions,
  ): WordByWordReader {
    this.assertOpen();
    return buildWordByWordReader(this.db, translationMeta, morphologyMeta, options);
  }

  public mushafLayouts(meta: LicenseMetadata): MushafLayoutsReader {
    this.assertOpen();
    return buildMushafLayoutsReader(this.db, meta);
  }

  public recitationSegments(
    reciterLicenses: ReadonlyMap<string, LicenseMetadata>,
  ): RecitationSegmentsReader {
    this.assertOpen();
    return buildRecitationSegmentsReader(this.db, reciterLicenses);
  }

  public surahInfo(metaPerLanguage: ReadonlyMap<string, LicenseMetadata>): SurahInfoReader {
    this.assertOpen();
    return buildSurahInfoReader(this.db, metaPerLanguage);
  }

  public quranScripts(
    scriptLicenses: ReadonlyMap<ScriptSlug, LicenseMetadata>,
  ): QuranScriptsReader {
    this.assertOpen();
    return buildQuranScriptsReader(this.db, scriptLicenses);
  }

  public close(): void {
    if (this.closed) return;
    this.db.close();
    this.closed = true;
  }

  private assertOpen(): void {
    if (this.closed) {
      throw new QalaamError('qalaam.data.not-loaded', 'QulReader is closed.');
    }
  }
}

/** Open a read-only QUL reader. Caller is responsible for `close()`. */
export function openQul(dbPath: string): QulReader {
  return new QulReaderImpl(dbPath);
}
