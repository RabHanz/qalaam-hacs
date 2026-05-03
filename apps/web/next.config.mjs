/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // React Compiler 1.0 (per §20.7 of strategy)
  experimental: {
    reactCompiler: true,
  },
  // Allow consuming workspace packages without re-bundling.
  transpilePackages: ['@qalaam/core', '@qalaam/types-ts', '@qalaam/api-client-ts'],
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
