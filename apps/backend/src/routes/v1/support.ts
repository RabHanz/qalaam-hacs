/**
 * /v1/support/* — H2 minimal billing-support intake.
 *
 * Stripe + actual payment processing will land in the deployment-day
 * commit. This module exists so the pricing UI has a real "I can't
 * afford it" + "request upgrade" submission target right now.
 *
 * Endpoints:
 *   POST  /v1/support     — submit a support request (auth optional)
 *   GET   /v1/support/me  — list my own requests (auth required)
 *
 * Anyone can submit (we capture email if anonymous). Authenticated
 * users get their user_id attached for follow-up.
 */
import { authDb } from '../../auth/db.js';
import { requireUser } from '../../auth/require-user.js';
import { SESSION_COOKIE_NAME, findUserBySession } from '../../auth/sessions.js';

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const VALID_KINDS = new Set(['cant-afford', 'upgrade', 'feedback']);
const VALID_TIERS = new Set(['premium', 'pro']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_MESSAGE = 4_000;

interface CreateBody {
  kind?: string;
  email?: string;
  message?: string;
  targetTier?: string;
}

function readSessionCookie(req: FastifyRequest): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const piece of header.split(';')) {
    const [k, ...rest] = piece.trim().split('=');
    if (k === SESSION_COOKIE_NAME) return rest.join('=');
  }
  return null;
}

export async function supportRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    '/v1/support',
    {
      schema: {
        description: 'Submit a billing-support request (cant-afford, upgrade, feedback).',
        tags: ['support'],
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = (req.body ?? {}) as CreateBody;
      const kind = body.kind;
      if (typeof kind !== 'string' || !VALID_KINDS.has(kind)) {
        void reply.code(400).send({ code: 'qalaam.support.bad-kind' });
        return;
      }
      const targetTier = body.targetTier ?? null;
      if (targetTier !== null && !VALID_TIERS.has(targetTier)) {
        void reply.code(400).send({ code: 'qalaam.support.bad-target-tier' });
        return;
      }
      const message = (body.message ?? '').trim();
      if (message.length === 0) {
        void reply.code(400).send({ code: 'qalaam.support.empty-message' });
        return;
      }
      if (message.length > MAX_MESSAGE) {
        void reply.code(413).send({ code: 'qalaam.support.message-too-long' });
        return;
      }
      // Resolve user from cookie if present (auth optional). We DON'T 401
      // anonymous; "I can't afford it" pre-signup is a legitimate flow.
      const sessionId = readSessionCookie(req);
      const user = sessionId ? findUserBySession(sessionId) : null;
      const email = user?.email ?? body.email?.trim() ?? null;
      if (!user && (!email || !EMAIL_RE.test(email))) {
        void reply.code(400).send({ code: 'qalaam.support.bad-email' });
        return;
      }
      const r = authDb()
        .prepare(
          `INSERT INTO support_requests (user_id, email, kind, target_tier, message)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(user?.id ?? null, email, kind, targetTier, message);
      void reply.code(201).send({ id: r.lastInsertRowid });
    },
  );

  fastify.get(
    '/v1/support/me',
    { schema: { tags: ['support'] } },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const rows = authDb()
        .prepare(
          `SELECT id, ts, kind, target_tier AS targetTier, message, handled_at AS handledAt
             FROM support_requests
            WHERE user_id = ?
            ORDER BY id DESC LIMIT 50`,
        )
        .all(user.id) as {
        id: number;
        ts: string;
        kind: string;
        targetTier: string | null;
        message: string;
        handledAt: string | null;
      }[];
      void reply.send({ requests: rows });
    },
  );
}
