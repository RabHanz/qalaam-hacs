/**
 * GET /v1/metadata/surahs        → all 114 surah info cards
 * GET /v1/metadata/surahs/:id    → single surah card
 * GET /v1/metadata/juz/:n        → juz boundaries
 * GET /v1/metadata/hizb/:n       → hizb boundaries
 * GET /v1/metadata/manzil/:n     → manzil boundaries
 * GET /v1/metadata/ruku/:n       → ruku boundaries
 * GET /v1/metadata/surahs/:id/rukus → all rukus inside a surah
 * GET /v1/metadata/sajda         → all 15 sajda ayahs
 *
 * Per ADR-0020. License: `factual`. Bundle-safe. Cache: 7 days (per
 * ADR-0018 — facts don't change).
 */
import { existsSync } from 'node:fs';

import { QalaamError } from '@qalaam/core';

import { getQul } from '../../lib/data-loader.js';
import { LICENSE_METADATA } from '../../lib/qul-license-registry.js';

import type { Config } from '../../config.js';
import type { FastifyInstance } from 'fastify';

const SEVEN_DAYS_S = 60 * 60 * 24 * 7;

// eslint-disable-next-line @typescript-eslint/require-await
export async function qulMetadataRoutes(
  fastify: FastifyInstance,
  opts: { config: Config },
): Promise<void> {
  function withMeta<T>(payload: T): {
    data: T;
    attribution: string;
    license: string;
  } {
    return {
      data: payload,
      attribution: LICENSE_METADATA.quranMetadata.attributionText,
      license: LICENSE_METADATA.quranMetadata.license,
    };
  }

  function ensureQul(): ReturnType<typeof getQul> {
    if (!existsSync(opts.config.QUL_SQLITE_PATH)) {
      throw new QalaamError(
        'qalaam.data.not-loaded',
        `QUL SQLite not present at ${opts.config.QUL_SQLITE_PATH}. Run 'make data-fetch'.`,
      );
    }
    return getQul(opts.config.QUL_SQLITE_PATH);
  }

  fastify.get('/v1/metadata/surahs', { schema: { tags: ['metadata'] } }, async (_req, reply) => {
    const reader = ensureQul().metadata(LICENSE_METADATA.quranMetadata);
    void reply.header('cache-control', `public, max-age=${SEVEN_DAYS_S.toString()}`);
    return withMeta(reader.allSurahs());
  });

  fastify.get<{ Params: { id: string } }>(
    '/v1/metadata/surahs/:id',
    {
      schema: {
        tags: ['metadata'],
        params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      },
    },
    async (req, reply) => {
      const surah = Number.parseInt(req.params.id, 10);
      const card = ensureQul().metadata(LICENSE_METADATA.quranMetadata).surahInfo(surah);
      if (!card) {
        throw new QalaamError(
          'qalaam.verse-key.surah-out-of-range',
          `Surah ${req.params.id} not found.`,
        );
      }
      void reply.header('cache-control', `public, max-age=${SEVEN_DAYS_S.toString()}`);
      return withMeta(card);
    },
  );

  fastify.get<{ Params: { id: string } }>(
    '/v1/metadata/surahs/:id/rukus',
    { schema: { tags: ['metadata'] } },
    async (req, reply) => {
      const surah = Number.parseInt(req.params.id, 10);
      const rukus = ensureQul().metadata(LICENSE_METADATA.quranMetadata).rukusInSurah(surah);
      void reply.header('cache-control', `public, max-age=${SEVEN_DAYS_S.toString()}`);
      return withMeta(rukus);
    },
  );

  for (const [unit, fn] of [
    ['juz', 'juzBoundary'],
    ['hizb', 'hizbBoundary'],
    ['rub', 'rubBoundary'],
    ['manzil', 'manzilBoundary'],
    ['ruku', 'rukuBoundary'],
  ] as const) {
    fastify.get<{ Params: { n: string } }>(
      `/v1/metadata/${unit}/:n`,
      { schema: { tags: ['metadata'] } },
      async (req, reply) => {
        const n = Number.parseInt(req.params.n, 10);
        const reader = ensureQul().metadata(LICENSE_METADATA.quranMetadata);
        const lookup = (reader as unknown as Record<string, (n: number) => unknown>)[fn];
        if (!lookup) {
          throw new QalaamError(
            'qalaam.data.not-loaded',
            `metadata accessor ${fn} not present on reader`,
          );
        }

        const boundary = lookup(n);
        if (!boundary) {
          throw new QalaamError(
            'qalaam.verse-key.surah-out-of-range',
            `${unit} ${req.params.n} not found.`,
          );
        }
        void reply.header('cache-control', `public, max-age=${SEVEN_DAYS_S.toString()}`);
        return withMeta(boundary);
      },
    );
  }

  fastify.get('/v1/metadata/sajda', { schema: { tags: ['metadata'] } }, async (_req, reply) => {
    const reader = ensureQul().metadata(LICENSE_METADATA.quranMetadata);
    void reply.header('cache-control', `public, max-age=${SEVEN_DAYS_S.toString()}`);
    return withMeta(reader.sajdaAyahs());
  });
}
