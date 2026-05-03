/**
 * GET /v1/wbw/:verseKey
 *   ?lang=en (default) — word-by-word translations
 *   ?include=morphology — adds gpl-derivative morphology rows
 *
 * Per ADR-0020. License: `permissive-with-credit` (translation),
 * `gpl-derivative` (morphology). The morphology surface is GATED:
 *   - Default: morphology is omitted from the response (`null`).
 *   - `?include=morphology` AND tier permits → morphology included with
 *     a clear `morphology_attribution` in the response body.
 *
 * The gating is duplicated at two layers (route + sub-reader's
 * enableMorphology) so a future refactor that bypasses one still hits
 * the other. Defense in depth.
 */
import { existsSync } from 'node:fs';

import { QalaamError } from '@qalaam/core';

import { getQul } from '../../lib/data-loader.js';
import { LICENSE_METADATA } from '../../lib/qul-license-registry.js';

import type { Config } from '../../config.js';
import type { FastifyInstance } from 'fastify';

const SEVEN_DAYS_S = 60 * 60 * 24 * 7;
const VERSE_KEY_RE = /^[1-9][0-9]?[0-9]?:[1-9][0-9]?[0-9]?$/;

// eslint-disable-next-line @typescript-eslint/require-await
export async function qulWbwRoutes(
  fastify: FastifyInstance,
  opts: { config: Config },
): Promise<void> {
  fastify.get<{
    Params: { verseKey: string };
    Querystring: { lang?: string; include?: string };
  }>(
    '/v1/wbw/:verseKey',
    {
      schema: {
        tags: ['wbw'],
        params: {
          type: 'object',
          properties: { verseKey: { type: 'string' } },
          required: ['verseKey'],
        },
        querystring: {
          type: 'object',
          properties: {
            lang: { type: 'string', enum: ['en'] },
            include: { type: 'string', enum: ['morphology'] },
          },
        },
      },
    },
    async (req, reply) => {
      if (!VERSE_KEY_RE.test(req.params.verseKey)) {
        throw new QalaamError(
          'qalaam.verse-key.malformed',
          `Invalid verseKey ${req.params.verseKey}`,
        );
      }
      if (!existsSync(opts.config.QUL_SQLITE_PATH)) {
        throw new QalaamError('qalaam.data.not-loaded', 'QUL SQLite not present.');
      }
      const includeMorphology = req.query.include === 'morphology';
      const reader = getQul(opts.config.QUL_SQLITE_PATH).wordByWord(
        LICENSE_METADATA.wbwTranslationEn,
        includeMorphology ? LICENSE_METADATA.morphology : null,
        { enableMorphology: includeMorphology },
      );
      const lang = req.query.lang ?? 'en';
      const words = reader.wordsForAyah(req.params.verseKey, lang);
      const morphology = reader.morphologyForAyah(req.params.verseKey);

      void reply.header('cache-control', `public, max-age=${SEVEN_DAYS_S.toString()}`);
      return {
        data: { words, morphology },
        attribution: {
          translation: LICENSE_METADATA.wbwTranslationEn.attributionText,
          translation_license: LICENSE_METADATA.wbwTranslationEn.license,
          morphology: includeMorphology ? LICENSE_METADATA.morphology.attributionText : null,
          morphology_license: includeMorphology ? LICENSE_METADATA.morphology.license : null,
        },
      };
    },
  );
}
