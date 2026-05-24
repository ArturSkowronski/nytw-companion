'use client'

import { Suspense, useMemo } from 'react'
import { EventMapLoader } from '@/components/EventMapLoader'
import { applyFilters } from '@/lib/filters'
import { useFilters } from '@/lib/use-filters'
import type { DayKey } from '@/lib/time'
import type { Event } from '@/lib/types'

interface EventsMapClientProps {
  events: Event[]
  initialDay: DayKey
}

export function EventsMapClient(props: EventsMapClientProps) {
  return (
    <Suspense fallback={<EventMapLoader events={props.events} initialDay={props.initialDay} />}>
      <EventsMapClientInner {...props} />
    </Suspense>
  )
}

function EventsMapClientInner({ events, initialDay }: EventsMapClientProps) {
  const { filters } = useFilters()
  const filtered = useMemo(() => applyFilters(events, filters), [events, filters])
  return <EventMapLoader events={filtered} initialDay={initialDay} />
}
