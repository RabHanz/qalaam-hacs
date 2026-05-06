/**
 * requireUser — auth-gate helper used by every authenticated route.
 *
 * Reads the session cookie, resolves it to a row in `sessions`, refreshes
 * the rolling expiry, and returns the AuthUser. Sends 401 + early-return
 * on the reply if no session / expired session — the route handler
 * checks for null and bails:
 *
 *   const user = requireUser(req, reply);
 *   if (!user) return;
 *   // ...use user.id, user.email, user.tier...
 *
 * Shared between bookmarks, plans, mistakes, family, khatm, voice-notes.
 */
import { SESSION_COOKIE_NAME, findUserBySession, type AuthUser } from './sessions.js';

import type { FastifyReply, FastifyRequest } from 'fastify';

export function readCookie(req: FastifyRequest, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const piece of header.split(';')) {
    const [k, ...rest] = piece.trim().split('=');
    if (k === name) return rest.join('=');
  }
  return null;
}

export function requireUser(req: FastifyRequest, reply: FastifyReply): AuthUser | null {
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
  return user;
}
