/**
 * GET /v1/translations              → list available translations
 * GET /v1/translations/:slug/by_verse/:verseKey → single-verse translation text
 * GET /v1/tafsirs                   → list available tafsirs
 * GET /v1/tafsirs/:slug/by_verse/:verseKey      → single-verse tafsir text
 *
 * v0.1 reads bundled fixtures (Al-Fatiha only). v0.5 hydrates the full Quran
 * from QUL. Per ADR-0002 + strategy §4.5 / §4.6.
 */
import { QalaamError, parseVerseKey } from '@qalaam/core';
import type { FastifyInstance } from 'fastify';

import {
  getTafsirVerse,
  getTranslationVerse,
  listTafsirs,
  listTranslations,
} from '../../lib/translation-loader.js';

export async function translationsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/v1/translations',
    {
      schema: {
        description: 'List bundled and available translations.',
        tags: ['translations'],
      },
    },
    async (_req, reply) => {
      void reply.header('cache-control', 'public, max-age=86400');
      return { translations: listTranslations() };
    },
  );

  fastify.get<{ Params: { slug: string; verseKey: string } }>(
    '/v1/translations/:slug/by_verse/:verseKey',
    {
      schema: {
        description: 'Verse text for a translation.',
        tags: ['translations'],
        params: {
          type: 'object',
          properties: {
            slug: { type: 'string', pattern: '^[a-z0-9-]+$' },
            verseKey: { type: 'string', pattern: '^[0-9]+:[0-9]+$' },
          },
          required: ['slug', 'verseKey'],
        },
      },
    },
    async (request, reply) => {
      const key = parseVerseKey(request.params.verseKey);
      const text = getTranslationVerse(request.params.slug, key);
      if (text === undefined) {
        throw new QalaamError(
          'qalaam.data.not-loaded',
          `No translation '${request.params.slug}' for verse ${key}. v0.1 ships Al-Fatiha; run 'make data-fetch' for full coverage.`,
          { outcomeImpacted: 'O-11' },
        );
      }
      void reply.header('cache-control', 'public, max-age=604800');
      void reply.header('x-qalaam-source', 'fixture');
      return { verseKey: key, slug: request.params.slug, text };
    },
  );

  fastify.get(
    '/v1/tafsirs',
    {
      schema: { description: 'List bundled tafsirs.', tags: ['tafsirs'] },
    },
    async (_req, reply) => {
      void reply.header('cache-control', 'public, max-age=86400');
      return { tafsirs: listTafsirs() };
    },
  );

  fastify.get<{ Params: { slug: string; verseKey: string } }>(
    '/v1/tafsirs/:slug/by_verse/:verseKey',
    {
      schema: {
        description: 'Verse-level tafsir text.',
        tags: ['tafsirs'],
        params: {
          type: 'object',
          properties: {
            slug: { type: 'string', pattern: '^[a-z0-9-]+$' },
            verseKey: { type: 'string', pattern: '^[0-9]+:[0-9]+$' },
          },
          required: ['slug', 'verseKey'],
        },
      },
    },
    async (request, reply) => {
      const key = parseVerseKey(request.params.verseKey);
      const text = getTafsirVerse(request.params.slug, key);
      if (text === undefined) {
        throw new QalaamError(
          'qalaam.data.not-loaded',
          `No tafsir '${request.params.slug}' for verse ${key}.`,
          { outcomeImpacted: 'O-11' },
        );
      }
      const meta = listTafsirs().find((t) => t.slug === request.params.slug);
      void reply.header('cache-control', 'public, max-age=604800');
      return {
        verseKey: key,
        slug: request.params.slug,
        text,
        language: meta?.language ?? 'en',
        scholar: meta?.scholar ?? null,
        attribution: meta?.scholar ?? null,
      };
    },
  );
}
