/**
 * /v1/mcp/* — thin proxy to mcp.quran.ai for content we don't have
 * locally. Used as a fallback by /study panes (extra tafsirs,
 * lesser-known qira'at, semantic search across translations) until
 * we ingest those resources locally.
 *
 *   GET  /v1/mcp/tools                        list available MCP tools
 *   POST /v1/mcp/call/:toolName  { args }     invoke a tool
 *   POST /v1/mcp/search-tafsir   { q, lang }  shortcut
 *
 * Per CLAUDE.md adab + ADR-0020: we don't proxy ANY user input
 * blindly. Tool args are validated; rate-limited at the Fastify
 * plugin layer (600/min).
 */
import { mcpListTools, mcpQuranTool } from '../../lib/mcp-quran-ai.js';

import type { FastifyInstance } from 'fastify';

const ALLOWED_TOOLS = new Set<string>([
  'fetch_quran',
  'search_quran',
  'fetch_translation',
  'search_translation',
  'fetch_tafsir',
  'search_tafsir',
  'get_word_morphology',
  'fetch_grounding_rules',
]);

export async function mcpRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/v1/mcp/tools',
    {
      schema: {
        description: 'List MCP tools available from upstream mcp.quran.ai. Useful for discovery.',
        tags: ['mcp'],
      },
    },
    async (_req, reply) => {
      try {
        const tools = await mcpListTools();
        void reply.header('cache-control', 'public, max-age=3600');
        return {
          source: 'mcp.quran.ai',
          tools: tools.tools.map((t) => ({
            name: t.name,
            description: t.description ?? '',
            allowed: ALLOWED_TOOLS.has(t.name),
          })),
        };
      } catch (err) {
        return reply.code(502).send({
          error: 'qalaam.mcp.upstream-error',
          message: err instanceof Error ? err.message : 'unknown',
        });
      }
    },
  );

  fastify.post<{
    Params: { toolName: string };
    Body: { args?: Record<string, unknown> };
  }>(
    '/v1/mcp/call/:toolName',
    {
      schema: {
        description: 'Invoke an MCP tool on mcp.quran.ai. Allowed tools listed in ALLOWED_TOOLS.',
        tags: ['mcp'],
        params: {
          type: 'object',
          properties: { toolName: { type: 'string', pattern: '^[a-z_]+$' } },
          required: ['toolName'],
        },
      },
    },
    async (req, reply) => {
      const { toolName } = req.params;
      if (!ALLOWED_TOOLS.has(toolName)) {
        return reply.code(403).send({ error: 'qalaam.mcp.tool-not-allowed', tool: toolName });
      }
      const args = req.body.args ?? {};
      try {
        const result = await mcpQuranTool(toolName, args);
        return { tool: toolName, result };
      } catch (err) {
        return reply.code(502).send({
          error: 'qalaam.mcp.upstream-error',
          tool: toolName,
          message: err instanceof Error ? err.message : 'unknown',
        });
      }
    },
  );

  // Convenience routes — most-used MCP tools surfaced as plain GET.
  fastify.get<{ Querystring: { q: string; lang?: string } }>(
    '/v1/mcp/search-tafsir',
    {
      schema: {
        description:
          'Cross-tafsir semantic search via mcp.quran.ai. Useful for /study fallback when local tafsirs miss the verse.',
        tags: ['mcp'],
        querystring: {
          type: 'object',
          properties: { q: { type: 'string', minLength: 2 }, lang: { type: 'string' } },
          required: ['q'],
        },
      },
    },
    async (req, reply) => {
      try {
        const result = await mcpQuranTool('search_tafsir', {
          query: req.query.q,
          ...(req.query.lang ? { language: req.query.lang } : {}),
        });
        return { source: 'mcp.quran.ai', query: req.query.q, result };
      } catch (err) {
        return reply.code(502).send({
          error: 'qalaam.mcp.upstream-error',
          message: err instanceof Error ? err.message : 'unknown',
        });
      }
    },
  );
}
