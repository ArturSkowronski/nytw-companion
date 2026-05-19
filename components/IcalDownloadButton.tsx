'use client'

import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { buildIcs } from '@/lib/ical'
import type { Event, PlanItem } from '@/lib/types'

const EXPORT_STATUSES = new Set<PlanItem['status']>(['confirmed', 'rsvp_pending', 'waitlist'])

interface IcalDownloadButtonProps {
  items: PlanItem[]
  events: Event[]
}

export function IcalDownloadButton({ items, events }: IcalDownloadButtonProps) {
  const exportableCount = useMemo(() => {
    const ids = new Set(events.map((e) => e.id))
    return items.filter((i) => EXPORT_STATUSES.has(i.status) && ids.has(i.event_id)).length
  }, [items, events])

  function handleDownload() {
    const ics = buildIcs(items, events)
    const blob = new Blob([ics], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'nytw-plan.ics'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (exportableCount === 0) {
    return (
      <Button variant="outline" disabled className="font-mono">
        Nothing to export yet
      </Button>
    )
  }

  return (
    <Button
      onClick={handleDownload}
      className="bg-[#FF6B35] hover:bg-[#e85a25] text-white font-mono"
    >
      Download .ics ({exportableCount})
    </Button>
  )
}
