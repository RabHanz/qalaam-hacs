/**
 * GET /v1/features — public feature catalog snapshot.
 *
 * The web client consumes this to mirror the catalog without
 * recompiling. Static for now (the catalog is code-driven); when the
 * admin-panel `feature_overrides` table lands (#214) this route will
 * compose code-level + override rows so an admin tier-flip propagates
 * within the next request.
 *
 * Public — no auth required. The catalog is non-secret; tier-gating
 * itself happens server-side in routes via gateFeature/requireFeature.
 */
import { publicCatalog } from '../../auth/features.js';

import type { FastifyInstance } from 'fastify';

export async function featuresRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/v1/features',
    {
      schema: {
        description: 'Feature catalog — minTier + customer-voice label per feature.',
        tags: ['features'],
      },
    },
    async (_req, reply) => {
      void reply.header('cache-control', 'public, max-age=60');
      return reply.send({ catalog: publicCatalog() });
    },
  );
}
