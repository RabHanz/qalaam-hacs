/**
 * Reference ingest script — Quran metadata (Surah / Juz / Hizb / Rub /
 * Manzil / Ruku / Sajda). License: `factual`. Bundle-safe.
 *
 * Per ADR-0020. This is the "follow this pattern" example for the other
 * five ingest scripts (mutashabihat-v2, wbw, layouts, recitations,
 * surah-info). It demonstrates:
 *   - License assertion at the top.
 *   - Idempotent CREATE TABLE.
 *   - Row insertion inside `runIngest`'s transaction.
 *   - Ingest-log row written automatically.
 *
 * **Source bytes:** the script reads from `data/qul-source/quran-metadata.json`
 * (downloaded one-shot per the bootstrap recipe in
 * `data/README.md`). The file shape is the QUL `/resources/quran-metadata`
 * JSON export (verified shape; see Docs/research/qul-inventory.md §1 row 7).
 *
 * Run:
 *   tsx scripts/data/ingest-qul-metadata.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Database as DB } from 'better-sqlite3';

import { type LicenseMetadata } from '../../packages/data-loader/src/qul/license.js';
import { type IngestPlan, runIngest } from './ingest-qul-base.js';

const DATA_DIR = process.env.QALAAM_DATA_DIR ?? join(process.cwd(), 'data');
const SOURCE_PATH = join(DATA_DIR, 'qul-source', 'quran-metadata.json');
const DB_PATH = join(DATA_DIR, 'qul.sqlite');

interface SourcePayload {
  surahs: {
    surah: number;
    name_arabic: string;
    name_transliteration: string;
    name_english: string;
    verse_count: number;
    revelation_place: 'makkah' | 'madinah';
    revelation_order: number;
    bismillah_pre: boolean;
  }[];
  juz: { juz: number; first_verse_key: string; last_verse_key: string; verse_count: number }[];
  hizb: { hizb: number; juz: number; first_verse_key: string; last_verse_key: string }[];
  rub: { rub: number; hizb: number; first_verse_key: string }[];
  manzil: { manzil: number; first_verse_key: string; last_verse_key: string }[];
  ruku: { ruku: number; surah: number; first_verse_key: string; last_verse_key: string }[];
  sajda: { verse_key: string; type: 'recommended' | 'obligatory' }[];
}

const META: LicenseMetadata = {
  sourceId: 'qul-quran-metadata-v1',
  sourceUrl: 'https://qul.tarteel.ai/resources/quran-metadata',
  license: 'factual',
  attributionRequired: true,
  attributionText: 'Quranic Universal Library (QUL) by Tarteel AI',
};

function ensureTables(db: DB): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS qalaam_v1_qul_metadata_surahs (
      surah                INTEGER PRIMARY KEY,
      name_arabic          TEXT    NOT NULL,
      name_transliteration TEXT    NOT NULL,
      name_english         TEXT    NOT NULL,
      verse_count          INTEGER NOT NULL,
      revelation_place     TEXT    NOT NULL CHECK (revelation_place IN ('makkah','madinah')),
      revelation_order     INTEGER NOT NULL,
      bismillah_pre        INTEGER NOT NULL CHECK (bismillah_pre IN (0,1))
    );
    CREATE TABLE IF NOT EXISTS qalaam_v1_qul_metadata_juz (
      juz              INTEGER PRIMARY KEY,
      first_verse_key  TEXT    NOT NULL,
      last_verse_key   TEXT    NOT NULL,
      verse_count      INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS qalaam_v1_qul_metadata_hizb (
      hizb             INTEGER PRIMARY KEY,
      juz              INTEGER NOT NULL,
      first_verse_key  TEXT    NOT NULL,
      last_verse_key   TEXT    NOT NULL
    );
    CREATE TABLE IF NOT EXISTS qalaam_v1_qul_metadata_rub (
      rub              INTEGER PRIMARY KEY,
      hizb             INTEGER NOT NULL,
      first_verse_key  TEXT    NOT NULL
    );
    CREATE TABLE IF NOT EXISTS qalaam_v1_qul_metadata_manzil (
      manzil           INTEGER PRIMARY KEY,
      first_verse_key  TEXT    NOT NULL,
      last_verse_key   TEXT    NOT NULL
    );
    CREATE TABLE IF NOT EXISTS qalaam_v1_qul_metadata_ruku (
      ruku             INTEGER PRIMARY KEY,
      surah            INTEGER NOT NULL,
      first_verse_key  TEXT    NOT NULL,
      last_verse_key   TEXT    NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ruku_surah ON qalaam_v1_qul_metadata_ruku (surah);
    CREATE TABLE IF NOT EXISTS qalaam_v1_qul_metadata_sajda (
      verse_key  TEXT PRIMARY KEY,
      type       TEXT NOT NULL CHECK (type IN ('recommended','obligatory'))
    );
  `);
}

function populate(db: DB, payload: SourcePayload): number {
  ensureTables(db);

  let count = 0;
  const insertSurah = db.prepare(
    `INSERT OR REPLACE INTO qalaam_v1_qul_metadata_surahs
       (surah, name_arabic, name_transliteration, name_english, verse_count,
        revelation_place, revelation_order, bismillah_pre)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const s of payload.surahs) {
    insertSurah.run(
      s.surah, s.name_arabic, s.name_transliteration, s.name_english,
      s.verse_count, s.revelation_place, s.revelation_order, s.bismillah_pre ? 1 : 0,
    );
    count++;
  }
  const insertJuz = db.prepare(
    `INSERT OR REPLACE INTO qalaam_v1_qul_metadata_juz
       (juz, first_verse_key, last_verse_key, verse_count) VALUES (?, ?, ?, ?)`,
  );
  for (const j of payload.juz) {
    insertJuz.run(j.juz, j.first_verse_key, j.last_verse_key, j.verse_count);
    count++;
  }
  const insertHizb = db.prepare(
    `INSERT OR REPLACE INTO qalaam_v1_qul_metadata_hizb
       (hizb, juz, first_verse_key, last_verse_key) VALUES (?, ?, ?, ?)`,
  );
  for (const h of payload.hizb) {
    insertHizb.run(h.hizb, h.juz, h.first_verse_key, h.last_verse_key);
    count++;
  }
  const insertRub = db.prepare(
    `INSERT OR REPLACE INTO qalaam_v1_qul_metadata_rub
       (rub, hizb, first_verse_key) VALUES (?, ?, ?)`,
  );
  for (const r of payload.rub) {
    insertRub.run(r.rub, r.hizb, r.first_verse_key);
    count++;
  }
  const insertManzil = db.prepare(
    `INSERT OR REPLACE INTO qalaam_v1_qul_metadata_manzil
       (manzil, first_verse_key, last_verse_key) VALUES (?, ?, ?)`,
  );
  for (const m of payload.manzil) {
    insertManzil.run(m.manzil, m.first_verse_key, m.last_verse_key);
    count++;
  }
  const insertRuku = db.prepare(
    `INSERT OR REPLACE INTO qalaam_v1_qul_metadata_ruku
       (ruku, surah, first_verse_key, last_verse_key) VALUES (?, ?, ?, ?)`,
  );
  for (const r of payload.ruku) {
    insertRuku.run(r.ruku, r.surah, r.first_verse_key, r.last_verse_key);
    count++;
  }
  const insertSajda = db.prepare(
    `INSERT OR REPLACE INTO qalaam_v1_qul_metadata_sajda (verse_key, type) VALUES (?, ?)`,
  );
  for (const s of payload.sajda) {
    insertSajda.run(s.verse_key, s.type);
    count++;
  }
  return count;
}

function main(): void {
  const sourceBytes = readFileSync(SOURCE_PATH);
  const payload = JSON.parse(sourceBytes.toString('utf-8')) as SourcePayload;
  const plan: IngestPlan = {
    resourceSlug: 'metadata',
    meta: META,
    sourceBytes,
    dbPath: DB_PATH,
  };
  const result = runIngest(plan, (db) => populate(db, payload));
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
