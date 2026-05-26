// GET /api/events/search?q=&limit= — REST mirror of MCP search_events tool.
import { NextResponse, type NextRequest } from 'next/server'
import { searchEvents } from '@/lib/events-api'

export const dynamic = 'force-dynamic'

export function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')
  if (!q || q.length < 2) {
    return NextResponse.json({ error: 'query must be at least 2 characters' }, { status: 400 })
  }
  const limit = req.nextUrl.searchParams.get('limit')
  const result = searchEvents(q, limit ? parseInt(limit, 10) : undefined)
  return NextResponse.json(result, {
    headers: { 'cache-control': 'public, max-age=60', 'access-control-allow-origin': '*' },
  })
}
