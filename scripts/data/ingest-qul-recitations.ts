/**
 * Ingest script — Recitation reciters + segmented word-level timings.
 *
 * Per ADR-0020. License: `per-reciter`. Each reciter row carries its own
 * source attribution (typically EveryAyah or QuranicAudio per the playbook
 * in `reference_2026_ai_stack.md`).
 *
 * Source: `data/qul-source/recitations/<reciter_id>.json` — one file per
 * reciter with the reciter info + segments.
 *
 * Run: `tsx scripts/data/ingest-qul-recitations.ts <reciter_id>`
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Database as DB } from 'better-sqlite3';

import { type LicenseMetadata } from '../../packages/data-loader/src/qul/license.js';
import { type IngestPlan, runIngest } from './ingest-qul-base.js';

const DATA_DIR = process.env.QALAAM_DATA_DIR ?? join(process.cwd(), 'data');
const DB_PATH = join(DATA_DIR, 'qul.sqlite');

interface ReciterPayload {
  reciter_id: string;
  source_id: string;
  source_url: string;
  attribution_text: string;
  reciter_info: {
    name_arabic: string;
    name_english: string;
    style: 'murattal' | 'mujawwad' | 'muallim';
    riwayah: string;
    segment_coverage: number;
  };
  segments: {
    verse_key: string;
    word_index: number;
    start_ms: number;
    end_ms: number;
  }[];
}

function ensureTables(db: DB): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS qalaam_v1_qul_recitations_reciters (
      reciter_id        TEXT PRIMARY KEY,
      name_arabic       TEXT NOT NULL,
      name_english      TEXT NOT NULL,
      style             TEXT NOT NULL CHECK (style IN ('murattal','mujawwad','muallim')),
      riwayah           TEXT NOT NULL,
      segment_coverage  INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS qalaam_v1_qul_recitations_segments (
      reciter_id  TEXT    NOT NULL,
      verse_key   TEXT    NOT NULL,
      word_index  INTEGER NOT NULL,
      start_ms    INTEGER NOT NULL,
      end_ms      INTEGER NOT NULL,
      PRIMARY KEY (reciter_id, verse_key, word_index)
    );
    CREATE INDEX IF NOT EXISTS idx_recitations_segments_position
      ON qalaam_v1_qul_recitations_segments (reciter_id, verse_key, start_ms, end_ms);
  `);
}

function ingestReciter(reciterId: string): void {
  const sourcePath = join(DATA_DIR, 'qul-source', 'recitations', `${reciterId}.json`);
  const sourceBytes = readFileSync(sourcePath);
  const payload = JSON.parse(sourceBytes.toString('utf-8')) as ReciterPayload;

  const meta: LicenseMetadata = {
    sourceId: payload.source_id,
    sourceUrl: payload.source_url,
    license: 'per-reciter',
    attributionRequired: true,
    attributionText: payload.attribution_text,
  };

  const plan: IngestPlan = {
    resourceSlug: `recitations:${reciterId}`,
    meta,
    sourceBytes,
    dbPath: DB_PATH,
  };

  const result = runIngest(plan, (db) => {
    ensureTables(db);
    db.prepare(
      `INSERT OR REPLACE INTO qalaam_v1_qul_recitations_reciters
         (reciter_id, name_arabic, name_english, style, riwayah, segment_coverage)
         VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      reciterId,
      payload.reciter_info.name_arabic,
      payload.reciter_info.name_english,
      payload.reciter_info.style,
      payload.reciter_info.riwayah,
      payload.reciter_info.segment_coverage,
    );
    const insertSeg = db.prepare(
      `INSERT OR REPLACE INTO qalaam_v1_qul_recitations_segments
         (reciter_id, verse_key, word_index, start_ms, end_ms)
         VALUES (?, ?, ?, ?, ?)`,
    );
    let n = 1; // reciter row counts as 1
    for (const s of payload.segments) {
      insertSeg.run(reciterId, s.verse_key, s.word_index, s.start_ms, s.end_ms);
      n++;
    }
    return n;
  });
  // eslint-disable-next-line no-console
  console.log('[recitations-ingest]', reciterId, JSON.stringify(result));
}

function main(): void {
  const reciterId = process.argv[2];
  if (!reciterId) {
    // eslint-disable-next-line no-console
    console.error('usage: tsx scripts/data/ingest-qul-recitations.ts <reciter_id>');
    process.exit(2);
  }
  ingestReciter(reciterId);
}

if (import.meta.url === `file://${process.argv[1] ?? ''}`) {
  main();
}
