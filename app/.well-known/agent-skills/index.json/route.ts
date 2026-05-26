// /.well-known/agent-skills/index.json — Agent Skills index.
// Catalogue of capabilities other agents can compose with.
import { NextResponse } from 'next/server'
import { SITE_URL } from '@/lib/site-url'

export const dynamic = 'force-static'

export function GET() {
  return NextResponse.json(
    {
      $schema: 'https://agent-skills.org/schema/v1.json',
      version: '1.0.0',
      provider: {
        name: "NYTW Engineer's Companion",
        url: SITE_URL,
      },
      skills: [
        {
          id: 'list_events',
          name: 'List NYTW events',
          description:
            'Paginate the full 1,390-event Tech Week NYC 2026 catalogue with optional day/tag/format/host filters.',
          mcp_tool: 'list_events',
          mcp_endpoint: `${SITE_URL}/mcp`,
        },
        {
          id: 'search_events',
          name: 'Search NYTW events',
          description: 'Fuzzy text search across title / host / description / tags / neighborhood.',
          mcp_tool: 'search_events',
          mcp_endpoint: `${SITE_URL}/mcp`,
        },
        {
          id: 'get_event',
          name: 'Get one event',
          description: 'Full record of a single NYTW event by id.',
          mcp_tool: 'get_event',
          mcp_endpoint: `${SITE_URL}/mcp`,
        },
        {
          id: 'next_up',
          name: 'What is happening soon',
          description: 'Events starting in the next N hours (NYC time).',
          mcp_tool: 'next_up',
          mcp_endpoint: `${SITE_URL}/mcp`,
        },
        {
          id: 'catalogue_stats',
          name: 'Catalogue stats',
          description: 'Counts by day / tag / format — start here to know what data is available.',
          mcp_tool: 'catalogue_stats',
          mcp_endpoint: `${SITE_URL}/mcp`,
        },
      ],
    },
    { headers: { 'cache-control': 'public, max-age=3600' } },
  )
}
