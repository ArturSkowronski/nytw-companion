// app/plan/page.tsx
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { ConciergeClient } from '@/components/ConciergeClient'
import type { Event } from '@/lib/types'
import { selectSeed } from '@/lib/seed-source'

export const metadata: Metadata = {
  title: "Plan with AI — NYTW Engineer's Companion",
  description: 'Describe yourself; AI picks 5–8 events for you.',
  alternates: { canonical: '/plan' },
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

export default async function PlanPage() {
  const events = await fetchEvents()

  return (
    <main className="min-h-screen bg-[#000000] text-[#F5F5F5]">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <header className="mb-8">
          <p className="font-mono text-2xl font-bold text-[#F5F5F5]">Plan with AI</p>
          <p className="text-sm text-[#9B9B9B] mt-1">
            Describe what you&rsquo;re looking for. Claude picks 5–8 events you&rsquo;d like.
          </p>
        </header>
        <ConciergeClient events={events} />
      </div>
    </main>
  )
}
