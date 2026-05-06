/**
 * /v1/plans/* — per-child Hifdh plan CRUD + progress logging.
 *
 * Endpoints:
 *   GET    /v1/plans                   — plans I own OR am assigned
 *   GET    /v1/plans/:id               — single plan + recent progress
 *   POST   /v1/plans                   — create
 *   PATCH  /v1/plans/:id               — update fields
 *   DELETE /v1/plans/:id               — soft via status='abandoned'; hard if owner
 *   POST   /v1/plans/:id/progress      — append a progress entry
 *
 * Authorization: a request is allowed if the current user is the
 * plan's owner OR assignee OR a guardian in the plan's family. The
 * mutation routes (POST/PATCH/DELETE) require owner-or-guardian.
 */
import { randomUUID } from 'node:crypto';

import { authDb } from '../../auth/db.js';
import { requireUser } from '../../auth/require-user.js';

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const VALID_SCOPE_KIND = new Set(['juz', 'surah', 'range', 'full']);
const VALID_STATUS = new Set(['active', 'paused', 'done', 'abandoned']);
const VALID_PROGRESS_KIND = new Set(['sabaq', 'sabqi', 'manzil', 'review']);
const VERSE_RANGE_RE =
  /^[1-9][0-9]?[0-9]?:[1-9][0-9]?[0-9]?(?:-[1-9][0-9]?[0-9]?:[1-9][0-9]?[0-9]?)?$/;

interface PlanRow {
  id: string;
  family_id: string;
  owner_user_id: string;
  assignee_user_id: string;
  title: string;
  scope_kind: string;
  scope_value: string | null;
  daily_pages: number;
  start_date: string;
  target_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ProgressRow {
  id: number;
  plan_id: string | null;
  user_id: string;
  reviewer_user_id: string | null;
  date: string;
  kind: string;
  page_number: number | null;
  verses_completed: number | null;
  quality: number | null;
  notes: string | null;
  ts: string;
}

interface CreatePlanBody {
  assigneeUserId?: string;
  title?: string;
  scopeKind?: string;
  scopeValue?: string | null;
  dailyPages?: number;
  startDate?: string;
  targetDate?: string | null;
  notes?: string | null;
}

interface PatchPlanBody {
  title?: string;
  scopeKind?: string;
  scopeValue?: string | null;
  dailyPages?: number;
  startDate?: string;
  targetDate?: string | null;
  status?: string;
  notes?: string | null;
}

interface ProgressBody {
  date?: string;
  kind?: string;
  pageNumber?: number;
  versesCompleted?: number;
  quality?: number;
  notes?: string;
}

function planJson(p: PlanRow): Record<string, unknown> {
  return {
    id: p.id,
    familyId: p.family_id,
    ownerUserId: p.owner_user_id,
    assigneeUserId: p.assignee_user_id,
    title: p.title,
    scopeKind: p.scope_kind,
    scopeValue: p.scope_value,
    dailyPages: p.daily_pages,
    startDate: p.start_date,
    targetDate: p.target_date,
    status: p.status,
    notes: p.notes,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

function progressJson(r: ProgressRow): Record<string, unknown> {
  return {
    id: r.id,
    planId: r.plan_id,
    userId: r.user_id,
    reviewerUserId: r.reviewer_user_id,
    date: r.date,
    kind: r.kind,
    pageNumber: r.page_number,
    versesCompleted: r.verses_completed,
    quality: r.quality,
    notes: r.notes,
    ts: r.ts,
  };
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

function isGuardianIn(familyId: string, userId: string): boolean {
  const r = authDb()
    .prepare(`SELECT role FROM family_members WHERE family_id = ? AND user_id = ?`)
    .get(familyId, userId) as { role: string } | undefined;
  return r?.role === 'guardian';
}

function loadPlan(planId: string): PlanRow | null {
  return (
    (authDb().prepare(`SELECT * FROM hifdh_plans WHERE id = ?`).get(planId) as
      | PlanRow
      | undefined) ?? null
  );
}

function canRead(plan: PlanRow, userId: string): boolean {
  if (plan.owner_user_id === userId) return true;
  if (plan.assignee_user_id === userId) return true;
  return isGuardianIn(plan.family_id, userId);
}

function canMutate(plan: PlanRow, userId: string): boolean {
  if (plan.owner_user_id === userId) return true;
  return isGuardianIn(plan.family_id, userId);
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Parses an optional ISO date.
 *   undefined → undefined  (caller chooses default)
 *   null | "" → null        (caller stores null)
 *   "YYYY-MM-DD" valid → "YYYY-MM-DD"
 *   anything else → false   (invalid — caller 400s)
 */
function parseDate(s: string | undefined | null): string | null | undefined | false {
  if (s === undefined) return undefined;
  if (s === null || s === '') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = Date.parse(s);
  if (Number.isNaN(t)) return false;
  return s;
}

function validateScope(kind: string, value: string | null | undefined): boolean {
  if (kind === 'full') return true;
  if (value === null || value === undefined || value === '') return false;
  if (kind === 'juz') {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) && n >= 1 && n <= 30;
  }
  if (kind === 'surah') {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) && n >= 1 && n <= 114;
  }
  if (kind === 'range') return VERSE_RANGE_RE.test(value);
  return false;
}

export async function plansRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/v1/plans',
    { schema: { description: 'Plans I own or am assigned to.', tags: ['plans'] } },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const rows = authDb()
        .prepare(
          `SELECT * FROM hifdh_plans
            WHERE owner_user_id = ? OR assignee_user_id = ?
            ORDER BY status = 'active' DESC, updated_at DESC`,
        )
        .all(user.id, user.id) as PlanRow[];
      void reply.send({ plans: rows.map(planJson) });
    },
  );

  fastify.get<{ Params: { id: string }; Querystring: { progressLimit?: string } }>(
    '/v1/plans/:id',
    { schema: { tags: ['plans'] } },
    async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const plan = loadPlan(req.params.id);
      if (!plan) {
        void reply.code(404).send({ code: 'qalaam.plan.not-found' });
        return;
      }
      if (!canRead(plan, user.id)) {
        void reply.code(403).send({ code: 'qalaam.plan.forbidden' });
        return;
      }
      const limit = Math.min(Number.parseInt(req.query.progressLimit ?? '30', 10) || 30, 200);
      const progress = authDb()
        .prepare(
          `SELECT * FROM hifdh_progress
            WHERE plan_id = ?
            ORDER BY ts DESC LIMIT ?`,
        )
        .all(plan.id, limit) as ProgressRow[];
      void reply.send({ plan: planJson(plan), progress: progress.map(progressJson) });
    },
  );

  fastify.post(
    '/v1/plans',
    { schema: { tags: ['plans'] } },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const familyId = familyOf(user.id);
      if (!familyId) {
        void reply.code(404).send({ code: 'qalaam.family.not-found' });
        return;
      }
      const body = (req.body ?? {}) as CreatePlanBody;
      const assigneeUserId = body.assigneeUserId ?? user.id;
      if (assigneeUserId !== user.id) {
        // Guardian-only: enforce that current user is a guardian
        // AND assignee is a member of the same family.
        if (!isGuardianIn(familyId, user.id)) {
          void reply.code(403).send({ code: 'qalaam.plan.not-guardian' });
          return;
        }
        const isMember = authDb()
          .prepare(`SELECT 1 AS x FROM family_members WHERE family_id = ? AND user_id = ?`)
          .get(familyId, assigneeUserId) as { x: number } | undefined;
        if (!isMember) {
          void reply.code(400).send({ code: 'qalaam.plan.assignee-not-in-family' });
          return;
        }
      }
      const title = (body.title ?? '').trim();
      if (title.length < 1 || title.length > 120) {
        void reply.code(400).send({ code: 'qalaam.plan.bad-title' });
        return;
      }
      const scopeKind = body.scopeKind ?? 'full';
      if (!VALID_SCOPE_KIND.has(scopeKind)) {
        void reply.code(400).send({ code: 'qalaam.plan.bad-scope-kind' });
        return;
      }
      if (!validateScope(scopeKind, body.scopeValue ?? null)) {
        void reply.code(400).send({ code: 'qalaam.plan.bad-scope-value' });
        return;
      }
      const dailyPages =
        typeof body.dailyPages === 'number' && body.dailyPages > 0 && body.dailyPages <= 20
          ? body.dailyPages
          : 1;
      const startDate = parseDate(body.startDate ?? isoToday());
      if (startDate === undefined || startDate === null || startDate === false) {
        void reply.code(400).send({ code: 'qalaam.plan.bad-start-date' });
        return;
      }
      const targetDate = parseDate(body.targetDate);
      if (targetDate === false) {
        void reply.code(400).send({ code: 'qalaam.plan.bad-target-date' });
        return;
      }
      // undefined or null → store null
      const targetDateStored = targetDate ?? null;
      const planId = randomUUID();
      authDb()
        .prepare(
          `INSERT INTO hifdh_plans (id, family_id, owner_user_id, assignee_user_id,
             title, scope_kind, scope_value, daily_pages, start_date, target_date, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          planId,
          familyId,
          user.id,
          assigneeUserId,
          title,
          scopeKind,
          body.scopeValue ?? null,
          dailyPages,
          startDate,
          targetDateStored,
          body.notes ?? null,
        );
      const created = loadPlan(planId);
      if (!created) {
        void reply.code(500).send({ code: 'qalaam.plan.create-failed' });
        return;
      }
      void reply.code(201).send({ plan: planJson(created) });
    },
  );

  fastify.patch<{ Params: { id: string } }>(
    '/v1/plans/:id',
    { schema: { tags: ['plans'] } },
    async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const plan = loadPlan(req.params.id);
      if (!plan) {
        void reply.code(404).send({ code: 'qalaam.plan.not-found' });
        return;
      }
      if (!canMutate(plan, user.id)) {
        void reply.code(403).send({ code: 'qalaam.plan.forbidden' });
        return;
      }
      const body = (req.body ?? {}) as PatchPlanBody;
      const sets: string[] = [];
      const args: (string | number | null)[] = [];
      if (body.title !== undefined) {
        const t = body.title.trim();
        if (t.length < 1 || t.length > 120) {
          void reply.code(400).send({ code: 'qalaam.plan.bad-title' });
          return;
        }
        sets.push('title = ?');
        args.push(t);
      }
      const newScopeKind = body.scopeKind ?? plan.scope_kind;
      const newScopeValue = body.scopeValue === undefined ? plan.scope_value : body.scopeValue;
      if (body.scopeKind !== undefined || body.scopeValue !== undefined) {
        if (!VALID_SCOPE_KIND.has(newScopeKind)) {
          void reply.code(400).send({ code: 'qalaam.plan.bad-scope-kind' });
          return;
        }
        if (!validateScope(newScopeKind, newScopeValue)) {
          void reply.code(400).send({ code: 'qalaam.plan.bad-scope-value' });
          return;
        }
        sets.push('scope_kind = ?', 'scope_value = ?');
        args.push(newScopeKind, newScopeValue);
      }
      if (body.dailyPages !== undefined) {
        if (typeof body.dailyPages !== 'number' || body.dailyPages <= 0 || body.dailyPages > 20) {
          void reply.code(400).send({ code: 'qalaam.plan.bad-daily' });
          return;
        }
        sets.push('daily_pages = ?');
        args.push(body.dailyPages);
      }
      if (body.startDate !== undefined) {
        const v = parseDate(body.startDate);
        if (v === undefined || v === null || v === false) {
          void reply.code(400).send({ code: 'qalaam.plan.bad-start-date' });
          return;
        }
        sets.push('start_date = ?');
        args.push(v);
      }
      if (body.targetDate !== undefined) {
        const v = parseDate(body.targetDate);
        if (v === false) {
          void reply.code(400).send({ code: 'qalaam.plan.bad-target-date' });
          return;
        }
        sets.push('target_date = ?');
        args.push(v ?? null);
      }
      if (body.status !== undefined) {
        if (!VALID_STATUS.has(body.status)) {
          void reply.code(400).send({ code: 'qalaam.plan.bad-status' });
          return;
        }
        sets.push('status = ?');
        args.push(body.status);
      }
      if (body.notes !== undefined) {
        sets.push('notes = ?');
        args.push(body.notes);
      }
      if (sets.length === 0) {
        void reply.send({ plan: planJson(plan) });
        return;
      }
      sets.push("updated_at = datetime('now')");
      args.push(plan.id);
      authDb()
        .prepare(`UPDATE hifdh_plans SET ${sets.join(', ')} WHERE id = ?`)
        .run(...args);
      const updated = loadPlan(plan.id);
      void reply.send({ plan: planJson(updated ?? plan) });
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    '/v1/plans/:id',
    { schema: { tags: ['plans'] } },
    async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const plan = loadPlan(req.params.id);
      if (!plan) {
        void reply.code(404).send({ code: 'qalaam.plan.not-found' });
        return;
      }
      if (!canMutate(plan, user.id)) {
        void reply.code(403).send({ code: 'qalaam.plan.forbidden' });
        return;
      }
      authDb().prepare(`DELETE FROM hifdh_plans WHERE id = ?`).run(plan.id);
      void reply.code(204).send();
    },
  );

  fastify.post<{ Params: { id: string } }>(
    '/v1/plans/:id/progress',
    { schema: { tags: ['plans'] } },
    async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const plan = loadPlan(req.params.id);
      if (!plan) {
        void reply.code(404).send({ code: 'qalaam.plan.not-found' });
        return;
      }
      // Both assignee and guardian can record progress; review/rate is
      // typically a guardian, but a child marking their own self-review
      // is also legitimate.
      if (!canRead(plan, user.id)) {
        void reply.code(403).send({ code: 'qalaam.plan.forbidden' });
        return;
      }
      const body = (req.body ?? {}) as ProgressBody;
      const date = parseDate(body.date ?? isoToday());
      if (date === undefined || date === null || date === false) {
        void reply.code(400).send({ code: 'qalaam.plan.bad-date' });
        return;
      }
      const kind = body.kind ?? 'sabaq';
      if (!VALID_PROGRESS_KIND.has(kind)) {
        void reply.code(400).send({ code: 'qalaam.plan.bad-kind' });
        return;
      }
      const pageNumber =
        typeof body.pageNumber === 'number' && body.pageNumber >= 1 && body.pageNumber <= 604
          ? body.pageNumber
          : null;
      const verses =
        typeof body.versesCompleted === 'number' &&
        body.versesCompleted >= 0 &&
        body.versesCompleted <= 6236
          ? body.versesCompleted
          : null;
      const quality =
        typeof body.quality === 'number' && body.quality >= 1 && body.quality <= 5
          ? Math.round(body.quality)
          : null;
      const notes = typeof body.notes === 'string' && body.notes.length > 0 ? body.notes : null;
      const reviewerId = user.id !== plan.assignee_user_id ? user.id : null;
      const result = authDb()
        .prepare(
          `INSERT INTO hifdh_progress
            (plan_id, user_id, reviewer_user_id, date, kind, page_number, verses_completed, quality, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          plan.id,
          plan.assignee_user_id,
          reviewerId,
          date,
          kind,
          pageNumber,
          verses,
          quality,
          notes,
        );
      const row = authDb()
        .prepare(`SELECT * FROM hifdh_progress WHERE id = ?`)
        .get(result.lastInsertRowid) as ProgressRow | undefined;
      if (!row) {
        void reply.code(500).send({ code: 'qalaam.plan.progress-failed' });
        return;
      }
      void reply.code(201).send({ progress: progressJson(row) });
    },
  );
}
