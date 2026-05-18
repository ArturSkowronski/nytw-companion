// components/EditorsPicksCarousel.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { usePlanStore } from '@/lib/plan-store'
import { formatEventTime } from '@/lib/events'
import { toast } from 'sonner'
import type { Event } from '@/lib/types'

interface EditorsPicksCarouselProps {
  picks: Event[]
}

export function EditorsPicksCarousel({ picks }: EditorsPicksCarouselProps) {
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)
  const { items, addItem } = usePlanStore()

  const next = useCallback(() => {
    setCurrent((c) => (c + 1) % picks.length)
  }, [picks.length])

  const prev = () => {
    setCurrent((c) => (c - 1 + picks.length) % picks.length)
  }

  // Auto-advance every 5s unless paused
  useEffect(() => {
    if (paused || picks.length <= 1) return
    const interval = setInterval(next, 5000)
    return () => clearInterval(interval)
  }, [paused, next, picks.length])

  if (picks.length === 0) return null

  const pick = picks[current]
  const isInPlan = items.some((i) => i.event_id === pick.id)

  function handleAdd() {
    addItem(pick.id, 'interested', 'editors_pick')
    toast('Added to your plan')
  }

  return (
    <div
      className="relative bg-gradient-to-br from-amber-500/10 to-[#111111] border border-amber-500/20 rounded-lg p-5 mb-8"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex items-baseline gap-2 mb-4">
        <h2 className="font-mono text-sm font-bold text-amber-400 uppercase tracking-wider">
          Editor&apos;s Picks
        </h2>
        <span className="text-[#555555] text-xs font-mono">{current + 1}/{picks.length}</span>
      </div>

      <div className="mb-3">
        {pick.is_virtuslab_event && (
          <Badge className="bg-[#FF6B35]/20 text-[#FF6B35] border-[#FF6B35]/30 text-xs mb-2">
            Featured
          </Badge>
        )}
        <h3 className="font-mono font-bold text-[#FAFAFA] text-lg leading-tight mb-1">
          {pick.title}
        </h3>
        <p className="text-[#A3A3A3] text-sm mb-1">
          {pick.host} · {formatEventTime(pick.starts_at, pick.ends_at)}
        </p>
        {pick.neighborhood && (
          <p className="text-[#666666] text-xs mb-3">{pick.neighborhood}</p>
        )}

        {pick.editors_pick_blurb && (
          <div className="border-l-2 border-amber-500/40 pl-3 mb-4">
            <p className="text-xs text-amber-400 font-mono mb-1">Why we picked this</p>
            <p className="text-[#A3A3A3] text-sm leading-relaxed">{pick.editors_pick_blurb}</p>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            size="sm"
            className="bg-[#FF6B35] hover:bg-[#e85a25] text-white font-mono text-xs"
            onClick={(e) => { e.stopPropagation(); window.open(pick.rsvp_url, '_blank', 'noopener,noreferrer'); handleAdd() }}
          >
            Open RSVP →
          </Button>
          {!isInPlan && (
            <Button
              size="sm"
              variant="outline"
              className="border-[#333333] text-[#A3A3A3] hover:bg-[#1A1A1A] font-mono text-xs"
              onClick={(e) => { e.stopPropagation(); handleAdd() }}
            >
              Add to plan
            </Button>
          )}
          {isInPlan && (
            <span className="text-xs text-amber-400 font-mono flex items-center">In your plan ✓</span>
          )}
        </div>
      </div>

      {/* Prev / Next */}
      {picks.length > 1 && (
        <div className="absolute top-4 right-4 flex gap-1">
          <button
            onClick={prev}
            className="w-7 h-7 flex items-center justify-center rounded border border-[#2A2A2A] text-[#A3A3A3] hover:bg-[#1A1A1A] text-xs"
            aria-label="Previous pick"
            type="button"
          >
            ‹
          </button>
          <button
            onClick={next}
            className="w-7 h-7 flex items-center justify-center rounded border border-[#2A2A2A] text-[#A3A3A3] hover:bg-[#1A1A1A] text-xs"
            aria-label="Next pick"
            type="button"
          >
            ›
          </button>
        </div>
      )}

      {/* Dot indicators */}
      {picks.length > 1 && (
        <div className="flex gap-1 mt-3">
          {picks.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-1 rounded-full transition-all ${i === current ? 'w-4 bg-amber-400' : 'w-1 bg-[#333333]'}`}
              aria-label={`Pick ${i + 1}`}
              type="button"
            />
          ))}
        </div>
      )}
    </div>
  )
}
