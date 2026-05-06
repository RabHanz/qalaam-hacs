/**
 * /v1/bookmarks/* — A7 server-side bookmarks + highlights + notes.
 *
 * Auth-gated: every route requires a valid session cookie. 401 if not.
 *
 * Endpoints:
 *   GET    /v1/bookmarks                    — list all of user's bookmarks
 *   POST   /v1/bookmarks                    — create one (verse_key + kind + …)
 *   PATCH  /v1/bookmarks/:id                — update color/note (only the owner)
 *   DELETE /v1/bookmarks/:id                — delete (only the owner)
 *   GET    /v1/bookmarks/by-verse/:verseKey — every bookmark on a verse for the user
 *
 * Schema:
 *   id          uuid v4
 *   user_id     fk → users.id (CASCADE)
 *   verse_key   "<surah>:<ayah>"
 *   kind        bookmark | highlight | note
 *   color       slug (gold|leaf|sand|… for highlight) — nullable
 *   note        markdown (when kind=note) — nullable
 *   created_at  ISO datetime
 *   updated_at  ISO datetime
 */
import { randomUUID } from 'node:crypto';

import { authDb } from '../../auth/db.js';
import { SESSION_COOKIE_NAME, findUserBySession } from '../../auth/sessions.js';

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const VALID_KINDS = new Set(['bookmark', 'highlight', 'note']);

interface BookmarkRow {
  id: string;
  user_id: string;
  verse_key: string;
  kind: string;
  color: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

function readCookie(req: FastifyRequest, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const piece of header.split(';')) {
    const [k, ...rest] = piece.trim().split('=');
    if (k === name) return rest.join('=');
  }
  return null;
}

function requireUser(req: FastifyRequest, reply: FastifyReply): string | null {
  const sessionId = readCookie(req, SESSION_COOKIE_NAME);
  if (!sessionId) {
    void reply.code(401).send({ code: 'qalaam.auth.no-session' });
    return null;
  }
  const user = findUserBySession(sessionId);
  if (!user) {
    void reply.code(401).send({ code: 'qalaam.auth.session-expired' });
    return null;
  }
  return user.id;
}

function rowToJson(r: BookmarkRow): {
  id: string;
  verseKey: string;
  kind: string;
  color: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
} {
  return {
    id: r.id,
    verseKey: r.verse_key,
    kind: r.kind,
    color: r.color,
    note: r.note,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

interface CreateBody {
  verseKey?: string;
  kind?: string;
  color?: string;
  note?: string;
}

interface PatchBody {
  color?: string | null;
  note?: string | null;
}

export async function bookmarksRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /v1/bookmarks
  fastify.get(
    '/v1/bookmarks',
    {
      schema: {
        description: "List the current user's bookmarks / highlights / notes.",
        tags: ['bookmarks'],
        querystring: {
          type: 'object',
          properties: {
            kind: { type: 'string', enum: ['bookmark', 'highlight', 'note'] },
          },
        },
      },
    },

    async (req, reply) => {
      const userId = requireUser(req, reply);
      if (!userId) return;
      const q = req.query as { kind?: string };
      const rows = (
        q.kind
          ? authDb()
              .prepare(
                `SELECT id, user_id, verse_key, kind, color, note, created_at, updated_at
                 FROM bookmarks
                WHERE user_id = ? AND kind = ?
                ORDER BY created_at DESC`,
              )
              .all(userId, q.kind)
          : authDb()
              .prepare(
                `SELECT id, user_id, verse_key, kind, color, note, created_at, updated_at
                 FROM bookmarks
                WHERE user_id = ?
                ORDER BY created_at DESC`,
              )
              .all(userId)
      ) as BookmarkRow[];
      return reply.send({ data: rows.map(rowToJson) });
    },
  );

  // GET /v1/bookmarks/by-verse/:verseKey
  fastify.get<{ Params: { verseKey: string } }>(
    '/v1/bookmarks/by-verse/:verseKey',
    {
      schema: {
        description: 'Bookmarks on a specific verse for the current user.',
        tags: ['bookmarks'],
        params: {
          type: 'object',
          properties: {
            verseKey: { type: 'string', pattern: '^[1-9][0-9]?[0-9]?:[1-9][0-9]?[0-9]?$' },
          },
          required: ['verseKey'],
        },
      },
    },

    async (req, reply) => {
      const userId = requireUser(req, reply);
      if (!userId) return;
      const rows = authDb()
        .prepare(
          `SELECT id, user_id, verse_key, kind, color, note, created_at, updated_at
             FROM bookmarks
            WHERE user_id = ? AND verse_key = ?
            ORDER BY created_at DESC`,
        )
        .all(userId, req.params.verseKey) as BookmarkRow[];
      return reply.send({ data: rows.map(rowToJson) });
    },
  );

  // POST /v1/bookmarks
  fastify.post<{ Body: CreateBody }>(
    '/v1/bookmarks',
    {
      schema: {
        description: 'Create a bookmark / highlight / note.',
        tags: ['bookmarks'],
        body: {
          type: 'object',
          required: ['verseKey', 'kind'],
          properties: {
            verseKey: { type: 'string', pattern: '^[1-9][0-9]?[0-9]?:[1-9][0-9]?[0-9]?$' },
            kind: { type: 'string', enum: ['bookmark', 'highlight', 'note'] },
            color: { type: 'string', maxLength: 24 },
            note: { type: 'string', maxLength: 4000 },
          },
        },
      },
    },

    async (req, reply) => {
      const userId = requireUser(req, reply);
      if (!userId) return;
      const { verseKey, kind } = req.body;
      if (!verseKey || !kind || !VALID_KINDS.has(kind)) {
        return reply.code(400).send({ code: 'qalaam.bookmarks.bad-input' });
      }
      const id = randomUUID();
      authDb()
        .prepare(
          `INSERT INTO bookmarks (id, user_id, verse_key, kind, color, note)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(id, userId, verseKey, kind, req.body.color ?? null, req.body.note ?? null);
      const row = authDb()
        .prepare(
          `SELECT id, user_id, verse_key, kind, color, note, created_at, updated_at
             FROM bookmarks WHERE id = ?`,
        )
        .get(id) as BookmarkRow;
      return reply.code(201).send(rowToJson(row));
    },
  );

  // PATCH /v1/bookmarks/:id
  fastify.patch<{ Params: { id: string }; Body: PatchBody }>(
    '/v1/bookmarks/:id',
    {
      schema: {
        description: 'Update color or note text on an existing bookmark.',
        tags: ['bookmarks'],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        body: {
          type: 'object',
          properties: {
            color: { type: ['string', 'null'], maxLength: 24 },
            note: { type: ['string', 'null'], maxLength: 4000 },
          },
        },
      },
    },

    async (req, reply) => {
      const userId = requireUser(req, reply);
      if (!userId) return;
      const db = authDb();
      const existing = db
        .prepare('SELECT id, user_id FROM bookmarks WHERE id = ?')
        .get(req.params.id) as { id: string; user_id: string } | undefined;
      if (!existing) return reply.code(404).send({ code: 'qalaam.bookmarks.not-found' });
      if (existing.user_id !== userId)
        return reply.code(403).send({ code: 'qalaam.auth.forbidden' });
      // Build a partial UPDATE so only the supplied keys change.
      const sets: string[] = ["updated_at = datetime('now')"];
      const args: (string | null)[] = [];
      if (Object.prototype.hasOwnProperty.call(req.body, 'color')) {
        sets.push('color = ?');
        args.push(req.body.color ?? null);
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'note')) {
        sets.push('note = ?');
        args.push(req.body.note ?? null);
      }
      args.push(req.params.id);
      db.prepare(`UPDATE bookmarks SET ${sets.join(', ')} WHERE id = ?`).run(...args);
      const row = db
        .prepare(
          `SELECT id, user_id, verse_key, kind, color, note, created_at, updated_at
             FROM bookmarks WHERE id = ?`,
        )
        .get(req.params.id) as BookmarkRow;
      return reply.send(rowToJson(row));
    },
  );

  // DELETE /v1/bookmarks/:id
  fastify.delete<{ Params: { id: string } }>(
    '/v1/bookmarks/:id',
    {
      schema: {
        description: 'Delete a bookmark.',
        tags: ['bookmarks'],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
      },
    },

    async (req, reply) => {
      const userId = requireUser(req, reply);
      if (!userId) return;
      const db = authDb();
      const existing = db
        .prepare('SELECT user_id FROM bookmarks WHERE id = ?')
        .get(req.params.id) as { user_id: string } | undefined;
      if (!existing) return reply.code(404).send({ code: 'qalaam.bookmarks.not-found' });
      if (existing.user_id !== userId)
        return reply.code(403).send({ code: 'qalaam.auth.forbidden' });
      db.prepare('DELETE FROM bookmarks WHERE id = ?').run(req.params.id);
      return reply.code(204).send();
    },
  );
}
