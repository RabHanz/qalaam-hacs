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
import Database from 'better-sqlite3';

import { getQul } from '../../lib/data-loader.js';
import { LICENSE_METADATA } from '../../lib/qul-license-registry.js';

import type { Config } from '../../config.js';
import type { Database as DB } from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';

const SEVEN_DAYS_S = 60 * 60 * 24 * 7;
const VERSE_KEY_RE = /^[1-9][0-9]?[0-9]?:[1-9][0-9]?[0-9]?$/;

let cachedScriptsDb: DB | undefined;
function scriptsReader(path: string): DB {
  cachedScriptsDb ??= new Database(path, { readonly: true, fileMustExist: true });
  return cachedScriptsDb;
}

interface FallbackWord {
  readonly verseKey: string;
  readonly wordIndex: number;
  readonly textArabic: string;
  readonly translation: string | null;
  readonly languageCode: string;
}

/**
 * QUL's wbw-translation pack only covers a fraction of the corpus
 * (~22k / 83k words). For ayahs without rows there, fall back to the
 * authoritative `qalaam_v1_qul_scripts_words` (full Quran, 83,668 words)
 * — clients still get Arabic word splits even when the gloss is missing.
 * Translation field is `null` rather than an empty string so the UI can
 * render the gloss column as "—" cleanly.
 */
function arabicWordsFor(dbPath: string, verseKey: string, lang: string): readonly FallbackWord[] {
  const rows = scriptsReader(dbPath)
    .prepare<[string], { word_index: number; text: string }>(
      `SELECT word_index, text
       FROM qalaam_v1_qul_scripts_words
       WHERE script = 'uthmani_simple' AND verse_key = ?
       ORDER BY word_index ASC`,
    )
    .all(verseKey);
  return rows.map(
    (r): FallbackWord => ({
      verseKey,
      wordIndex: r.word_index,
      textArabic: r.text,
      translation: null,
      languageCode: lang,
    }),
  );
}

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
      let words: readonly { verseKey: string; wordIndex: number; textArabic: string; translation: string | null; languageCode: string }[] = reader.wordsForAyah(req.params.verseKey, lang);
      if (words.length === 0) {
        // Fallback: render Arabic word splits from scripts_words even when
        // QUL's wbw-translation pack lacks a gloss for this ayah.
        words = arabicWordsFor(opts.config.QUL_SQLITE_PATH, req.params.verseKey, lang);
      }
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
