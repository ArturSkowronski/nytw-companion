// components/EventDetailModal.tsx
'use client'

import { useEffect } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { usePlanStore } from '@/lib/plan-store'
import { formatEventTime } from '@/lib/events'
import { toast } from 'sonner'
import type { Event } from '@/lib/types'

interface EventDetailModalProps {
  event: Event
  open: boolean
  onClose: () => void
}

const FORMAT_LABELS: Record<string, string> = {
  rooftop: '🏙 Rooftop',
  dinner: '🍽 Dinner',
  panel: '🎙 Panel',
  breakfast: '☕ Breakfast',
  hackathon: '💻 Hackathon',
  workshop: '🛠 Workshop',
}

export function EventDetailModal({ event, open, onClose }: EventDetailModalProps) {
  const { items, addItem, removeItem } = usePlanStore()
  const isInPlan = items.some((i) => i.event_id === event.id)

  // Update URL hash for deep-linking without navigation
  useEffect(() => {
    if (open) {
      window.history.replaceState(null, '', `#${event.id}`)
    } else {
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }, [open, event.id])

  function handleSave() {
    addItem(event.id, 'interested', 'manual')
    toast('Added to your plan')
  }

  function handleOpenRsvp() {
    if (!isInPlan) addItem(event.id, 'interested', 'manual')
    toast(`Added — confirm RSVP on ${capitalize(event.rsvp_platform)}`)
    window.open(event.rsvp_url, '_blank', 'noopener,noreferrer')
  }

  function handleRemove() {
    removeItem(event.id)
    toast('Removed from plan')
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent
        className="bg-[#0B0B0B] border-[#1A1A1A] text-[#F5F5F5] w-full sm:max-w-lg overflow-y-auto p-6"
        side="right"
      >
        <SheetHeader className="mb-4 p-0">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {event.is_editors_pick && (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                Editor&apos;s Pick
              </Badge>
            )}
            {event.is_virtuslab_event && (
              <Badge
                className="text-xs"
                style={{
                  backgroundColor: 'rgba(146, 200, 62, 0.14)',
                  color: '#92C83E',
                  borderColor: 'rgba(146, 200, 62, 0.30)',
                }}
              >
                Hosted by us
              </Badge>
            )}
            {event.is_invite_only && (
              <Badge variant="outline" className="text-xs border-[#333333] text-[#9B9B9B]">
                Invite-only
              </Badge>
            )}
          </div>
          <SheetTitle className="font-mono text-xl font-bold text-[#F5F5F5] text-left">
            {event.title}
          </SheetTitle>
        </SheetHeader>

        {/* Host */}
        <div className="flex items-center gap-2 mb-4 text-sm text-[#9B9B9B]">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#262626] text-xs font-mono font-bold text-[#F5F5F5]">
            {event.host.charAt(0).toUpperCase()}
          </span>
          <span>{event.host}</span>
        </div>

        {/* Time / Location */}
        <div className="space-y-1.5 mb-4 text-sm">
          <div className="flex items-center gap-2 text-[#9B9B9B]">
            <span className="text-[#9B9B9B]">🕐</span>
            <span>{formatEventTime(event.starts_at, event.ends_at)}</span>
          </div>
          {event.venue_name && (
            <div className="flex items-center gap-2 text-[#9B9B9B]">
              <span className="text-[#9B9B9B]">📍</span>
              <span>{event.venue_name}{event.neighborhood ? ` · ${event.neighborhood}` : ''}</span>
            </div>
          )}
          {event.address && (
            <div className="flex items-start gap-2 text-[#9B9B9B]">
              <span className="text-[#9B9B9B] mt-0.5">🗺</span>
              <span>{event.address}</span>
            </div>
          )}
          {event.format && (
            <div className="flex items-center gap-2 text-[#9B9B9B]">
              <span className="text-[#9B9B9B]">·</span>
              <span>{FORMAT_LABELS[event.format] ?? event.format}</span>
            </div>
          )}
          {event.capacity && (
            <div className="flex items-center gap-2 text-[#9B9B9B]">
              <span className="text-[#9B9B9B]">👥</span>
              <span>Capacity: ~{event.capacity}</span>
            </div>
          )}
        </div>

        <Separator className="bg-[#1A1A1A] mb-4" />

        {/* Description */}
        <p className="text-[#9B9B9B] text-sm leading-relaxed mb-4">
          {event.description}
        </p>

        {/* Editor's Pick blurb */}
        {event.is_editors_pick && event.editors_pick_blurb && (
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-md p-3 mb-4">
            <p className="text-amber-400 text-xs font-mono mb-1">Why we picked this</p>
            <p className="text-[#9B9B9B] text-sm">{event.editors_pick_blurb}</p>
          </div>
        )}

        {/* Tags */}
        {event.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-6">
            {event.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs text-[#9B9B9B] bg-[#1A1A1A] px-2 py-1 rounded font-mono"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <Separator className="bg-[#1A1A1A] mb-4" />

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          <Button
            className="text-white font-mono"
            style={
              event.is_virtuslab_event
                ? { backgroundColor: '#92C83E', color: '#0A0A0A' }
                : { backgroundColor: '#FF5B25' }
            }
            onClick={handleOpenRsvp}
          >
            Open RSVP →
          </Button>
          {isInPlan ? (
            <Button
              variant="outline"
              className="border-[#333333] text-red-400 hover:bg-[#1A1A1A] font-mono"
              onClick={handleRemove}
            >
              Remove from plan
            </Button>
          ) : (
            <Button
              variant="outline"
              className="border-[#333333] text-[#9B9B9B] hover:bg-[#1A1A1A] font-mono"
              onClick={handleSave}
            >
              Save to plan
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
