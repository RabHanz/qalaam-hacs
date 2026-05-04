/**
 * API base resolution that works in BOTH server and client contexts.
 *
 * - Server-side (RSC, route handlers): hit the backend directly via
 *   PUBLIC_API_URL or the localhost dev fallback. Bypasses the proxy
 *   so SSR doesn't add a hop.
 * - Client-side: use the same-origin "/api" rewrite that next.config.mjs
 *   proxies to the backend. Same-origin fetches dodge CORS entirely;
 *   the backend's allowed-origin list never has to know about the web
 *   app's hostname (works for localhost, deploy preview URLs, mobile
 *   IP, etc.).
 *
 * The single resolveApiBase() helper means components don't have to
 * branch on typeof window.
 */
export function resolveApiBase(): string {
  if (typeof window === 'undefined') {
    return process.env.PUBLIC_API_URL ?? 'http://localhost:4111';
  }
  // Same-origin path that next.config.mjs rewrites to the backend.
  return '/api';
}

/**
 * Server-only base — never used from the browser. Use this in server
 * components that want to skip the proxy hop.
 */
export const SERVER_API_BASE: string =
  typeof window === 'undefined'
    ? process.env.PUBLIC_API_URL ?? 'http://localhost:4111'
    : '/api';
