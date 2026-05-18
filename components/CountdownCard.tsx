'use client'

import { festivalWindow, msUntil, dayKeyForDate } from '@/lib/time'
import { formatEventTime } from '@/lib/events'
import { usePlanStore } from '@/lib/plan-store'
import type { Event } from '@/lib/types'

interface CountdownCardProps {
  now: Date
  events: Event[]
}

export function CountdownCard({ now, events }: CountdownCardProps) {
  const items = usePlanStore((s) => s.items)
  const { start } = festivalWindow()
  const raw = msUntil(start, now)
  // Round up to the next whole day for a friendlier "X days to go" display
  const ms = Math.max(0, start.getTime() - now.getTime())
  const days = ms % 86_400_000 === 0 ? raw.days : raw.days + 1
  const { hours, mins } = raw

  const day1Events = events.filter((e) => dayKeyForDate(new Date(e.starts_at)) === 'mon')
  const planSet = new Set(items.map((i) => i.event_id))
  const planDay1 = day1Events.filter((e) => planSet.has(e.id))

  const showPlan = planDay1.length > 0
  const preview = showPlan
    ? planDay1.slice(0, 3)
    : events.filter((e) => e.is_editors_pick).slice(0, 3)

  return (
    <div className="bg-[#111111] border border-[#1A1A1A] rounded-md p-6 space-y-5">
      <div>
        <p className="text-xs font-mono text-[#666666] uppercase tracking-widest mb-1">
          Pre-festival
        </p>
        <p className="font-mono text-2xl font-bold text-[#FF6B35]">
          {`Tech Week starts in ${days} days, ${hours}h ${mins}m`}
        </p>
        <p className="text-sm text-[#A3A3A3] mt-1">Monday June 1, 2026 · New York City</p>
      </div>

      <div>
        <p className="text-xs font-mono text-[#A3A3A3] uppercase tracking-widest mb-3">
          {showPlan ? 'From your plan · Day 1' : 'Editor’s Picks · Day 1 preview'}
        </p>
        {preview.length === 0 ? (
          <p className="text-sm text-[#666666]">No events queued yet. Browse to start →</p>
        ) : (
          <ul className="space-y-2">
            {preview.map((e) => (
              <li key={e.id} className="text-sm">
                <p className="font-mono text-[#FAFAFA]">{e.title}</p>
                <p className="text-xs text-[#666666]">
                  {e.host} · {formatEventTime(e.starts_at, e.ends_at)}
                  {e.neighborhood ? ` · ${e.neighborhood}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
