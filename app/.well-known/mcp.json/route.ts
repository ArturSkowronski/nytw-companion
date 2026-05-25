// /.well-known/mcp.json — MCP Server Card.
// Discovery manifest for AI agents that scan well-known paths to find MCP
// endpoints (per isagentready.com Agent Protocols spec).
import { NextResponse } from 'next/server'
import { SITE_URL } from '@/lib/site-url'

export const dynamic = 'force-static'

export function GET() {
  return NextResponse.json(
    {
      schema_version: '2025-06-18',
      name: 'nytw-engineers-companion',
      display_name: "NYTW Engineer's Companion",
      description:
        'MCP server exposing the full Tech Week NYC 2026 event catalogue — 1,390 events scraped from tech-week.com and partiful.com, with curated tags. Use these tools to browse, search, and pull events for planning, scheduling, or recommendation use cases.',
      version: '1.0.0',
      vendor: 'VirtusLab',
      homepage: SITE_URL,
      contact: {
        url: `${SITE_URL}/about`,
      },
      license: 'MIT',
      transport: {
        type: 'streamable_http',
        url: `${SITE_URL}/mcp`,
      },
      sse_url: `${SITE_URL}/sse`,
      capabilities: {
        tools: true,
        resources: false,
        prompts: false,
      },
      tools: [
        {
          name: 'catalogue_stats',
          description: 'Counts by day / tag / format. Discovery entry point.',
        },
        {
          name: 'list_events',
          description: 'Paginate the full 1,390-event catalogue. Filters: day, tag, format, host substring.',
        },
        {
          name: 'search_events',
          description: 'Fuzzy text search across title / host / description / tags / neighborhood.',
        },
        {
          name: 'get_event',
          description: 'Full record for one event by id.',
        },
        {
          name: 'next_up',
          description: 'Events starting in the next N hours, NYC time.',
        },
      ],
      tags: ['events', 'nytw', 'tech-week-nyc', 'calendar', 'engineering', 'curation'],
    },
    {
      headers: {
        'cache-control': 'public, max-age=3600',
      },
    },
  )
}
