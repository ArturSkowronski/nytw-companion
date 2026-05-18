'use client'

import { formatEventTime } from '@/lib/events'
import type { Event } from '@/lib/types'

interface SuggestionsCardProps {
  suggestions: Event[]
  fromPlan: boolean
}

export function SuggestionsCard({ suggestions, fromPlan }: SuggestionsCardProps) {
  return (
    <div className="bg-[#111111] border border-[#1A1A1A] rounded-md p-5">
      <p className="text-xs font-mono text-[#666666] uppercase tracking-widest mb-3">
        {fromPlan ? 'Nothing planned next 2h — later today' : 'Plan is light — try one of these'}
      </p>
      {suggestions.length === 0 ? (
        <p className="text-sm text-[#666666]">No suggestions available.</p>
      ) : (
        <ul className="space-y-3">
          {suggestions.map((e) => (
            <li key={e.id}>
              <p className="font-mono text-sm text-[#FAFAFA]">{e.title}</p>
              <p className="text-xs text-[#A3A3A3]">
                {e.host} · {formatEventTime(e.starts_at, e.ends_at)}
                {e.neighborhood ? ` · ${e.neighborhood}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
