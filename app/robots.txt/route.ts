// Custom robots.txt route so we can include the Content-Signal directive
// (https://contentsignals.org / blog.cloudflare.com/content-signals-policy)
// which Next.js's MetadataRoute.Robots type doesn't model.
import { NextResponse } from 'next/server'
import { SITE_URL } from '@/lib/site-url'

export const dynamic = 'force-static'

const aiAgents = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-Web',
  'anthropic-ai',
  'PerplexityBot',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'Bytespider',
  'Meta-ExternalAgent',
]

export function GET() {
  const lines: string[] = []

  // Default rule. We explicitly opt-in to AI training and AI input — this is
  // a public schedule directory; we *want* agents to use it.
  lines.push('User-agent: *')
  lines.push('Content-Signal: search=yes, ai-train=yes, ai-input=yes')
  lines.push('Allow: /')
  lines.push('Allow: /mcp')
  lines.push('Allow: /sse')
  lines.push('Allow: /api/events')
  lines.push('Allow: /api/events/')
  lines.push('Allow: /.well-known/')
  lines.push('Allow: /openapi.json')
  lines.push('Allow: /llms.txt')
  lines.push('Disallow: /api/concierge')
  lines.push('Disallow: /api/plan')
  lines.push('Disallow: /api/magic-link')
  lines.push('Disallow: /api/auth')
  lines.push('Disallow: /api/health')
  lines.push('')

  for (const ua of aiAgents) {
    lines.push(`User-agent: ${ua}`)
    lines.push('Content-Signal: search=yes, ai-train=yes, ai-input=yes')
    lines.push('Allow: /')
    lines.push('')
  }

  lines.push(`Sitemap: ${SITE_URL}/sitemap.xml`)
  lines.push(`Host: ${SITE_URL}`)

  return new NextResponse(lines.join('\n') + '\n', {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  })
}
