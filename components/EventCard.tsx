// components/EventCard.tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { EventDetailModal } from '@/components/EventDetailModal'
import { usePlanStore } from '@/lib/plan-store'
import { formatStartTime, formatEndTime } from '@/lib/events'
import type { Event } from '@/lib/types'

interface EventCardProps {
  event: Event
  onTagClick?: (tag: string) => void
}

export function EventCard({ event, onTagClick }: EventCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { items, addItem } = usePlanStore()
  const isInPlan = items.some((i) => i.event_id === event.id)

  function handleSave(e?: React.MouseEvent) {
    if (e) e.stopPropagation()
    if (isInPlan) return
    addItem(event.id, 'interested', 'manual')
    toast('Added to your plan')
  }

  return (
    <>
      <article
        data-testid="event-card"
        onClick={() => setIsModalOpen(true)}
        className="grid grid-cols-[90px_1fr] md:grid-cols-[90px_1fr_240px_auto] gap-5 py-5 border-t border-[#1A1A1A] hover:bg-[#FF5B25]/[0.03] transition-colors cursor-pointer group"
      >
        {/* Time column */}
        <div className="font-mono text-xs text-[#FF5B25] font-bold tracking-wide pt-1">
          {formatStartTime(event.starts_at)}
          <span className="block text-[#737373] font-normal mt-1">
            – {formatEndTime(event.ends_at)}
          </span>
        </div>

        {/* Body column */}
        <div className="col-start-2 md:col-start-2 min-w-0">
          {event.is_editors_pick && (
            <span className="inline-block font-mono text-[10px] uppercase tracking-[0.14em] bg-[#FF5B25]/[0.14] text-[#FF5B25] px-1.5 py-0.5 mb-2">
              Editor&apos;s Pick
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
          {event.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2" onClick={(e) => e.stopPropagation()}>
              {event.tags.slice(0, 4).map((tag) =>
                onTagClick ? (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => onTagClick(tag)}
                    aria-label={`Filter by tag ${tag}`}
                    className="text-[10px] text-[#737373] hover:text-[#FF5B25] font-mono"
                  >
                    #{tag}
                  </button>
                ) : (
                  <span key={tag} className="text-[10px] text-[#737373] font-mono">
                    #{tag}
                  </span>
                )
              )}
            </div>
          )}
        </div>

        {/* Meta column — desktop only */}
        <div className="hidden md:flex flex-col gap-1.5 font-mono text-xs uppercase tracking-wide text-[#737373] pt-1">
          {event.neighborhood && (
            <span className="text-[#9B9B9B]">{event.neighborhood}</span>
          )}
          {event.is_invite_only && (
            <span>Invite-only</span>
          )}
          <div className="flex gap-2.5 flex-wrap">
            {event.has_free_food && <span className="text-[#F5F5F5]">food</span>}
            {event.has_free_drinks && <span className="text-[#F5F5F5]">drinks</span>}
          </div>
        </div>

        {/* Save column — desktop visible (mobile users use modal) */}
        <div className="hidden md:block self-start" onClick={(e) => e.stopPropagation()}>
          {!isInPlan ? (
            <button
              type="button"
              onClick={handleSave}
              className="font-mono text-xs uppercase tracking-wide text-[#FF5B25] hover:underline pt-1 opacity-60 group-hover:opacity-100 transition-opacity"
            >
              Save
            </button>
          ) : (
            <span className="font-mono text-xs uppercase tracking-wide text-[#4CC38A] pt-1 inline-block">
              ✓ In your plan
            </span>
          )}
        </div>
      </article>

      <EventDetailModal
        event={event}
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  )
}
