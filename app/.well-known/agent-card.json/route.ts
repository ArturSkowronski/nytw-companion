// /.well-known/agent-card.json — A2A (Agent-to-Agent) Agent Card.
// Lets autonomous agents discover what skills this companion can offer them
// and how to invoke those skills (via the MCP endpoint).
import { NextResponse } from 'next/server'
import { SITE_URL } from '@/lib/site-url'

export const dynamic = 'force-static'

export function GET() {
  return NextResponse.json(
    {
      schemaVersion: '0.1.0',
      name: "NYTW Engineer's Companion",
      description:
        'An agent endpoint exposing the curated Tech Week NYC 2026 event catalogue. Built for humans (web UI) and AI agents (MCP). Use the MCP transport for programmatic access to 1,390 events spanning June 1–7, 2026.',
      url: SITE_URL,
      provider: {
        organization: 'VirtusLab',
        url: 'https://virtuslab.com',
      },
      version: '1.0.0',
      documentationUrl: `${SITE_URL}/about`,
      capabilities: {
        streaming: true,
        pushNotifications: false,
        stateTransitionHistory: false,
      },
      defaultInputModes: ['text'],
      defaultOutputModes: ['text', 'application/json'],
      skills: [
        {
          id: 'browse_events',
          name: 'Browse Tech Week NYC events',
          description: 'List, filter, and paginate the 1,390-event NYTW 2026 catalogue.',
          tags: ['events', 'calendar', 'browse'],
          examples: [
            'List all AI-infra events on Wednesday June 3',
            'Show me events hosted by Anthropic',
            'What hackathons are happening during Tech Week?',
          ],
        },
        {
          id: 'search_events',
          name: 'Search for specific events',
          description: 'Fuzzy text search across event titles, hosts, and descriptions.',
          tags: ['events', 'search'],
          examples: [
            'Find events about MCP / agentic AI',
            'Search for events in Williamsburg',
            'Events featuring Snyk or Cloudflare',
          ],
        },
        {
          id: 'plan_schedule',
          name: 'Plan a personalized schedule',
          description:
            'Combine browse / search with travel and conflict-awareness signals exposed by individual event records (start_at, ends_at, lat/lng, neighborhood) to build a 1-week plan.',
          tags: ['events', 'planning', 'scheduling'],
          examples: [
            'Plan my Tuesday around AI infra and devtools, returning to Manhattan after 8pm',
            'Pick 5 founder/VC dinners across the week, max 1 per day, prefer non-Williamsburg',
          ],
        },
      ],
      endpoints: {
        mcp: `${SITE_URL}/mcp`,
      },
    },
    {
      headers: {
        'cache-control': 'public, max-age=3600',
      },
    },
  )
}
