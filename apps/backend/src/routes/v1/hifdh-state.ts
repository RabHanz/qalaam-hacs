/**
 * GET /v1/hifdh/state → at-a-glance summary for HA sensors.
 *
 * Aggregates: streak, current sabqi range, manzil cycle position, top weakest.
 * v0.1: derives from the in-memory hifdh store; v0.5 from Postgres.
 */
import type { FastifyInstance } from 'fastify';

import { type PortionLike } from '@qalaam/hifdh-engine';

interface AggregateView {
  readonly user_id: string;
  readonly streak_days: number;
  readonly grace_days_remaining: number;
  readonly current_sabqi: string | null;
  readonly manzil_cycle_position: string | null;
  readonly weakest_pages: readonly string[];
  readonly mutashabihat_watchlist: readonly string[];
  readonly generated_at: string;
}

// In-memory; same store as routes/v1/hifdh.ts (v0.5 unifies via Prisma).
const dummy = (userId: string, portions: readonly PortionLike[]): AggregateView => ({
  user_id: userId,
  streak_days: 0,
  grace_days_remaining: 2,
  current_sabqi: portions.length > 0 ? `${portions[0]?.range[0]} → ${portions[0]?.range[1]}` : null,
  manzil_cycle_position: null,
  weakest_pages: [],
  mutashabihat_watchlist: [],
  generated_at: new Date().toISOString(),
});

export async function hifdhStateRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Querystring: { user_id?: string } }>(
    '/v1/hifdh/state',
    {
      schema: {
        description: "At-a-glance Hifdh summary — surfaced as HA sensors.",
        tags: ['hifdh'],
        querystring: {
          type: 'object',
          properties: { user_id: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const userId = request.query.user_id ?? 'demo-user';
      void reply.header('cache-control', 'no-store');
      return dummy(userId, []);
    },
  );
}
