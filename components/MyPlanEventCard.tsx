'use client'

import { forwardRef, useState } from 'react'
import { EventDetailModal } from '@/components/EventDetailModal'
import { formatStartTime, formatEndTime } from '@/lib/events'
import { accentFor, accentRgba } from '@/lib/event-accent'
import type { Event, PlanItem } from '@/lib/types'

const STATUS_LABEL: Record<PlanItem['status'], string> = {
  interested: 'Interested',
  rsvp_pending: 'RSVP pending',
  confirmed: 'Confirmed',
  waitlist: 'Waitlist',
  declined: 'Declined',
  attended: 'Attended',
}

const STATUS_COLOR: Record<PlanItem['status'], string> = {
  interested: 'text-[#9B9B9B]',
  rsvp_pending: 'text-[#E0B847]',
  confirmed: 'text-[#4CC38A]',
  waitlist: 'text-[#FF5B25]',
  declined: 'text-[#737373]',
  attended: 'text-[#4CC38A]',
}

interface MyPlanEventCardProps {
  planItem: PlanItem
  event: Event
}

export const MyPlanEventCard = forwardRef<HTMLDivElement, MyPlanEventCardProps>(
  function MyPlanEventCard({ planItem, event }, ref) {
    const [isModalOpen, setIsModalOpen] = useState(false)
    const accent = accentFor(event)
    const accentBg = accentRgba(event, 0.14)
    const accentHover = accentRgba(event, 0.03)

    return (
      <>
        <div
          ref={ref}
          data-testid="my-plan-event-card"
          onClick={() => setIsModalOpen(true)}
          style={{ ['--accent-hover-bg' as string]: accentHover }}
          className="grid grid-cols-[90px_1fr] md:grid-cols-[90px_1fr_240px_auto] gap-5 py-5 border-t border-[#1A1A1A] hover:bg-[var(--accent-hover-bg)] transition-colors cursor-pointer"
        >
          <div className="font-mono text-xs font-bold tracking-wide pt-1" style={{ color: accent }}>
            {formatStartTime(event.starts_at)}
            <span className="block text-[#737373] font-normal mt-1">
              – {formatEndTime(event.ends_at)}
            </span>
          </div>

          <div className="col-start-2 md:col-start-2 min-w-0">
            {event.is_editors_pick && (
              <span
                className="inline-block font-mono text-[10px] uppercase tracking-[0.14em] px-1.5 py-0.5 mb-2"
                style={{ backgroundColor: accentBg, color: accent }}
              >
                {event.is_virtuslab_event ? 'Hosted by us' : "Editor's Pick"}
              </span>
            )}
            <h4 className="font-mono font-bold text-base leading-snug mb-1 text-[#F5F5F5]">
              {event.title}
            </h4>
            <p className="font-mono text-xs uppercase tracking-wide text-[#9B9B9B] mb-2">
              {event.host}
            </p>
            <p className="text-sm text-[#9B9B9B] leading-relaxed max-w-[62ch] line-clamp-2">
              {event.description}
            </p>
          </div>

          <div className="hidden md:flex flex-col gap-1.5 font-mono text-xs uppercase tracking-wide text-[#737373] pt-1">
            {event.neighborhood && (
              <span className="text-[#9B9B9B]">{event.neighborhood}</span>
            )}
            {event.is_invite_only && <span>Invite-only</span>}
          </div>

          <div className="hidden md:block self-start pt-1" onClick={(e) => e.stopPropagation()}>
            <span className={`font-mono text-xs uppercase tracking-wide ${STATUS_COLOR[planItem.status]}`}>
              {STATUS_LABEL[planItem.status]}
            </span>
          </div>
        </div>

        <EventDetailModal
          event={event}
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      </>
    )
  }
)
