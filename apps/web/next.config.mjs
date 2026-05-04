/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
  // Per CLAUDE.md §11.2 design non-negotiable: explicit headers.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
