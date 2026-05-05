/**
 * GET /v1/verses/by_key/:verseKey
 *
 * Reads from local QUL (per ADR-0002). Falls back to bundled Al-Fatiha fixture
 * if the QUL SQLite isn't downloaded yet — keeps the demo path always working.
 *
 * Outcome served: O-01 (mistake-detection latency depends on fast verse lookup).
 */
import { existsSync } from 'node:fs';

import { QalaamError, parseVerseKey } from '@qalaam/core';

import { getQul } from '../../lib/data-loader.js';
import { fixtureVerse } from '../../lib/fixture-loader.js';

import type { Config } from '../../config.js';
import type { FastifyInstance } from 'fastify';

export async function versesRoutes(
  fastify: FastifyInstance,
  opts: { config: Config },
): Promise<void> {
  fastify.get<{ Params: { verseKey: string } }>(
    '/v1/verses/by_key/:verseKey',
    {
      schema: {
        description: 'Look up a single verse by key (e.g., "1:1").',
        tags: ['verses'],
        params: {
          type: 'object',
          properties: {
            verseKey: { type: 'string', pattern: '^[0-9]+:[0-9]+$' },
          },
          required: ['verseKey'],
        },
      },
    },
    async (request, reply) => {
      const key = parseVerseKey(request.params.verseKey);
      const hasQul = existsSync(opts.config.QUL_SQLITE_PATH);
      if (!hasQul) {
        const fixture = fixtureVerse(key);
        if (!fixture) {
          throw new QalaamError(
            'qalaam.data.not-loaded',
            `Verse ${key} is preparing — please check back in a moment.`,
            { outcomeImpacted: 'O-01' },
          );
        }
        void reply.header('cache-control', 'public, max-age=86400');
        void reply.header('x-qalaam-source', 'fixture');
        return fixture;
      }
      const qul = getQul(opts.config.QUL_SQLITE_PATH);
      const verse = qul.getVerse(key);
      if (!verse) {
        throw new QalaamError(
          'qalaam.verse-key.invalid-format',
          `Verse ${key} not found in local QUL store.`,
          { outcomeImpacted: 'O-01' },
        );
      }
      void reply.header('cache-control', 'public, max-age=86400');
      void reply.header('x-qalaam-source', 'qul');
      return verse;
    },
  );
}
