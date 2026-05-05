/**
 * GET /v1/qpc-text/:verseKey?layout=v4
 *
 * Returns the per-word PUA-encoded text + the mushaf page that
 * determines which font-family the frontend should use to render it.
 *
 * Why this exists: the canonical KFGQPC V4 Tajweed mushaf renders
 * tajweed colours via the FONT itself (COLR/CPAL color tables baked
 * into 604 per-page woff2 files). To render a verse with that font:
 *   1. Look up each word's PUA codepoint (U+FC41-U+FC64) for the
 *      target layout (v4, v2, v1).
 *   2. Look up the mushaf page that verse falls on (1-604).
 *   3. Render with `font-family: QPCv4Page<page>`.
 *
 * Currently only `?layout=v4` is implemented; v1/v2 PUA text isn't yet
 * staged (the QUL "quran-script" detail pages for V1/V2 expose only
 * the fonts, no JSON text — needs a separate ingest path).
 *
 * Response shape:
 *   {
 *     verseKey: "3:4",
 *     layout:   "v4",
 *     pageNumber: 50,            // 1-604; the font-family is QPCv4Page50
 *     fontFamily: "QPCv4Page50", // ready to drop into CSS
 *     words: [
 *       { wordIndex: 1, text: "ﱁ" },
 *       { wordIndex: 2, text: "ﱂ" },
 *       …
 *     ]
 *   }
 *
 * Cache-control: 7 days (mushaf data is effectively immutable).
 */
import { existsSync } from 'node:fs';

import { QalaamError, parseVerseKey } from '@qalaam/core';
import Database from 'better-sqlite3';

import type { Config } from '../../config.js';
import type { Database as DB } from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';

let cachedDb: DB | undefined;
function openReadOnly(path: string): DB {
  if (!existsSync(path)) {
    throw new QalaamError(
      'qalaam.data.not-loaded',
      'Tajweed text is preparing — please check back in a moment.',
    );
  }
  cachedDb ??= new Database(path, { readonly: true, fileMustExist: true });
  return cachedDb;
}

interface QpcWordRow {
  word_index: number;
  text: string;
  page_number: number | null;
}

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature.
export async function qpcTextRoutes(
  fastify: FastifyInstance,
  opts: { config: Config },
): Promise<void> {
  fastify.get<{
    Params: { verseKey: string };
    Querystring: { layout?: string };
  }>(
    '/v1/qpc-text/:verseKey',
    {
      schema: {
        description:
          'Per-word PUA text for a verse + the mushaf page that determines the font-family.',
        tags: ['qpc-text'],
        params: {
          type: 'object',
          properties: {
            verseKey: { type: 'string', pattern: '^[0-9]+:[0-9]+$' },
          },
          required: ['verseKey'],
        },
        querystring: {
          type: 'object',
          properties: {
            layout: { type: 'string', enum: ['v4'] },
          },
        },
      },
    },
    async (request, reply) => {
      const verseKey = parseVerseKey(request.params.verseKey);
      const layout = request.query.layout ?? 'v4';

      // v1 / v2 PUA text isn't yet staged — fail-closed with a clear message.
      // Once those quran-script PUA JSONs are ingested, branch by layout here.
      if (layout !== 'v4') {
        throw new QalaamError(
          'qalaam.adapter.capability-unsupported',
          `Layout ${layout} PUA text isn't ingested yet — only v4 is supported.`,
        );
      }

      const db = openReadOnly(opts.config.QUL_SQLITE_PATH);
      const rows = db
        .prepare<[string], QpcWordRow>(
          `SELECT word_index, text, page_number
           FROM qalaam_v1_qul_qpc_v4_text
           WHERE verse_key = ?
           ORDER BY word_index ASC`,
        )
        .all(verseKey);

      if (rows.length === 0) {
        throw new QalaamError(
          'qalaam.data.not-found',
          `Verse ${verseKey} isn't in the V4 Tajweed corpus.`,
        );
      }

      // Use the first word's page — verses don't span pages in our data
      // (line breaks are only at word boundaries; no word straddles two
      // pages). If a future re-ingest violates that invariant, the
      // earliest word still wins.
      const pageNumber = rows[0]?.page_number ?? null;

      void reply.header('cache-control', 'public, max-age=604800'); // 7 days
      return {
        verseKey,
        layout,
        pageNumber,
        fontFamily: pageNumber ? `QPCv4Page${pageNumber.toString()}` : null,
        words: rows.map((r) => ({ wordIndex: r.word_index, text: r.text })),
      };
    },
  );
}
