// app/events/page.tsx
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { EventList } from '@/components/EventList'
import { ViewToggle } from '@/components/ViewToggle'
import { EventsMapClient } from '@/components/EventsMapClient'
import type { Event } from '@/lib/types'
import type { DayKey } from '@/lib/time'
import { dayKeyForDate, festivalMode, nowInNYC } from '@/lib/time'
import { selectSeed } from '@/lib/seed-source'

export const metadata: Metadata = {
  title: "Browse Events — NYTW Engineer's Companion",
  description: 'LLM-curated engineering events for Tech Week NYC 2026. Day-grouped timeline with instant search — also browsable by AI agents via MCP.',
  alternates: { canonical: '/events' },
}

export const revalidate = 3600

const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

async function fetchEvents(): Promise<Event[]> {
  // Dev fallback: when Supabase env is unset, load from local seed JSON
  // so the UI is demo-able without a real database.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return selectSeed()
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

function resolveDay(raw: string | undefined): DayKey {
  if (raw && (DAY_KEYS as string[]).includes(raw)) return raw as DayKey
  const mode = festivalMode(new Date())
  if (mode === 'pre') return 'mon'
  if (mode === 'post') return 'sun'
  return dayKeyForDate(nowInNYC())
}

interface EventsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function EventsPage({ searchParams }: EventsPageProps) {
  const events = await fetchEvents()
  const sp = await searchParams
  const view = sp.view === 'map' ? 'map' : 'timeline'
  const dayParam = typeof sp.day === 'string' ? sp.day : undefined
  const initialDay = resolveDay(dayParam)

  return (
    <main className="min-h-screen bg-[#000000] text-[#F5F5F5]">
      <div className="max-w-5xl mx-auto px-6 py-4 border-b border-[#1A1A1A] flex items-center justify-between gap-4 flex-wrap">
        <p className="text-[#9B9B9B] text-xs font-mono">
          {events.length} curated events · Tech Week NYC 2026 · June 1–7
        </p>
        <ViewToggle />
      </div>
      <div className="max-w-5xl mx-auto px-6 py-8">
        {view === 'map' ? (
          <EventsMapClient events={events} initialDay={initialDay} />
        ) : (
          <EventList events={events} />
        )}
      </div>
    </main>
  )
}
