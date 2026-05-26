// /.well-known/api-catalog — RFC 9727 well-known URI for API catalog.
// Lists the discoverable API surfaces of this site so agents don't have to
// guess endpoints.
import { NextResponse } from 'next/server'
import { SITE_URL } from '@/lib/site-url'

export const dynamic = 'force-static'

export function GET() {
  // RFC 9727 specifies a "service-desc" / "linkset" payload pointing at each
  // API description. We return a linkset-compatible JSON list.
  const body = {
    linkset: [
      {
        anchor: SITE_URL,
        'service-desc': [
          {
            href: `${SITE_URL}/openapi.json`,
            type: 'application/vnd.oai.openapi+json',
            title: 'OpenAPI 3.1 — NYTW Companion REST surface mirroring the MCP tools',
          },
          {
            href: `${SITE_URL}/.well-known/mcp.json`,
            type: 'application/json',
            title: 'MCP Server Card — JSON-RPC over streamable HTTP at /mcp',
          },
          {
            href: `${SITE_URL}/.well-known/agent-card.json`,
            type: 'application/json',
            title: 'A2A Agent Card — capabilities / skills overview',
          },
          {
            href: `${SITE_URL}/.well-known/agents.json`,
            type: 'application/json',
            title: 'agents.json — flow- and tool-level discovery for AI agents',
          },
        ],
      },
    ],
  }
  return NextResponse.json(body, {
    headers: {
      'cache-control': 'public, max-age=3600',
      'content-type': 'application/linkset+json',
    },
  })
}
