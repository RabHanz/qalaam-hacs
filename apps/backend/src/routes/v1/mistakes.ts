/**
 * /v1/mistakes/* — per-page mistake heatmap (E1).
 *
 * Endpoints:
 *   POST   /v1/mistakes               — record one (verseKey + kind required)
 *   GET    /v1/mistakes/heatmap       — per-page aggregate (default last 30 days)
 *   GET    /v1/mistakes/by-page/:n    — list for a single page
 *   POST   /v1/mistakes/:id/resolve   — mark a single mistake resolved
 *   POST   /v1/mistakes/resolve-page  — mark every open mistake on a page resolved
 *
 * Page lookup: backend joins `mistakes.verse_key` against
 * `qalaam_v1_verses.page_madani_15` so the heatmap is canonically
 * page-keyed even when the recorder only knew the verse.
 *
 * Why a separate `resolve-page` endpoint: when a child completes a
 * clean recite of a page, every prior mistake on that page should
 * close at once — the heatmap cools without manual triage.
 */
import Database from 'better-sqlite3';

import { authDb } from '../../auth/db.js';
import { requireFeature } from '../../auth/features.js';

import type { Config } from '../../config.js';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const VALID_KINDS = new Set([
  'skipped',
  'wrong-word',
  'hesitation',
  'repeat',
  'tajweed',
  'self-corrected',
]);
const VALID_SOURCES = new Set(['asr', 'parent-mark', 'self-mark']);
const VERSE_KEY_RE = /^[1-9][0-9]?[0-9]?:[1-9][0-9]?[0-9]?$/;

interface MistakeRow {
  id: number;
  user_id: string;
  ts: string;
  verse_key: string;
  page_number: number | null;
  word_index: number | null;
  kind: string;
  source: string;
  context: string | null;
  resolved: number;
}

interface CreateBody {
  verseKey?: string;
  kind?: string;
  source?: string;
  wordIndex?: number;
  context?: string;
  // Optional override: if the client already knows the page (e.g. from
  // /v1/qpc-text), pass it; otherwise we look it up.
  pageNumber?: number;
  // Permits a guardian to record on behalf of an assignee.
  forUserId?: string;
}

function rowToJson(r: MistakeRow): Record<string, unknown> {
  return {
    id: r.id,
    userId: r.user_id,
    ts: r.ts,
    verseKey: r.verse_key,
    pageNumber: r.page_number,
    wordIndex: r.word_index,
    kind: r.kind,
    source: r.source,
    context: r.context,
    resolved: r.resolved === 1,
  };
}

interface QulVerseRow {
  page: number;
}

let qulCache: { path: string; db: Database.Database } | null = null;

function qulDb(qulPath: string): Database.Database {
  if (qulCache?.path === qulPath) return qulCache.db;
  const db = new Database(qulPath, { readonly: true });
  qulCache = { path: qulPath, db };
  return db;
}

function pageForVerse(qulPath: string, verseKey: string): number | null {
  try {
    const row = qulDb(qulPath)
      .prepare(`SELECT page_madani_15 AS page FROM qalaam_v1_verses WHERE verse_key = ?`)
      .get(verseKey) as QulVerseRow | undefined;
    return row?.page ?? null;
  } catch {
    return null;
  }
}

function isGuardianFor(targetUserId: string, currentUserId: string): boolean {
  if (targetUserId === currentUserId) return true;
  const r = authDb()
    .prepare(
      `SELECT 1 AS x
         FROM family_members fm_self
         JOIN family_members fm_other
           ON fm_other.family_id = fm_self.family_id
        WHERE fm_self.user_id = ?
          AND fm_self.role    = 'guardian'
          AND fm_other.user_id = ?
        LIMIT 1`,
    )
    .get(currentUserId, targetUserId) as { x: number } | undefined;
  return r !== undefined;
}

export async function mistakesRoutes(
  fastify: FastifyInstance,
  opts: { config: Config },
): Promise<void> {
  fastify.post(
    '/v1/mistakes',
    {
      schema: {
        description: 'Record one mistake (ASR, parent-mark, or self-mark).',
        tags: ['mistakes'],
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = requireFeature(req, reply, 'family.mistakes.heatmap');
      if (!user) return;
      const body = (req.body ?? {}) as CreateBody;
      const verseKey = (body.verseKey ?? '').trim();
      if (!VERSE_KEY_RE.test(verseKey)) {
        void reply.code(400).send({ code: 'qalaam.mistake.bad-verse-key' });
        return;
      }
      const kind = body.kind ?? 'wrong-word';
      if (!VALID_KINDS.has(kind)) {
        void reply.code(400).send({ code: 'qalaam.mistake.bad-kind' });
        return;
      }
      const source = body.source ?? 'self-mark';
      if (!VALID_SOURCES.has(source)) {
        void reply.code(400).send({ code: 'qalaam.mistake.bad-source' });
        return;
      }
      const targetUserId = body.forUserId ?? user.id;
      if (!isGuardianFor(targetUserId, user.id)) {
        void reply.code(403).send({ code: 'qalaam.mistake.forbidden' });
        return;
      }
      const pageNumber =
        typeof body.pageNumber === 'number' && body.pageNumber >= 1 && body.pageNumber <= 604
          ? body.pageNumber
          : pageForVerse(opts.config.QUL_SQLITE_PATH, verseKey);
      const wordIndex =
        typeof body.wordIndex === 'number' && body.wordIndex >= 0 && body.wordIndex < 100
          ? body.wordIndex
          : null;
      const context =
        typeof body.context === 'string' && body.context.length > 0
          ? body.context.slice(0, 240)
          : null;
      const result = authDb()
        .prepare(
          `INSERT INTO mistakes
             (user_id, verse_key, page_number, word_index, kind, source, context)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(targetUserId, verseKey, pageNumber, wordIndex, kind, source, context);
      const row = authDb()
        .prepare(`SELECT * FROM mistakes WHERE id = ?`)
        .get(result.lastInsertRowid) as MistakeRow | undefined;
      if (!row) {
        void reply.code(500).send({ code: 'qalaam.mistake.create-failed' });
        return;
      }
      void reply.code(201).send({ mistake: rowToJson(row) });
    },
  );

  fastify.get<{ Querystring: { days?: string; userId?: string } }>(
    '/v1/mistakes/heatmap',
    { schema: { tags: ['mistakes'] } },
    async (req, reply) => {
      const user = requireFeature(req, reply, 'family.mistakes.heatmap');
      if (!user) return;
      const days = Math.min(Math.max(Number.parseInt(req.query.days ?? '30', 10) || 30, 1), 365);
      const targetUserId = req.query.userId ?? user.id;
      if (!isGuardianFor(targetUserId, user.id)) {
        void reply.code(403).send({ code: 'qalaam.mistake.forbidden' });
        return;
      }
      const rows = authDb()
        .prepare(
          `SELECT page_number, COUNT(*) AS total,
                  SUM(CASE WHEN resolved = 0 THEN 1 ELSE 0 END) AS open
             FROM mistakes
            WHERE user_id = ?
              AND ts >= datetime('now', ?)
              AND page_number IS NOT NULL
            GROUP BY page_number
            ORDER BY page_number ASC`,
        )
        .all(targetUserId, `-${days.toString()} days`) as {
        page_number: number;
        total: number;
        open: number;
      }[];
      const totalRow = authDb()
        .prepare(
          `SELECT
             COUNT(*) AS total,
             SUM(CASE WHEN resolved = 0 THEN 1 ELSE 0 END) AS open
             FROM mistakes
            WHERE user_id = ?
              AND ts >= datetime('now', ?)`,
        )
        .get(targetUserId, `-${days.toString()} days`) as { total: number; open: number };
      const max = rows.reduce((m, r) => Math.max(m, r.total), 0);
      void reply.send({
        userId: targetUserId,
        windowDays: days,
        totalMistakes: totalRow.total,
        openMistakes: totalRow.open,
        maxPageCount: max,
        pages: rows.map((r) => ({
          page: r.page_number,
          total: r.total,
          open: r.open,
          intensity: max === 0 ? 0 : r.total / max,
        })),
      });
    },
  );

  fastify.get<{ Params: { n: string }; Querystring: { userId?: string; days?: string } }>(
    '/v1/mistakes/by-page/:n',
    { schema: { tags: ['mistakes'] } },
    async (req, reply) => {
      const user = requireFeature(req, reply, 'family.mistakes.heatmap');
      if (!user) return;
      const n = Number.parseInt(req.params.n, 10);
      if (!Number.isFinite(n) || n < 1 || n > 604) {
        void reply.code(400).send({ code: 'qalaam.mistake.bad-page' });
        return;
      }
      const targetUserId = req.query.userId ?? user.id;
      if (!isGuardianFor(targetUserId, user.id)) {
        void reply.code(403).send({ code: 'qalaam.mistake.forbidden' });
        return;
      }
      const days = Math.min(Math.max(Number.parseInt(req.query.days ?? '90', 10) || 90, 1), 365);
      const rows = authDb()
        .prepare(
          `SELECT * FROM mistakes
            WHERE user_id = ?
              AND page_number = ?
              AND ts >= datetime('now', ?)
            ORDER BY ts DESC LIMIT 200`,
        )
        .all(targetUserId, n, `-${days.toString()} days`) as MistakeRow[];
      void reply.send({ page: n, mistakes: rows.map(rowToJson) });
    },
  );

  fastify.post<{ Params: { id: string } }>(
    '/v1/mistakes/:id/resolve',
    { schema: { tags: ['mistakes'] } },
    async (req, reply) => {
      const user = requireFeature(req, reply, 'family.mistakes.heatmap');
      if (!user) return;
      const id = Number.parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) {
        void reply.code(400).send({ code: 'qalaam.mistake.bad-id' });
        return;
      }
      const row = authDb().prepare(`SELECT user_id FROM mistakes WHERE id = ?`).get(id) as
        | { user_id: string }
        | undefined;
      if (!row) {
        void reply.code(404).send({ code: 'qalaam.mistake.not-found' });
        return;
      }
      if (!isGuardianFor(row.user_id, user.id)) {
        void reply.code(403).send({ code: 'qalaam.mistake.forbidden' });
        return;
      }
      authDb().prepare(`UPDATE mistakes SET resolved = 1 WHERE id = ?`).run(id);
      void reply.code(204).send();
    },
  );

  fastify.post<{ Body: { pageNumber?: number; forUserId?: string } }>(
    '/v1/mistakes/resolve-page',
    { schema: { tags: ['mistakes'] } },
    async (req, reply) => {
      const user = requireFeature(req, reply, 'family.mistakes.heatmap');
      if (!user) return;
      const body = req.body;
      const pageNumber = body.pageNumber;
      if (typeof pageNumber !== 'number' || pageNumber < 1 || pageNumber > 604) {
        void reply.code(400).send({ code: 'qalaam.mistake.bad-page' });
        return;
      }
      const targetUserId = body.forUserId ?? user.id;
      if (!isGuardianFor(targetUserId, user.id)) {
        void reply.code(403).send({ code: 'qalaam.mistake.forbidden' });
        return;
      }
      const r = authDb()
        .prepare(
          `UPDATE mistakes
             SET resolved = 1
           WHERE user_id = ?
             AND page_number = ?
             AND resolved = 0`,
        )
        .run(targetUserId, pageNumber);
      void reply.send({ resolved: r.changes });
    },
  );
}
