/**
 * Ingest script — Word-by-word translations + (license-gated) morphology.
 *
 * Translation surface: `permissive-with-credit` per pack. Morphology
 * surface: `gpl-derivative` (Quranic Arabic Corpus). Per ADR-0020 the
 * morphology rows are still ingested into a separate table; the gating
 * happens at READ time via `WordByWordReader.enableMorphology` and the
 * `?include=morphology` query parameter on the public route.
 *
 * Source bytes:
 *   data/qul-source/wbw-translations-en.json
 *   data/qul-source/morphology.json (optional — skipped if absent)
 *
 * Run: `tsx scripts/data/ingest-qul-wbw.ts`
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Database as DB } from 'better-sqlite3';

import { type LicenseMetadata } from '../../packages/data-loader/src/qul/license.js';
import { type IngestPlan, runIngest } from './ingest-qul-base.js';

const DATA_DIR = process.env.QALAAM_DATA_DIR ?? join(process.cwd(), 'data');
const TRANSLATION_PATH = join(DATA_DIR, 'qul-source', 'wbw-translations-en.json');
const MORPHOLOGY_PATH = join(DATA_DIR, 'qul-source', 'morphology.json');
const DB_PATH = join(DATA_DIR, 'qul.sqlite');

interface TranslationPayload {
  words: {
    verse_key: string;
    word_index: number;
    text_arabic: string;
    translation: string;
    language_code: string;
  }[];
}

interface MorphologyPayload {
  words: {
    verse_key: string;
    word_index: number;
    root: string | null;
    lemma: string | null;
    stem: string | null;
    pos: string | null;
    irab: string | null;
  }[];
}

const TRANSLATION_META: LicenseMetadata = {
  sourceId: 'qul-wbw-en-corpus',
  sourceUrl: 'https://qul.tarteel.ai/resources/translation',
  license: 'permissive-with-credit',
  attributionRequired: true,
  attributionText: 'Quranic Universal Library (QUL) — Quranic Arabic Corpus word-by-word (English)',
};

const MORPHOLOGY_META: LicenseMetadata = {
  sourceId: 'qul-morphology',
  sourceUrl: 'https://qul.tarteel.ai/resources/morphology',
  license: 'gpl-derivative',
  attributionRequired: true,
  attributionText: 'Quranic Arabic Corpus by Dr. Kais Dukes (via QUL)',
};

function ensureTables(db: DB): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS qalaam_v1_qul_wbw_translations (
      verse_key      TEXT NOT NULL,
      word_index     INTEGER NOT NULL,
      text_arabic    TEXT NOT NULL,
      translation    TEXT NOT NULL,
      language_code  TEXT NOT NULL,
      PRIMARY KEY (verse_key, word_index, language_code)
    );
    CREATE TABLE IF NOT EXISTS qalaam_v1_qul_morphology (
      verse_key   TEXT NOT NULL,
      word_index  INTEGER NOT NULL,
      root        TEXT,
      lemma       TEXT,
      stem        TEXT,
      pos         TEXT,
      irab        TEXT,
      PRIMARY KEY (verse_key, word_index)
    );
  `);
}

function ingestTranslations(): void {
  if (!existsSync(TRANSLATION_PATH)) {
    // eslint-disable-next-line no-console
    console.warn(`[wbw-ingest] no ${TRANSLATION_PATH}; skipping translations`);
    return;
  }
  const sourceBytes = readFileSync(TRANSLATION_PATH);
  const payload = JSON.parse(sourceBytes.toString('utf-8')) as TranslationPayload;
  const plan: IngestPlan = {
    resourceSlug: 'wbw-translations',
    meta: TRANSLATION_META,
    sourceBytes,
    dbPath: DB_PATH,
  };
  const result = runIngest(plan, (db) => {
    ensureTables(db);
    const insert = db.prepare(
      `INSERT OR REPLACE INTO qalaam_v1_qul_wbw_translations
         (verse_key, word_index, text_arabic, translation, language_code)
         VALUES (?, ?, ?, ?, ?)`,
    );
    let n = 0;
    for (const w of payload.words) {
      insert.run(w.verse_key, w.word_index, w.text_arabic, w.translation, w.language_code);
      n++;
    }
    return n;
  });
  // eslint-disable-next-line no-console
  console.log('[wbw-ingest] translations:', JSON.stringify(result));
}

function ingestMorphology(): void {
  if (!existsSync(MORPHOLOGY_PATH)) {
    // eslint-disable-next-line no-console
    console.warn(`[wbw-ingest] no ${MORPHOLOGY_PATH}; skipping morphology (gpl-derivative)`);
    return;
  }
  const sourceBytes = readFileSync(MORPHOLOGY_PATH);
  const payload = JSON.parse(sourceBytes.toString('utf-8')) as MorphologyPayload;
  const plan: IngestPlan = {
    resourceSlug: 'morphology',
    meta: MORPHOLOGY_META,
    sourceBytes,
    dbPath: DB_PATH,
  };
  const result = runIngest(plan, (db) => {
    ensureTables(db);
    const insert = db.prepare(
      `INSERT OR REPLACE INTO qalaam_v1_qul_morphology
         (verse_key, word_index, root, lemma, stem, pos, irab)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    let n = 0;
    for (const w of payload.words) {
      insert.run(w.verse_key, w.word_index, w.root, w.lemma, w.stem, w.pos, w.irab);
      n++;
    }
    return n;
  });
  // eslint-disable-next-line no-console
  console.log('[wbw-ingest] morphology:', JSON.stringify(result));
}

function main(): void {
  ingestTranslations();
  ingestMorphology();
}

if (import.meta.url === `file://${process.argv[1] ?? ''}`) {
  main();
}
