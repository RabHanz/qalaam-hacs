/**
 * Ingest framework for QUL resources.
 *
 * Per ADR-0020, every ingest script:
 *   1. Asserts a `LicenseMetadata` for the resource it's ingesting; refuses
 *      to write rows tagged `unverified`.
 *   2. Opens a write transaction on `data/qul.sqlite`.
 *   3. Creates the `qalaam_v1_qul_<resource>_*` table(s) if not present
 *      (idempotent re-run).
 *   4. Streams rows from the source (file path, JSON URL, or in-memory
 *      payload) into the prepared INSERT.
 *   5. Records a row in `qalaam_v1_qul_ingest_log` with: resource_slug,
 *      source_url, license, attribution_text, source_sha256, row_count,
 *      ingested_at. This is what the CI gate inspects to refuse `unverified`
 *      bundles.
 *
 * The framework is intentionally headless — no HTTP fetching here. Each
 * concrete script (`ingest-qul-metadata.ts`, etc.) decides how to obtain
 * the source bytes (per Docs/research/qul-inventory.md §4 the QUL site
 * has no API; options are headless-browser scrape or QUL repo's dev
 * Postgres dump). The ingest framework only writes.
 */
import { createHash } from 'node:crypto';

import Database, { type Database as DB } from 'better-sqlite3';

import {
  type LicenseMetadata,
  type LicenseTag,
  attributionLine,
} from '../../packages/data-loader/src/qul/license.js';

export interface IngestPlan {
  /** Resource slug — must match a `qalaam_v1_qul_<slug>_*` table family. */
  readonly resourceSlug: string;
  readonly meta: LicenseMetadata;
  /** Source bytes (for SHA + size auditing). */
  readonly sourceBytes: Uint8Array;
  /** Filesystem path to the destination SQLite. */
  readonly dbPath: string;
}

export interface IngestResult {
  readonly resourceSlug: string;
  readonly rowCount: number;
  readonly sourceSha256: string;
  readonly ingestedAt: string;
}

/**
 * Refuses to ingest if the license tag is `unverified` (CI gate).
 * Allows the rest of the ingest pipeline to assume `meta.license !== 'unverified'`.
 */
function assertLicenseClean(meta: LicenseMetadata): void {
  if ((meta.license as LicenseTag) === 'unverified') {
    throw new Error(
      `qalaam.qul.ingest.refused: license tag is 'unverified' for ` +
        `${meta.sourceId} (${meta.sourceUrl}). Pin the actual license tag ` +
        `before ingesting. See ADR-0020.`,
    );
  }
}

function ensureIngestLogTable(db: DB): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS qalaam_v1_qul_ingest_log (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      resource_slug   TEXT    NOT NULL,
      source_id       TEXT    NOT NULL,
      source_url      TEXT    NOT NULL,
      license         TEXT    NOT NULL,
      attribution     TEXT    NOT NULL,
      source_sha256   TEXT    NOT NULL,
      row_count       INTEGER NOT NULL,
      ingested_at     TEXT    NOT NULL,
      UNIQUE (resource_slug, source_sha256)
    );
  `);
}

/**
 * Generic shell. Each concrete ingest script provides a `populate` callback
 * that writes the resource's domain rows inside the same write transaction.
 * The framework handles license assertion, SHA computation, and the
 * ingest-log row.
 */
export function runIngest(
  plan: IngestPlan,
  populate: (db: DB) => number,
): IngestResult {
  assertLicenseClean(plan.meta);

  const db = new Database(plan.dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  ensureIngestLogTable(db);

  const sha = createHash('sha256').update(plan.sourceBytes).digest('hex');
  const ingestedAt = new Date().toISOString();

  const txn = db.transaction(() => {
    const rowCount = populate(db);
    db.prepare(
      `INSERT OR REPLACE INTO qalaam_v1_qul_ingest_log
        (resource_slug, source_id, source_url, license, attribution,
         source_sha256, row_count, ingested_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      plan.resourceSlug,
      plan.meta.sourceId,
      plan.meta.sourceUrl,
      plan.meta.license,
      attributionLine(plan.meta),
      sha,
      rowCount,
      ingestedAt,
    );
    return rowCount;
  });

  const rowCount = txn();
  db.close();

  return {
    resourceSlug: plan.resourceSlug,
    rowCount,
    sourceSha256: sha,
    ingestedAt,
  };
}

/**
 * CI gate helper: throws if any row in the ingest log is missing or has
 * `license = 'unverified'`. Bundle pipelines should call this before
 * shipping `data/qul.sqlite`.
 */
export function assertIngestLogClean(dbPath: string): void {
  const db = new Database(dbPath, { readonly: true });
  try {
    const unverified = db
      .prepare<[], { resource_slug: string; source_id: string }>(
        `SELECT resource_slug, source_id FROM qalaam_v1_qul_ingest_log
         WHERE license = 'unverified'`,
      )
      .all();
    if (unverified.length > 0) {
      throw new Error(
        `qalaam.qul.ingest.unverified-rows: ${JSON.stringify(unverified)}. ` +
          `Refusing to bundle. See ADR-0020.`,
      );
    }
  } finally {
    db.close();
  }
}
