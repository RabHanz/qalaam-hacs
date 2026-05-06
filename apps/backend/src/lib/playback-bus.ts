/**
 * Playback session bus — in-memory pub/sub for SSE subscribers,
 * keyed by user_id. The actual session state lives in qalaam.sqlite
 * (`playback_sessions` table); this module is the broadcaster that
 * fans out updates to whatever frontend devices are currently
 * subscribed for that user.
 *
 * Per ADR-0025 Phase 2:
 *   - Sessions are PER user_id (not per network) — two users on the
 *     same WiFi don't share a session. This is enforced by the
 *     subscriber map being keyed by user_id, set from the auth
 *     cookie at subscribe-time.
 *   - When a device sends a command, the route handler updates the
 *     SQLite row, then calls `broadcast(userId, state)` here. Every
 *     SSE stream subscribed for that user receives the new state.
 *
 * The bus deliberately doesn't persist subscriber identity — if the
 * server restarts, every client's EventSource auto-reconnects (the
 * standard browser behaviour) and re-subscribes.
 */
import type { FastifyReply } from 'fastify';

export interface PlaybackState {
  readonly verseKey: string;
  readonly reciterSlug: string;
  readonly positionSeconds: number;
  readonly isPaused: boolean;
  readonly target: string;
  readonly activeDeviceId: string | null;
  readonly updatedAt: number;
}

/** Subscribers for a given user, identified by their reply object
 *  (the SSE stream). The map uses Sets so duplicate subscribes (e.g.
 *  React StrictMode double-invoking effects) don't create ghost
 *  entries. */
const subscribers = new Map<string, Set<FastifyReply>>();

export function subscribe(userId: string, reply: FastifyReply): () => void {
  let set = subscribers.get(userId);
  if (!set) {
    set = new Set();
    subscribers.set(userId, set);
  }
  set.add(reply);
  return (): void => {
    const s = subscribers.get(userId);
    if (!s) return;
    s.delete(reply);
    if (s.size === 0) subscribers.delete(userId);
  };
}

/** Push a state update to every subscriber of `userId`. Each
 *  subscriber gets a SSE "data:" frame with the JSON-encoded
 *  payload. Errors writing to a stream silently drop that
 *  subscriber (the stream cleanup will run via its own close
 *  handler). */
export function broadcast(userId: string, state: PlaybackState): void {
  const set = subscribers.get(userId);
  if (!set || set.size === 0) return;
  const frame = `event: state\ndata: ${JSON.stringify(state)}\n\n`;
  for (const reply of set) {
    try {
      reply.raw.write(frame);
    } catch {
      /* connection closed mid-write — cleanup runs from the
         on-close handler in the route */
    }
  }
}

/** Diagnostic — used by /v1/playback/state to surface the live
 *  subscriber count alongside the persisted state, mostly for
 *  debugging / future admin panel. */
export function subscriberCount(userId: string): number {
  return subscribers.get(userId)?.size ?? 0;
}
