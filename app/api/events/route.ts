// GET /api/events — REST mirror of the MCP list_events tool.
import { NextResponse, type NextRequest } from 'next/server'
import { listEvents } from '@/lib/events-api'

export const dynamic = 'force-dynamic'

export function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const result = listEvents({
    day: sp.get('day') ?? undefined,
    tag: sp.get('tag') ?? undefined,
    format: sp.get('format') ?? undefined,
    hostContains: sp.get('host_contains') ?? undefined,
    limit: sp.get('limit') ? parseInt(sp.get('limit')!, 10) : undefined,
    offset: sp.get('offset') ? parseInt(sp.get('offset')!, 10) : undefined,
  })
  return NextResponse.json(result, {
    headers: {
      'cache-control': 'public, max-age=300, s-maxage=600',
      'access-control-allow-origin': '*',
    },
  })
}
