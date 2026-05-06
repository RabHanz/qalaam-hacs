/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Standalone output bundles the Node server + minimal node_modules
  // into `.next/standalone/` so the production Docker image ships with
  // `node server.js` and ~80% smaller footprint than copying the full
  // repo. Required by `infrastructure/docker/Dockerfile.web`.
  output: 'standalone',
  // pnpm monorepo: the standalone tracer needs the workspace root so
  // it can hoist transitive deps from packages/* and node_modules.
  outputFileTracingRoot: new URL('../..', import.meta.url).pathname,
  // Allow `.js` ESM imports to resolve to `.ts(x)` source files (matches
  // tsconfig moduleResolution: Bundler). Without this Webpack errors on
  // every `import { X } from './foo.js'` whose source is `foo.tsx`.
  webpack(config) {
    config.resolve = config.resolve || {};
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias || {}),
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },
  // React Compiler 1.0 (per §20.7 of strategy) — only set when the env
  // flag is on; otherwise omit the key entirely so Next doesn't try to
  // resolve the babel plugin.
  experimental: process.env.QALAAM_REACT_COMPILER === '1' ? { reactCompiler: true } : {},
  // Allow consuming workspace packages without re-bundling.
  transpilePackages: [
    '@qalaam/core',
    '@qalaam/types-ts',
    '@qalaam/api-client-ts',
    '@qalaam/ui',
    '@qalaam/ui-hifdh',
    '@qalaam/ui-quran',
    '@qalaam/ui-recite',
    '@qalaam/ui-learn',
    '@qalaam/curriculum',
  ],
  // Proxy /api/v1/* → backend so client-side fetches stay same-origin
  // (sidesteps CORS without weakening the backend's allowed-origin
  // policy). Server-side fetches still hit the backend directly via
  // PUBLIC_API_URL since they don't go through the browser.
  //
  // /api/internal/* is intentionally NOT proxied — internal-only routes
  // (admin, debug) must never be reachable from the browser. The :path*
  // capture in the public rule still matches everything under /api so
  // callers can't bypass it; the internal block returns 404 first.
  async rewrites() {
    const apiTarget = process.env.PUBLIC_API_URL ?? 'http://localhost:4111';
    return {
      beforeFiles: [
        // Explicit deny — anything routing through /api/internal/* gets
        // a same-origin 404 before it reaches the backend.
        { source: '/api/internal/:path*', destination: '/404' },
      ],
      afterFiles: [{ source: '/api/:path*', destination: `${apiTarget}/:path*` }],
      fallback: [],
    };
  },
  // Per CLAUDE.md §11.2 design non-negotiable: explicit headers.
  // Permissions-Policy notes:
  //   - geolocation=(self): /salah needs lat/lon for prayer times
  //   - microphone=(self): /recite + /hifz-check need mic for ASR
  //   - camera=():        no camera surface today; closed
  async headers() {
    const baseHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      {
        key: 'Permissions-Policy',
        value:
          'camera=(), microphone=(self), geolocation=(self), accelerometer=(self), gyroscope=(self)',
      },
    ];
    // HSTS only in prod — dev runs over plain HTTP.
    if (process.env.NODE_ENV === 'production') {
      baseHeaders.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
      });
    }
    return [
      // Apply to the entire app surface
      { source: '/:path*', headers: baseHeaders },
      // Allow audio asset prefetch from the QUL CDN — the backend
      // returns audio_url pointing to verses.quran.com (Quran.com CDN);
      // the browser fetches them directly. Explicit Cache-Control on
      // the proxied /api responses is forwarded from the backend, but
      // we set a sensible client-side default for static assets.
      {
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

export default nextConfig;
