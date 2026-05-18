'use client'

import { formatEventTime } from '@/lib/events'
import type { Event } from '@/lib/types'

interface AfterThisCardProps {
  event: Event | null
}

export function AfterThisCard({ event }: AfterThisCardProps) {
  if (!event) return null
  return (
    <div className="bg-[#0F0F0F] border border-[#1A1A1A] rounded-md p-4">
      <p className="text-[10px] font-mono text-[#666666] uppercase tracking-widest mb-1">
        After this
      </p>
      <p className="font-mono text-sm text-[#FAFAFA]">{event.title}</p>
      <p className="text-xs text-[#A3A3A3] mt-0.5">
        {event.host} · {formatEventTime(event.starts_at, event.ends_at)}
        {event.neighborhood ? ` · ${event.neighborhood}` : ''}
      </p>
    </div>
  )
}
