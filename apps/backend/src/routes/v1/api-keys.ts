/**
 * /v1/auth/api-keys — programmatic-access keys for HA integration,
 * MCP clients, and third-party automations.
 *
 * Per ADR-0024 (moat) + ADR-0025 Phase 3:
 *   - Minting is Premium-tier (the resulting key carries the owner's
 *     tier on every request the gate resolves it for).
 *   - The plaintext key is shown ONCE at mint time; only the SHA-256
 *     hash is persisted. Lookup happens via `findUserByApiKey` in
 *     auth/sessions.ts.
 *   - Revocation is soft-delete (sets `revoked_at`); the row stays
 *     for audit. Revoked keys never resolve a user.
 *
 * Endpoints:
 *   POST   /v1/auth/api-keys             → mint a new key (returns plaintext ONCE)
 *   GET    /v1/auth/api-keys             → list this user's keys (no secrets)
 *   DELETE /v1/auth/api-keys/:id         → revoke
 *
 * All gated by `auth.api-keys` (premium, requiresAuth=true).
 */
import { createHash, randomBytes } from 'node:crypto';

import { authDb } from '../../auth/db.js';
import { requireFeature } from '../../auth/features.js';

import type { FastifyInstance } from 'fastify';

interface ApiKeyRow {
  id: string;
  user_id: string;
  key_hash: string;
  name: string;
  scopes: string;
  created_at: number;
  last_used_at: number | null;
  revoked_at: number | null;
}

interface MintBody {
  name?: string;
  scopes?: readonly string[];
}

function generatePlaintextKey(): string {
  // 32 bytes of CSRNG → ~43 chars base64url. Prefix `qk_` so the
  // session resolver can fast-reject anything else without a hash
  // lookup. Base64url so the key is URL-safe + copy-paste safe.
  return `qk_${randomBytes(32).toString('base64url')}`;
}

export async function apiKeysRoutes(fastify: FastifyInstance): Promise<void> {
  // ─── POST /v1/auth/api-keys ─────────────────────────────────────
  fastify.post(
    '/v1/auth/api-keys',
    {
      schema: {
        description:
          'Mint a new API key for the authenticated user. Returns the plaintext token ONCE — the server only stores its sha256.',
        tags: ['auth'],
      },
    },
    async (req, reply) => {
      const user = requireFeature(req, reply, 'auth.api-keys');
      if (!user) return;
      const body = (req.body ?? {}) as MintBody;
      const id = crypto.randomUUID();
      const plaintext = generatePlaintextKey();
      const hash = createHash('sha256').update(plaintext).digest('hex');
      const name = (body.name ?? '').trim() || 'Untitled key';
      const scopes = JSON.stringify(body.scopes && body.scopes.length > 0 ? body.scopes : ['all']);
      const now = Date.now();
      authDb()
        .prepare(
          `INSERT INTO api_keys (id, user_id, key_hash, name, scopes, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(id, user.id, hash, name, scopes, now);
      // Echo the plaintext exactly once. The HA config-flow / admin UI
      // is responsible for surfacing it to the user with a "copy now,
      // you won't see it again" warning.
      return reply.code(201).send({
        id,
        name,
        scopes: JSON.parse(scopes) as string[],
        createdAt: now,
        key: plaintext,
      });
    },
  );

  // ─── GET /v1/auth/api-keys ──────────────────────────────────────
  fastify.get(
    '/v1/auth/api-keys',
    {
      schema: {
        description: "List the authenticated user's API keys (without secrets).",
        tags: ['auth'],
      },
    },
    async (req, reply) => {
      const user = requireFeature(req, reply, 'auth.api-keys');
      if (!user) return;
      const rows = authDb()
        .prepare<[string], ApiKeyRow>(
          `SELECT id, user_id, key_hash, name, scopes, created_at, last_used_at, revoked_at
         FROM api_keys
         WHERE user_id = ?
         ORDER BY created_at DESC`,
        )
        .all(user.id);
      return reply.send({
        keys: rows.map((r) => ({
          id: r.id,
          name: r.name,
          scopes: JSON.parse(r.scopes) as string[],
          createdAt: r.created_at,
          lastUsedAt: r.last_used_at,
          revokedAt: r.revoked_at,
        })),
      });
    },
  );

  // ─── DELETE /v1/auth/api-keys/:id ───────────────────────────────
  fastify.delete<{ Params: { id: string } }>(
    '/v1/auth/api-keys/:id',
    {
      schema: {
        description: 'Revoke an API key. Soft-delete (sets revoked_at).',
        tags: ['auth'],
      },
    },
    async (req, reply) => {
      const user = requireFeature(req, reply, 'auth.api-keys');
      if (!user) return;
      const { id } = req.params;
      const now = Date.now();
      const result = authDb()
        .prepare(
          `UPDATE api_keys SET revoked_at = ?
         WHERE id = ? AND user_id = ? AND revoked_at IS NULL`,
        )
        .run(now, id, user.id);
      if (result.changes === 0) {
        return reply.code(404).send({ code: 'qalaam.api-keys.not-found' });
      }
      return reply.send({ ok: true, revokedAt: now });
    },
  );
}
