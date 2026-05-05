/**
 * mcp.quran.ai client — JSON-RPC over HTTP+SSE.
 *
 * mcp.quran.ai exposes the Model Context Protocol over a single
 * endpoint (POST https://mcp.quran.ai/). Every interaction needs:
 *   - Accept: application/json, text/event-stream
 *   - mcp-session-id (issued on `initialize`, then required on every
 *     subsequent call)
 *   - JSON-RPC envelope { jsonrpc, id, method, params }
 *
 * Responses are SSE — `event: message\ndata: <jsonrpc envelope>\n\n`.
 *
 * This module owns ONE long-lived session per process. We initialize
 * lazily on first use, then re-initialize transparently if the
 * upstream invalidates the session id (rare).
 *
 * Tools available (per server's `instructions` + tools/list):
 *   - fetch_grounding_rules    return citation/attribution rules + nonce
 *   - fetch_quran(verseKeys[]) canonical Arabic text
 *   - search_quran(query)
 *   - fetch_translation(slug, verseKeys[])
 *   - search_translation(query, lang)
 *   - fetch_tafsir(slug, verseKey)
 *   - search_tafsir(query, lang)
 *   - get_word_morphology(word | verseKey)
 *
 * Reference:
 *   https://github.com/quran/quran-mcp
 *   https://api-docs.quran.foundation/
 */

const ENDPOINT = process.env.QALAAM_MCP_QURAN_URL ?? 'https://mcp.quran.ai/';
const CLIENT_INFO = { name: 'qalaam', version: '0.1' };

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}
interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id: number | string;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
}

let sessionId: string | null = null;
let nextId = 1;
let initInFlight: Promise<void> | null = null;
let groundingNonce: string | null = null;

async function postRpc<T>(
  req: JsonRpcRequest,
  includeSession: boolean,
): Promise<JsonRpcResponse<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };
  if (includeSession && sessionId) headers['mcp-session-id'] = sessionId;
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify(req),
  });
  if (!res.ok && res.status !== 200) {
    throw new Error(`MCP HTTP ${res.status.toString()}`);
  }
  // Capture session id if returned (only on initialize).
  const sid = res.headers.get('mcp-session-id');
  if (sid) sessionId = sid;
  const ct = res.headers.get('content-type') ?? '';
  const raw = await res.text();
  // SSE stream — extract the FIRST `data: …` line.
  if (ct.includes('text/event-stream')) {
    const m = /^data:\s*(.+)$/m.exec(raw);
    if (!m?.[1]) throw new Error('MCP empty SSE');
    return JSON.parse(m[1]) as JsonRpcResponse<T>;
  }
  return JSON.parse(raw) as JsonRpcResponse<T>;
}

async function ensureInitialized(): Promise<void> {
  if (sessionId) return;
  if (initInFlight) {
    await initInFlight;
    return;
  }
  initInFlight = (async () => {
    const initRes = await postRpc<{ protocolVersion: string }>(
      {
        jsonrpc: '2.0',
        id: nextId++,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: CLIENT_INFO,
        },
      },
      false,
    );
    if (initRes.error) throw new Error(`MCP init: ${initRes.error.message}`);
    // Notify server we're ready (per MCP spec).
    try {
      await postRpc({ jsonrpc: '2.0', id: nextId++, method: 'notifications/initialized' }, true);
    } catch {
      /* notification can fail silently */
    }
    // Grab the grounding nonce — saves tokens on every tool call.
    try {
      const g = await postRpc<{ content: { text: string }[] }>(
        {
          jsonrpc: '2.0',
          id: nextId++,
          method: 'tools/call',
          params: { name: 'fetch_grounding_rules', arguments: {} },
        },
        true,
      );
      const text = g.result?.content[0]?.text;
      if (text) {
        const m = /grounding_nonce[":\s]+([a-z0-9-]+)/i.exec(text);
        if (m?.[1]) groundingNonce = m[1];
      }
    } catch {
      /* nonce is optional */
    }
  })();
  await initInFlight;
  initInFlight = null;
}

/**
 * Generic tool-call wrapper. Re-initializes once if the session is
 * stale (server returns code -32602 / -32600 for missing session).
 */
export async function mcpQuranTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  await ensureInitialized();
  const argsWithNonce: Record<string, unknown> = { ...args };
  if (groundingNonce) argsWithNonce.grounding_nonce = groundingNonce;

  const callOnce = async (): Promise<JsonRpcResponse> => {
    return postRpc(
      {
        jsonrpc: '2.0',
        id: nextId++,
        method: 'tools/call',
        params: { name: toolName, arguments: argsWithNonce },
      },
      true,
    );
  };

  let res = await callOnce();
  if (res.error && /session/i.test(res.error.message)) {
    sessionId = null;
    groundingNonce = null;
    await ensureInitialized();
    res = await callOnce();
  }
  if (res.error) throw new Error(`MCP ${toolName}: ${res.error.message}`);
  return res.result;
}

export interface McpToolsListResult {
  readonly tools: { name: string; description?: string; inputSchema?: unknown }[];
}

export async function mcpListTools(): Promise<McpToolsListResult> {
  await ensureInitialized();
  const res = await postRpc<McpToolsListResult>(
    { jsonrpc: '2.0', id: nextId++, method: 'tools/list' },
    true,
  );
  if (res.error) throw new Error(`MCP tools/list: ${res.error.message}`);
  return res.result ?? { tools: [] };
}
