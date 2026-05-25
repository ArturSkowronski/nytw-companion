'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import type { DayKey } from '@/lib/time'

const ORDER: { key: DayKey; label: string; date: string }[] = [
  { key: 'mon', label: 'Mon', date: 'Jun 1' },
  { key: 'tue', label: 'Tue', date: 'Jun 2' },
  { key: 'wed', label: 'Wed', date: 'Jun 3' },
  { key: 'thu', label: 'Thu', date: 'Jun 4' },
  { key: 'fri', label: 'Fri', date: 'Jun 5' },
  { key: 'sat', label: 'Sat', date: 'Jun 6' },
  { key: 'sun', label: 'Sun', date: 'Jun 7' },
]

interface DayChipNavProps {
  /** map of day key → event count (used to show 0-badges) */
  eventsByDay: Partial<Record<DayKey, number>>
}

export function DayChipNav({ eventsByDay }: DayChipNavProps) {
  const router = useRouter()
  const params = useSearchParams()
  const pathname = usePathname()
  const active = (params.get('day') as DayKey | null) ?? 'mon'

  function selectDay(key: DayKey) {
    const next = new URLSearchParams(params.toString())
    next.set('day', key)
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {ORDER.map(({ key, label, date }) => {
        const isActive = active === key
        const count = eventsByDay[key] ?? 0
        return (
          <button
            key={key}
            type="button"
            onClick={() => selectDay(key)}
            className={
              `shrink-0 font-mono text-xs px-3 py-1.5 rounded-full whitespace-nowrap border transition-colors ` +
              (isActive
                ? 'border-[#FF5B25] text-[#FF5B25] bg-[#FF5B25]/10'
                : 'border-[#262626] text-[#9B9B9B] bg-[#0B0B0B] hover:border-[#9B9B9B]')
            }
          >
            {label} <span className="text-[#9B9B9B]">{date}</span>
            <span className="ml-1 text-[#9B9B9B]">({count})</span>
          </button>
        )
      })}
    </div>
  )
}
