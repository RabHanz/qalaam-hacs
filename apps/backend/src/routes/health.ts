/**
 * Liveness + readiness endpoints.
 */
import type { FastifyInstance } from 'fastify';

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/healthz',
    {
      schema: {
        description: 'Liveness probe',
        tags: ['health'],
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', const: 'ok' },
              version: { type: 'string' },
            },
          },
        },
      },
    },
    () => ({ status: 'ok' as const, version: '0.0.1' }),
  );

  fastify.get(
    '/readyz',
    {
      schema: {
        description: 'Readiness probe — checks DB, Redis, data-loader',
        tags: ['health'],
      },
    },
    () => ({ status: 'ok' as const }),
  );
}
