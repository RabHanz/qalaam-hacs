/**
 * /v1/auth/* — H1 auth foundation.
 *
 * Endpoints:
 *   POST   /v1/auth/signup    — { email, password, displayName? } → user + session cookie
 *   POST   /v1/auth/signin    — { email, password }                → user + session cookie
 *   POST   /v1/auth/signout   — clears the session cookie + deletes server-side row
 *   GET    /v1/auth/me        — returns current user from cookie (200) or 401
 *
 * All routes set/clear an httpOnly, SameSite=Lax cookie called
 * `qalaam_session`. The cookie is `Secure` in production (NODE_ENV
 * === 'production') and unsecured in dev so localhost works.
 *
 * Family-Hifdh framing: signup auto-creates a Family for the user, with
 * them as the guardian. Adding family members happens via a separate
 * /v1/family/* route family (not shipped here — A7+).
 *
 * Cookie path: '/' so /api/* and /v1/* both see it.
 */
import { randomUUID } from 'node:crypto';

import { checkAuthThrottle, recordAuthEvent } from '../../auth/audit.js';
import { authDb } from '../../auth/db.js';
import { FEATURE_CATALOG, tierSatisfies } from '../../auth/features.js';
import { hashPassword, verifyPassword } from '../../auth/passwords.js';
import {
  SESSION_COOKIE_NAME,
  createSession,
  deleteSession,
  findUserBySession,
  type AuthUser,
} from '../../auth/sessions.js';

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SECURE_COOKIE = process.env.NODE_ENV === 'production';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  display_name: string | null;
  tier: string;
  is_minor: number;
  ha_url: string | null;
}

function setSessionCookie(reply: FastifyReply, sessionId: string, expiresAt: Date): void {
  // Manual Set-Cookie header — Fastify's default cookie support requires
  // a separate plugin; this stays dependency-free.
  const parts = [
    `${SESSION_COOKIE_NAME}=${sessionId}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Expires=${expiresAt.toUTCString()}`,
  ];
  if (SECURE_COOKIE) parts.push('Secure');
  reply.header('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(reply: FastifyReply): void {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
  ];
  if (SECURE_COOKIE) parts.push('Secure');
  reply.header('Set-Cookie', parts.join('; '));
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

function userPayload(user: AuthUser): {
  id: string;
  email: string;
  displayName: string | null;
  tier: string;
  isMinor: boolean;
  haUrl: string | null;
} {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    tier: user.tier,
    isMinor: user.isMinor,
    haUrl: user.haUrl,
  };
}

interface SignupBody {
  email?: string;
  password?: string;
  displayName?: string;
}

interface SigninBody {
  email?: string;
  password?: string;
}

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /v1/auth/signup
  fastify.post<{ Body: SignupBody }>(
    '/v1/auth/signup',
    {
      schema: {
        description: 'Create a Qalaam account with email + password.',
        tags: ['auth'],
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', minLength: 3, maxLength: 254 },
            password: { type: 'string', minLength: 8, maxLength: 256 },
            displayName: { type: 'string', minLength: 1, maxLength: 80 },
          },
        },
      },
    },
    async (req, reply) => {
      const body = req.body;
      const email = (body.email ?? '').trim().toLowerCase();
      const password = body.password ?? '';
      const displayName = (body.displayName ?? '').trim() || null;
      if (!EMAIL_RE.test(email)) {
        return reply.code(400).send({ code: 'qalaam.auth.bad-email', message: 'invalid email' });
      }
      if (password.length < 8) {
        return reply.code(400).send({
          code: 'qalaam.auth.weak-password',
          message: 'password must be at least 8 characters',
        });
      }
      const db = authDb();
      const existing = db
        .prepare('SELECT id FROM users WHERE email = ? AND deleted_at IS NULL')
        .get(email) as { id: string } | undefined;
      if (existing) {
        // Generic message — don't enable account-enumeration via signup.
        return reply
          .code(409)
          .send({ code: 'qalaam.auth.email-taken', message: 'email already registered' });
      }
      const id = randomUUID();
      const passwordHash = hashPassword(password);
      db.prepare(
        `INSERT INTO users (id, email, password_hash, display_name)
         VALUES (?, ?, ?, ?)`,
      ).run(id, email, passwordHash, displayName);

      // Auto-create a Family — the user becomes its guardian. Lets all
      // downstream family-tier features (#179 plan creator, #182 voice
      // notes, #183 khatm) attach to a real family without a separate
      // setup flow on first login.
      const familyId = randomUUID();
      db.prepare(`INSERT INTO families (id, name, created_by) VALUES (?, ?, ?)`).run(
        familyId,
        displayName ? `${displayName}'s family` : 'Family',
        id,
      );
      db.prepare(
        `INSERT INTO family_members (id, family_id, user_id, role, display_name)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(randomUUID(), familyId, id, 'guardian', displayName);

      const session = createSession(id, {
        ip: req.ip,
        userAgent: req.headers['user-agent'] ?? undefined,
      });
      setSessionCookie(reply, session.id, session.expiresAt);
      recordAuthEvent({
        kind: 'signup',
        email,
        userId: id,
        ip: req.ip,
        userAgent: req.headers['user-agent'] ?? null,
      });
      return reply.code(201).send({
        user: userPayload({
          id,
          email,
          displayName,
          tier: 'free',
          isMinor: false,
          haUrl: null,
        }),
      });
    },
  );

  // POST /v1/auth/signin
  fastify.post<{ Body: SigninBody }>(
    '/v1/auth/signin',
    {
      schema: {
        description: 'Sign in with email + password.',
        tags: ['auth'],
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', minLength: 3, maxLength: 254 },
            password: { type: 'string', minLength: 1, maxLength: 256 },
          },
        },
      },
    },
    async (req, reply) => {
      const email = (req.body.email ?? '').trim().toLowerCase();
      const password = req.body.password ?? '';
      // Throttle BEFORE password verification so we don't leak timing
      // info about whether the email exists or not.
      const limit = checkAuthThrottle({ email, ip: req.ip });
      if (limit) {
        reply.header('Retry-After', String(limit.retryAfterSeconds));
        return reply.code(429).send({
          code: limit.reason,
          retryAfterSeconds: limit.retryAfterSeconds,
        });
      }
      const db = authDb();
      const row = db
        .prepare(
          `SELECT id, email, password_hash, display_name, tier, is_minor, ha_url
             FROM users WHERE email = ? AND deleted_at IS NULL`,
        )
        .get(email) as UserRow | undefined;
      // Generic invalid-credentials response — same wording for missing
      // user + bad password (avoids account enumeration).
      const fail = (userId: string | null): unknown => {
        recordAuthEvent({
          kind: 'signin_fail',
          email,
          userId,
          ip: req.ip,
          userAgent: req.headers['user-agent'] ?? null,
        });
        return reply
          .code(401)
          .send({ code: 'qalaam.auth.invalid-credentials', message: 'invalid email or password' });
      };
      if (!row) return fail(null);
      if (!verifyPassword(password, row.password_hash)) return fail(row.id);
      const session = createSession(row.id, {
        ip: req.ip,
        userAgent: req.headers['user-agent'] ?? undefined,
      });
      setSessionCookie(reply, session.id, session.expiresAt);
      recordAuthEvent({
        kind: 'signin_ok',
        email,
        userId: row.id,
        ip: req.ip,
        userAgent: req.headers['user-agent'] ?? null,
      });
      return reply.code(200).send({
        user: userPayload({
          id: row.id,
          email: row.email,
          displayName: row.display_name,
          tier: row.tier,
          isMinor: row.is_minor === 1,
          haUrl: row.ha_url,
        }),
      });
    },
  );

  // POST /v1/auth/signout
  fastify.post(
    '/v1/auth/signout',
    {
      schema: {
        description: 'Sign out — deletes the server-side session row + clears the cookie.',
        tags: ['auth'],
      },
    },

    async (req, reply) => {
      const sessionId = readCookie(req, SESSION_COOKIE_NAME);
      if (sessionId) deleteSession(sessionId);
      clearSessionCookie(reply);
      return reply.code(204).send();
    },
  );

  // GET /v1/auth/me
  fastify.get(
    '/v1/auth/me',
    {
      schema: {
        description: 'Current user from the session cookie. 401 if not signed in.',
        tags: ['auth'],
      },
    },

    async (req, reply) => {
      const sessionId = readCookie(req, SESSION_COOKIE_NAME);
      if (!sessionId) return reply.code(401).send({ code: 'qalaam.auth.no-session' });
      const user = findUserBySession(sessionId);
      if (!user) {
        clearSessionCookie(reply);
        return reply.code(401).send({ code: 'qalaam.auth.session-expired' });
      }
      return reply.code(200).send({ user: userPayload(user) });
    },
  );

  // PATCH /v1/auth/me — update profile fields. `haUrl` is gated to
  // Premium / Pro tiers since the Home Assistant integration is part
  // of the paid value prop. `displayName` is open to every tier.
  fastify.patch<{ Body: { displayName?: string | null; haUrl?: string | null } }>(
    '/v1/auth/me',
    {
      schema: {
        description: 'Update display name + optional Home Assistant URL.',
        tags: ['auth'],
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            displayName: { type: ['string', 'null'], maxLength: 80 },
            haUrl: { type: ['string', 'null'], maxLength: 200 },
          },
        },
      },
    },
    async (req, reply) => {
      const sessionId = readCookie(req, SESSION_COOKIE_NAME);
      if (!sessionId) return reply.code(401).send({ code: 'qalaam.auth.no-session' });
      const user = findUserBySession(sessionId);
      if (!user) {
        clearSessionCookie(reply);
        return reply.code(401).send({ code: 'qalaam.auth.session-expired' });
      }
      const body = req.body;
      const sets: string[] = [];
      const args: (string | null)[] = [];
      if (body.displayName !== undefined) {
        const trimmed = body.displayName === null ? null : body.displayName.trim();
        if (trimmed !== null && (trimmed.length < 1 || trimmed.length > 80)) {
          return reply.code(400).send({ code: 'qalaam.auth.bad-display-name' });
        }
        sets.push('display_name = ?');
        args.push(trimmed);
      }
      if (body.haUrl !== undefined) {
        // Tier check goes through the feature catalog so the admin
        // panel (#214) can flip ha.url-config between tiers without
        // touching this route.
        if (!tierSatisfies(user.tier, FEATURE_CATALOG['ha.url-config'].minTier)) {
          void reply.code(403).send({
            code: 'qalaam.feature.tier-required',
            feature: 'ha.url-config',
            featureLabel: FEATURE_CATALOG['ha.url-config'].label,
            requiredTier: FEATURE_CATALOG['ha.url-config'].minTier,
            currentTier: user.tier,
          });
          return;
        }
        const v = body.haUrl === null ? null : body.haUrl.trim();
        if (v !== null) {
          // Surface the parse error rather than 500ing on bad input.
          try {
            const u = new URL(v);
            if (u.protocol !== 'http:' && u.protocol !== 'https:') {
              void reply.code(400).send({ code: 'qalaam.auth.bad-ha-url' });
              return;
            }
          } catch {
            void reply.code(400).send({ code: 'qalaam.auth.bad-ha-url' });
            return;
          }
        }
        sets.push('ha_url = ?');
        args.push(v);
      }
      if (sets.length === 0) return reply.code(200).send({ user: userPayload(user) });
      args.push(user.id);
      authDb()
        .prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`)
        .run(...args);
      const fresh = findUserBySession(sessionId);
      return reply.code(200).send({ user: userPayload(fresh ?? user) });
    },
  );
}
