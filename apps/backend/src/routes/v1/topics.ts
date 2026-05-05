/**
 * /v1/topics                 → list root categories with child counts
 * /v1/topics/:slug            → topic detail + verse list
 * /v1/topics/by-verse/:vk     → all topics that include a given verse
 *                              (sidebar on /study)
 *
 * Source: curated foundational topic taxonomy
 * (scripts/data/ingest-topics.py) — modeled on classical Islamic
 * subject indexes. 8 categories × 53 topics × 803 verse mappings.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import Database from 'better-sqlite3';

import type { Database as DB } from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';

let cachedDb: DB | undefined;
function topicsDb(): DB | undefined {
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

interface TopicRow {
  topic_id: number;
  slug: string;
  name_en: string;
  name_ar: string | null;
  parent_id: number | null;
  summary: string | null;
  verse_count: number;
}

export async function topicsRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /v1/topics
   * Returns the full taxonomy grouped by parent category.
   */
  fastify.get('/v1/topics', { schema: { tags: ['topics'] } }, async (_req, reply) => {
    const db = topicsDb();
    if (!db) return reply.code(503).send({ error: 'qalaam.data.not-loaded' });
    void reply.header('cache-control', 'public, max-age=86400');

    const rows = db
      .prepare<[], TopicRow>(
        `SELECT topic_id, slug, name_en, name_ar, parent_id, summary, verse_count
         FROM qalaam_v1_qul_topics
         ORDER BY sort_order ASC`,
      )
      .all();

    const cats = rows.filter((r) => r.parent_id === null);
    const subs = rows.filter((r) => r.parent_id !== null);
    return {
      categories: cats.map((c) => ({
        slug: c.slug,
        nameEn: c.name_en,
        nameAr: c.name_ar,
        topics: subs
          .filter((s) => s.parent_id === c.topic_id)
          .map((s) => ({
            slug: s.slug,
            nameEn: s.name_en,
            nameAr: s.name_ar,
            summary: s.summary,
            verseCount: s.verse_count,
          })),
      })),
      source: 'Qalaam curated foundational taxonomy',
      license: 'CC-BY-SA-4.0',
    };
  });

  /**
   * GET /v1/topics/:slug — full verse list for a topic.
   */
  fastify.get<{ Params: { slug: string } }>(
    '/v1/topics/:slug',
    { schema: { tags: ['topics'] } },
    async (req, reply) => {
      const db = topicsDb();
      if (!db) return reply.code(503).send({ error: 'qalaam.data.not-loaded' });
      const t = db
        .prepare<[string], TopicRow>(
          `SELECT topic_id, slug, name_en, name_ar, parent_id, summary, verse_count
           FROM qalaam_v1_qul_topics WHERE slug = ?`,
        )
        .get(req.params.slug);
      if (!t) return reply.code(404).send({ error: 'qalaam.topic.not-found' });
      const verses = db
        .prepare<[number], { verse_key: string }>(
          `SELECT verse_key FROM qalaam_v1_qul_topic_verses
           WHERE topic_id = ? ORDER BY sort_order ASC`,
        )
        .all(t.topic_id);
      void reply.header('cache-control', 'public, max-age=86400');
      return {
        slug: t.slug,
        nameEn: t.name_en,
        nameAr: t.name_ar,
        summary: t.summary,
        verseCount: t.verse_count,
        verses: verses.map((v) => v.verse_key),
      };
    },
  );

  /**
   * GET /v1/topics/by-verse/:verseKey — topics that include this verse.
   * Used by the /study sidebar to surface "this verse appears in: X, Y, Z".
   */
  fastify.get<{ Params: { verseKey: string } }>(
    '/v1/topics/by-verse/:verseKey',
    {
      schema: {
        tags: ['topics'],
        params: {
          type: 'object',
          properties: { verseKey: { type: 'string', pattern: '^[0-9]+:[0-9]+$' } },
          required: ['verseKey'],
        },
      },
    },
    async (req, reply) => {
      const db = topicsDb();
      if (!db) return reply.code(503).send({ error: 'qalaam.data.not-loaded' });
      void reply.header('cache-control', 'public, max-age=86400');
      const rows = db
        .prepare<
          [string],
          { slug: string; name_en: string; name_ar: string | null; summary: string | null }
        >(
          `SELECT t.slug, t.name_en, t.name_ar, t.summary
           FROM qalaam_v1_qul_topic_verses tv
           JOIN qalaam_v1_qul_topics t ON t.topic_id = tv.topic_id
           WHERE tv.verse_key = ?
           ORDER BY t.sort_order ASC`,
        )
        .all(req.params.verseKey);
      return {
        verseKey: req.params.verseKey,
        topics: rows.map((r) => ({
          slug: r.slug,
          nameEn: r.name_en,
          nameAr: r.name_ar,
          summary: r.summary,
        })),
      };
    },
  );
}
