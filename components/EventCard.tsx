// components/EventCard.tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EventDetailModal } from '@/components/EventDetailModal'
import { usePlanStore } from '@/lib/plan-store'
import { formatEventTime } from '@/lib/events'
import type { Event } from '@/lib/types'

const FORMAT_ICONS: Record<string, string> = {
  rooftop: '🏙',
  dinner: '🍽',
  panel: '🎙',
  breakfast: '☕',
  hackathon: '💻',
  workshop: '🛠',
}

interface EventCardProps {
  event: Event
  onTagClick?: (tag: string) => void
}

export function EventCard({ event, onTagClick }: EventCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { items, addItem, removeItem } = usePlanStore()
  const isInPlan = items.some((i) => i.event_id === event.id)

  function handleSave() {
    addItem(event.id, 'interested', 'manual')
    toast('Added to your plan')
  }

  function handleOpenRsvp() {
    if (!isInPlan) {
      addItem(event.id, 'interested', 'manual')
    }
    toast(`Added — confirm RSVP on ${capitalize(event.rsvp_platform)}`)
    window.open(event.rsvp_url, '_blank', 'noopener,noreferrer')
  }

  function handleRemove() {
    removeItem(event.id)
    toast('Removed from plan')
  }

  return (
    <>
      <div
        data-testid="event-card"
        className="group relative rounded-lg border border-[#1A1A1A] bg-[#0B0B0B] p-4 hover:border-[#333333] transition-colors cursor-pointer"
        onClick={() => setIsModalOpen(true)}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'a') { e.preventDefault(); handleSave() }
          if (e.key === 'r' || e.key === 'R') { e.preventDefault(); handleOpenRsvp() }
        }}
        tabIndex={0}
        role="article"
        aria-label={event.title}
      >
        {/* Badges */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {event.is_editors_pick && (
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
              Editor&apos;s Pick
            </Badge>
          )}
          {event.is_virtuslab_event && (
            <Badge className="bg-[#FF5B25]/[0.14] text-[#FF5B25] border-[#FF5B25]/30 text-xs">
              Featured
            </Badge>
          )}
          {event.is_invite_only && (
            <Badge variant="outline" className="text-xs border-[#333333] text-[#9B9B9B]">
              Invite-only
            </Badge>
          )}
          {event.has_free_food && (
            <Badge variant="outline" className="text-xs border-[#333333] text-[#9B9B9B]">
              Free food
            </Badge>
          )}
          {event.has_free_drinks && (
            <Badge variant="outline" className="text-xs border-[#333333] text-[#9B9B9B]">
              Free drinks
            </Badge>
          )}
        </div>

        {/* Title */}
        <h3 className="font-mono font-bold text-[#F5F5F5] text-base leading-tight mb-1">
          {event.title}
        </h3>

        {/* Host */}
        <p className="text-[#9B9B9B] text-sm mb-2 flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#262626] text-[10px] font-mono font-bold text-[#F5F5F5] shrink-0">
            {event.host.charAt(0).toUpperCase()}
          </span>
          {event.host}
        </p>

        {/* Time + neighborhood */}
        <div className="flex items-center gap-2 mb-2 text-xs text-[#9B9B9B]">
          <span>{formatEventTime(event.starts_at, event.ends_at)}</span>
          <span>·</span>
          <span className="bg-[#1A1A1A] text-[#9B9B9B] px-1.5 py-0.5 rounded text-[11px]">
            {event.neighborhood}
          </span>
          {event.format && (
            <>
              <span>·</span>
              <span>{FORMAT_ICONS[event.format] ?? ''} {event.format}</span>
            </>
          )}
        </div>

        {/* Description teaser */}
        <p className="text-[#9B9B9B] text-sm line-clamp-1 mb-3">
          {event.description}
        </p>

        {/* Tags */}
        {event.tags.length > 0 && (
          <div
            className="flex flex-wrap gap-1 mb-3"
            onClick={(e) => e.stopPropagation()}
          >
            {event.tags.slice(0, 4).map((tag) =>
              onTagClick ? (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onTagClick(tag)}
                  aria-label={`Filter by tag ${tag}`}
                  className="text-[10px] text-[#9B9B9B] bg-[#1A1A1A] hover:bg-[#FF5B25]/[0.14] hover:text-[#FF5B25] px-1.5 py-0.5 rounded font-mono transition-colors"
                >
                  {tag}
                </button>
              ) : (
                <span
                  key={tag}
                  className="text-[10px] text-[#9B9B9B] bg-[#1A1A1A] px-1.5 py-0.5 rounded font-mono"
                >
                  {tag}
                </span>
              )
            )}
          </div>
        )}

        {/* Actions — stop propagation so clicking buttons doesn't open modal */}
        <div
          className="flex gap-2 items-center"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {isInPlan ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    size="sm"
                    className="bg-[#1A1A1A] text-[#F5F5F5] border border-[#333333] hover:bg-[#262626] font-mono text-xs"
                  >
                    In your plan ✓
                  </Button>
                }
              />
              <DropdownMenuContent className="bg-[#0B0B0B] border-[#333333]">
                <DropdownMenuItem
                  className="text-[#F5F5F5] hover:bg-[#1A1A1A] cursor-pointer"
                  onClick={handleOpenRsvp}
                >
                  Open RSVP →
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-red-400 hover:bg-[#1A1A1A] cursor-pointer"
                  onClick={handleRemove}
                >
                  Remove from plan
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button
                size="sm"
                className="bg-[#FF5B25] hover:bg-[#e85a25] text-white font-mono text-xs"
                onClick={handleOpenRsvp}
              >
                Open RSVP →
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-[#333333] text-[#9B9B9B] hover:bg-[#1A1A1A] font-mono text-xs"
                onClick={handleSave}
              >
                Save
              </Button>
            </>
          )}
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

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
