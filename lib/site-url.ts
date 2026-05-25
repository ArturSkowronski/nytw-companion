// Public origin used in metadata, OG images, well-known files, sitemap, etc.
// Resolution order:
//   1. NEXT_PUBLIC_SITE_URL — explicit override (preferred for prod custom domains)
//   2. NEXT_PUBLIC_VERCEL_URL — auto-injected by Vercel on every deploy
//   3. VERCEL_URL — server-side equivalent on Vercel
//   4. http://localhost:3000 — local dev fallback
const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim()
const vercelPublic = process.env.NEXT_PUBLIC_VERCEL_URL?.trim()
const vercelServer = process.env.VERCEL_URL?.trim()

function withScheme(host: string): string {
  if (host.startsWith('http://') || host.startsWith('https://')) return host
  return `https://${host}`
}

const raw =
  explicit ??
  (vercelPublic ? withScheme(vercelPublic) : undefined) ??
  (vercelServer ? withScheme(vercelServer) : undefined) ??
  'http://localhost:3000'

export const SITE_URL = raw.replace(/\/$/, '')
