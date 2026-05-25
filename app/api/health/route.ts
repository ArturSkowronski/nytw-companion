import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type CheckStatus = 'ok' | 'skipped' | 'fail'

async function checkSupabase(): Promise<CheckStatus> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return 'skipped'
  try {
    const supabase = await createClient()
    const query = supabase.from('events').select('id').limit(1)
    const timeout = new Promise<{ error: { message: string } }>((resolve) =>
      setTimeout(() => resolve({ error: { message: 'timeout' } }), 2000)
    )
    const result = (await Promise.race([query, timeout])) as { error: unknown }
    return result.error ? 'fail' : 'ok'
  } catch {
    return 'fail'
  }
}

function checkAnthropic(): CheckStatus {
  return process.env.ANTHROPIC_API_KEY ? 'ok' : 'skipped'
}

export async function GET() {
  const checks = {
    supabase: await checkSupabase(),
    anthropic: checkAnthropic(),
  }
  const hasFailure = Object.values(checks).includes('fail')
  const status: 'ok' | 'degraded' = hasFailure ? 'degraded' : 'ok'
  const body = {
    status,
    timestamp: new Date().toISOString(),
    checks,
    version: process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev',
  }
  return NextResponse.json(body, { status: hasFailure ? 503 : 200 })
}
