/**
 * GET /v1/now-playing/:speaker_id → current verse + reciter + position.
 *
 * Surfaced as a sensor in the HA integration (current_verse + media_position).
 * v0.1: in-memory single-user store; v0.5 wires to Postgres + multi-tenant.
 */
import type { FastifyInstance } from 'fastify';

interface NowPlayingState {
  readonly speaker_id: string;
  readonly verse_key: string | null;
  readonly reciter_slug: string | null;
  readonly position_ms: number;
  readonly is_playing: boolean;
  readonly updated_at: string;
}

const store = new Map<string, NowPlayingState>();

/** Public API for other routes / tests to update now-playing without going through HTTP. */
export function setNowPlaying(state: NowPlayingState): void {
  store.set(state.speaker_id, state);
}

export async function nowPlayingRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Params: { speakerId: string } }>(
    '/v1/now-playing/:speakerId',
    {
      schema: {
        description: 'Current verse + reciter + position for a speaker.',
        tags: ['now-playing'],
        params: {
          type: 'object',
          properties: { speakerId: { type: 'string' } },
          required: ['speakerId'],
        },
      },
    },
    async (request, reply) => {
      const id = request.params.speakerId;
      const state = store.get(id) ?? {
        speaker_id: id,
        verse_key: null,
        reciter_slug: null,
        position_ms: 0,
        is_playing: false,
        updated_at: new Date().toISOString(),
      };
      void reply.header('cache-control', 'no-store');
      return state;
    },
  );

  fastify.post<{ Body: NowPlayingState }>(
    '/v1/now-playing/:speakerId',
    {
      schema: {
        description: 'Update now-playing state — called by adapters after media_player events.',
        tags: ['now-playing'],
        body: {
          type: 'object',
          required: ['speaker_id', 'position_ms', 'is_playing', 'updated_at'],
          properties: {
            speaker_id: { type: 'string' },
            verse_key: { type: ['string', 'null'] },
            reciter_slug: { type: ['string', 'null'] },
            position_ms: { type: 'integer', minimum: 0 },
            is_playing: { type: 'boolean' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    async (request, reply) => {
      setNowPlaying(request.body);
      void reply.code(204);
      return null;
    },
  );
}
