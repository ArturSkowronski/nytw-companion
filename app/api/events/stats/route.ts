// GET /api/events/stats — REST mirror of MCP catalogue_stats tool.
import { NextResponse } from 'next/server'
import { catalogueStats } from '@/lib/events-api'

export const dynamic = 'force-static'

export function GET() {
  return NextResponse.json(catalogueStats(), {
    headers: { 'cache-control': 'public, max-age=3600', 'access-control-allow-origin': '*' },
  })
}
