/**
 * `qalaam-mcp` server — Qalaam's own Model Context Protocol surface.
 *
 * Exposes family-aware tools that mcp.quran.ai cannot:
 *   - qalaam_hifdh_state(user_id?)              → current sabaq/sabqi/manzil state
 *   - qalaam_mutashabihat_for_verse(verse_key)  → similar-ayah pairs + severity
 *   - qalaam_morphology_for_verse(verse_key)    → per-word POS / lemma / root
 *   - qalaam_root_concordance(root)             → every verse-word sharing a root
 *   - qalaam_topics_for_verse(verse_key)        → topic chips for the /study sidebar
 *   - qalaam_topic_verses(topic_slug)           → every verse on a curated topic
 *   - qalaam_search_topics(query)               → fuzzy match topic names
 *
 * Wire protocol: JSON-RPC 2.0 over plain HTTP (the simplest variant of
 * MCP's "streamable HTTP" transport — no SSE complexity). Clients POST
 * to /mcp; we reply application/json.
 *
 * Methods supported:
 *   - initialize                      → server info + protocolVersion
 *   - notifications/initialized       → ack (no-op)
 *   - tools/list                      → tool registry with JSON-Schema inputs
 *   - tools/call {name, arguments}    → invoke one of the tools above
 *
 * Per ADR-0020: every reader fails closed if the SQLite DB isn't
 * present so we can't accidentally serve stale or empty data.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import Database from 'better-sqlite3';

import type { Database as DB } from 'better-sqlite3';
import type { FastifyInstance, FastifyReply } from 'fastify';

const PROTOCOL_VERSION = '2025-06-18';
const SERVER_NAME = 'qalaam-mcp';
const SERVER_VERSION = '0.1.0';

interface JsonRpcRequest {
  readonly jsonrpc: '2.0';
  readonly id?: number | string | null;
  readonly method: string;
  readonly params?: Record<string, unknown>;
}

interface JsonRpcSuccess {
  readonly jsonrpc: '2.0';
  readonly id: number | string | null;
  readonly result: unknown;
}
interface JsonRpcFailure {
  readonly jsonrpc: '2.0';
  readonly id: number | string | null;
  readonly error: { code: number; message: string; data?: unknown };
}
type JsonRpcResponse = JsonRpcSuccess | JsonRpcFailure;

let cachedDb: DB | undefined;
function db(): DB | undefined {
  if (cachedDb) return cachedDb;
  const path = process.env.QUL_SQLITE_PATH ?? join(process.cwd(), 'data', 'qul.sqlite');
  if (!existsSync(path)) return undefined;
  try {
    cachedDb = new Database(path, { readonly: true, fileMustExist: true });
    return cachedDb;
  } catch {
    return undefined;
  }
}

// --- Tool registry -------------------------------------------------------

interface ToolDef {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
  readonly handler: (args: Record<string, unknown>) => unknown;
}

function asString(v: unknown, field: string): string {
  if (typeof v !== 'string' || v.length === 0) {
    throw new Error(`missing or empty required string: ${field}`);
  }
  return v;
}

const TOOLS: readonly ToolDef[] = [
  {
    name: 'qalaam_hifdh_state',
    description:
      "Returns the current learner's hifdh state (sabaq new portion, sabqi recent " +
      'review, manzil long-distance review). Reads `qalaam_v1_hifdh_state`. ' +
      "Defaults to user_id='demo-user' when none is provided.",
    inputSchema: {
      type: 'object',
      properties: { user_id: { type: 'string' } },
    },
    handler: (args) => {
      const d = db();
      if (!d) throw new Error('qalaam.data.not-loaded');
      const userId = (args.user_id as string | undefined) ?? 'demo-user';
      try {
        const row = d
          .prepare<
            [string],
            { state_json: string; updated_at: string }
          >(`SELECT state_json, updated_at FROM qalaam_v1_hifdh_state WHERE user_id = ?`)
          .get(userId);
        if (!row) {
          return { userId, state: null, note: 'no hifdh state recorded yet' };
        }
        return {
          userId,
          state: JSON.parse(row.state_json) as Record<string, unknown>,
          updatedAt: row.updated_at,
        };
      } catch (err) {
        // Table may not exist yet; surface cleanly rather than 500.
        return {
          userId,
          state: null,
          note: `hifdh state not queryable: ${(err as Error).message}`,
        };
      }
    },
  },

  {
    name: 'qalaam_mutashabihat_for_verse',
    description:
      'Returns similar-ayah pairs for a verse (mutashabihat). Useful when a learner ' +
      'confuses the verse with another that starts the same way. Source: QUL ' +
      'mutashabihat-v2 + similar-ayah edges.',
    inputSchema: {
      type: 'object',
      properties: { verse_key: { type: 'string', pattern: '^[0-9]+:[0-9]+$' } },
      required: ['verse_key'],
    },
    handler: (args) => {
      const d = db();
      if (!d) throw new Error('qalaam.data.not-loaded');
      const verseKey = asString(args.verse_key, 'verse_key');
      const pairs = d
        .prepare<
          [string, string],
          {
            verse_key_a: string;
            verse_key_b: string;
            similarity: number;
            cluster_id: number | null;
          }
        >(
          `SELECT verse_key_a, verse_key_b, similarity, cluster_id
           FROM qalaam_v1_qul_mutashabihat_v2_pairs
           WHERE verse_key_a = ? OR verse_key_b = ?
           ORDER BY similarity DESC LIMIT 50`,
        )
        .all(verseKey, verseKey);
      return {
        verseKey,
        pairs: pairs.map((p) => ({
          counterpart: p.verse_key_a === verseKey ? p.verse_key_b : p.verse_key_a,
          similarity: p.similarity,
          clusterId: p.cluster_id,
        })),
      };
    },
  },

  {
    name: 'qalaam_morphology_for_verse',
    description:
      'Word-by-word morphology (POS tag, lemma, Buckwalter root) for a verse. ' +
      'Source: Quranic Arabic Corpus v0.4 (Kais Dukes, GPL).',
    inputSchema: {
      type: 'object',
      properties: { verse_key: { type: 'string', pattern: '^[0-9]+:[0-9]+$' } },
      required: ['verse_key'],
    },
    handler: (args) => {
      const d = db();
      if (!d) throw new Error('qalaam.data.not-loaded');
      const verseKey = asString(args.verse_key, 'verse_key');
      const rows = d
        .prepare<
          [string],
          {
            word_index: number;
            pos_tag: string;
            form_arabic: string;
            lemma: string | null;
            root: string | null;
          }
        >(
          `SELECT word_index, pos_tag, form_arabic, lemma, root
           FROM qalaam_v1_qul_morphology
           WHERE verse_key = ? AND is_stem = 1
           ORDER BY word_index`,
        )
        .all(verseKey);
      return {
        verseKey,
        words: rows.map((r) => ({
          wordIndex: r.word_index,
          pos: r.pos_tag,
          form: r.form_arabic,
          lemma: r.lemma,
          root: r.root,
        })),
      };
    },
  },

  {
    name: 'qalaam_root_concordance',
    description:
      'Returns every verse-word that shares a Buckwalter root (concordance ' +
      'lookup). Capped at 500 occurrences. Source: Quranic Arabic Corpus v0.4.',
    inputSchema: {
      type: 'object',
      properties: { root: { type: 'string' } },
      required: ['root'],
    },
    handler: (args) => {
      const d = db();
      if (!d) throw new Error('qalaam.data.not-loaded');
      const root = asString(args.root, 'root');
      const rows = d
        .prepare<
          [string],
          {
            verse_key: string;
            word_index: number;
            form_arabic: string;
            lemma: string | null;
            pos_tag: string;
          }
        >(
          `SELECT verse_key, word_index, form_arabic, lemma, pos_tag
           FROM qalaam_v1_qul_morphology
           WHERE root = ? AND is_stem = 1
           ORDER BY surah, ayah, word_index
           LIMIT 500`,
        )
        .all(root);
      return {
        root,
        count: rows.length,
        occurrences: rows.map((r) => ({
          verseKey: r.verse_key,
          wordIndex: r.word_index,
          form: r.form_arabic,
          lemma: r.lemma,
          pos: r.pos_tag,
        })),
      };
    },
  },

  {
    name: 'qalaam_topics_for_verse',
    description: 'Returns curated topics that include a given verse — for the /study sidebar.',
    inputSchema: {
      type: 'object',
      properties: { verse_key: { type: 'string', pattern: '^[0-9]+:[0-9]+$' } },
      required: ['verse_key'],
    },
    handler: (args) => {
      const d = db();
      if (!d) throw new Error('qalaam.data.not-loaded');
      const verseKey = asString(args.verse_key, 'verse_key');
      const rows = d
        .prepare<
          [string],
          { slug: string; name_en: string; name_ar: string | null; summary: string | null }
        >(
          `SELECT t.slug, t.name_en, t.name_ar, t.summary
           FROM qalaam_v1_qul_topic_verses tv
           JOIN qalaam_v1_qul_topics t ON t.topic_id = tv.topic_id
           WHERE tv.verse_key = ?
           ORDER BY t.sort_order ASC`,
        )
        .all(verseKey);
      return {
        verseKey,
        topics: rows.map((r) => ({
          slug: r.slug,
          nameEn: r.name_en,
          nameAr: r.name_ar,
          summary: r.summary,
        })),
      };
    },
  },

  {
    name: 'qalaam_topic_verses',
    description: 'Returns every verse mapped to a curated topic.',
    inputSchema: {
      type: 'object',
      properties: { topic_slug: { type: 'string' } },
      required: ['topic_slug'],
    },
    handler: (args) => {
      const d = db();
      if (!d) throw new Error('qalaam.data.not-loaded');
      const topicSlug = asString(args.topic_slug, 'topic_slug');
      const t = d
        .prepare<
          [string],
          {
            topic_id: number;
            name_en: string;
            name_ar: string | null;
            summary: string | null;
            verse_count: number;
          }
        >(
          `SELECT topic_id, name_en, name_ar, summary, verse_count
           FROM qalaam_v1_qul_topics WHERE slug = ?`,
        )
        .get(topicSlug);
      if (!t) throw new Error(`unknown topic_slug: ${topicSlug}`);
      const verses = d
        .prepare<[number], { verse_key: string }>(
          `SELECT verse_key FROM qalaam_v1_qul_topic_verses
           WHERE topic_id = ? ORDER BY sort_order ASC`,
        )
        .all(t.topic_id);
      return {
        slug: topicSlug,
        nameEn: t.name_en,
        nameAr: t.name_ar,
        summary: t.summary,
        verseCount: t.verse_count,
        verses: verses.map((v) => v.verse_key),
      };
    },
  },

  {
    name: 'qalaam_search_topics',
    description: 'Fuzzy-match curated topics by their English or Arabic name.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
    handler: (args) => {
      const d = db();
      if (!d) throw new Error('qalaam.data.not-loaded');
      const query = asString(args.query, 'query');
      const like = `%${query}%`;
      const rows = d
        .prepare<
          [string, string],
          { slug: string; name_en: string; name_ar: string | null; verse_count: number }
        >(
          `SELECT slug, name_en, name_ar, verse_count
           FROM qalaam_v1_qul_topics
           WHERE parent_id IS NOT NULL AND (name_en LIKE ? OR name_ar LIKE ?)
           ORDER BY verse_count DESC LIMIT 25`,
        )
        .all(like, like);
      return {
        query,
        matches: rows.map((r) => ({
          slug: r.slug,
          nameEn: r.name_en,
          nameAr: r.name_ar,
          verseCount: r.verse_count,
        })),
      };
    },
  },
];

const TOOLS_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

// --- JSON-RPC dispatcher -------------------------------------------------

function rpcOk(id: number | string | null | undefined, result: unknown): JsonRpcSuccess {
  return { jsonrpc: '2.0', id: id ?? null, result };
}
function rpcErr(
  id: number | string | null | undefined,
  code: number,
  message: string,
): JsonRpcFailure {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

function dispatch(req: JsonRpcRequest): JsonRpcResponse | null {
  const { method, id, params } = req;
  switch (method) {
    case 'initialize':
      return rpcOk(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
        instructions:
          'Qalaam family-aware Quran tools. Tools surface curated topics, ' +
          'mutashabihat clusters, morphology, and per-learner hifdh state. ' +
          'All data ships with attribution metadata; cite the source field ' +
          'returned by each tool when surfacing answers.',
      });

    case 'notifications/initialized':
      // Notifications carry no id; spec says return nothing.
      return null;

    case 'tools/list':
      return rpcOk(id, {
        tools: TOOLS.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      });

    case 'tools/call': {
      const name = (params?.name as string | undefined) ?? '';
      const args = (params?.arguments as Record<string, unknown> | undefined) ?? {};
      const tool = TOOLS_BY_NAME.get(name);
      if (!tool) return rpcErr(id, -32602, `unknown tool: ${name}`);
      try {
        const result = tool.handler(args);
        // MCP convention: tools return `content: [{type:"text", text:"…"}]`.
        // We embed our JSON payload as a single text block so any MCP
        // client (Claude Desktop, Cursor, custom) renders it without
        // schema gymnastics.
        return rpcOk(id, {
          content: [{ type: 'text', text: JSON.stringify(result) }],
          isError: false,
        });
      } catch (err) {
        return rpcOk(id, {
          content: [{ type: 'text', text: `qalaam-mcp ${name}: ${(err as Error).message}` }],
          isError: true,
        });
      }
    }

    default:
      return rpcErr(id, -32601, `method not found: ${method}`);
  }
}

// eslint-disable-next-line @typescript-eslint/require-await -- fastify register signature requires Promise<void> for symmetry with the rest of the route modules; body does not await.
export async function mcpServerRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /mcp — discovery endpoint. Some MCP clients probe this for
   * server metadata before opening a JSON-RPC stream.
   */
  fastify.get('/mcp', { schema: { tags: ['mcp-server'] } }, async (_req, reply) => {
    void reply.header('cache-control', 'no-store');
    return {
      protocol: 'mcp',
      protocolVersion: PROTOCOL_VERSION,
      transport: 'http',
      serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
      tools: TOOLS.map((t) => t.name),
    };
  });

  /**
   * POST /mcp — JSON-RPC 2.0 endpoint. Accepts a single request or a
   * batch (array). Notifications (no id) get HTTP 204.
   */
  fastify.post<{ Body: JsonRpcRequest | readonly JsonRpcRequest[] }>(
    '/mcp',
    {
      schema: {
        tags: ['mcp-server'],
        description:
          'qalaam-mcp JSON-RPC endpoint. Speaks Model Context Protocol over ' +
          'plain HTTP. Methods: initialize · tools/list · tools/call.',
      },
    },
    async (req, reply: FastifyReply) => {
      void reply.header('cache-control', 'no-store');
      const body = req.body;

      // Batch.
      if (Array.isArray(body)) {
        const responses = (body as readonly JsonRpcRequest[])
          .map((r) => dispatch(r))
          .filter((r): r is JsonRpcResponse => r !== null);
        if (responses.length === 0) return reply.code(204).send();
        return reply.send(responses);
      }

      // Single.
      const out = dispatch(body as JsonRpcRequest);
      if (out === null) return reply.code(204).send();
      return reply.send(out);
    },
  );
}
