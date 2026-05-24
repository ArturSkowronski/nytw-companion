// app/my-plan/page.tsx
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { MyPlanClient } from '@/components/MyPlanClient'
import type { Event } from '@/lib/types'
import type { DayKey } from '@/lib/time'
import { dayKeyForDate, festivalMode, nowInNYC } from '@/lib/time'
import seedEvents from '@/data/seed-events.json' with { type: 'json' }

export const metadata: Metadata = {
  title: "My Plan — NYTW Engineer's Companion",
  description: 'Your hand-picked schedule for Tech Week NYC 2026.',
  alternates: { canonical: '/my-plan' },
}

export const revalidate = 3600

const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

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

function resolveDay(raw: string | undefined): DayKey {
  if (raw && (DAY_KEYS as string[]).includes(raw)) return raw as DayKey
  const mode = festivalMode(new Date())
  if (mode === 'pre') return 'mon'
  if (mode === 'post') return 'sun'
  return dayKeyForDate(nowInNYC())
}

interface MyPlanPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function MyPlanPage({ searchParams }: MyPlanPageProps) {
  const events = await fetchEvents()
  const sp = await searchParams
  const initialTab: 'timeline' | 'map' = sp.tab === 'map' ? 'map' : 'timeline'
  const dayParam = typeof sp.day === 'string' ? sp.day : undefined
  const initialDay = resolveDay(dayParam)

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-[#FAFAFA]">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <MyPlanClient events={events} initialTab={initialTab} initialDay={initialDay} />
      </div>
    </main>
  )
}
