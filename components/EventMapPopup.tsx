'use client'

import { haversineKm, walkingTimeMin } from '@/lib/geo'
import { formatEventTime } from '@/lib/events'
import type { Event } from '@/lib/types'

interface EventMapPopupProps {
  event: Event
  sameDayEvents: Event[]
  onOpenDetails: (eventId: string) => void
}

export function EventMapPopup({ event, sameDayEvents, onOpenDetails }: EventMapPopupProps) {
  const nearest = event.lat != null && event.lng != null
    ? sameDayEvents
        .filter((e) => e.id !== event.id && e.lat != null && e.lng != null)
        .map((e) => ({
          e,
          km: haversineKm(
            { lat: event.lat as number, lng: event.lng as number },
            { lat: e.lat as number, lng: e.lng as number },
          ),
        }))
        .sort((a, b) => a.km - b.km)
        .slice(0, 5)
    : []

  return (
    <div className="bg-[#0B0B0B] border border-[#1A1A1A] rounded-md p-3 text-[#F5F5F5] font-sans max-w-[280px]">
      <p className="font-mono text-sm font-bold mb-1">{event.title}</p>
      <p className="text-xs text-[#9B9B9B] mb-2">
        {event.host} · {formatEventTime(event.starts_at, event.ends_at)}
      </p>
      {event.neighborhood && (
        <p className="text-xs text-[#9B9B9B] mb-3">📍 {event.neighborhood}</p>
      )}
      <button
        type="button"
        onClick={() => onOpenDetails(event.id)}
        className="font-mono text-xs text-[#FF5B25] hover:underline"
      >
        Open details →
      </button>

      {nearest.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[#1A1A1A]">
          <p className="text-[10px] text-[#9B9B9B] uppercase tracking-widest mb-1.5">
            5 nearest same day
          </p>
          <ul className="space-y-1">
            {nearest.map(({ e, km }) => (
              <li key={e.id} className="text-xs">
                <button
                  type="button"
                  onClick={() => onOpenDetails(e.id)}
                  className="text-left text-[#9B9B9B] hover:text-[#F5F5F5]"
                >
                  {e.title}{' '}
                  <span className="text-[#9B9B9B]">
                    · {walkingTimeMin(km)} min walk
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
