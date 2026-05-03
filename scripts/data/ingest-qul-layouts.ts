/**
 * Ingest script — Mushaf layouts (pages + per-line words).
 *
 * Per-layout license: `permissive-with-credit` for community layouts;
 * `kfgqpc-terms` for KFGQPC V1/V2/V4; `digitalkhatt-anane` for DigitalKhatt.
 * License is supplied PER layout via the source payload's `license_tag` field
 * (defaults to `permissive-with-credit` if absent).
 *
 * Source: `data/qul-source/layouts/<slug>.json` — one file per layout slug.
 *
 * Run: `tsx scripts/data/ingest-qul-layouts.ts <slug>` (e.g., `madani_15`)
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Database as DB } from 'better-sqlite3';

import {
  type LicenseMetadata,
  type LicenseTag,
} from '../../packages/data-loader/src/qul/license.js';
import { type IngestPlan, runIngest } from './ingest-qul-base.js';

const DATA_DIR = process.env.QALAAM_DATA_DIR ?? join(process.cwd(), 'data');
const DB_PATH = join(DATA_DIR, 'qul.sqlite');

interface LayoutPayload {
  layout_slug: string;
  source_id: string;
  source_url: string;
  license_tag?: LicenseTag;
  attribution_text: string;
  pages: {
    page_number: number;
    line_number: number;
    line_type: 'ayah' | 'surah_name' | 'basmallah';
    alignment: 'left' | 'right' | 'center' | 'justify';
    first_word_id: number | null;
    last_word_id: number | null;
    surah: number | null;
    lines_per_page: number;
  }[];
  words: {
    page_number: number;
    line_number: number;
    word_id: number;
    word_index: number;
    verse_key: string;
    text: string;
  }[];
}

function ensureTables(db: DB): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS qalaam_v1_qul_layouts_pages (
      layout          TEXT    NOT NULL,
      page_number     INTEGER NOT NULL,
      line_number     INTEGER NOT NULL,
      line_type       TEXT    NOT NULL CHECK (line_type IN ('ayah','surah_name','basmallah')),
      alignment       TEXT    NOT NULL,
      first_word_id   INTEGER,
      last_word_id    INTEGER,
      surah           INTEGER,
      lines_per_page  INTEGER NOT NULL,
      PRIMARY KEY (layout, page_number, line_number)
    );
    CREATE TABLE IF NOT EXISTS qalaam_v1_qul_layouts_words (
      layout      TEXT    NOT NULL,
      page_number INTEGER NOT NULL,
      line_number INTEGER NOT NULL,
      word_id     INTEGER NOT NULL,
      word_index  INTEGER NOT NULL,
      verse_key   TEXT    NOT NULL,
      text        TEXT    NOT NULL,
      PRIMARY KEY (layout, word_id)
    );
    CREATE INDEX IF NOT EXISTS idx_layouts_words_line ON qalaam_v1_qul_layouts_words (layout, page_number, line_number, word_index);
    CREATE INDEX IF NOT EXISTS idx_layouts_words_verse ON qalaam_v1_qul_layouts_words (layout, verse_key, word_index);
  `);
}

function ingestLayout(slug: string): void {
  const sourcePath = join(DATA_DIR, 'qul-source', 'layouts', `${slug}.json`);
  const sourceBytes = readFileSync(sourcePath);
  const payload = JSON.parse(sourceBytes.toString('utf-8')) as LayoutPayload;

  const meta: LicenseMetadata = {
    sourceId: payload.source_id,
    sourceUrl: payload.source_url,
    license: payload.license_tag ?? 'permissive-with-credit',
    attributionRequired: true,
    attributionText: payload.attribution_text,
  };

  const plan: IngestPlan = {
    resourceSlug: `layouts:${slug}`,
    meta,
    sourceBytes,
    dbPath: DB_PATH,
  };

  const result = runIngest(plan, (db) => {
    ensureTables(db);
    let n = 0;
    const insertPage = db.prepare(
      `INSERT OR REPLACE INTO qalaam_v1_qul_layouts_pages
         (layout, page_number, line_number, line_type, alignment,
          first_word_id, last_word_id, surah, lines_per_page)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const p of payload.pages) {
      insertPage.run(
        slug,
        p.page_number,
        p.line_number,
        p.line_type,
        p.alignment,
        p.first_word_id,
        p.last_word_id,
        p.surah,
        p.lines_per_page,
      );
      n++;
    }
    const insertWord = db.prepare(
      `INSERT OR REPLACE INTO qalaam_v1_qul_layouts_words
         (layout, page_number, line_number, word_id, word_index, verse_key, text)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const w of payload.words) {
      insertWord.run(slug, w.page_number, w.line_number, w.word_id, w.word_index, w.verse_key, w.text);
      n++;
    }
    return n;
  });
  // eslint-disable-next-line no-console
  console.log('[layouts-ingest]', slug, JSON.stringify(result));
}

function main(): void {
  const slug = process.argv[2];
  if (!slug) {
    // eslint-disable-next-line no-console
    console.error('usage: tsx scripts/data/ingest-qul-layouts.ts <layout_slug>');
    process.exit(2);
  }
  ingestLayout(slug);
}

if (import.meta.url === `file://${process.argv[1] ?? ''}`) {
  main();
}
