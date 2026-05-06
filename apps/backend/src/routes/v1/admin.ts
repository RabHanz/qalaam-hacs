/**
 * /v1/admin/* — maintainer-only operational endpoints.
 *
 * Task #214 (J2). Behind the `requireAdmin` env-allowlist gate. Every
 * write writes an `admin_audit` row.
 *
 * Endpoints:
 *   GET    /v1/admin/me                       → { isAdmin, email }
 *   GET    /v1/admin/system                   → tier counts, signups, sessions, etc.
 *   GET    /v1/admin/users                    → paginated user list
 *   PATCH  /v1/admin/users/:id                → bump tier / minor / displayName / haUrl
 *   GET    /v1/admin/audit                    → recent admin actions (tail)
 *   GET    /v1/admin/support                  → recent support requests
 *   PATCH  /v1/admin/support/:id              → mark resolved
 */
import { isAdmin, requireAdmin, writeAudit } from '../../auth/admin.js';
import { authDb } from '../../auth/db.js';
import { SESSION_COOKIE_NAME, findUserBySession } from '../../auth/sessions.js';

import type { FastifyInstance, FastifyRequest } from 'fastify';

interface UserRow {
  id: string;
  email: string;
  display_name: string | null;
  tier: string;
  is_minor: number;
  is_shadow: number;
  created_at: string;
  last_seen_at: string;
  deleted_at: string | null;
  ha_url: string | null;
  avatar_color: string | null;
}

interface AuditRow {
  id: number;
  ts: string;
  actor_user_id: string;
  actor_email: string | null;
  action: string;
  target_user_id: string | null;
  target_email: string | null;
  payload_json: string | null;
}

interface SupportRow {
  id: number;
  ts: string;
  user_id: string | null;
  email: string | null;
  kind: string;
  target_tier: string | null;
  message: string | null;
  handled_at: string | null;
  handled_by: string | null;
}

function readSessionCookie(req: FastifyRequest): string | null {
  const h = req.headers.cookie;
  if (!h) return null;
  for (const c of h.split(';').map((s) => s.trim())) {
    const [name, ...rest] = c.split('=');
    if (name === SESSION_COOKIE_NAME) return rest.join('=');
  }
  return null;
}

const VALID_TIERS = new Set(['free', 'premium', 'pro']);

export async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  // ─── GET /v1/admin/me ─────────────────────────────────────────────
  // Used by the /admin shell to decide whether to render the panel
  // or redirect home. Always 200, even for non-admins.
  fastify.get(
    '/v1/admin/me',
    { schema: { description: 'Whether the current session is an admin.', tags: ['admin'] } },
    async (req, reply) => {
      const sid = readSessionCookie(req);
      const user = sid ? findUserBySession(sid) : null;
      const admin = isAdmin(user);
      return reply.send({
        isAdmin: admin,
        email: user?.email ?? null,
      });
    },
  );

  // ─── GET /v1/admin/system ─────────────────────────────────────────
  fastify.get(
    '/v1/admin/system',
    { schema: { description: 'Snapshot of system-wide counters.', tags: ['admin'] } },
    async (req, reply) => {
      const gate = requireAdmin(req, reply);
      if (!gate.ok) return;
      const db = authDb();

      const tierRows = db
        .prepare<[], { tier: string; n: number }>(
          `SELECT tier, COUNT(*) AS n
             FROM users
             WHERE deleted_at IS NULL AND is_shadow = 0
             GROUP BY tier`,
        )
        .all();
      const byTier: Record<string, number> = { free: 0, premium: 0, pro: 0 };
      for (const r of tierRows) byTier[r.tier] = r.n;

      const totals = db
        .prepare<
          [],
          { n: number }
        >(`SELECT COUNT(*) AS n FROM users WHERE deleted_at IS NULL AND is_shadow = 0`)
        .get();
      const minors = db
        .prepare<[], { n: number }>(
          `SELECT COUNT(*) AS n FROM users
             WHERE deleted_at IS NULL AND is_shadow = 0 AND is_minor = 1`,
        )
        .get();
      const shadow = db
        .prepare<
          [],
          { n: number }
        >(`SELECT COUNT(*) AS n FROM users WHERE deleted_at IS NULL AND is_shadow = 1`)
        .get();
      const signupsLast7d = db
        .prepare<[], { n: number }>(
          `SELECT COUNT(*) AS n FROM users
             WHERE deleted_at IS NULL AND is_shadow = 0
               AND created_at >= datetime('now', '-7 days')`,
        )
        .get();
      const activeSessions = db
        .prepare<
          [],
          { n: number }
        >(`SELECT COUNT(*) AS n FROM sessions WHERE expires_at > datetime('now')`)
        .get();
      const supportOpen = db
        .prepare<
          [],
          { n: number }
        >(`SELECT COUNT(*) AS n FROM support_requests WHERE handled_at IS NULL`)
        .get();
      const apiKeysActive = db
        .prepare<[], { n: number }>(`SELECT COUNT(*) AS n FROM api_keys WHERE revoked_at IS NULL`)
        .get();

      return reply.send({
        users: {
          total: totals?.n ?? 0,
          byTier,
          minors: minors?.n ?? 0,
          shadow: shadow?.n ?? 0,
          signupsLast7d: signupsLast7d?.n ?? 0,
        },
        sessions: { active: activeSessions?.n ?? 0 },
        support: { open: supportOpen?.n ?? 0 },
        apiKeys: { active: apiKeysActive?.n ?? 0 },
      });
    },
  );

  // ─── GET /v1/admin/users ──────────────────────────────────────────
  fastify.get<{
    Querystring: { q?: string; tier?: string; limit?: string; offset?: string };
  }>(
    '/v1/admin/users',
    {
      schema: {
        description: 'Paginated user list. Filterable by email/display + tier.',
        tags: ['admin'],
      },
    },
    async (req, reply) => {
      const gate = requireAdmin(req, reply);
      if (!gate.ok) return;
      const q = (req.query.q ?? '').trim().toLowerCase();
      const tier = (req.query.tier ?? '').trim();
      const limit = Math.min(200, Math.max(1, Number.parseInt(req.query.limit ?? '50', 10) || 50));
      const offset = Math.max(0, Number.parseInt(req.query.offset ?? '0', 10) || 0);

      const where: string[] = ['deleted_at IS NULL'];
      const params: (string | number)[] = [];
      if (q) {
        where.push("(LOWER(email) LIKE ? OR LOWER(COALESCE(display_name, '')) LIKE ?)");
        const like = `%${q}%`;
        params.push(like, like);
      }
      if (tier && VALID_TIERS.has(tier)) {
        where.push('tier = ?');
        params.push(tier);
      }
      const sql = `
        SELECT id, email, display_name, tier, is_minor, is_shadow,
               created_at, last_seen_at, deleted_at, ha_url, avatar_color
          FROM users
         WHERE ${where.join(' AND ')}
         ORDER BY last_seen_at DESC, created_at DESC
         LIMIT ? OFFSET ?`;
      params.push(limit, offset);
      const rows = authDb()
        .prepare<typeof params, UserRow>(sql)
        .all(...params);

      const totalSql = `SELECT COUNT(*) AS n FROM users WHERE ${where.join(' AND ')}`;
      const total =
        authDb()
          .prepare<typeof params, { n: number }>(totalSql)
          .get(...params.slice(0, params.length - 2))?.n ?? 0;

      return reply.send({
        total,
        limit,
        offset,
        users: rows.map((r) => ({
          id: r.id,
          email: r.email,
          displayName: r.display_name,
          tier: r.tier,
          isMinor: r.is_minor === 1,
          isShadow: r.is_shadow === 1,
          createdAt: r.created_at,
          lastSeenAt: r.last_seen_at,
          haUrl: r.ha_url,
          avatarColor: r.avatar_color,
        })),
      });
    },
  );

  // ─── PATCH /v1/admin/users/:id ────────────────────────────────────
  fastify.patch<{
    Params: { id: string };
    Body: {
      tier?: string;
      isMinor?: boolean;
      displayName?: string | null;
      haUrl?: string | null;
    };
  }>(
    '/v1/admin/users/:id',
    {
      schema: {
        description: 'Mutate a user — tier, minor flag, display name, or HA URL.',
        tags: ['admin'],
      },
    },
    async (req, reply) => {
      const gate = requireAdmin(req, reply);
      if (!gate.ok) return;
      const { id } = req.params;
      const body = req.body;
      const db = authDb();

      const before = db
        .prepare<[string], UserRow>(
          `SELECT id, email, display_name, tier, is_minor, is_shadow,
                  created_at, last_seen_at, deleted_at, ha_url, avatar_color
             FROM users WHERE id = ? AND deleted_at IS NULL`,
        )
        .get(id);
      if (!before) return reply.code(404).send({ code: 'qalaam.admin.user-not-found' });

      const updates: string[] = [];
      const params: (string | number | null)[] = [];
      const audit: Record<string, unknown> = {};

      if (typeof body.tier === 'string') {
        if (!VALID_TIERS.has(body.tier)) {
          return reply.code(400).send({ code: 'qalaam.admin.invalid-tier' });
        }
        if (body.tier !== before.tier) {
          updates.push('tier = ?');
          params.push(body.tier);
          audit.tier = { from: before.tier, to: body.tier };
        }
      }
      if (typeof body.isMinor === 'boolean') {
        const next = body.isMinor ? 1 : 0;
        if (next !== before.is_minor) {
          updates.push('is_minor = ?');
          params.push(next);
          audit.isMinor = { from: before.is_minor === 1, to: body.isMinor };
        }
      }
      if ('displayName' in body) {
        const trimmed = body.displayName?.toString().trim();
        const next = trimmed && trimmed.length > 0 ? trimmed : null;
        if (next !== before.display_name) {
          updates.push('display_name = ?');
          params.push(next);
          audit.displayName = { from: before.display_name, to: next };
        }
      }
      if ('haUrl' in body) {
        const trimmed = body.haUrl?.toString().trim();
        const next = trimmed && trimmed.length > 0 ? trimmed : null;
        if (next !== before.ha_url) {
          updates.push('ha_url = ?');
          params.push(next);
          audit.haUrl = { from: before.ha_url, to: next };
        }
      }

      if (updates.length === 0) {
        return reply.send({ ok: true, changed: false });
      }
      params.push(id);
      db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
      writeAudit(gate.user.id, 'user.update', id, audit);

      return reply.send({ ok: true, changed: true, audit });
    },
  );

  // ─── GET /v1/admin/audit ──────────────────────────────────────────
  fastify.get<{ Querystring: { limit?: string } }>(
    '/v1/admin/audit',
    { schema: { description: 'Recent admin-action audit entries.', tags: ['admin'] } },
    async (req, reply) => {
      const gate = requireAdmin(req, reply);
      if (!gate.ok) return;
      const limit = Math.min(
        500,
        Math.max(1, Number.parseInt(req.query.limit ?? '100', 10) || 100),
      );
      const rows = authDb()
        .prepare<[number], AuditRow>(
          `SELECT a.id, a.ts, a.actor_user_id, ua.email AS actor_email,
                  a.action, a.target_user_id, ut.email AS target_email,
                  a.payload_json
             FROM admin_audit a
             LEFT JOIN users ua ON ua.id = a.actor_user_id
             LEFT JOIN users ut ON ut.id = a.target_user_id
             ORDER BY a.id DESC
             LIMIT ?`,
        )
        .all(limit);
      return reply.send({
        entries: rows.map((r) => ({
          id: r.id,
          ts: r.ts,
          actorUserId: r.actor_user_id,
          actorEmail: r.actor_email,
          action: r.action,
          targetUserId: r.target_user_id,
          targetEmail: r.target_email,
          payload: r.payload_json ? (JSON.parse(r.payload_json) as Record<string, unknown>) : null,
        })),
      });
    },
  );

  // ─── GET /v1/admin/support ────────────────────────────────────────
  fastify.get<{ Querystring: { status?: string; limit?: string } }>(
    '/v1/admin/support',
    { schema: { description: 'Support requests, newest first.', tags: ['admin'] } },
    async (req, reply) => {
      const gate = requireAdmin(req, reply);
      if (!gate.ok) return;
      const limit = Math.min(
        200,
        Math.max(1, Number.parseInt(req.query.limit ?? '100', 10) || 100),
      );
      const status = req.query.status ?? 'open'; // open | resolved | all
      const where =
        status === 'resolved'
          ? 'WHERE handled_at IS NOT NULL'
          : status === 'all'
            ? ''
            : 'WHERE handled_at IS NULL';
      const rows = authDb()
        .prepare<[number], SupportRow>(
          `SELECT id, ts, user_id, email, kind, target_tier, message, handled_at, handled_by
             FROM support_requests
             ${where}
             ORDER BY id DESC
             LIMIT ?`,
        )
        .all(limit);
      return reply.send({
        requests: rows.map((r) => ({
          id: r.id,
          ts: r.ts,
          userId: r.user_id,
          email: r.email,
          kind: r.kind,
          targetTier: r.target_tier,
          message: r.message,
          handledAt: r.handled_at,
          handledBy: r.handled_by,
        })),
      });
    },
  );

  // ─── PATCH /v1/admin/support/:id ──────────────────────────────────
  fastify.patch<{ Params: { id: string }; Body: { resolved?: boolean } }>(
    '/v1/admin/support/:id',
    { schema: { description: 'Mark a support request resolved or re-open it.', tags: ['admin'] } },
    async (req, reply) => {
      const gate = requireAdmin(req, reply);
      if (!gate.ok) return;
      const id = Number.parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) {
        return reply.code(400).send({ code: 'qalaam.admin.invalid-id' });
      }
      const resolved = Boolean(req.body.resolved);
      const db = authDb();
      const before = db
        .prepare<[number], SupportRow>(
          `SELECT id, ts, user_id, email, kind, target_tier, message, handled_at, handled_by
             FROM support_requests WHERE id = ?`,
        )
        .get(id);
      if (!before) return reply.code(404).send({ code: 'qalaam.admin.support-not-found' });
      if (resolved) {
        db.prepare(
          `UPDATE support_requests SET handled_at = datetime('now'), handled_by = ? WHERE id = ?`,
        ).run(gate.user.id, id);
        writeAudit(gate.user.id, 'support.resolve', before.user_id, { supportId: id });
      } else {
        db.prepare(
          `UPDATE support_requests SET handled_at = NULL, handled_by = NULL WHERE id = ?`,
        ).run(id);
        writeAudit(gate.user.id, 'support.reopen', before.user_id, { supportId: id });
      }
      return reply.send({ ok: true });
    },
  );
}
