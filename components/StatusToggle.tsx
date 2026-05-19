'use client'

import { usePlanStore } from '@/lib/plan-store'
import type { PlanStatus } from '@/lib/types'

const STATUSES: { value: PlanStatus; label: string; icon: string }[] = [
  { value: 'interested',   label: 'Interested', icon: '👀' },
  { value: 'rsvp_pending', label: 'RSVPed',     icon: '⏳' },
  { value: 'confirmed',    label: 'Confirmed',  icon: '✅' },
  { value: 'waitlist',     label: 'Waitlist',   icon: '📋' },
  { value: 'declined',     label: 'Declined',   icon: '❌' },
  { value: 'attended',     label: 'Attended',   icon: '✔' },
]

interface StatusToggleProps {
  eventId: string
}

export function StatusToggle({ eventId }: StatusToggleProps) {
  const item = usePlanStore((s) => s.items.find((i) => i.event_id === eventId))
  const updateStatus = usePlanStore((s) => s.updateStatus)

  if (!item) return null

  return (
    <div
      className="inline-flex flex-wrap gap-1 rounded-md border border-[#2A2A2A] bg-[#111111] p-1"
      role="group"
      aria-label="Update status"
    >
      {STATUSES.map(({ value, label, icon }) => {
        const active = item.status === value
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => updateStatus(eventId, value)}
            className={
              `font-mono text-xs px-2.5 py-1.5 rounded transition-colors flex items-center gap-1.5 ` +
              (active
                ? 'bg-[#FF6B35] text-white font-bold'
                : 'text-[#A3A3A3] hover:text-[#FAFAFA] hover:bg-[#1A1A1A]')
            }
          >
            <span aria-hidden="true">{icon}</span>
            <span>{label}</span>
          </button>
        )
      })}
    </div>
  )
}
