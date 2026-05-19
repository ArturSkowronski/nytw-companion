'use client'

import { createRef, useMemo, useRef } from 'react'
import { MyPlanEventCard } from '@/components/MyPlanEventCard'
import { ConflictWarnings } from '@/components/ConflictWarnings'
import { groupEventsByDay, formatDayHeading } from '@/lib/events'
import type { ConflictPair } from '@/lib/conflicts'
import type { Event, PlanItem } from '@/lib/types'

interface MyPlanTimelineProps {
  planEvents: Array<{ item: PlanItem; event: Event }>
  conflicts: ConflictPair[]
}

export function MyPlanTimeline({ planEvents, conflicts }: MyPlanTimelineProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  const cardRefs = useMemo(() => {
    const m = new Map<string, ReturnType<typeof createRef<HTMLDivElement>>>()
    for (const { event } of planEvents) m.set(event.id, createRef<HTMLDivElement>())
    return m
  }, [planEvents])

  const events = useMemo(() => planEvents.map((p) => p.event), [planEvents])
  const grouped = useMemo(() => groupEventsByDay(events), [events])
  const dayKeys = Object.keys(grouped).sort()
  const itemByEventId = useMemo(() => {
    const m = new Map<string, PlanItem>()
    for (const { item } of planEvents) m.set(item.event_id, item)
    return m
  }, [planEvents])

  return (
    <div ref={containerRef} className="relative pl-4">
      <ConflictWarnings
        pairs={conflicts}
        cardRefs={cardRefs}
        containerRef={containerRef}
      />
      {dayKeys.map((dayKey) => (
        <section key={dayKey} className="mb-10">
          <h2 className="sticky top-0 z-10 bg-[#0A0A0A] border-b border-[#1A1A1A] py-3 mb-4 font-mono font-bold text-[#FAFAFA] text-lg">
            {formatDayHeading(dayKey)}
          </h2>
          <div className="grid gap-3">
            {grouped[dayKey].map((event) => {
              const item = itemByEventId.get(event.id)
              if (!item) return null
              return (
                <MyPlanEventCard
                  key={event.id}
                  ref={cardRefs.get(event.id)}
                  planItem={item}
                  event={event}
                />
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
