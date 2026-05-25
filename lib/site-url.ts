// Public origin used in metadata, OG images, well-known files, sitemap, etc.
// Resolution order:
//   1. NEXT_PUBLIC_SITE_URL                 — explicit override (custom domain)
//   2. NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL — Vercel canonical prod alias
//   3. VERCEL_PROJECT_PRODUCTION_URL        — server-only equivalent
//   4. NEXT_PUBLIC_VERCEL_URL / VERCEL_URL  — per-deploy preview URL (may be unstable)
//   5. http://localhost:3000                — local dev fallback
function withScheme(host: string): string {
  if (host.startsWith('http://') || host.startsWith('https://')) return host
  return `https://${host}`
}

const candidates = [
  process.env.NEXT_PUBLIC_SITE_URL,
  process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL,
  process.env.VERCEL_PROJECT_PRODUCTION_URL,
  process.env.NEXT_PUBLIC_VERCEL_URL,
  process.env.VERCEL_URL,
]
const first = candidates.map((c) => c?.trim()).find((c) => c && c.length > 0)
const raw = first ? withScheme(first) : 'http://localhost:3000'

export const SITE_URL = raw.replace(/\/$/, '')
