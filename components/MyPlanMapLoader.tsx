'use client'

import dynamic from 'next/dynamic'
import type { DayKey } from '@/lib/time'
import type { Event, PlanItem } from '@/lib/types'

const MyPlanMapDynamic = dynamic(
  () => import('@/components/MyPlanMap').then((m) => m.MyPlanMap),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[400px] bg-[#0B0B0B] border border-[#1A1A1A] rounded-md flex items-center justify-center">
        <p className="font-mono text-sm text-[#9B9B9B]">Loading map…</p>
      </div>
    ),
  },
)

interface MyPlanMapLoaderProps {
  planEvents: Array<{ item: PlanItem; event: Event }>
  initialDay: DayKey
}

export function MyPlanMapLoader({ planEvents, initialDay }: MyPlanMapLoaderProps) {
  return <MyPlanMapDynamic planEvents={planEvents} initialDay={initialDay} />
}
