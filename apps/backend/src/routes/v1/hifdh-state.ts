/**
 * GET /v1/hifdh/state → at-a-glance summary for HA sensors and /hifdh page.
 *
 * Aggregates: streak, current sabqi range, manzil cycle position, top
 * weakest, mutashabihat watchlist. v0.1 reads from
 * `lib/hifdh-store.ts` (in-memory, demo-but-plausible). v0.5 swaps in
 * the Postgres-backed Prisma store.
 *
 * Per CLAUDE.md adab non-negotiables: this endpoint NEVER returns
 * all-zero state — a fresh user sees an inviting practice in progress,
 * not "you broke your streak."
 */
import type { FastifyInstance } from 'fastify';

import { getDemoHifdhState } from '../../lib/hifdh-store.js';

interface AggregateView {
  readonly user_id: string;
  readonly streak_days: number;
  readonly grace_days_remaining: number;
  readonly current_sabqi: string | null;
  readonly current_sabaq: string | null;
  readonly portions_due_today: number;
  readonly minutes_completed_today: number;
  readonly manzil_cycle_position: string | null;
  readonly weakest_pages: readonly string[];
  readonly mutashabihat_watchlist: readonly string[];
  readonly generated_at: string;
}

export async function hifdhStateRoutes(fastify: FastifyInstance): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/require-await
  fastify.get<{ Querystring: { user_id?: string } }>(
    '/v1/hifdh/state',
    {
      schema: {
        description: "At-a-glance Hifdh summary — surfaced as HA sensors and /hifdh.",
        tags: ['hifdh'],
        querystring: {
          type: 'object',
          properties: { user_id: { type: 'string' } },
        },
      },
    },
    async (request, reply): Promise<AggregateView> => {
      const userId = request.query.user_id ?? 'demo-user';
      const s = getDemoHifdhState(userId);
      void reply.header('cache-control', 'no-store');
      return {
        user_id: userId,
        streak_days: s.streakDays,
        grace_days_remaining: s.graceDaysRemaining,
        current_sabqi: s.currentSabqi,
        current_sabaq: s.currentSabaq,
        portions_due_today: s.portionsDueToday,
        minutes_completed_today: s.minutesCompletedToday,
        manzil_cycle_position: s.manzilCyclePosition,
        weakest_pages: s.weakestPages,
        mutashabihat_watchlist: s.mutashabihatWatchlist,
        generated_at: new Date().toISOString(),
      };
    },
  );
}
