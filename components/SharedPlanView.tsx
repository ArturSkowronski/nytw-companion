'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { SharedPlanEventCard } from '@/components/SharedPlanEventCard'
import { groupEventsByDay, formatDayHeading } from '@/lib/events'
import { usePlanStore } from '@/lib/plan-store'
import type { Event } from '@/lib/types'

interface SharedPlanViewProps {
  ids: string[]
  senderName: string | undefined
  allEvents: Event[]
}

export function SharedPlanView({ ids, senderName, allEvents }: SharedPlanViewProps) {
  const items = usePlanStore((s) => s.items)

  const { events, dropped } = useMemo(() => {
    const byId = new Map(allEvents.map((e) => [e.id, e]))
    const resolved: Event[] = []
    let missing = 0
    for (const id of ids) {
      const event = byId.get(id)
      if (event) resolved.push(event)
      else missing++
    }
    resolved.sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    return { events: resolved, dropped: missing }
  }, [ids, allEvents])

  const inPlanIds = useMemo(() => new Set(items.map((i) => i.event_id)), [items])
  const grouped = useMemo(() => groupEventsByDay(events), [events])
  const dayKeys = Object.keys(grouped).sort()

  const headerName = senderName?.trim()
  const headerTitle = headerName ? `${headerName}'s NYTW plan` : 'Shared NYTW plan'

  if (ids.length === 0) {
    return (
      <div className="bg-[#0B0B0B] border border-[#1A1A1A] rounded-md p-8 text-center">
        <p className="font-mono text-sm text-[#9B9B9B] mb-4">This share link is empty.</p>
        <Link href="/events" className="font-mono text-xs text-[#FF5B25] underline">
          Browse all events →
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="font-mono text-2xl font-bold text-[#F5F5F5]">{headerTitle}</p>
        <p className="text-xs text-[#9B9B9B] font-mono mt-1">{events.length} events</p>
      </header>

      <div className="relative pl-4">
        {dayKeys.map((dayKey) => (
          <section key={dayKey} className="mb-10">
            <h2 className="sticky top-0 z-10 bg-[#000000] border-b border-[#1A1A1A] py-3 mb-4 font-mono font-bold text-[#F5F5F5] text-lg">
              {formatDayHeading(dayKey)}
            </h2>
            <div className="grid gap-1">
              {grouped[dayKey].map((event) => (
                <SharedPlanEventCard
                  key={event.id}
                  event={event}
                  alreadyInPlan={inPlanIds.has(event.id)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {dropped > 0 && (
        <p className="text-xs text-[#737373] font-mono italic">
          {dropped} event{dropped === 1 ? '' : 's'} from this plan{' '}
          {dropped === 1 ? 'is' : 'are'} no longer available.
        </p>
      )}
    </div>
  )
}
