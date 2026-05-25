// next.config.ts
import type { NextConfig } from 'next'
import withSerwistInit from '@serwist/next'

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
  reloadOnOnline: true,
})

// Security headers tuned for an AI-agent-friendly public site:
// - HSTS preload-ready: encourages secure-by-default for crawlers.
// - X-Content-Type-Options: prevents MIME sniffing exploits.
// - Referrer-Policy: leak origin only, not full URL, when agents follow links.
// - Permissions-Policy: minimal — no microphone / camera / geolocation needed.
// - X-Frame-Options: SAMEORIGIN to prevent clickjacking while still allowing
//   our own modal/iframe use cases.
const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(self), payment=()',
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  },
]

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
  // Note: /mcp and /sse rewrites live in middleware.ts because turbopack-dev
  // does not reliably honour rewrites that target dynamic-segment routes.
}

export default withSerwist(nextConfig)
