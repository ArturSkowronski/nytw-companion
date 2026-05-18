'use client'

import { usePlanStore } from '@/lib/plan-store'
import type { PlanStatus } from '@/lib/types'

const STATUSES: { value: PlanStatus; label: string }[] = [
  { value: 'interested',   label: 'Interested' },
  { value: 'rsvp_pending', label: 'RSVPed' },
  { value: 'confirmed',    label: 'Confirmed' },
  { value: 'waitlist',     label: 'Waitlist' },
  { value: 'declined',     label: 'Declined' },
  { value: 'attended',     label: 'Attended' },
]

interface StatusPickerInlineProps {
  eventId: string
}

export function StatusPickerInline({ eventId }: StatusPickerInlineProps) {
  const item = usePlanStore((s) => s.items.find((i) => i.event_id === eventId))
  const updateStatus = usePlanStore((s) => s.updateStatus)

  if (!item) return null

  return (
    <div
      className="inline-flex flex-wrap gap-1 rounded-md border border-[#2A2A2A] bg-[#111111] p-1"
      role="group"
      aria-label="Update status"
    >
      {STATUSES.map(({ value, label }) => {
        const active = item.status === value
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => updateStatus(eventId, value)}
            className={
              `font-mono text-[10px] px-2 py-1 rounded transition-colors ` +
              (active
                ? 'bg-[#FF6B35] text-white'
                : 'text-[#A3A3A3] hover:text-[#FAFAFA]')
            }
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
