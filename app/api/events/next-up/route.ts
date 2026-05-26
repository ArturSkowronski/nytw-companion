// GET /api/events/next-up?hours=&limit= — REST mirror of MCP next_up tool.
import { NextResponse, type NextRequest } from 'next/server'
import { nextUp } from '@/lib/events-api'

export const dynamic = 'force-dynamic'

export function GET(req: NextRequest) {
  const hoursParam = req.nextUrl.searchParams.get('hours')
  const limitParam = req.nextUrl.searchParams.get('limit')
  const result = nextUp(
    hoursParam ? parseFloat(hoursParam) : undefined,
    limitParam ? parseInt(limitParam, 10) : undefined,
  )
  return NextResponse.json(result, {
    headers: { 'cache-control': 'no-store', 'access-control-allow-origin': '*' },
  })
}
