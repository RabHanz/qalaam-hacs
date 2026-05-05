/**
 * GET /v1/recitations → list of reciters Qalaam supports.
 * GET /v1/reciters    → alias for the HA coordinator.
 * GET /v1/audio/by_verse/:verseKey/:reciter → resolved per-ayah audio URL.
 *
 * Source: `qalaam_v1_qul_recitations_reciters` joined with the in-process
 * license registry. Reciters absent from the registry are filtered out
 * (fail-closed per ADR-0020). Per-ayah audio URLs come from
 * `qalaam_v1_qul_recitations_audio` (populated by the QUL recitation ingest).
 */
import { existsSync } from 'node:fs';

import { QalaamError, parseVerseKey } from '@qalaam/core';
import Database from 'better-sqlite3';

import { LICENSE_METADATA } from '../../lib/qul-license-registry.js';

import type { Config } from '../../config.js';
import type { Database as DB } from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';

interface ReciterPayload {
  readonly id: string; // canonical slug — keeps stability when QUL renumbers
  readonly slug: string;
  readonly name: { readonly en: string; readonly ar: string };
  readonly style: 'murattal' | 'mujawwad' | 'muallim';
  readonly riwayah: string;
  readonly segmentCoverage: number;
  readonly attribution: string;
  readonly license: string;
}

let cachedDb: DB | undefined;
function openReadOnly(path: string): DB {
  if (!existsSync(path)) {
    throw new QalaamError(
      'qalaam.data.not-loaded',
      `QUL SQLite not present at ${path}. Run \`make data-fetch\` then \`python3 scripts/data/ingest-qul-extras.py\`.`,
    );
  }
  cachedDb ??= new Database(path, { readonly: true, fileMustExist: true });
  return cachedDb;
}

// eslint-disable-next-line @typescript-eslint/require-await -- fastify register signature requires Promise<void> for symmetry; body does not await.
export async function recitationsRoutes(
  fastify: FastifyInstance,
  opts: { config: Config },
): Promise<void> {
  function listReciters(): readonly ReciterPayload[] {
    const db = openReadOnly(opts.config.QUL_SQLITE_PATH);
    const rows = db
      .prepare<
        [],
        {
          reciter_id: string;
          name_arabic: string;
          name_english: string;
          style: 'murattal' | 'mujawwad' | 'muallim';
          riwayah: string;
        }
      >(
        `SELECT reciter_id, name_arabic, name_english, style, riwayah
         FROM qalaam_v1_qul_recitations_reciters
         ORDER BY name_english ASC`,
      )
      .all();

    // Compute REAL segment coverage = number of distinct verses in
    // qalaam_v1_qul_recitations_segments per reciter. The
    // `segment_coverage` column on the reciters table was set to the
    // audio-coverage value (6,236 for everyone) during ingest, so it
    // can't be trusted. This subquery runs once per /v1/reciters
    // request and is cached for an hour by Fastify's reply header.
    const segCoverage = new Map<string, number>(
      db
        .prepare<[], { reciter_id: string; cnt: number }>(
          `SELECT reciter_id, COUNT(DISTINCT verse_key) AS cnt
           FROM qalaam_v1_qul_recitations_segments
           GROUP BY reciter_id`,
        )
        .all()
        .map((r) => [r.reciter_id, r.cnt]),
    );
    // Aligned (heuristic) segments table — also counts toward coverage
    // because the player can highlight from it. Best-effort: the table
    // may not exist yet on a fresh DB.
    try {
      const aligned = db
        .prepare<[], { reciter_id: string; cnt: number }>(
          `SELECT reciter_id, COUNT(DISTINCT verse_key) AS cnt
           FROM qalaam_v1_recitations_segments_aligned
           GROUP BY reciter_id`,
        )
        .all();
      for (const r of aligned) {
        segCoverage.set(r.reciter_id, (segCoverage.get(r.reciter_id) ?? 0) + r.cnt);
      }
    } catch {
      /* aligned table not yet created — fine */
    }

    return rows.flatMap((r): readonly ReciterPayload[] => {
      const lic = LICENSE_METADATA.recitersByReciterId.get(r.reciter_id);
      if (!lic) return []; // fail-closed: reciter present in DB but not licensed
      return [
        {
          id: r.reciter_id,
          slug: r.reciter_id,
          name: { en: r.name_english, ar: r.name_arabic },
          style: r.style,
          riwayah: r.riwayah,
          segmentCoverage: segCoverage.get(r.reciter_id) ?? 0,
          attribution: lic.attributionText,
          license: lic.license,
        },
      ];
    });
  }

  const handler = async (
    _request: unknown,
    reply: { header: (k: string, v: string) => unknown },
    // eslint-disable-next-line @typescript-eslint/require-await -- fastify route handlers must be async; body is sync.
  ): Promise<{ reciters: readonly ReciterPayload[]; api_version: string }> => {
    void reply.header('cache-control', 'public, max-age=3600');
    return { reciters: listReciters(), api_version: '0.0.2' };
  };

  fastify.get(
    '/v1/recitations',
    { schema: { description: 'List supported reciters.', tags: ['recitations'] } },
    handler,
  );
  fastify.get(
    '/v1/reciters',
    { schema: { description: 'Alias of /v1/recitations.', tags: ['recitations'] } },
    handler,
  );

  fastify.get<{ Params: { verseKey: string; reciter: string } }>(
    '/v1/audio/by_verse/:verseKey/:reciter',
    {
      schema: {
        description:
          'Per-ayah audio URL for a reciter — pulled from qalaam_v1_qul_recitations_audio.',
        tags: ['recitations'],
        params: {
          type: 'object',
          properties: {
            verseKey: { type: 'string', pattern: '^[0-9]+:[0-9]+$' },
            reciter: { type: 'string', pattern: '^[a-z0-9-]+$' },
          },
          required: ['verseKey', 'reciter'],
        },
      },
    },
    async (request, reply) => {
      const verseKey = parseVerseKey(request.params.verseKey);
      const lic = LICENSE_METADATA.recitersByReciterId.get(request.params.reciter);
      if (!lic) {
        throw new QalaamError(
          'qalaam.adapter.capability-unsupported',
          `Reciter ${request.params.reciter} is not licensed; audio refused. See ADR-0020.`,
          { outcomeImpacted: 'O-06' },
        );
      }
      const db = openReadOnly(opts.config.QUL_SQLITE_PATH);
      const row = db
        .prepare<[string, string], { audio_url: string; duration_ms: number | null }>(
          `SELECT audio_url, duration_ms
           FROM qalaam_v1_qul_recitations_audio
           WHERE reciter_id = ? AND verse_key = ?`,
        )
        .get(request.params.reciter, verseKey);

      if (!row) {
        throw new QalaamError(
          'qalaam.data.not-loaded',
          `No audio row for ${request.params.reciter}/${verseKey}.`,
        );
      }
      void reply.header('cache-control', 'public, max-age=2592000'); // 30 days — audio is immutable
      return {
        verseKey,
        reciterSlug: request.params.reciter,
        audioUrl: row.audio_url,
        durationMs: row.duration_ms,
        attribution: lic.attributionText,
        license: lic.license,
        source: 'qul',
      };
    },
  );
}
