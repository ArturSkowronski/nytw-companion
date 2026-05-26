import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { selectSeed } from '@/lib/seed-source'
import { SharedPlanClient } from './SharedPlanClient'
import type { Event } from '@/lib/types'

export const metadata: Metadata = {
  title: "Shared plan — NYTW Engineer's Companion",
  description: 'A friend shared their Tech Week NYC 2026 plan with you.',
  alternates: { canonical: '/plan/share' },
}

export const revalidate = 3600

async function fetchEvents(): Promise<Event[]> {
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

export default async function SharedPlanPage() {
  const events = await fetchEvents()
  return (
    <main className="min-h-screen bg-[#000000] text-[#F5F5F5]">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <SharedPlanClient allEvents={events} />
      </div>
    </main>
  )
}
