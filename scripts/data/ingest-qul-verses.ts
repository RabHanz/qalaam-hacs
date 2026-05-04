/**
 * Ingest script — full Quran verses (6,236 rows) into `qalaam_v1_verses`.
 *
 * Source: `data/qul-source/_raw-export.json` produced by
 * `scripts/data/bootstrap-qul-from-dump.sh`. The `verses_basic` array
 * carries the canonical row set we need — surah, ayah, verse_key, the
 * three text variants (uthmani / indopak / imlaei), juz / hizb / rub /
 * page numbers per verse.
 *
 * Per ADR-0020. License: `permissive-with-credit` (QUL community curation).
 *
 * Run: `tsx scripts/data/ingest-qul-verses.ts`
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Database as DB } from 'better-sqlite3';

import { type LicenseMetadata } from '../../packages/data-loader/src/qul/license.js';
import { type IngestPlan, runIngest } from './ingest-qul-base.js';

const DATA_DIR = process.env.QALAAM_DATA_DIR ?? join(process.cwd(), 'data');
const SOURCE_PATH = join(DATA_DIR, 'qul-source', '_raw-export.json');
const DB_PATH = join(DATA_DIR, 'qul.sqlite');

interface RawExport {
  verses_basic?: VerseRow[];
}

interface VerseRow {
  id: number;
  verse_key: string;
  chapter_id: number;
  verse_number: number;
  text_uthmani: string | null;
  text_indopak: string | null;
  text_imlaei: string | null;
  juz_number: number;
  hizb_number: number;
  rub_el_hizb_number: number;
  page_number: number;
}

const META: LicenseMetadata = {
  sourceId: 'qul-verses-v1',
  sourceUrl: 'https://qul.tarteel.ai/resources/quran-script',
  license: 'permissive-with-credit',
  attributionRequired: true,
  attributionText: 'Quranic Universal Library (QUL) by Tarteel AI',
};

function ensureSchema(db: DB): void {
  // Idempotent — the metadata ingest already created an empty version of
  // this table; we make sure the index exists too.
  db.exec(`
    CREATE TABLE IF NOT EXISTS qalaam_v1_verses (
      verse_key TEXT PRIMARY KEY, surah INTEGER, ayah INTEGER,
      text_uthmani TEXT, text_indopak TEXT, text_imlaei TEXT, text_qpc_hafs TEXT,
      juz INTEGER, hizb INTEGER, rub_el_hizb INTEGER, ruku INTEGER, manzil INTEGER,
      page_madani_15 INTEGER, word_count INTEGER, is_sajdah INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_verses_surah_ayah ON qalaam_v1_verses (surah, ayah);
    CREATE INDEX IF NOT EXISTS idx_verses_page ON qalaam_v1_verses (page_madani_15);
  `);
}

function populate(db: DB, rows: VerseRow[]): number {
  ensureSchema(db);
  const insert = db.prepare(
    `INSERT OR REPLACE INTO qalaam_v1_verses
       (verse_key, surah, ayah, text_uthmani, text_indopak, text_imlaei, text_qpc_hafs,
        juz, hizb, rub_el_hizb, ruku, manzil,
        page_madani_15, word_count, is_sajdah)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  let n = 0;
  for (const v of rows) {
    insert.run(
      v.verse_key,
      v.chapter_id,
      v.verse_number,
      v.text_uthmani,
      v.text_indopak,
      v.text_imlaei,
      // QPC Hafs not in mini dump
      null,
      v.juz_number,
      v.hizb_number,
      v.rub_el_hizb_number,
      // ruku + manzil per-verse not in this row; left null for v1.
      null,
      null,
      v.page_number,
      v.text_uthmani ? v.text_uthmani.split(/\s+/).filter(Boolean).length : 0,
      0, // sajdah flag handled by qalaam_v1_qul_metadata_sajda
    );
    n++;
  }
  return n;
}

function main(): void {
  // Strip the SET prefix psql emits before the JSON value.
  let text = readFileSync(SOURCE_PATH, 'utf-8').replace(/^\s+/, '');
  if (!text.startsWith('{') && !text.startsWith('[')) {
    const idx = text.indexOf('{');
    if (idx === -1) throw new Error('no JSON object in source');
    text = text.slice(idx);
  }
  const sourceBytes = Buffer.from(text, 'utf-8');
  const payload = JSON.parse(text) as RawExport;
  const rows = payload.verses_basic ?? [];
  const plan: IngestPlan = {
    resourceSlug: 'verses',
    meta: META,
    sourceBytes,
    dbPath: DB_PATH,
  };
  const result = runIngest(plan, (db) => populate(db, rows));
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result, null, 2));
}

if (import.meta.url === `file://${process.argv[1] ?? ''}`) {
  main();
}
