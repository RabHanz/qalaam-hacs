/**
 * Auth audit log + brute-force throttle.
 *
 * Three concerns this module owns:
 *
 *   1. AUDIT — record every auth event (signup, signin_ok, signin_fail,
 *      signout, locked) so the user can see their recent activity, and
 *      ops can detect intrusions.
 *
 *   2. THROTTLE — per-IP + per-email count of failed sign-ins in a
 *      sliding window. After N fails inside W minutes, refuse with a
 *      generic 429 "too many attempts" response — defeats credential-
 *      stuffing without giving the attacker an oracle.
 *
 *   3. LOCKOUT — after a (higher) threshold of failures on the same
 *      account, refuse all signins for that user until COOLDOWN_MIN.
 *      Belt-and-suspenders alongside the throttle.
 *
 * Design choice: a single `auth_audit` table is queried with a sliding
 * window in SQL — no in-memory leaky bucket. Lets the throttle survive
 * process restarts (important behind a load balancer).
 */
import { authDb } from './db.js';

const FAIL_WINDOW_MIN = 15; // window over which we count failures
const FAIL_THRESHOLD_IP = 20; // per-IP fails inside the window
const FAIL_THRESHOLD_EMAIL = 8; // per-email fails inside the window
const LOCKOUT_THRESHOLD = 12; // per-email fails → hard lockout
const LOCKOUT_COOLDOWN_MIN = 30; // lockout duration

export type AuthEventKind =
  | 'signup'
  | 'signin_ok'
  | 'signin_fail'
  | 'signout'
  | 'locked'
  | 'password_change';

export function recordAuthEvent(args: {
  kind: AuthEventKind;
  email?: string | null;
  userId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}): void {
  authDb()
    .prepare(
      `INSERT INTO auth_audit (kind, email, user_id, ip, user_agent)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      args.kind,
      args.email ?? null,
      args.userId ?? null,
      args.ip ?? null,
      args.userAgent ?? null,
    );
}

/**
 * Returns a string error code if the IP+email combo is currently rate-
 * limited or locked out, otherwise null. The caller MUST short-circuit
 * with the corresponding 429 if non-null is returned, before doing
 * any password verification (don't leak timing).
 */
export function checkAuthThrottle(args: {
  email?: string | null;
  ip?: string | null;
}): { limited: true; retryAfterSeconds: number; reason: string } | null {
  const db = authDb();
  const windowSql = `datetime('now', '-${FAIL_WINDOW_MIN.toString()} minutes')`;
  // Per-email count
  if (args.email) {
    const row = db
      .prepare(
        `SELECT COUNT(*) AS c FROM auth_audit
          WHERE kind = 'signin_fail'
            AND email = ?
            AND ts >= ${windowSql}`,
      )
      .get(args.email) as { c: number };
    if (row.c >= LOCKOUT_THRESHOLD) {
      return {
        limited: true,
        retryAfterSeconds: LOCKOUT_COOLDOWN_MIN * 60,
        reason: 'qalaam.auth.account-locked',
      };
    }
    if (row.c >= FAIL_THRESHOLD_EMAIL) {
      return {
        limited: true,
        retryAfterSeconds: FAIL_WINDOW_MIN * 60,
        reason: 'qalaam.auth.too-many-attempts',
      };
    }
  }
  // Per-IP count (defends against credential-stuffing across many emails)
  if (args.ip) {
    const row = db
      .prepare(
        `SELECT COUNT(*) AS c FROM auth_audit
          WHERE kind = 'signin_fail'
            AND ip = ?
            AND ts >= ${windowSql}`,
      )
      .get(args.ip) as { c: number };
    if (row.c >= FAIL_THRESHOLD_IP) {
      return {
        limited: true,
        retryAfterSeconds: FAIL_WINDOW_MIN * 60,
        reason: 'qalaam.auth.too-many-attempts',
      };
    }
  }
  return null;
}

/**
 * Recent successful + failed signins for the current user. Surfaced on
 * /v1/auth/sessions (future) so the user can review unfamiliar logins.
 */
export function recentAuthEvents(
  userId: string,
  limit = 25,
): readonly {
  ts: string;
  kind: string;
  ip: string | null;
  userAgent: string | null;
}[] {
  return authDb()
    .prepare(
      `SELECT ts, kind, ip, user_agent AS userAgent
         FROM auth_audit
        WHERE user_id = ?
        ORDER BY id DESC
        LIMIT ?`,
    )
    .all(userId, limit) as {
    ts: string;
    kind: string;
    ip: string | null;
    userAgent: string | null;
  }[];
}
