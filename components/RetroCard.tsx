'use client'

import { usePlanStore } from '@/lib/plan-store'

export function RetroCard() {
  const items = usePlanStore((s) => s.items)
  const attended = items.filter((i) => i.status === 'attended').length
  const confirmed = items.filter((i) => i.status === 'confirmed').length

  return (
    <div className="bg-[#111111] border border-[#1A1A1A] rounded-md p-6 space-y-4">
      <p className="text-xs font-mono text-[#7A7A7A] uppercase tracking-widest">
        Post-festival
      </p>
      <p className="font-mono text-2xl font-bold text-[#FAFAFA]">Tech Week wrapped.</p>
      <p className="text-sm text-[#A3A3A3]">
        You had {items.length} events in your plan
        {attended > 0 ? ` · ${attended} marked attended` : ''}
        {confirmed > 0 ? ` · ${confirmed} confirmed` : ''}.
      </p>
      <p className="text-sm text-[#7A7A7A]">
        Your full plan retro view is coming in the next release.
      </p>
    </div>
  )
}
