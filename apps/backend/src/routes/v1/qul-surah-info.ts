/**
 * GET /v1/surah-info/:surah?lang=en
 *   → revelation place + period + themes + summary + asbab al-nuzul
 * GET /v1/surah-info/languages
 *   → list of supported languages this dataset has cards for
 *
 * Per ADR-0020. License: per-language `permissive-with-credit`. Cache: 7 days.
 */
import { existsSync } from 'node:fs';

import { QalaamError } from '@qalaam/core';


import { getQul } from '../../lib/data-loader.js';
import { LICENSE_METADATA } from '../../lib/qul-license-registry.js';

import type { Config } from '../../config.js';
import type { FastifyInstance } from 'fastify';

const SEVEN_DAYS_S = 60 * 60 * 24 * 7;

// eslint-disable-next-line @typescript-eslint/require-await
export async function qulSurahInfoRoutes(
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
    return getQul(opts.config.QUL_SQLITE_PATH).surahInfo(LICENSE_METADATA.surahInfoByLanguage);
  }

  fastify.get(
    '/v1/surah-info/languages',
    { schema: { tags: ['surah-info'] } },
    async (_req, reply) => {
      void reply.header('cache-control', `public, max-age=${SEVEN_DAYS_S.toString()}`);
      return { data: reader().availableLanguages() };
    },
  );

  fastify.get<{
    Params: { surah: string };
    Querystring: { lang?: string };
  }>(
    '/v1/surah-info/:surah',
    {
      schema: {
        tags: ['surah-info'],
        params: { type: 'object', properties: { surah: { type: 'string' } }, required: ['surah'] },
        querystring: {
          type: 'object',
          properties: { lang: { type: 'string', enum: ['en'] } },
        },
      },
    },
    async (req, reply) => {
      const surah = Number.parseInt(req.params.surah, 10);
      if (!Number.isFinite(surah) || surah < 1 || surah > 114) {
        throw new QalaamError(
          'qalaam.verse-key.surah-out-of-range',
          `Surah ${req.params.surah} out of [1, 114].`,
        );
      }
      const lang = req.query.lang ?? 'en';
      const card = reader().card(surah, lang);
      if (!card) {
        throw new QalaamError(
          'qalaam.data.not-loaded',
          `surah-info card for ${surah.toString()}/${lang} not present.`,
        );
      }
      // Strip the per-language LicenseMetadata from the response body — caller
      // sees attribution as a sibling field (matches the other QUL routes).
      const { meta, ...rest } = card;
      void reply.header('cache-control', `public, max-age=${SEVEN_DAYS_S.toString()}`);
      return {
        data: rest,
        attribution: meta.attributionText,
        license: meta.license,
      };
    },
  );
}
