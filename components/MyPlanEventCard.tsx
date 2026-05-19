'use client'

import { forwardRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { StatusToggle } from '@/components/StatusToggle'
import { formatEventTime } from '@/lib/events'
import { usePlanStore } from '@/lib/plan-store'
import type { Event, PlanItem } from '@/lib/types'

const STATUS_LABEL: Record<PlanItem['status'], string> = {
  interested:   'Interested',
  rsvp_pending: 'RSVPed',
  confirmed:    'Confirmed',
  waitlist:     'Waitlist',
  declined:     'Declined',
  attended:     'Attended',
}

const STATUS_TONE: Record<PlanItem['status'], string> = {
  interested:   'bg-[#1A1A1A] text-[#A3A3A3] border-[#2A2A2A]',
  rsvp_pending: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  confirmed:    'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  waitlist:     'bg-amber-500/10 text-amber-400 border-amber-500/30',
  declined:     'bg-red-500/10 text-red-400 border-red-500/30 line-through',
  attended:     'bg-emerald-500/10 text-emerald-400/60 border-emerald-500/30',
}

interface MyPlanEventCardProps {
  planItem: PlanItem
  event: Event
}

export const MyPlanEventCard = forwardRef<HTMLDivElement, MyPlanEventCardProps>(
  function MyPlanEventCard({ planItem, event }, ref) {
    const removeItem = usePlanStore((s) => s.removeItem)

    return (
      <div
        ref={ref}
        className="bg-[#111111] border border-[#1A1A1A] rounded-md p-5 space-y-3"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <Badge className={`text-[10px] ${STATUS_TONE[planItem.status]}`}>
                {STATUS_LABEL[planItem.status]}
              </Badge>
              {event.is_editors_pick && (
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">
                  Editor&rsquo;s Pick
                </Badge>
              )}
              {event.is_virtuslab_event && (
                <Badge className="bg-[#FF6B35]/20 text-[#FF6B35] border-[#FF6B35]/30 text-[10px]">
                  Featured
                </Badge>
              )}
            </div>
            <p className="font-mono text-base font-bold text-[#FAFAFA]">{event.title}</p>
            <p className="text-xs text-[#A3A3A3] mt-1">
              {event.host} · {formatEventTime(event.starts_at, event.ends_at)}
              {event.neighborhood ? ` · ${event.neighborhood}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => removeItem(event.id)}
            className="text-[10px] text-[#555555] hover:text-red-400 font-mono"
          >
            Remove
          </button>
        </div>

        <StatusToggle eventId={event.id} />

        <div>
          <a
            href={event.rsvp_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-md bg-[#FF6B35] hover:bg-[#e85a25] text-white font-mono text-sm px-4 py-2"
          >
            Open RSVP →
          </a>
        </div>
      </div>
    )
  },
)
