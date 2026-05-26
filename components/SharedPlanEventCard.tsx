'use client'

import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { formatEventTime } from '@/lib/events'
import { usePlanStore } from '@/lib/plan-store'
import type { Event } from '@/lib/types'

interface SharedPlanEventCardProps {
  event: Event
  alreadyInPlan: boolean
}

export function SharedPlanEventCard({ event, alreadyInPlan }: SharedPlanEventCardProps) {
  const addItem = usePlanStore((s) => s.addItem)

  function handleAdd() {
    addItem(event.id, 'interested', 'share')
    toast(`Added "${event.title}" to your plan`)
  }

  return (
    <div className="grid grid-cols-[90px_1fr_auto] gap-5 py-5 border-t border-[#1A1A1A]">
      <div className="font-mono text-xs font-bold tracking-wide text-[#FF5B25] pt-1">
        {formatEventTime(event.starts_at, event.ends_at)}
      </div>
      <div className="min-w-0">
        {event.is_editors_pick && (
          <span className="inline-block font-mono text-[10px] uppercase tracking-[0.14em] px-1.5 py-0.5 mb-2 bg-amber-500/15 text-amber-400">
            Editor&apos;s Pick
          </span>
        )}
        <p className="font-mono font-bold text-[#F5F5F5] text-sm leading-tight">
          {event.title}
        </p>
        <p className="text-xs text-[#9B9B9B] mt-1">
          {event.host}
          {event.neighborhood ? ` · ${event.neighborhood}` : ''}
        </p>
      </div>
      <div className="flex items-center">
        {alreadyInPlan ? (
          <span className="text-xs text-[#4CC38A] font-mono">✓ In your plan</span>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="font-mono text-xs"
            onClick={handleAdd}
          >
            + Add to my plan
          </Button>
        )}
      </div>
    </div>
  )
}
