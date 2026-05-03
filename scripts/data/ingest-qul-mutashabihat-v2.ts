/**
 * Ingest script — Mutashabihat v2 (5,277 phrase clusters + 4,001 ayah-pair
 * similarities). License: `permissive-with-credit`. Bundle-safe.
 *
 * Per ADR-0020. Source bytes from `data/qul-source/mutashabihat-v2.json`
 * (download per `data/README.md`).
 *
 * Run: `tsx scripts/data/ingest-qul-mutashabihat-v2.ts`
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Database as DB } from 'better-sqlite3';

import { type LicenseMetadata } from '../../packages/data-loader/src/qul/license.js';
import { type IngestPlan, runIngest } from './ingest-qul-base.js';

const DATA_DIR = process.env.QALAAM_DATA_DIR ?? join(process.cwd(), 'data');
const SOURCE_PATH = join(DATA_DIR, 'qul-source', 'mutashabihat-v2.json');
const DB_PATH = join(DATA_DIR, 'qul.sqlite');

interface SourcePayload {
  clusters: {
    cluster_id: string;
    shared_phrase: string;
    member_verse_keys: string[];
    member_offsets?: { verseKey: string; wordStart: number; wordEnd: number }[];
  }[];
  pairs: {
    left_verse_key: string;
    right_verse_key: string;
    score: number;
    note?: string | null;
  }[];
}

const META: LicenseMetadata = {
  sourceId: 'qul-mutashabihat-v2',
  sourceUrl: 'https://qul.tarteel.ai/resources/mutashabihat',
  license: 'permissive-with-credit',
  attributionRequired: true,
  attributionText: 'Quranic Universal Library (QUL) — community-curated mutashabihat',
};

function ensureTables(db: DB): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS qalaam_v1_qul_mutashabihat_v2_clusters (
      cluster_id        TEXT PRIMARY KEY,
      shared_phrase     TEXT NOT NULL,
      member_verse_keys TEXT NOT NULL, -- JSON array
      member_offsets    TEXT           -- nullable JSON array
    );
    CREATE TABLE IF NOT EXISTS qalaam_v1_qul_mutashabihat_v2_pairs (
      left_verse_key  TEXT NOT NULL,
      right_verse_key TEXT NOT NULL,
      score           REAL NOT NULL,
      note            TEXT,
      PRIMARY KEY (left_verse_key, right_verse_key)
    );
    CREATE INDEX IF NOT EXISTS idx_pairs_left  ON qalaam_v1_qul_mutashabihat_v2_pairs (left_verse_key, score DESC);
    CREATE INDEX IF NOT EXISTS idx_pairs_right ON qalaam_v1_qul_mutashabihat_v2_pairs (right_verse_key, score DESC);
  `);
}

function populate(db: DB, payload: SourcePayload): number {
  ensureTables(db);
  let count = 0;
  const insertCluster = db.prepare(
    `INSERT OR REPLACE INTO qalaam_v1_qul_mutashabihat_v2_clusters
       (cluster_id, shared_phrase, member_verse_keys, member_offsets)
       VALUES (?, ?, ?, ?)`,
  );
  for (const c of payload.clusters) {
    insertCluster.run(
      c.cluster_id,
      c.shared_phrase,
      JSON.stringify(c.member_verse_keys),
      c.member_offsets ? JSON.stringify(c.member_offsets) : null,
    );
    count++;
  }
  const insertPair = db.prepare(
    `INSERT OR REPLACE INTO qalaam_v1_qul_mutashabihat_v2_pairs
       (left_verse_key, right_verse_key, score, note) VALUES (?, ?, ?, ?)`,
  );
  for (const p of payload.pairs) {
    insertPair.run(p.left_verse_key, p.right_verse_key, p.score, p.note ?? null);
    count++;
  }
  return count;
}

function main(): void {
  const sourceBytes = readFileSync(SOURCE_PATH);
  const payload = JSON.parse(sourceBytes.toString('utf-8')) as SourcePayload;
  const plan: IngestPlan = {
    resourceSlug: 'mutashabihat-v2',
    meta: META,
    sourceBytes,
    dbPath: DB_PATH,
  };
  const result = runIngest(plan, (db) => populate(db, payload));
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result, null, 2));
}

if (import.meta.url === `file://${process.argv[1] ?? ''}`) {
  main();
}
