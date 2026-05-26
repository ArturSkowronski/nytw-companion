// GET /api/events/{id} — REST mirror of the MCP get_event tool.
import { NextResponse } from 'next/server'
import { eventToJson, getEvent } from '@/lib/events-api'

export const dynamic = 'force-static'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ev = getEvent(id)
  if (!ev) return NextResponse.json({ error: 'not_found', id }, { status: 404 })
  return NextResponse.json(eventToJson(ev), {
    headers: {
      'cache-control': 'public, max-age=3600',
      'access-control-allow-origin': '*',
    },
  })
}
