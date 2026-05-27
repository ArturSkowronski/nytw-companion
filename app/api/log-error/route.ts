import { NextResponse } from 'next/server'
import { z } from 'zod'

const PayloadSchema = z.object({
  message: z.string().min(1).max(4096),
  stack: z.string().max(4096).optional(),
  url: z.string().max(2048).optional(),
  userAgent: z.string().max(1024).optional(),
  kind: z.enum(['boundary', 'window', 'rejection']),
})

export async function POST(request: Request): Promise<Response> {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = PayloadSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }
  console.error('[client-error]', JSON.stringify(parsed.data))
  return new NextResponse(null, { status: 204 })
}

export async function GET(): Promise<Response> {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
