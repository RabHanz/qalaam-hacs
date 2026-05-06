/**
 * Session lifecycle — opaque token in a httpOnly cookie, backed by the
 * `sessions` table in qalaam.sqlite.
 *
 * The token is 32 random bytes (64-char hex). It's the PRIMARY KEY of
 * the row, so we can verify in O(1) without bcrypt-style hashing on
 * every request.
 *
 * Rolling expiry: every successful auth advances `last_used_at` and
 * extends `expires_at` by SESSION_TTL_DAYS, so an active user never
 * gets logged out, but an idle session times out.
 *
 * Garbage collection runs lazily on every lookup — the row is deleted
 * if expired. A periodic sweep (cron job, future) can also be wired
 * but isn't necessary for correctness.
 */
import { randomBytes } from 'node:crypto';

import { authDb } from './db.js';

import type { Database as DB } from 'better-sqlite3';

export const SESSION_COOKIE_NAME = 'qalaam_session';
const SESSION_TTL_DAYS = 30;
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

export interface AuthSession {
  readonly id: string;
  readonly userId: string;
  readonly expiresAt: Date;
}

export interface AuthUser {
  readonly id: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly tier: string;
  readonly isMinor: boolean;
  readonly haUrl: string | null;
}

interface UserRow {
  id: string;
  email: string;
  display_name: string | null;
  tier: string;
  is_minor: number;
  ha_url: string | null;
}

interface SessionRow {
  id: string;
  user_id: string;
  expires_at: string;
}

function newSessionId(): string {
  return randomBytes(32).toString('hex');
}

function isoNow(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function isoFromMs(msFromNow: number): string {
  return new Date(Date.now() + msFromNow).toISOString().slice(0, 19).replace('T', ' ');
}

export function createSession(
  userId: string,
  opts: { ip?: string | undefined; userAgent?: string | undefined },
): AuthSession {
  const db = authDb();
  const id = newSessionId();
  const expiresAt = isoFromMs(SESSION_TTL_MS);
  db.prepare(
    `INSERT INTO sessions (id, user_id, created_at, last_used_at, expires_at, user_agent, ip)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, userId, isoNow(), isoNow(), expiresAt, opts.userAgent ?? null, opts.ip ?? null);
  return { id, userId, expiresAt: new Date(expiresAt + 'Z') };
}

export function deleteSession(sessionId: string): void {
  authDb().prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

export function findUserBySession(sessionId: string): AuthUser | null {
  if (!sessionId || typeof sessionId !== 'string' || sessionId.length !== 64) return null;
  const db = authDb();
  const row = db
    .prepare(
      `SELECT id, user_id AS userId, expires_at AS expiresAt
         FROM sessions
        WHERE id = ?`,
    )
    .get(sessionId) as { id: string; userId: string; expiresAt: string } | undefined;
  if (!row) return null;
  // Expiry check (string compare works because we use ISO-with-space format
  // generated identically each side; both lex-order-correct).
  if (row.expiresAt <= isoNow()) {
    deleteSession(row.id);
    return null;
  }
  // Rolling expiry — bump last_used_at + extend expires_at.
  db.prepare(`UPDATE sessions SET last_used_at = ?, expires_at = ? WHERE id = ?`).run(
    isoNow(),
    isoFromMs(SESSION_TTL_MS),
    sessionId,
  );
  // Bump user.last_seen_at too — cheap and useful for "active families" metrics.
  db.prepare(`UPDATE users SET last_seen_at = ? WHERE id = ?`).run(isoNow(), row.userId);
  const user = db
    .prepare(
      `SELECT id, email, display_name, tier, is_minor, ha_url
         FROM users
        WHERE id = ? AND deleted_at IS NULL`,
    )
    .get(row.userId) as UserRow | undefined;
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    tier: user.tier,
    isMinor: user.is_minor === 1,
    haUrl: user.ha_url,
  };
}

export function _internalGetSessionRow(sessionId: string, db?: DB): SessionRow | null {
  return (
    ((db ?? authDb())
      .prepare('SELECT id, user_id, expires_at FROM sessions WHERE id = ?')
      .get(sessionId) as SessionRow | undefined) ?? null
  );
}

/** Sweeps every expired session — call from a cron / interval. */
export function purgeExpiredSessions(): number {
  const r = authDb().prepare('DELETE FROM sessions WHERE expires_at <= ?').run(isoNow());
  return r.changes;
}
