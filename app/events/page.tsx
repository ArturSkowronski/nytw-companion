// app/events/page.tsx
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { EventList } from '@/components/EventList'
import type { Event } from '@/lib/types'

export const metadata: Metadata = {
  title: "Browse Events — NYTW Engineer's Companion",
  description: '87 hand-curated engineering events for Tech Week NYC 2026. Day-grouped timeline with instant search.',
}

// Revalidate every hour; Supabase data doesn't change frequently
export const revalidate = 3600

export default async function EventsPage() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('starts_at', { ascending: true })

  const events: Event[] = error || !data ? [] : data

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-[#FAFAFA]">
      {/* Page header */}
      <div className="border-b border-[#1A1A1A] px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-mono font-bold text-[#FAFAFA] text-xl">
              NYTW Engineer&apos;s Companion
            </h1>
            <p className="text-[#A3A3A3] text-xs font-mono mt-0.5">
              {events.length} curated events · Tech Week NYC 2026 · June 1–7
            </p>
          </div>
          <nav className="flex gap-4 text-sm">
            <a href="/" className="text-[#A3A3A3] hover:text-[#FAFAFA] font-mono">Home</a>
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <EventList events={events} />
      </div>
    </main>
  )
}
