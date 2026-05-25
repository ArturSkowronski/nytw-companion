'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { usePlanStore } from '@/lib/plan-store'
import { detectConflicts } from '@/lib/conflicts'
import { MyPlanEmptyState } from '@/components/MyPlanEmptyState'
import { MyPlanTimeline } from '@/components/MyPlanTimeline'
import { MyPlanMapLoader } from '@/components/MyPlanMapLoader'
import { IcalDownloadButton } from '@/components/IcalDownloadButton'
import type { Event, PlanItem } from '@/lib/types'
import type { DayKey } from '@/lib/time'

type Tab = 'timeline' | 'map'

interface MyPlanClientProps {
  events: Event[]
  initialTab: Tab
  initialDay: DayKey
}

function statusCounts(items: PlanItem[]) {
  return {
    confirmed: items.filter((i) => i.status === 'confirmed').length,
    pending: items.filter((i) => i.status === 'rsvp_pending').length,
    waitlist: items.filter((i) => i.status === 'waitlist').length,
    interested: items.filter((i) => i.status === 'interested').length,
    declined: items.filter((i) => i.status === 'declined').length,
    attended: items.filter((i) => i.status === 'attended').length,
  }
}

export function MyPlanClient({ events, initialTab, initialDay }: MyPlanClientProps) {
  const [mounted, setMounted] = useState(false)
  const items = usePlanStore((s) => s.items)
  const router = useRouter()
  const params = useSearchParams()
  const pathname = usePathname()

  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard SSR hydration guard
  useEffect(() => setMounted(true), [])

  const tab: Tab = params.get('tab') === 'map' ? 'map' : initialTab === 'map' ? 'map' : 'timeline'

  function setTab(next: Tab) {
    const updated = new URLSearchParams(params.toString())
    if (next === 'map') updated.set('tab', 'map')
    else updated.delete('tab')
    const qs = updated.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const eventById = useMemo(() => {
    const m = new Map<string, Event>()
    for (const e of events) m.set(e.id, e)
    return m
  }, [events])

  const planEvents = useMemo(() => {
    return items
      .map((item) => {
        const event = eventById.get(item.event_id)
        return event ? { item, event } : null
      })
      .filter((p): p is { item: PlanItem; event: Event } => p !== null)
  }, [items, eventById])

  const conflicts = useMemo(() => detectConflicts(items, events), [items, events])
  const counts = statusCounts(items)

  if (!mounted) {
    return (
      <div className="bg-[#111111] border border-[#1A1A1A] rounded-md p-6">
        <p className="font-mono text-sm text-[#7A7A7A]">Loading…</p>
      </div>
    )
  }

  if (planEvents.length === 0) {
    return <MyPlanEmptyState />
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-mono text-2xl font-bold text-[#FAFAFA]">Your plan</p>
          <p className="text-xs text-[#A3A3A3] font-mono mt-1">
            {planEvents.length} events ·{' '}
            {counts.confirmed} confirmed · {counts.pending} pending ·{' '}
            {counts.waitlist} waitlist · {counts.interested} interested
          </p>
        </div>
        <IcalDownloadButton items={items} events={events} />
      </header>

      <div
        className="inline-flex rounded-md border border-[#2A2A2A] bg-[#111111] p-0.5"
        role="group"
        aria-label="Tab"
      >
        <button
          type="button"
          aria-pressed={tab === 'timeline'}
          onClick={() => setTab('timeline')}
          className={
            `font-mono text-xs px-3 py-1.5 rounded transition-colors ` +
            (tab === 'timeline' ? 'bg-[#FF6B35] text-white' : 'text-[#A3A3A3] hover:text-[#FAFAFA]')
          }
        >
          Timeline
        </button>
        <button
          type="button"
          aria-pressed={tab === 'map'}
          onClick={() => setTab('map')}
          className={
            `font-mono text-xs px-3 py-1.5 rounded transition-colors ` +
            (tab === 'map' ? 'bg-[#FF6B35] text-white' : 'text-[#A3A3A3] hover:text-[#FAFAFA]')
          }
        >
          Map
        </button>
      </div>

      {tab === 'timeline' ? (
        <MyPlanTimeline planEvents={planEvents} conflicts={conflicts} />
      ) : (
        <MyPlanMapLoader planEvents={planEvents} initialDay={initialDay} />
      )}
    </div>
  )
}
