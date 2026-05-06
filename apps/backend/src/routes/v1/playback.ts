/**
 * /v1/playback/* — Spotify-Connect-style cross-device playback sync.
 *
 * Per ADR-0025:
 *   GET  /v1/playback/state          → current session row.
 *   POST /v1/playback/command        → mutate (action: play|pause|seek|load|transfer).
 *   GET  /v1/playback/subscribe      → SSE stream of state updates.
 *   POST /v1/playback/devices/heartbeat → device registration / refresh.
 *   GET  /v1/playback/devices        → list known devices for this user.
 *
 * Sessions are keyed by user_id — strict per-user isolation. Two
 * users on the same WiFi never share a session.
 *
 * Backend is the source of truth: any device sending a command
 * UPDATEs the row, then `broadcast()` fans the new state out via
 * SSE. Devices apply the change locally (e.g. MiniPlayer pauses
 * the local <audio> when broadcast says is_paused=true).
 *
 * SSE was chosen over WebSocket because the data flow is one-way
 * (server→client; commands go via REST) and EventSource is
 * cookie-auth-friendly with auto-reconnect built in. No new dep.
 */
import { authDb } from '../../auth/db.js';
import { gateFeature, requireFeature } from '../../auth/features.js';
import {
  broadcast,
  subscribe,
  subscriberCount,
  type PlaybackState,
} from '../../lib/playback-bus.js';

import type { FastifyInstance } from 'fastify';

interface SessionRow {
  user_id: string;
  verse_key: string;
  reciter_slug: string;
  position_seconds: number;
  is_paused: number;
  target: string;
  active_device_id: string | null;
  updated_at: number;
}

interface DeviceRow {
  device_id: string;
  user_id: string;
  name: string;
  capabilities: string;
  last_seen: number;
}

function rowToState(r: SessionRow): PlaybackState {
  return {
    verseKey: r.verse_key,
    reciterSlug: r.reciter_slug,
    positionSeconds: r.position_seconds,
    isPaused: r.is_paused === 1,
    target: r.target,
    activeDeviceId: r.active_device_id,
    updatedAt: r.updated_at,
  };
}

function getOrCreateSession(userId: string): SessionRow {
  const db = authDb();
  const existing = db
    .prepare<[string], SessionRow>('SELECT * FROM playback_sessions WHERE user_id = ?')
    .get(userId);
  if (existing) return existing;
  const now = Date.now();
  db.prepare(`INSERT INTO playback_sessions (user_id, updated_at) VALUES (?, ?)`).run(userId, now);
  // Re-read so defaults populated by the schema land in the response.
  const created = db
    .prepare<[string], SessionRow>('SELECT * FROM playback_sessions WHERE user_id = ?')
    .get(userId);
  if (!created) throw new Error('playback session insert vanished');
  return created;
}

function pruneStaleDevices(userId: string): void {
  const db = authDb();
  // Devices older than 5 minutes without a heartbeat are considered
  // offline. Keep the row purged so /v1/playback/devices stays
  // accurate without per-request cron infra.
  const cutoff = Date.now() - 5 * 60 * 1000;
  db.prepare(`DELETE FROM playback_devices WHERE user_id = ? AND last_seen < ?`).run(
    userId,
    cutoff,
  );
}

interface CommandBody {
  action: 'play' | 'pause' | 'seek' | 'load' | 'transfer' | 'sync';
  /** Identifies the device sending the command — required so
   *  "active_device_id" can change ownership on transfer. */
  deviceId?: string;
  position?: number;
  verseKey?: string;
  reciterSlug?: string;
  target?: string;
}

interface DeviceHeartbeatBody {
  deviceId: string;
  name: string;
  capabilities?: string[];
}

export async function playbackRoutes(fastify: FastifyInstance): Promise<void> {
  // ─── GET /v1/playback/state ─────────────────────────────────────
  fastify.get(
    '/v1/playback/state',
    {
      schema: {
        description: 'Current playback session for the authenticated user.',
        tags: ['playback'],
      },
    },
    async (req, reply) => {
      const user = requireFeature(req, reply, 'playback.session.read');
      if (!user) return;
      const row = getOrCreateSession(user.id);
      return reply.send({
        ...rowToState(row),
        subscriberCount: subscriberCount(user.id),
      });
    },
  );

  // ─── POST /v1/playback/command ──────────────────────────────────
  fastify.post(
    '/v1/playback/command',
    {
      schema: {
        description: 'Mutate the playback session. Broadcasts to subscribers.',
        tags: ['playback'],
      },
    },
    async (req, reply) => {
      const user = requireFeature(req, reply, 'playback.session.write');
      if (!user) return;
      const body = req.body as CommandBody;
      const db = authDb();
      const now = Date.now();
      const current = getOrCreateSession(user.id);

      // Apply the command. Each branch mutates the SQL row + leaves
      // `next` populated for the broadcast. We always touch updated_at
      // so subscribers can dedupe / order.
      let next: SessionRow = { ...current, updated_at: now };

      switch (body.action) {
        case 'play':
          next = {
            ...next,
            is_paused: 0,
            active_device_id: body.deviceId ?? next.active_device_id,
          };
          if (typeof body.position === 'number') next.position_seconds = body.position;
          break;
        case 'pause':
          next = {
            ...next,
            is_paused: 1,
            active_device_id: body.deviceId ?? next.active_device_id,
          };
          if (typeof body.position === 'number') next.position_seconds = body.position;
          break;
        case 'seek':
          if (typeof body.position !== 'number') {
            return reply.code(400).send({ code: 'qalaam.playback.bad-seek' });
          }
          next = {
            ...next,
            position_seconds: body.position,
            active_device_id: body.deviceId ?? next.active_device_id,
          };
          break;
        case 'load':
          if (!body.verseKey || !body.reciterSlug) {
            return reply.code(400).send({ code: 'qalaam.playback.bad-load' });
          }
          next = {
            ...next,
            verse_key: body.verseKey,
            reciter_slug: body.reciterSlug,
            position_seconds: 0,
            is_paused: 0,
            target: body.target ?? next.target,
            active_device_id: body.deviceId ?? next.active_device_id,
          };
          break;
        case 'transfer':
          if (!body.target) {
            return reply.code(400).send({ code: 'qalaam.playback.bad-transfer' });
          }
          next = {
            ...next,
            target: body.target,
            active_device_id: body.deviceId ?? next.active_device_id,
          };
          break;
        case 'sync':
          // No-op state-push from the active device (e.g. periodic
          // position update). Caller has already mutated position
          // optimistically; we just record + rebroadcast.
          if (typeof body.position === 'number') next.position_seconds = body.position;
          break;
        default:
          return reply.code(400).send({ code: 'qalaam.playback.unknown-action' });
      }

      db.prepare(
        `UPDATE playback_sessions
       SET verse_key=?, reciter_slug=?, position_seconds=?, is_paused=?, target=?, active_device_id=?, updated_at=?
       WHERE user_id=?`,
      ).run(
        next.verse_key,
        next.reciter_slug,
        next.position_seconds,
        next.is_paused,
        next.target,
        next.active_device_id,
        next.updated_at,
        user.id,
      );

      const state = rowToState(next);
      broadcast(user.id, state);
      return reply.send(state);
    },
  );

  // ─── GET /v1/playback/subscribe (SSE) ───────────────────────────
  // Long-lived stream. Pushes one initial state frame on connect,
  // then frames whenever broadcast() fires for this user.
  fastify.get(
    '/v1/playback/subscribe',
    {
      schema: {
        description: 'SSE stream of playback session state changes.',
        tags: ['playback'],
      },
    },
    async (req, reply) => {
      const user = requireFeature(req, reply, 'playback.session.read');
      if (!user) return;

      // SSE setup — long-running connection, no compression (Fastify
      // would otherwise buffer), explicit no-cache + keep-alive.
      void reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // disable Nginx buffering if proxied
      });

      // Initial frame — current session state so the client renders
      // without a separate fetch.
      const initial = rowToState(getOrCreateSession(user.id));
      reply.raw.write(`event: state\ndata: ${JSON.stringify(initial)}\n\n`);

      // Heartbeat every 25 s so intermediate proxies don't time the
      // stream out. SSE comments (lines starting with ":") are ignored
      // by EventSource clients.
      const heartbeat = setInterval(() => {
        try {
          reply.raw.write(': heartbeat\n\n');
        } catch {
          clearInterval(heartbeat);
        }
      }, 25_000);

      const unsubscribe = subscribe(user.id, reply);

      req.raw.on('close', () => {
        clearInterval(heartbeat);
        unsubscribe();
      });

      // Don't return — Fastify keeps the stream open while we hold
      // the reply object.
      return reply;
    },
  );

  // ─── POST /v1/playback/devices/heartbeat ────────────────────────
  fastify.post(
    '/v1/playback/devices/heartbeat',
    {
      schema: {
        description: 'Register or refresh a device for the authenticated user.',
        tags: ['playback'],
      },
    },
    async (req, reply) => {
      const user = requireFeature(req, reply, 'playback.session.write');
      if (!user) return;
      const body = req.body as DeviceHeartbeatBody;
      if (!body.deviceId || !body.name) {
        return reply.code(400).send({ code: 'qalaam.playback.bad-device' });
      }
      const db = authDb();
      const now = Date.now();
      const caps = JSON.stringify(body.capabilities ?? []);
      db.prepare(
        `INSERT INTO playback_devices (device_id, user_id, name, capabilities, last_seen)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(device_id) DO UPDATE SET
         user_id=excluded.user_id,
         name=excluded.name,
         capabilities=excluded.capabilities,
         last_seen=excluded.last_seen`,
      ).run(body.deviceId, user.id, body.name, caps, now);
      return reply.send({ ok: true, lastSeen: now });
    },
  );

  // ─── GET /v1/playback/devices ───────────────────────────────────
  fastify.get(
    '/v1/playback/devices',
    {
      schema: {
        description: 'List devices recently active for the authenticated user.',
        tags: ['playback'],
      },
    },
    async (req, reply) => {
      const user = requireFeature(req, reply, 'playback.session.read');
      if (!user) return;
      pruneStaleDevices(user.id);
      const rows = authDb()
        .prepare<
          [string],
          DeviceRow
        >(`SELECT * FROM playback_devices WHERE user_id = ? ORDER BY last_seen DESC`)
        .all(user.id);
      return reply.send({
        devices: rows.map((r) => ({
          deviceId: r.device_id,
          name: r.name,
          capabilities: JSON.parse(r.capabilities) as string[],
          lastSeen: r.last_seen,
        })),
      });
    },
  );
}

// Re-export so the route registration in server.ts can ignore the
// unused `gateFeature` import warning when wiring this module.
export { gateFeature };
