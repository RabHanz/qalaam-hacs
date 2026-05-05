/**
 * Hifdh routes — plan, today's session, rating submission.
 *
 * v0.1: in-memory store keyed by user-id (anonymous demo). v0.5 swaps the store
 * for Prisma + Postgres per ADR-0010. The route surface stays identical.
 *
 * Outcomes served: O-04 (parent cognitive load), O-05 (mutashabihat), O-07 (retention).
 */
import { QalaamError } from '@qalaam/core';
import {
  applyGrade,
  deriveFsrsGrade,
  generateDailySession,
  initialReviewState,
  type Accuracy,
  type Fluency,
  type PortionLike,
} from '@qalaam/hifdh-engine';

import type { FastifyInstance } from 'fastify';

interface UserHifdhState {
  portions: PortionLike[];
}

const store = new Map<string, UserHifdhState>();

function ensure(userId: string): UserHifdhState {
  let s = store.get(userId);
  if (!s) {
    s = { portions: [] };
    store.set(userId, s);
  }
  return s;
}

export async function hifdhRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Querystring: { user_id?: string } }>(
    '/v1/hifdh/session',
    {
      schema: {
        description: "Today's Hifdh session: sabaq + sabqi + manzil portions.",
        tags: ['hifdh'],
        querystring: {
          type: 'object',
          properties: { user_id: { type: 'string' } },
        },
      },
    },
    async (request) => {
      const userId = request.query.user_id ?? 'demo-user';
      const state = ensure(userId);
      const session = generateDailySession({
        now: new Date(),
        portions: state.portions,
      });
      return session;
    },
  );

  fastify.post<{
    Body: {
      user_id?: string;
      portion_id: string;
      fluency: Fluency;
      accuracy: Accuracy;
      mutashabihat_swap?: boolean;
    };
  }>(
    '/v1/hifdh/rate',
    {
      schema: {
        description: 'Submit a fluency × accuracy rating for a portion. Updates FSRS-6 state.',
        tags: ['hifdh'],
        body: {
          type: 'object',
          required: ['portion_id', 'fluency', 'accuracy'],
          properties: {
            user_id: { type: 'string' },
            portion_id: { type: 'string', format: 'uuid' },
            fluency: { type: 'integer', minimum: 0, maximum: 3 },
            accuracy: { type: 'integer', minimum: 0, maximum: 3 },
            mutashabihat_swap: { type: 'boolean', default: false },
          },
        },
      },
    },
    async (request) => {
      const userId = request.body.user_id ?? 'demo-user';
      const state = ensure(userId);
      const portion = state.portions.find((p) => p.id === request.body.portion_id);
      if (!portion) {
        throw new QalaamError(
          'qalaam.data.not-loaded',
          `No portion ${request.body.portion_id} for user ${userId}.`,
          { outcomeImpacted: 'O-04' },
        );
      }
      const grade = deriveFsrsGrade(request.body.fluency, request.body.accuracy);
      const updated = applyGrade({ now: new Date(), review: portion.reviewState, grade });
      const next: PortionLike = { ...portion, reviewState: updated };
      state.portions = state.portions.map((p) => (p.id === portion.id ? next : p));
      return { portion: next, derived_grade: grade };
    },
  );

  fastify.post<{
    Body: {
      user_id?: string;
      start_verse_key: string;
      end_verse_key: string;
      status?: 'new' | 'sabqi' | 'manzil' | 'weak' | 'locked';
    };
  }>(
    '/v1/hifdh/portion',
    {
      schema: {
        description: 'Create a new Hifdh portion (e.g., a freshly-memorized half-page).',
        tags: ['hifdh'],
        body: {
          type: 'object',
          required: ['start_verse_key', 'end_verse_key'],
          properties: {
            user_id: { type: 'string' },
            start_verse_key: { type: 'string', pattern: '^[0-9]+:[0-9]+$' },
            end_verse_key: { type: 'string', pattern: '^[0-9]+:[0-9]+$' },
            status: { type: 'string', enum: ['new', 'sabqi', 'manzil', 'weak', 'locked'] },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.body.user_id ?? 'demo-user';
      const state = ensure(userId);
      const { ayahRange, parseVerseKey } = await import('@qalaam/core');
      const range = ayahRange(
        parseVerseKey(request.body.start_verse_key),
        parseVerseKey(request.body.end_verse_key),
      );
      const id = crypto.randomUUID();
      const portion: PortionLike = {
        id,
        range,
        status: request.body.status ?? 'new',
        reviewState: initialReviewState({ now: new Date() }),
      };
      state.portions = [...state.portions, portion];
      void reply.code(201);
      return portion;
    },
  );
}
