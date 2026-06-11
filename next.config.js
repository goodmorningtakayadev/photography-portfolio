/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: new URL(process.env.NEXT_PUBLIC_CDN_URL || 'https://placeholder.com').hostname,
      },
    ],
  },
  async headers() {
    // Baseline hardening headers on every response. No CSP: the admin UI
    // relies on inline style attributes, so a strict style-src would force
    // 'unsafe-inline' (no real gain) or a refactor (visual-regression risk).
    // These five are zero-risk and add no latency.
    const securityHeaders = [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
      },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=()',
      },
    ];

    // Hand-placed static assets are content-addressed by convention (a new
    // asset gets a new filename), so repeat visits can cache hard.
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        source: '/hero/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/about/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/photos/optimized/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=604800' },
        ],
      },
    ];
  },
};

export default nextConfig;
