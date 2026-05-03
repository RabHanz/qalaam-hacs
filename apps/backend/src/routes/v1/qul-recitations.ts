/**
 * GET /v1/recitations/segmented
 *   → list of segmented reciters (only those licensed in `recitersByReciterId`)
 * GET /v1/recitations/:reciterId/segments/:verseKey
 *   → word-level start_ms / end_ms timings for an ayah
 * GET /v1/recitations/:reciterId/word-at?verseKey=...&ms=...
 *   → word_index whose [start_ms, end_ms] interval contains `ms`
 *
 * Per ADR-0020. License: `per-reciter`. Cache: 1 day for segments
 * (timings rarely change after a re-mastering); per-reciter list cached
 * 1 hour because the catalog evolves with new licensed reciters.
 */
import { existsSync } from 'node:fs';

import { QalaamError } from '@qalaam/core';


import { getQul } from '../../lib/data-loader.js';
import { LICENSE_METADATA } from '../../lib/qul-license-registry.js';

import type { Config } from '../../config.js';
import type { FastifyInstance } from 'fastify';

const ONE_HOUR_S = 60 * 60;
const ONE_DAY_S = 60 * 60 * 24;
const VERSE_KEY_RE = /^[1-9][0-9]?[0-9]?:[1-9][0-9]?[0-9]?$/;

// eslint-disable-next-line @typescript-eslint/require-await
export async function qulRecitationsRoutes(
  fastify: FastifyInstance,
  opts: { config: Config },
): Promise<void> {
  function reader() {
    if (!existsSync(opts.config.QUL_SQLITE_PATH)) {
      throw new QalaamError(
        'qalaam.data.not-loaded',
        `QUL SQLite not present at ${opts.config.QUL_SQLITE_PATH}.`,
      );
    }
    return getQul(opts.config.QUL_SQLITE_PATH).recitationSegments(
      LICENSE_METADATA.recitersByReciterId,
    );
  }

  fastify.get(
    '/v1/recitations/segmented',
    { schema: { tags: ['recitations'] } },
    async (_req, reply) => {
      // Strip per-row LicenseMetadata; emit one consolidated `attribution_per_reciter`
      // so the client can render correct credits without leaking license internals.
      const reciters = reader()
        .reciters()
        .map(({ meta, ...rest }) => ({
          ...rest,
          attribution: meta.attributionText,
          license: meta.license,
        }));
      void reply.header('cache-control', `public, max-age=${ONE_HOUR_S.toString()}`);
      return { data: reciters };
    },
  );

  fastify.get<{ Params: { reciterId: string; verseKey: string } }>(
    '/v1/recitations/:reciterId/segments/:verseKey',
    { schema: { tags: ['recitations'] } },
    async (req, reply) => {
      if (!VERSE_KEY_RE.test(req.params.verseKey)) {
        throw new QalaamError(
          'qalaam.verse-key.malformed',
          `Invalid verseKey ${req.params.verseKey}`,
        );
      }
      try {
        const segments = reader().segmentsForAyah(req.params.reciterId, req.params.verseKey);
        const meta = LICENSE_METADATA.recitersByReciterId.get(req.params.reciterId);
        void reply.header('cache-control', `public, max-age=${ONE_DAY_S.toString()}`);
        return {
          data: segments,
          attribution: meta?.attributionText ?? null,
          license: meta?.license ?? null,
        };
      } catch (err) {
        if (err instanceof Error && err.message.includes('unlicensed-reciter')) {
          throw new QalaamError(
            'qalaam.adapter.capability-unsupported',
            `Reciter ${req.params.reciterId} is not licensed; segments refused. See ADR-0020.`,
          );
        }
        throw err;
      }
    },
  );

  fastify.get<{
    Params: { reciterId: string };
    Querystring: { verseKey?: string; ms?: string };
  }>(
    '/v1/recitations/:reciterId/word-at',
    { schema: { tags: ['recitations'] } },
    async (req, reply) => {
      const verseKey = req.query.verseKey ?? '';
      const ms = Number.parseInt(req.query.ms ?? '0', 10);
      if (!VERSE_KEY_RE.test(verseKey)) {
        throw new QalaamError('qalaam.verse-key.malformed', `Invalid verseKey ${verseKey}`);
      }
      try {
        const wordIndex = reader().wordAtPosition(req.params.reciterId, verseKey, ms);
        void reply.header('cache-control', 'no-store'); // playback head — never cache
        return {
          data: { reciterId: req.params.reciterId, verseKey, ms, wordIndex: wordIndex ?? null },
        };
      } catch (err) {
        if (err instanceof Error && err.message.includes('unlicensed-reciter')) {
          throw new QalaamError(
            'qalaam.adapter.capability-unsupported',
            `Reciter ${req.params.reciterId} is not licensed; word-at refused.`,
          );
        }
        throw err;
      }
    },
  );
}
