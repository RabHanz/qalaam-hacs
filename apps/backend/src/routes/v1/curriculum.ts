/**
 * GET /v1/curriculum/lessons               — full catalog
 * GET /v1/curriculum/levels/:level/lessons — list within a level
 * GET /v1/curriculum/lessons/:slug         — single lesson
 * GET /v1/curriculum/progress              — per-user (v0.1: in-memory; v0.5: Postgres)
 * POST /v1/curriculum/progress             — mark a lesson complete
 *
 * Per strategy §9 + §15.6 of DEV_CHECKLIST.md.
 */
import { QalaamError } from '@qalaam/core';
import { LESSONS, LEVEL_META, lessonById, lessonsByLevel } from '@qalaam/curriculum';

import type { FastifyInstance } from 'fastify';

interface UserProgress {
  completedLessonIds: Set<string>;
}

const store = new Map<string, UserProgress>();

function ensure(userId: string): UserProgress {
  let p = store.get(userId);
  if (!p) {
    p = { completedLessonIds: new Set() };
    store.set(userId, p);
  }
  return p;
}

export async function curriculumRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/v1/curriculum/lessons',
    {
      schema: {
        description: 'Full curriculum catalog across all 4 levels.',
        tags: ['curriculum'],
      },
    },
    async (_req, reply) => {
      void reply.header('cache-control', 'public, max-age=86400');
      return {
        levels: ([1, 2, 3, 4] as const).map((l) => ({
          level: l,
          ...LEVEL_META[l],
          lessons: lessonsByLevel(l),
        })),
      };
    },
  );

  fastify.get<{ Params: { level: string } }>(
    '/v1/curriculum/levels/:level/lessons',
    {
      schema: {
        description: 'Lessons within a level.',
        tags: ['curriculum'],
        params: {
          type: 'object',
          properties: { level: { type: 'string', pattern: '^[1-4]$' } },
          required: ['level'],
        },
      },
    },
    async (request, reply) => {
      const n = Number.parseInt(request.params.level, 10) as 1 | 2 | 3 | 4;
      void reply.header('cache-control', 'public, max-age=86400');
      return { level: n, ...LEVEL_META[n], lessons: lessonsByLevel(n) };
    },
  );

  fastify.get<{ Params: { slug: string } }>(
    '/v1/curriculum/lessons/:slug',
    {
      schema: {
        description: 'Single lesson by slug, id, or `level/slug`.',
        tags: ['curriculum'],
      },
    },
    async (request, reply) => {
      try {
        const lesson = lessonById(request.params.slug);
        void reply.header('cache-control', 'public, max-age=86400');
        return lesson;
      } catch {
        throw new QalaamError(
          'qalaam.data.not-loaded',
          `Unknown lesson '${request.params.slug}'.`,
          { outcomeImpacted: 'O-19' },
        );
      }
    },
  );

  fastify.get<{ Querystring: { user_id?: string } }>(
    '/v1/curriculum/progress',
    {
      schema: {
        description: 'Per-user lesson completion set.',
        tags: ['curriculum'],
      },
    },
    async (request) => {
      const userId = request.query.user_id ?? 'demo-user';
      const p = ensure(userId);
      return {
        user_id: userId,
        completed: [...p.completedLessonIds],
        total: LESSONS.length,
      };
    },
  );

  fastify.post<{ Body: { user_id?: string; lesson_id: string } }>(
    '/v1/curriculum/progress',
    {
      schema: {
        description: 'Mark a lesson complete.',
        tags: ['curriculum'],
        body: {
          type: 'object',
          required: ['lesson_id'],
          properties: {
            user_id: { type: 'string' },
            lesson_id: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.body.user_id ?? 'demo-user';
      const lessonId = request.body.lesson_id;
      try {
        lessonById(lessonId);
      } catch {
        throw new QalaamError('qalaam.data.not-loaded', `Unknown lesson '${lessonId}'.`, {
          outcomeImpacted: 'O-19',
        });
      }
      const p = ensure(userId);
      p.completedLessonIds.add(lessonId);
      void reply.code(201);
      return { user_id: userId, lesson_id: lessonId, completed: true };
    },
  );
}
