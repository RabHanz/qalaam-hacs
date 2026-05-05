/**
 * GET /v1/image-mushaf/:layout/:page
 *   → metadata for the page-image mushaf surface:
 *     {
 *       layoutId, page, imageUrl,
 *       words: [{surah, ayah, word, x, y, w, h}, ...]
 *     }
 *
 * GET /v1/image-mushaf/:layout/page-for/:verseKey
 *   → resolve a verse key to the page that contains it (so /read can
 *     deep-link into the image surface).
 *
 * Source: QUL `mushaf-layout-12` (Madani 16-line) ingested via
 * `scripts/data/ingest-image-mushaf-overlays.py` into
 * `qalaam_v1_qul_image_overlays`. PNGs are staged at
 * `apps/web/public/mushaf-images/madani-16/<page>.png` so the same
 * Next.js process serves both metadata and pixels.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import Database from 'better-sqlite3';

import type { Database as DB } from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';

let cachedDb: DB | undefined;
function imgDb(): DB | undefined {
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

interface OverlayRow {
  surah: number;
  ayah: number;
  word: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

// Maps `:layout` URL slug → DB layout_id + frontend image folder.
const LAYOUT_REGISTRY: Record<string, { layoutId: string; imageFolder: string }> = {
  'madani-16': {
    layoutId: 'madani_16_image_overlay_v12',
    imageFolder: '/mushaf-images/madani-16',
  },
};

// eslint-disable-next-line @typescript-eslint/require-await -- fastify register signature requires Promise<void>; body does not await.
export async function imageMushafRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Params: { layout: string; page: string } }>(
    '/v1/image-mushaf/:layout/:page',
    {
      schema: {
        description: 'Image-mushaf page metadata: image URL + word-rectangle overlays.',
        tags: ['image-mushaf'],
        params: {
          type: 'object',
          properties: {
            layout: { type: 'string', pattern: '^[a-z0-9-]+$' },
            page: { type: 'string', pattern: '^[0-9]+$' },
          },
          required: ['layout', 'page'],
        },
      },
    },
    async (req, reply) => {
      const reg = LAYOUT_REGISTRY[req.params.layout];
      if (!reg) {
        return reply.code(404).send({ error: 'qalaam.image-mushaf.layout-not-found' });
      }
      const db = imgDb();
      if (!db) return reply.code(503).send({ error: 'qalaam.data.not-loaded' });
      const page = Number.parseInt(req.params.page, 10);
      const rows = db
        .prepare<[string, number], OverlayRow>(
          `SELECT surah, ayah, word, x, y, w, h
           FROM qalaam_v1_qul_image_overlays
           WHERE layout_id = ? AND page = ?
           ORDER BY surah, ayah, word`,
        )
        .all(reg.layoutId, page);
      if (rows.length === 0) {
        return reply.code(404).send({ error: 'qalaam.image-mushaf.page-not-found' });
      }
      void reply.header('cache-control', 'public, max-age=604800');
      return reply.send({
        layoutId: reg.layoutId,
        layoutSlug: req.params.layout,
        page,
        imageUrl: `${reg.imageFolder}/${page.toString()}.png`,
        words: rows,
      });
    },
  );

  fastify.get<{ Params: { layout: string; verseKey: string } }>(
    '/v1/image-mushaf/:layout/page-for/:verseKey',
    {
      schema: {
        description: 'Resolve a verse key to the page that contains it.',
        tags: ['image-mushaf'],
        params: {
          type: 'object',
          properties: {
            layout: { type: 'string', pattern: '^[a-z0-9-]+$' },
            verseKey: { type: 'string', pattern: '^[0-9]+:[0-9]+$' },
          },
          required: ['layout', 'verseKey'],
        },
      },
    },
    async (req, reply) => {
      const reg = LAYOUT_REGISTRY[req.params.layout];
      if (!reg) {
        return reply.code(404).send({ error: 'qalaam.image-mushaf.layout-not-found' });
      }
      const db = imgDb();
      if (!db) return reply.code(503).send({ error: 'qalaam.data.not-loaded' });
      const [surahStr, ayahStr] = req.params.verseKey.split(':');
      const surah = Number.parseInt(surahStr ?? '0', 10);
      const ayah = Number.parseInt(ayahStr ?? '0', 10);
      const row = db
        .prepare<[string, number, number], { page: number }>(
          `SELECT page FROM qalaam_v1_qul_image_overlays
           WHERE layout_id = ? AND surah = ? AND ayah = ?
           ORDER BY page LIMIT 1`,
        )
        .get(reg.layoutId, surah, ayah);
      if (!row) {
        return reply.code(404).send({ error: 'qalaam.image-mushaf.verse-not-found' });
      }
      void reply.header('cache-control', 'public, max-age=604800');
      return reply.send({
        layoutId: reg.layoutId,
        layoutSlug: req.params.layout,
        verseKey: req.params.verseKey,
        page: row.page,
      });
    },
  );
}
