/**
 * Admin gate — env-allowlist authentication for /v1/admin/*.
 *
 * J2 / task #214. The maintainer-tier authority isn't a database role;
 * it's a deploy-time secret: `QALAAM_ADMIN_EMAILS` is a comma-separated
 * list of email addresses that may invoke admin endpoints. This keeps
 * admin status out of the user table (so we can't grant it via SQL on
 * a stolen DB dump) and gives ops a single rotation surface.
 *
 *   QALAAM_ADMIN_EMAILS="ops@qalaam.app, signzartco@gmail.com"
 *
 * Anti-bypass posture (production rule):
 *   - Cookie-only — admin actions never authenticate via API-key. The
 *     HA integration must NEVER be able to bump a user's tier even
 *     with a Premium key, because the key never carried that authority.
 *   - The allowlist is read on every call so a deploy with a rotated
 *     env var takes effect immediately without rebuild.
 *   - If the env var is unset, the admin endpoints stay closed (return
 *     503). This is a "fail-loud" default.
 */
import { authDb } from './db.js';
import { SESSION_COOKIE_NAME, findUserBySession, type AuthUser } from './sessions.js';

import type { FastifyReply, FastifyRequest } from 'fastify';

function readSessionCookie(req: FastifyRequest): string | null {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').map((c) => c.trim());
  for (const c of cookies) {
    const [name, ...rest] = c.split('=');
    if (name === SESSION_COOKIE_NAME) return rest.join('=');
  }
  return null;
}

function adminAllowlist(): readonly string[] {
  const raw = process.env.QALAAM_ADMIN_EMAILS ?? '';
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

export function isAdmin(user: AuthUser | null): boolean {
  if (!user) return false;
  const list = adminAllowlist();
  if (list.length === 0) return false;
  return list.includes(user.email.toLowerCase());
}

/**
 * Same shape as `gateFeature` — non-null user on `ok:true`. On
 * failure, the response has already been sent (401 or 403).
 *
 *   const gate = requireAdmin(req, reply);
 *   if (!gate.ok) return;
 *   const admin = gate.user;
 */
export type AdminGateResult = { ok: true; user: AuthUser } | { ok: false; user: null };

export function requireAdmin(req: FastifyRequest, reply: FastifyReply): AdminGateResult {
  const allow = adminAllowlist();
  if (allow.length === 0) {
    void reply
      .code(503)
      .send({ code: 'qalaam.admin.unavailable', message: 'Admin surface not configured.' });
    return { ok: false, user: null };
  }
  const sid = readSessionCookie(req);
  const user = sid ? findUserBySession(sid) : null;
  if (!user) {
    void reply.code(401).send({ code: 'qalaam.admin.auth-required' });
    return { ok: false, user: null };
  }
  if (!allow.includes(user.email.toLowerCase())) {
    void reply.code(403).send({ code: 'qalaam.admin.forbidden' });
    return { ok: false, user: null };
  }
  return { ok: true, user };
}

/**
 * Append an admin-action audit entry. Best-effort — the SQL is
 * append-only on a single table with no constraints, so the
 * write is fast and unlikely to throw, but we still wrap to keep
 * audit gaps from killing a request.
 */
export function writeAudit(
  actorUserId: string,
  action: string,
  targetUserId: string | null,
  payload: Record<string, unknown> | null,
): void {
  try {
    authDb()
      .prepare(
        `INSERT INTO admin_audit (actor_user_id, action, target_user_id, payload_json)
         VALUES (?, ?, ?, ?)`,
      )
      .run(actorUserId, action, targetUserId, payload ? JSON.stringify(payload) : null);
  } catch {
    /* audit failure must not break the action */
  }
}
