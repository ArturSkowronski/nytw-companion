import { NextResponse } from 'next/server'
import seedEvents from '@/data/seed-events.json' with { type: 'json' }
import { createClient } from '@/lib/supabase/server'
import { checkLimit } from '@/lib/rate-limit'
import { ConciergeRequestSchema, type Proposal } from '@/lib/concierge-schema'
import { generateProposals, MissingKeyError } from '@/lib/anthropic'
import { buildMockProposals } from '@/lib/concierge-mock'
import type { Event } from '@/lib/types'

const RATE_MAX = 5
const RATE_WINDOW_MS = 60 * 60 * 1000

async function fetchEvents(): Promise<Event[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return seedEvents as Event[]
  }
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('starts_at', { ascending: true })
    if (error || !data) return []
    return data as Event[]
  } catch {
    return []
  }
}

function ipFromRequest(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  const real = request.headers.get('x-real-ip')
  if (real) return real
  return 'unknown'
}

async function logConcierge(args: {
  profile_text: string
  proposals: Proposal[]
  promptTokens?: number
  completionTokens?: number
}): Promise<void> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return
  try {
    const supabase = await createClient()
    await supabase.from('concierge_logs').insert({
      profile_text: args.profile_text,
      recommended_event_ids: args.proposals.map((p) => p.event_id),
      prompt_tokens: args.promptTokens ?? null,
      completion_tokens: args.completionTokens ?? null,
    })
  } catch (err) {
    console.warn('concierge_logs insert failed', err)
  }
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = ConciergeRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }
  const { profile_text, existing_event_ids } = parsed.data

  const ip = ipFromRequest(request)
  const limit = checkLimit(ip, RATE_MAX, RATE_WINDOW_MS)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfterMs: limit.retryAfterMs },
      { status: 429 },
    )
  }

  const events = await fetchEvents()
  const existing = new Set(existing_event_ids)
  const candidates = events.filter((e) => !existing.has(e.id))

  let proposals: Proposal[]
  let notes: string | null
  let usage: { promptTokens?: number; completionTokens?: number } = {}

  try {
    const result = await generateProposals(profile_text, candidates)
    proposals = result.proposals
    notes = result.notes
    usage = result.usage
  } catch (err) {
    if (err instanceof MissingKeyError) {
      const mock = buildMockProposals(candidates, 5)
      proposals = mock.proposals
      notes = mock.notes
    } else {
      console.error('Concierge generation failed', err)
      return NextResponse.json(
        { error: 'Concierge unavailable, please try again' },
        { status: 500 },
      )
    }
  }

  // Drop proposals pointing to non-existent events (defense in depth)
  const eventIds = new Set(events.map((e) => e.id))
  proposals = proposals.filter((p) => eventIds.has(p.event_id))

  // Best-effort logging — never blocks the response
  void logConcierge({
    profile_text,
    proposals,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
  })

  return NextResponse.json({ proposals, notes })
}
