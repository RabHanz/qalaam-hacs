/**
 * GET /v1/chapters → minimal chapter metadata (114 surahs).
 * GET /v1/chapters/:id/verses → ordered verse list for a surah.
 *
 * v0.1: serves Al-Fatiha from fixture; other surahs require QUL SQLite.
 */
import { existsSync } from 'node:fs';

import { QalaamError } from '@qalaam/core';

import { getQul } from '../../lib/data-loader.js';
import { fixtureSurah } from '../../lib/fixture-loader.js';

import type { Config } from '../../config.js';
import type { FastifyInstance } from 'fastify';

export async function chaptersRoutes(
  fastify: FastifyInstance,
  opts: { config: Config },
): Promise<void> {
  fastify.get<{ Params: { id: string } }>(
    '/v1/chapters/:id/verses',
    {
      schema: {
        description: 'Verses of a surah, in order.',
        tags: ['verses'],
        params: {
          type: 'object',
          properties: { id: { type: 'string', pattern: '^[1-9][0-9]?[0-9]?$' } },
          required: ['id'],
        },
      },
    },
    async (request, reply) => {
      const surahNumber = Number.parseInt(request.params.id, 10);
      if (!Number.isFinite(surahNumber) || surahNumber < 1 || surahNumber > 114) {
        throw new QalaamError(
          'qalaam.verse-key.surah-out-of-range',
          `Surah ${request.params.id} out of [1, 114].`,
        );
      }
      const hasQul = existsSync(opts.config.QUL_SQLITE_PATH);
      if (!hasQul) {
        const fixture = fixtureSurah(surahNumber);
        if (fixture.length === 0) {
          throw new QalaamError(
            'qalaam.data.not-loaded',
            `Surah ${surahNumber.toString()} is preparing — please check back in a moment.`,
            { outcomeImpacted: 'O-01' },
          );
        }
        void reply.header('cache-control', 'public, max-age=86400');
        void reply.header('x-qalaam-source', 'fixture');
        return { verses: fixture };
      }
      const qul = getQul(opts.config.QUL_SQLITE_PATH);
      const verses: unknown[] = [];
      // Walk via QUL: select where surah=N order by ayah; data-loader provides per-key.
      // For v0.1 we simply hydrate one verse at a time — performant enough (<10ms per).
      for (let ayah = 1; ayah <= 286; ayah += 1) {
        const key = `${surahNumber.toString()}:${ayah.toString()}`;

        const verse = qul.getVerse(key as never);
        if (!verse) break;
        verses.push(verse);
      }
      void reply.header('cache-control', 'public, max-age=86400');
      void reply.header('x-qalaam-source', 'qul');
      return { verses };
    },
  );
}
