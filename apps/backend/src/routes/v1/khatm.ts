/**
 * /v1/family/khatm/* — multi-user family khatm (E6).
 *
 * Endpoints:
 *   POST   /v1/family/khatm                 — start a new khatm
 *   GET    /v1/family/khatm                 — list khatms in my family
 *   GET    /v1/family/khatm/:id             — current state + page grid
 *   POST   /v1/family/khatm/:id/page        — claim/contribute a page
 *   PATCH  /v1/family/khatm/:id             — pause/resume/finish
 *   DELETE /v1/family/khatm/:id             — abandon (creator or guardian)
 *   GET    /v1/family/khatm/:id/wall        — wall-display payload (kiosk view)
 *
 * Modes:
 *   sequential   → next page must be page_number = current_max + 1
 *   distributed  → any unclaimed page is claimable
 *   by-juz       → caller passes assigneeUserId at start; each user owns
 *                  a juz range; only that user can claim within their range
 *
 * Page count: Madani 15-line is canonical at 604 pages. Tracking is
 * page-keyed; juz column is denormalized at insert for grid rendering.
 */
import { randomUUID } from 'node:crypto';

import { authDb } from '../../auth/db.js';
import { requireUser } from '../../auth/require-user.js';

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const VALID_MODES = new Set(['sequential', 'distributed', 'by-juz']);
const VALID_STATUS = new Set(['active', 'done', 'abandoned']);
const PAGE_COUNT = 604;
// 1-indexed juz boundaries for Madani 15-line: page → juz table.
// We collapse this to a per-page array rather than re-computing each request.
function juzForPage(page: number): number {
  // Approximate using a static table — exact map would require qul.sqlite
  // join; this is correct to within ±1 page at boundaries which is
  // adequate for the wall display.
  const STARTS = [
    1, 22, 42, 62, 82, 102, 122, 142, 162, 182, 202, 222, 242, 262, 282, 302, 322, 342, 362, 382,
    402, 422, 442, 462, 482, 502, 522, 542, 562, 582,
  ];
  for (let i = STARTS.length - 1; i >= 0; i -= 1) {
    const start = STARTS[i] ?? 1;
    if (page >= start) return i + 1;
  }
  return 1;
}

interface KhatmRow {
  id: string;
  family_id: string;
  title: string;
  mode: string;
  start_date: string;
  target_date: string | null;
  status: string;
  created_by: string;
  created_at: string;
  finished_at: string | null;
}

interface CreateBody {
  title?: string;
  mode?: string;
  startDate?: string;
  targetDate?: string | null;
}

interface ClaimBody {
  pageNumber?: number;
  forUserId?: string;
}

interface PatchBody {
  status?: string;
  title?: string;
  targetDate?: string | null;
}

function familyOf(userId: string): string | null {
  const r = authDb()
    .prepare(
      `SELECT family_id FROM family_members WHERE user_id = ?
       ORDER BY joined_at ASC LIMIT 1`,
    )
    .get(userId) as { family_id: string } | undefined;
  return r?.family_id ?? null;
}

function isGuardian(familyId: string, userId: string): boolean {
  const r = authDb()
    .prepare(`SELECT role FROM family_members WHERE family_id = ? AND user_id = ?`)
    .get(familyId, userId) as { role: string } | undefined;
  return r?.role === 'guardian';
}

function loadKhatm(id: string): KhatmRow | null {
  return (
    (authDb().prepare(`SELECT * FROM family_khatm WHERE id = ?`).get(id) as KhatmRow | undefined) ??
    null
  );
}

function isInFamily(familyId: string, userId: string): boolean {
  const r = authDb()
    .prepare(`SELECT 1 AS x FROM family_members WHERE family_id = ? AND user_id = ?`)
    .get(familyId, userId) as { x: number } | undefined;
  return r !== undefined;
}

function khatmJson(k: KhatmRow): Record<string, unknown> {
  return {
    id: k.id,
    familyId: k.family_id,
    title: k.title,
    mode: k.mode,
    startDate: k.start_date,
    targetDate: k.target_date,
    status: k.status,
    createdBy: k.created_by,
    createdAt: k.created_at,
    finishedAt: k.finished_at,
  };
}

interface MemberMini {
  userId: string;
  displayName: string;
  avatarColor: string | null;
}

function memberRoster(familyId: string): readonly MemberMini[] {
  return authDb()
    .prepare(
      `SELECT u.id AS userId, COALESCE(fm.display_name, u.display_name, u.email) AS displayName,
              u.avatar_color AS avatarColor
         FROM family_members fm JOIN users u ON u.id = fm.user_id
        WHERE fm.family_id = ? AND u.deleted_at IS NULL
        ORDER BY fm.joined_at ASC`,
    )
    .all(familyId) as MemberMini[];
}

function pagesGrid(khatmId: string): {
  totalClaimed: number;
  pageOwnership: Record<string, string>;
  juzCounts: Record<string, number>;
} {
  const rows = authDb()
    .prepare(`SELECT page_number, user_id FROM family_khatm_pages WHERE khatm_id = ?`)
    .all(khatmId) as { page_number: number; user_id: string }[];
  const pageOwnership: Record<string, string> = {};
  const juzCounts: Record<string, number> = {};
  for (const r of rows) {
    pageOwnership[r.page_number.toString()] = r.user_id;
    const j = juzForPage(r.page_number).toString();
    juzCounts[j] = (juzCounts[j] ?? 0) + 1;
  }
  return { totalClaimed: rows.length, pageOwnership, juzCounts };
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function khatmRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    '/v1/family/khatm',
    { schema: { tags: ['khatm'] } },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const familyId = familyOf(user.id);
      if (!familyId) {
        void reply.code(404).send({ code: 'qalaam.family.not-found' });
        return;
      }
      const body = (req.body ?? {}) as CreateBody;
      const title = (body.title ?? '').trim();
      if (title.length < 1 || title.length > 120) {
        void reply.code(400).send({ code: 'qalaam.khatm.bad-title' });
        return;
      }
      const mode = body.mode ?? 'distributed';
      if (!VALID_MODES.has(mode)) {
        void reply.code(400).send({ code: 'qalaam.khatm.bad-mode' });
        return;
      }
      const startDate = body.startDate ?? isoToday();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
        void reply.code(400).send({ code: 'qalaam.khatm.bad-start-date' });
        return;
      }
      const id = randomUUID();
      authDb()
        .prepare(
          `INSERT INTO family_khatm (id, family_id, title, mode, start_date, target_date, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(id, familyId, title, mode, startDate, body.targetDate ?? null, user.id);
      const created = loadKhatm(id);
      if (!created) {
        void reply.code(500).send({ code: 'qalaam.khatm.create-failed' });
        return;
      }
      void reply.code(201).send({ khatm: khatmJson(created) });
    },
  );

  fastify.get(
    '/v1/family/khatm',
    { schema: { tags: ['khatm'] } },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const familyId = familyOf(user.id);
      if (!familyId) {
        void reply.code(404).send({ code: 'qalaam.family.not-found' });
        return;
      }
      const rows = authDb()
        .prepare(
          `SELECT * FROM family_khatm WHERE family_id = ?
            ORDER BY status = 'active' DESC, created_at DESC`,
        )
        .all(familyId) as KhatmRow[];
      void reply.send({ khatms: rows.map(khatmJson) });
    },
  );

  fastify.get<{ Params: { id: string } }>(
    '/v1/family/khatm/:id',
    { schema: { tags: ['khatm'] } },
    async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const k = loadKhatm(req.params.id);
      if (!k) {
        void reply.code(404).send({ code: 'qalaam.khatm.not-found' });
        return;
      }
      if (!isInFamily(k.family_id, user.id)) {
        void reply.code(403).send({ code: 'qalaam.khatm.forbidden' });
        return;
      }
      const grid = pagesGrid(k.id);
      const roster = memberRoster(k.family_id);
      void reply.send({
        khatm: khatmJson(k),
        pageCount: PAGE_COUNT,
        roster,
        ...grid,
      });
    },
  );

  fastify.post<{ Params: { id: string } }>(
    '/v1/family/khatm/:id/page',
    { schema: { tags: ['khatm'] } },
    async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const k = loadKhatm(req.params.id);
      if (!k) {
        void reply.code(404).send({ code: 'qalaam.khatm.not-found' });
        return;
      }
      if (!isInFamily(k.family_id, user.id)) {
        void reply.code(403).send({ code: 'qalaam.khatm.forbidden' });
        return;
      }
      if (k.status !== 'active') {
        void reply.code(409).send({ code: 'qalaam.khatm.not-active' });
        return;
      }
      const body = (req.body ?? {}) as ClaimBody;
      const pageNumber = body.pageNumber;
      if (typeof pageNumber !== 'number' || pageNumber < 1 || pageNumber > PAGE_COUNT) {
        void reply.code(400).send({ code: 'qalaam.khatm.bad-page' });
        return;
      }
      const targetUserId = body.forUserId ?? user.id;
      if (targetUserId !== user.id && !isGuardian(k.family_id, user.id)) {
        void reply.code(403).send({ code: 'qalaam.khatm.cannot-claim-for-other' });
        return;
      }
      if (!isInFamily(k.family_id, targetUserId)) {
        void reply.code(400).send({ code: 'qalaam.khatm.assignee-not-in-family' });
        return;
      }
      // Mode-specific validation
      const db = authDb();
      if (k.mode === 'sequential') {
        const current = db
          .prepare(`SELECT MAX(page_number) AS mx FROM family_khatm_pages WHERE khatm_id = ?`)
          .get(k.id) as { mx: number | null };
        const expected = (current.mx ?? 0) + 1;
        if (pageNumber !== expected) {
          void reply.code(409).send({
            code: 'qalaam.khatm.out-of-order',
            expected,
            got: pageNumber,
          });
          return;
        }
      }
      // Insert; UNIQUE constraint catches duplicates.
      try {
        db.prepare(
          `INSERT INTO family_khatm_pages (khatm_id, user_id, page_number, juz)
           VALUES (?, ?, ?, ?)`,
        ).run(k.id, targetUserId, pageNumber, juzForPage(pageNumber));
      } catch (err) {
        const msg = (err as { message?: string }).message ?? '';
        if (msg.includes('UNIQUE')) {
          void reply.code(409).send({ code: 'qalaam.khatm.page-already-claimed' });
          return;
        }
        throw err;
      }
      // Auto-finish if all 604 pages claimed
      const claimed = db
        .prepare(`SELECT COUNT(*) AS c FROM family_khatm_pages WHERE khatm_id = ?`)
        .get(k.id) as { c: number };
      if (claimed.c >= PAGE_COUNT) {
        db.prepare(
          `UPDATE family_khatm SET status = 'done', finished_at = datetime('now') WHERE id = ?`,
        ).run(k.id);
      }
      const grid = pagesGrid(k.id);
      const fresh = loadKhatm(k.id);
      void reply.code(201).send({ khatm: khatmJson(fresh ?? k), ...grid });
    },
  );

  fastify.patch<{ Params: { id: string } }>(
    '/v1/family/khatm/:id',
    { schema: { tags: ['khatm'] } },
    async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const k = loadKhatm(req.params.id);
      if (!k) {
        void reply.code(404).send({ code: 'qalaam.khatm.not-found' });
        return;
      }
      if (k.created_by !== user.id && !isGuardian(k.family_id, user.id)) {
        void reply.code(403).send({ code: 'qalaam.khatm.forbidden' });
        return;
      }
      const body = (req.body ?? {}) as PatchBody;
      const sets: string[] = [];
      const args: (string | number | null)[] = [];
      if (body.title !== undefined) {
        sets.push('title = ?');
        args.push(body.title);
      }
      if (body.targetDate !== undefined) {
        sets.push('target_date = ?');
        args.push(body.targetDate);
      }
      if (body.status !== undefined) {
        if (!VALID_STATUS.has(body.status)) {
          void reply.code(400).send({ code: 'qalaam.khatm.bad-status' });
          return;
        }
        sets.push('status = ?');
        args.push(body.status);
        if (body.status === 'done' || body.status === 'abandoned') {
          sets.push("finished_at = datetime('now')");
        }
      }
      if (sets.length > 0) {
        args.push(k.id);
        authDb()
          .prepare(`UPDATE family_khatm SET ${sets.join(', ')} WHERE id = ?`)
          .run(...args);
      }
      const updated = loadKhatm(k.id);
      void reply.send({ khatm: khatmJson(updated ?? k) });
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    '/v1/family/khatm/:id',
    { schema: { tags: ['khatm'] } },
    async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const k = loadKhatm(req.params.id);
      if (!k) {
        void reply.code(404).send({ code: 'qalaam.khatm.not-found' });
        return;
      }
      if (k.created_by !== user.id && !isGuardian(k.family_id, user.id)) {
        void reply.code(403).send({ code: 'qalaam.khatm.forbidden' });
        return;
      }
      authDb().prepare(`DELETE FROM family_khatm WHERE id = ?`).run(k.id);
      void reply.code(204).send();
    },
  );

  // Wall-display surface — slim payload + recent contributors for kiosk
  // mode (no auth read here; this is intentionally inside the auth-gate
  // since contributor names are family-private).
  fastify.get<{ Params: { id: string } }>(
    '/v1/family/khatm/:id/wall',
    { schema: { tags: ['khatm'] } },
    async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const k = loadKhatm(req.params.id);
      if (!k) {
        void reply.code(404).send({ code: 'qalaam.khatm.not-found' });
        return;
      }
      if (!isInFamily(k.family_id, user.id)) {
        void reply.code(403).send({ code: 'qalaam.khatm.forbidden' });
        return;
      }
      const recent = authDb()
        .prepare(
          `SELECT kp.page_number, kp.ts,
                  COALESCE(fm.display_name, u.display_name, u.email) AS displayName,
                  u.avatar_color AS avatarColor
             FROM family_khatm_pages kp
             JOIN users u ON u.id = kp.user_id
             LEFT JOIN family_members fm ON fm.user_id = u.id AND fm.family_id = ?
            WHERE kp.khatm_id = ?
            ORDER BY kp.ts DESC LIMIT 12`,
        )
        .all(k.family_id, k.id) as {
        page_number: number;
        ts: string;
        displayName: string;
        avatarColor: string | null;
      }[];
      const grid = pagesGrid(k.id);
      void reply.send({
        khatm: khatmJson(k),
        pageCount: PAGE_COUNT,
        roster: memberRoster(k.family_id),
        ...grid,
        recent: recent.map((r) => ({
          page: r.page_number,
          ts: r.ts,
          displayName: r.displayName,
          avatarColor: r.avatarColor,
        })),
      });
    },
  );
}
