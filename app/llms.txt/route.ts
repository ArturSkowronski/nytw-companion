// /llms.txt — content discovery file for LLM crawlers.
// Spec: https://llmstxt.org/  — terse, markdown-ish guide pointing AI agents
// at the highest-signal entry points.

import { NextResponse } from 'next/server'
import { SITE_URL } from '@/lib/site-url'
import seedEvents from '@/data/seed-events.json' with { type: 'json' }
import allEvents from '@/data/all-events.json' with { type: 'json' }

export const dynamic = 'force-static'

export function GET() {
  const curated = (seedEvents as unknown[]).length
  const total = (allEvents as unknown[]).length
  const body = `# NYTW Engineer's Companion

> Curated companion for **Tech Week NYC 2026** (June 1–7, 2026). Built for engineers — and for AI agents.

Two views of the same event ecosystem:

- **Human UI** ships ${curated} curated events at ${SITE_URL}/events.
- **MCP server** exposes the full ${total}-event catalogue at ${SITE_URL}/api/mcp/mcp for agents that want to filter on their own.

## Quick links

- [Browse events](${SITE_URL}/events): day-grouped timeline, instant search, map view.
- [My Plan](${SITE_URL}/my-plan): user's saved schedule (browser-local, no auth).
- [AI Concierge](${SITE_URL}/plan): describe yourself, get 5-8 personalized event picks.
- [Beyond](${SITE_URL}/beyond): links to other Tech Week aggregators.
- [About](${SITE_URL}/about): how the curation pipeline works.

## For agents

- **MCP endpoint**: ${SITE_URL}/api/mcp/mcp (streamable HTTP transport).
- **MCP Server Card**: ${SITE_URL}/.well-known/mcp.json
- **A2A Agent Card**: ${SITE_URL}/.well-known/agent-card.json
- **Tools**: \`catalogue_stats\`, \`list_events\`, \`search_events\`, \`get_event\`, \`next_up\`. See \`/.well-known/mcp.json\` for descriptions.

## Data

- Source: tech-week.com (scraped) + partiful.com (enriched). All events June 1–7, 2026.
- ${total} total events, of which ${curated} pass the human-curation filter (two Claude Sonnet 4.5 passes that read every event description).
- Each event: title, host, description, ISO start/end times (NYC), neighborhood, lat/lng centroid, RSVP URL, tags (\`ai-infra\`, \`devtools\`, \`agentic-ai\`, etc.).
- No personal data, no analytics on agent queries.

## Honest limits

- We don't RSVP for you — agents and users alike must follow \`rsvp_url\` to Luma/Partiful.
- Editor's Picks are currently empty until manual curation.
- VirtusLab built this; we disclose any VirtusLab-hosted events with \`is_virtuslab_event: true\`.

— Artur Skowroński, VirtusLab
`
  return new NextResponse(body, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  })
}
