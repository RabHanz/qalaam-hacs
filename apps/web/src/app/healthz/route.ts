/**
 * /healthz — liveness probe for the qalaam-web container.
 *
 * Sits OUTSIDE the /api/* rewrite chain so Traefik (and any external
 * uptime monitor) can verify the web process is up without depending
 * on the backend container being reachable. Returns 200 + small JSON
 * payload; never throws.
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function GET(): NextResponse {
  return NextResponse.json({
    status: 'ok',
    service: 'qalaam-web',
    timestamp: new Date().toISOString(),
  });
}
