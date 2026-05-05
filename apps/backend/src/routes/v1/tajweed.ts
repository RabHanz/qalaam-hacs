/**
 * GET /v1/tajweed/:verseKey → tajweed rule annotations for a verse.
 *
 * Annotations are character offsets into the Hafs Uthmani text of the
 * verse, sourced from cpfair/quran-tajweed (MIT). Frontend uses these
 * to color-code each rule when rendering the v4 ("Tajweed") layout.
 *
 * Response shape:
 *   {
 *     "verseKey": "2:255",
 *     "annotations": [
 *       { "start": 0, "end": 7,  "rule": "ghunnah" },
 *       { "start": 12, "end": 14, "rule": "qalqalah" },
 *       ...
 *     ],
 *     "source": "cpfair/quran-tajweed (MIT)",
 *     "license": "MIT"
 *   }
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import Database from 'better-sqlite3';

import type { Database as DB } from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';

let cachedDb: DB | undefined;
function qulDb(): DB | undefined {
  if (cachedDb) return cachedDb;
  const path = process.env.QUL_SQLITE_PATH ?? join(process.cwd(), 'data', 'qul.sqlite');
  if (!existsSync(path)) return undefined;
  try {
    cachedDb = new Database(path, { readonly: true, fileMustExist: true });
    return cachedDb;
  } catch {
    return undefined;
  }
}

interface AnnotationRow {
  start_idx: number;
  end_idx: number;
  rule: string;
}

export async function tajweedRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/v1/tajweed/:verseKey',
    {
      schema: {
        description: 'Tajweed rule annotations for a verse (Hafs Uthmani).',
        tags: ['tajweed'],
        params: {
          type: 'object',
          properties: { verseKey: { type: 'string' } },
          required: ['verseKey'],
        },
      },
    },
    async (req, reply) => {
      const { verseKey } = req.params as { verseKey: string };
      void reply.header('cache-control', 'public, max-age=604800');
      const db = qulDb();
      if (!db) {
        return reply
          .code(503)
          .send({ error: 'tajweed.db-unavailable', message: 'qul.sqlite not loaded' });
      }
      const rows = db
        .prepare<[string], AnnotationRow>(
          `SELECT start_idx, end_idx, rule
           FROM qalaam_v1_tajweed_annotations
           WHERE verse_key = ?
           ORDER BY start_idx, end_idx`,
        )
        .all(verseKey);
      return reply.send({
        verseKey,
        annotations: rows.map((r) => ({ start: r.start_idx, end: r.end_idx, rule: r.rule })),
        source: 'cpfair/quran-tajweed',
        license: 'MIT',
      });
    },
  );
}
