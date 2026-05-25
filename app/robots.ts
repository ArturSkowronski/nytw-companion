import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site-url'

// Default rule blocks /api/ to keep server-action routes out of search indices,
// but explicitly allows /api/mcp/ (the MCP server) and /.well-known/ (agent
// discovery) for AI crawlers. AI-specific user agents are listed by name so
// they get the same allow surface — no opt-out for GPTBot / ClaudeBot etc.
export default function robots(): MetadataRoute.Robots {
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
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/api/mcp/', '/.well-known/'],
        disallow: ['/api/'],
      },
      ...aiAgents.map((userAgent) => ({
        userAgent,
        allow: ['/'],
      })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
