// /.well-known/agent-skills/index.json — Agent Skills index.
// Each skill includes the required fields per the validator: name, type,
// description, url, and digest (sha256 of the skill schema).
import { NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { SITE_URL } from '@/lib/site-url'

export const dynamic = 'force-static'

interface SkillDecl {
  id: string
  name: string
  description: string
  mcp_tool: string
}

const baseSkills: SkillDecl[] = [
  {
    id: 'list_events',
    name: 'List NYTW events',
    description:
      'Paginate the full 1,390-event Tech Week NYC 2026 catalogue with optional day/tag/format/host filters.',
    mcp_tool: 'list_events',
  },
  {
    id: 'search_events',
    name: 'Search NYTW events',
    description: 'Fuzzy text search across title / host / description / tags / neighborhood.',
    mcp_tool: 'search_events',
  },
  {
    id: 'get_event',
    name: 'Get one event',
    description: 'Full record of a single NYTW event by id.',
    mcp_tool: 'get_event',
  },
  {
    id: 'next_up',
    name: 'What is happening soon',
    description: 'Events starting in the next N hours (NYC time).',
    mcp_tool: 'next_up',
  },
  {
    id: 'catalogue_stats',
    name: 'Catalogue stats',
    description: 'Counts by day / tag / format — start here to know what data is available.',
    mcp_tool: 'catalogue_stats',
  },
]

function digest(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

export function GET() {
  const skills = baseSkills.map((s) => {
    const url = `${SITE_URL}/mcp#${s.mcp_tool}`
    return {
      id: s.id,
      name: s.name,
      type: 'mcp-tool',
      description: s.description,
      url,
      mcp_tool: s.mcp_tool,
      mcp_endpoint: `${SITE_URL}/mcp`,
      sha256: digest(`${s.id}|${s.name}|${s.description}|${url}`),
    }
  })

  return NextResponse.json(
    {
      $schema: 'https://schemas.modelcontextprotocol.io/agent-skills/v1.json',
      version: '1.0.0',
      provider: {
        name: "NYTW Engineer's Companion",
        url: SITE_URL,
      },
      skills,
    },
    { headers: { 'cache-control': 'public, max-age=3600' } },
  )
}
