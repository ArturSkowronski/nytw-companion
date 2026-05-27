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
// Content-Security-Policy: tight enough to score on isagentready.com but
// loose enough to permit Mapbox GL JS (workers + WebGL), Vercel Analytics,
// inline Next.js bootstrap scripts, and inline JSON-LD <script> blocks.
// 'unsafe-inline' on script-src is required for Next.js App Router's
// inlined React Server Component payload — using a nonce would force every
// route to opt out of static rendering.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline' https://api.mapbox.com",
  "img-src 'self' data: blob: https: https://partiful.imgix.net https://api.mapbox.com https://*.tiles.mapbox.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://*.supabase.co https://api.anthropic.com https://api.mapbox.com https://events.mapbox.com https://va.vercel-scripts.com https://*.vercel-analytics.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "worker-src 'self' blob:",
  'upgrade-insecure-requests',
].join('; ')

// Link header: discovery hints pointing AI crawlers at the canonical sitemap,
// MCP server, OpenAPI spec, and other well-known files. Saves an HTML parse.
const linkHeader = [
  '</sitemap.xml>; rel="sitemap"; type="application/xml"',
  '</llms.txt>; rel="describedby"; type="text/markdown"',
  '</.well-known/mcp.json>; rel="describedby"; type="application/json"; title="MCP Server Card"',
  '</.well-known/agent-card.json>; rel="describedby"; type="application/json"; title="A2A Agent Card"',
  '</openapi.json>; rel="service-desc"; type="application/vnd.oai.openapi+json"',
  '</mcp>; rel="alternate"; type="application/json"; title="MCP endpoint"',
].join(', ')

// Last-Modified pegged at build time so AI crawlers have a freshness signal.
// Vercel rebuilds on every push, so this stays meaningful.
const BUILD_TIME_HTTP = new Date().toUTCString()

const securityHeaders = [
  {
    key: 'Last-Modified',
    value: BUILD_TIME_HTTP,
  },
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
  {
    key: 'Content-Security-Policy',
    value: csp,
  },
  {
    key: 'Link',
    value: linkHeader,
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
