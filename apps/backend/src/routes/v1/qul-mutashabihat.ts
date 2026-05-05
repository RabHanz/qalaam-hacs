/**
 * GET /v1/mutashabihat/clusters/:verseKey
 *   → phrase clusters whose member set contains the verse_key.
 * GET /v1/mutashabihat/pairs/:verseKey
 *   → ayah-similarity pairs involving the verse_key (ordered by score desc).
 * GET /v1/mutashabihat/watchlist/:verseKey?limit=5
 *   → top-N most-confused-with ayahs.
 *
 * Per ADR-0020. License: `permissive-with-credit`. Cache: 7 days.
 */
import { existsSync } from 'node:fs';

import { QalaamError } from '@qalaam/core';

import { getQul } from '../../lib/data-loader.js';
import { LICENSE_METADATA } from '../../lib/qul-license-registry.js';

import type { Config } from '../../config.js';
import type { FastifyInstance } from 'fastify';

const SEVEN_DAYS_S = 60 * 60 * 24 * 7;

const VERSE_KEY_RE = /^[1-9][0-9]?[0-9]?:[1-9][0-9]?[0-9]?$/;

function assertVerseKey(s: string): string {
  if (!VERSE_KEY_RE.test(s)) {
    throw new QalaamError('qalaam.verse-key.malformed', `Invalid verseKey ${s}`);
  }
  return s;
}

export async function qulMutashabihatRoutes(
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
    return getQul(opts.config.QUL_SQLITE_PATH).mutashabihatV2(LICENSE_METADATA.mutashabihatV2);
  }

  function withMeta<T>(payload: T): { data: T; attribution: string; license: string } {
    return {
      data: payload,
      attribution: LICENSE_METADATA.mutashabihatV2.attributionText,
      license: LICENSE_METADATA.mutashabihatV2.license,
    };
  }

  fastify.get<{ Params: { verseKey: string } }>(
    '/v1/mutashabihat/clusters/:verseKey',
    { schema: { tags: ['mutashabihat'] } },
    async (req, reply) => {
      const vk = assertVerseKey(req.params.verseKey);
      void reply.header('cache-control', `public, max-age=${SEVEN_DAYS_S.toString()}`);
      return withMeta(reader().clustersForAyah(vk));
    },
  );

  fastify.get<{ Params: { verseKey: string } }>(
    '/v1/mutashabihat/pairs/:verseKey',
    { schema: { tags: ['mutashabihat'] } },
    async (req, reply) => {
      const vk = assertVerseKey(req.params.verseKey);
      void reply.header('cache-control', `public, max-age=${SEVEN_DAYS_S.toString()}`);
      return withMeta(reader().pairsForAyah(vk));
    },
  );

  fastify.get<{ Params: { verseKey: string }; Querystring: { limit?: string } }>(
    '/v1/mutashabihat/watchlist/:verseKey',
    { schema: { tags: ['mutashabihat'] } },
    async (req, reply) => {
      const vk = assertVerseKey(req.params.verseKey);
      const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit ?? '5', 10) || 5));
      void reply.header('cache-control', `public, max-age=${SEVEN_DAYS_S.toString()}`);
      return withMeta(reader().watchlistFor(vk, limit));
    },
  );
}
