/**
 * GET /v1/transliterations
 *   → catalog of available transliteration editions (en/tr/ru) with
 *     translator + license + verse count
 * GET /v1/transliterations/:slug/by_verse/:verseKey
 *   → single-verse phonetic text in the requested edition
 *
 * Source: alquran.cloud editions (en.transliteration, tr.transliteration,
 * ru.transliteration). Surfaced under the Arabic on /read for non-Arabic
 * readers and as a learning aid for early-stage Arabic students.
 *
 * Schema parity with `qalaam_v1_translations*` so the frontend
 * TranslationPicker can render transliteration as a sibling section
 * without a separate code path.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import Database from 'better-sqlite3';

import type { Database as DB } from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';

let cachedDb: DB | undefined;
function transliterationDb(): DB | undefined {
  if (cachedDb) return cachedDb;
  const path = process.env.QUL_SQLITE_PATH ?? join(process.cwd(), 'data', 'qul.sqlite');
  if (!existsSync(path)) return undefined;
  try {
    cachedDb = new Database(path, { readonly: true, fileMustExist: true });
    return cachedDb;
  } catch {
    return undefined;
  }
}

interface MetaRow {
  slug: string;
  name: string;
  translator: string;
  language: string;
  license_tag: string;
  attribution: string;
  verse_count: number;
}

// eslint-disable-next-line @typescript-eslint/require-await -- fastify register signature requires Promise<void>; body does not await.
export async function transliterationsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/v1/transliterations',
    {
      schema: {
        description: 'List available transliteration editions.',
        tags: ['transliterations'],
      },
    },
    async (_req, reply) => {
      const db = transliterationDb();
      if (!db) return reply.code(503).send({ error: 'qalaam.data.not-loaded' });
      void reply.header('cache-control', 'public, max-age=86400');
      const rows = db
        .prepare<[], MetaRow>(
          `SELECT slug, name, translator, language, license_tag, attribution, verse_count
           FROM qalaam_v1_transliteration_meta ORDER BY language, slug`,
        )
        .all();
      return reply.send({
        transliterations: rows.map((r) => ({
          slug: r.slug,
          name: r.name,
          translator: r.translator,
          language: r.language,
          licenseTag: r.license_tag,
          attribution: r.attribution,
          verseCount: r.verse_count,
        })),
      });
    },
  );

  fastify.get<{ Params: { slug: string; verseKey: string } }>(
    '/v1/transliterations/:slug/by_verse/:verseKey',
    {
      schema: {
        description: 'Verse-level transliteration text.',
        tags: ['transliterations'],
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
    async (req, reply) => {
      const db = transliterationDb();
      if (!db) return reply.code(503).send({ error: 'qalaam.data.not-loaded' });
      const { slug, verseKey } = req.params;
      const row = db
        .prepare<
          [string, string],
          { text: string }
        >(`SELECT text FROM qalaam_v1_transliterations WHERE slug = ? AND verse_key = ?`)
        .get(slug, verseKey);
      if (!row) {
        return reply.code(404).send({ error: 'qalaam.transliteration.not-found' });
      }
      const meta = db
        .prepare<[string], MetaRow>(
          `SELECT slug, name, translator, language, license_tag, attribution, verse_count
           FROM qalaam_v1_transliteration_meta WHERE slug = ?`,
        )
        .get(slug);
      void reply.header('cache-control', 'public, max-age=604800');
      return reply.send({
        slug,
        verseKey,
        text: row.text,
        meta: meta
          ? {
              name: meta.name,
              translator: meta.translator,
              language: meta.language,
              licenseTag: meta.license_tag,
              attribution: meta.attribution,
            }
          : null,
      });
    },
  );
}
