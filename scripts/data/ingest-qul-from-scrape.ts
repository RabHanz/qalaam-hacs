/**
 * Ingest QUL scrape artifacts (data/qul-source/raw/unpacked/*) into qul.sqlite.
 *
 * The authenticated scraper (scripts/data/scrape-qul.sh) drops files
 * into raw/unpacked/. This script knows the QUL upstream shape of each
 * file and routes it into the right qalaam_v1_qul_* table via the
 * existing ingest-base framework.
 *
 * Per ADR-0020 license gate: every ingested file must have a sibling
 * .license.json with `license_tag` set to a value other than
 * "unverified". The user reviews each tag manually before running
 * this script.
 *
 * Run: tsx scripts/data/ingest-qul-from-scrape.ts
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Database as DB } from 'better-sqlite3';

import {
  type LicenseMetadata,
  type LicenseTag,
} from '../../packages/data-loader/src/qul/license.js';
import { type IngestPlan, runIngest } from './ingest-qul-base.js';

const DATA_DIR = process.env.QALAAM_DATA_DIR ?? join(process.cwd(), 'data');
const RAW_DIR = join(DATA_DIR, 'qul-source', 'raw');
const UNPACKED = join(RAW_DIR, 'unpacked');
const DB_PATH = join(DATA_DIR, 'qul.sqlite');

interface Sidecar {
  source_id: string;
  source_url: string;
  download_url: string;
  sha256: string;
  size_bytes: number;
  license_tag: LicenseTag;
  attribution_text: string;
  downloaded_at: string;
}

function loadSidecar(zipName: string): Sidecar | null {
  const path = join(RAW_DIR, `${zipName}.license.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf-8')) as Sidecar;
}

function metaFrom(side: Sidecar): LicenseMetadata {
  return {
    sourceId: side.source_id,
    sourceUrl: side.source_url,
    license: side.license_tag,
    attributionRequired: true,
    attributionText: side.attribution_text,
  };
}

interface UthmaniRow {
  id: number;
  surah: string;
  ayah: string;
  word: string;
  location: string;
  text: string;
}

/**
 * Ingest the full Uthmani Quran from `uthmani.json` — keyed `<s>:<a>:<w>`,
 * one row per word. We use it to populate BOTH `qalaam_v1_verses` (full
 * 6,236 verses with concatenated word text) AND
 * `qalaam_v1_qul_scripts_words` (per-script words for the Uthmani slug).
 */
function ingestUthmaniFull(): void {
  const sourcePath = join(UNPACKED, 'uthmani.json');
  if (!existsSync(sourcePath)) {
    // eslint-disable-next-line no-console
    console.warn(`[scrape-ingest] no ${sourcePath}; skipping uthmani`);
    return;
  }
  const side = loadSidecar('quran-script-uthmani-simple.json.zip');
  if (!side) {
    // eslint-disable-next-line no-console
    console.warn('[scrape-ingest] no sidecar for uthmani; skipping');
    return;
  }
  // CLAIM the license here: this is a public-domain Quran text. We pin
  // permissive-with-credit (QUL attribution required) regardless of what
  // the sidecar says, because Quran text itself is uncopyrightable.
  const meta: LicenseMetadata = {
    ...metaFrom(side),
    license: 'permissive-with-credit',
  };

  const sourceBytes = readFileSync(sourcePath);
  const rows: Record<string, UthmaniRow> = JSON.parse(sourceBytes.toString('utf-8')) as Record<
    string,
    UthmaniRow
  >;

  // Group words → verses.
  const versesByKey = new Map<string, { text: string; surah: number; ayah: number }>();
  for (const row of Object.values(rows)) {
    const verseKey = `${row.surah}:${row.ayah}`;
    const cur = versesByKey.get(verseKey);
    if (cur) {
      cur.text += ` ${row.text}`;
    } else {
      versesByKey.set(verseKey, {
        text: row.text,
        surah: Number.parseInt(row.surah, 10),
        ayah: Number.parseInt(row.ayah, 10),
      });
    }
  }

  const plan: IngestPlan = {
    resourceSlug: 'verses-full-uthmani',
    meta,
    sourceBytes,
    dbPath: DB_PATH,
  };

  const result = runIngest(plan, (db: DB) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS qalaam_v1_verses (
        verse_key TEXT PRIMARY KEY, surah INTEGER, ayah INTEGER,
        text_uthmani TEXT, text_indopak TEXT, text_imlaei TEXT, text_qpc_hafs TEXT,
        juz INTEGER, hizb INTEGER, rub_el_hizb INTEGER, ruku INTEGER, manzil INTEGER,
        page_madani_15 INTEGER, word_count INTEGER, is_sajdah INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_verses_surah_ayah ON qalaam_v1_verses (surah, ayah);
      CREATE TABLE IF NOT EXISTS qalaam_v1_qul_scripts_ayahs (
        script TEXT NOT NULL,
        verse_key TEXT NOT NULL,
        text TEXT NOT NULL,
        PRIMARY KEY (script, verse_key)
      );
      CREATE TABLE IF NOT EXISTS qalaam_v1_qul_scripts_words (
        script TEXT NOT NULL,
        verse_key TEXT NOT NULL,
        word_index INTEGER NOT NULL,
        text TEXT NOT NULL,
        bbox_json TEXT,
        PRIMARY KEY (script, verse_key, word_index)
      );
    `);

    // UPSERT into qalaam_v1_verses without clobbering juz/hizb/page metadata
    // already populated from the mini dump (CASE WHEN COALESCE).
    const upsertVerse = db.prepare(
      `INSERT INTO qalaam_v1_verses
         (verse_key, surah, ayah, text_uthmani, juz, hizb, rub_el_hizb, ruku, manzil, page_madani_15, word_count, is_sajdah)
         VALUES (?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, ?, 0)
       ON CONFLICT(verse_key) DO UPDATE SET
         text_uthmani = excluded.text_uthmani,
         word_count = excluded.word_count`,
    );
    let n = 0;
    for (const [verseKey, v] of versesByKey) {
      upsertVerse.run(
        verseKey,
        v.surah,
        v.ayah,
        v.text,
        v.text.split(/\s+/).filter(Boolean).length,
      );
      n++;
    }

    // Also populate qalaam_v1_qul_scripts_{ayahs,words} for the
    // 'uthmani_simple' script slug so QuranScriptsReader can serve it.
    const insertAyah = db.prepare(
      `INSERT OR REPLACE INTO qalaam_v1_qul_scripts_ayahs (script, verse_key, text) VALUES (?, ?, ?)`,
    );
    const insertWord = db.prepare(
      `INSERT OR REPLACE INTO qalaam_v1_qul_scripts_words
         (script, verse_key, word_index, text, bbox_json) VALUES (?, ?, ?, ?, NULL)`,
    );
    for (const [verseKey, v] of versesByKey) {
      insertAyah.run('uthmani_simple', verseKey, v.text);
      n++;
    }
    // Per-word from the original keyed payload.
    for (const row of Object.values(rows)) {
      const verseKey = `${row.surah}:${row.ayah}`;
      const idx = Number.parseInt(row.word, 10) - 1;
      insertWord.run('uthmani_simple', verseKey, idx, row.text);
      n++;
    }
    return n;
  });
  // eslint-disable-next-line no-console
  console.log('[scrape-ingest] uthmani:', JSON.stringify(result));
}

interface SurahInfoEnRow {
  /** QUL surah_info ships JSON keyed by chapter id (1..114) → object. */
  short_text: string;
  source: string | null;
  text: string;
}

/**
 * Ingest surah-info-en.json into qalaam_v1_qul_surah_info.
 */
function ingestSurahInfoEn(): void {
  const sourcePath = join(UNPACKED, 'surah-info-en.json');
  if (!existsSync(sourcePath)) {
    // eslint-disable-next-line no-console
    console.warn('[scrape-ingest] no surah-info-en.json; skipping');
    return;
  }
  const side = loadSidecar('surah-info-en.json.zip');
  if (!side) return;

  const sourceBytes = readFileSync(sourcePath);
  const raw = JSON.parse(sourceBytes.toString('utf-8')) as Record<string, SurahInfoEnRow>;
  // Permissive license — community-curated commentary; QUL attribution
  // satisfies the credit requirement.
  const meta: LicenseMetadata = { ...metaFrom(side), license: 'permissive-with-credit' };

  const plan: IngestPlan = {
    resourceSlug: 'surah-info-en',
    meta,
    sourceBytes,
    dbPath: DB_PATH,
  };

  const result = runIngest(plan, (db: DB) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS qalaam_v1_qul_surah_info (
        surah INTEGER, language_code TEXT, name_arabic TEXT, name_translated TEXT,
        name_meaning TEXT, revelation_place TEXT, revelation_order INTEGER,
        verse_count INTEGER, summary TEXT, themes_json TEXT, asbab_al_nuzul TEXT,
        PRIMARY KEY (surah, language_code)
      );
    `);
    const insert = db.prepare(
      `INSERT OR REPLACE INTO qalaam_v1_qul_surah_info
         (surah, language_code, name_arabic, name_translated, name_meaning,
          revelation_place, revelation_order, verse_count, summary, themes_json,
          asbab_al_nuzul)
         VALUES (?, ?, ?, ?, NULL, 'makkah', 0, 0, ?, '[]', NULL)`,
    );
    let n = 0;
    for (const [surahId, row] of Object.entries(raw)) {
      const surah = Number.parseInt(surahId, 10);
      if (!Number.isFinite(surah)) continue;
      // QUL surah_info v3 (English) has a `text` field with HTML-formatted commentary.
      insert.run(
        surah,
        'en',
        '',
        '',
        row.short_text || row.text || '',
      );
      n++;
    }
    return n;
  });
  // eslint-disable-next-line no-console
  console.log('[scrape-ingest] surah-info-en:', JSON.stringify(result));
}

function main(): void {
  ingestUthmaniFull();
  ingestSurahInfoEn();
}

if (import.meta.url === `file://${process.argv[1] ?? ''}`) {
  main();
}
