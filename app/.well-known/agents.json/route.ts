// /.well-known/agents.json — agents.json spec (https://agents.json/).
// Describes what AI agents can do here and where the contracts live.
import { NextResponse } from 'next/server'
import { SITE_URL } from '@/lib/site-url'

export const dynamic = 'force-static'

export function GET() {
  return NextResponse.json(
    {
      $schema: 'https://agents.json/schema/v1',
      name: "NYTW Engineer's Companion",
      description:
        'Curated companion for Tech Week NYC 2026. AI agents can browse, search, and pull events via MCP. Web UI for humans.',
      version: '1.0.0',
      contact: {
        name: 'Artur Skowroński',
        url: `${SITE_URL}/about`,
      },
      apis: [
        {
          name: 'mcp',
          type: 'mcp',
          description: 'Model Context Protocol server for full event catalogue access (1,390 events).',
          url: `${SITE_URL}/mcp`,
          openapi: `${SITE_URL}/openapi.json`,
        },
      ],
      flows: [
        {
          id: 'discover_events',
          title: 'Discover Tech Week NYC events',
          description: 'Browse, filter, and search 1,390 NYTW 2026 events to build a personalised schedule.',
          steps: [
            { api: 'mcp', tool: 'catalogue_stats', purpose: 'List counts by day / tag / format to understand the data.' },
            { api: 'mcp', tool: 'list_events', purpose: 'Page through events filtered by day / tag / format / host.' },
            { api: 'mcp', tool: 'search_events', purpose: 'Fuzzy text search.' },
            { api: 'mcp', tool: 'get_event', purpose: 'Fetch the full record for one event.' },
          ],
        },
        {
          id: 'plan_now',
          title: 'What should I do next?',
          description: 'In-festival query — what is happening in the next few hours.',
          steps: [
            { api: 'mcp', tool: 'next_up', purpose: 'Events starting in the next N hours (NYC time).' },
          ],
        },
      ],
    },
    { headers: { 'cache-control': 'public, max-age=3600' } },
  )
}
