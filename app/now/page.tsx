// app/now/page.tsx
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { NowClient } from '@/components/NowClient'
import type { Event } from '@/lib/types'
import { selectSeed } from '@/lib/seed-source'

export const metadata: Metadata = {
  title: "Now — NYTW Engineer's Companion",
  description: "What's next in your Tech Week plan.",
  alternates: { canonical: '/now' },
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

export default async function NowPage() {
  const events = await fetchEvents()

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-[#FAFAFA]">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="font-mono text-lg font-bold text-[#FAFAFA] mb-6">/now</h1>
        <NowClient events={events} />
      </div>
    </main>
  )
}
