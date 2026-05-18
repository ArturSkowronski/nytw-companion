'use client'

// Thin client-component wrapper so next/dynamic({ ssr: false }) is legal.
// next/dynamic with ssr:false is only allowed inside Client Components.
import dynamic from 'next/dynamic'
import type { DayKey } from '@/lib/time'
import type { Event } from '@/lib/types'

const EventMapDynamic = dynamic(
  () => import('@/components/EventMap').then((m) => m.EventMap),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[400px] bg-[#111111] border border-[#1A1A1A] rounded-md flex items-center justify-center">
        <p className="font-mono text-sm text-[#A3A3A3]">Loading map…</p>
      </div>
    ),
  },
)

interface EventMapLoaderProps {
  events: Event[]
  initialDay: DayKey
}

export function EventMapLoader({ events, initialDay }: EventMapLoaderProps) {
  return <EventMapDynamic events={events} initialDay={initialDay} />
}
