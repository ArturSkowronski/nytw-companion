'use client'

import { formatEventTime } from '@/lib/events'
import { haversineKm, uberTimeMin, walkingTimeMin } from '@/lib/geo'
import { msUntil } from '@/lib/time'
import { usePlanStore } from '@/lib/plan-store'
import { Button } from '@/components/ui/button'
import { StatusToggle } from '@/components/StatusToggle'
import { StaticMapImage } from '@/components/StaticMapImage'
import type { Event } from '@/lib/types'
import type { LatLng } from '@/lib/geo'

interface NextUpCardProps {
  event: Event
  now: Date
  geo: LatLng | null
}

function mapsHref(event: Event): string {
  const query = event.address ?? event.venue_name ?? `${event.lat},${event.lng}`
  return `https://maps.google.com/?q=${encodeURIComponent(query)}`
}

function untilLabel(now: Date, target: Date): string {
  const { days, hours, mins } = msUntil(target, now)
  if (days > 0) return `Starts in ${days}d ${hours}h`
  if (hours > 0) return `Starts in ${hours}h ${mins}m`
  return `Starts in ${mins} min`
}

export function NextUpCard({ event, now, geo }: NextUpCardProps) {
  const updateStatus = usePlanStore((s) => s.updateStatus)

  const km = geo && event.lat != null && event.lng != null
    ? haversineKm(geo, { lat: event.lat, lng: event.lng })
    : null

  function handleSkip() {
    updateStatus(event.id, 'declined')
  }

  return (
    <div className="bg-[#0B0B0B] border border-[#1A1A1A] rounded-md p-6 space-y-5">
      <div>
        <p className="text-xs font-mono text-[#9B9B9B] uppercase tracking-widest mb-1">
          Next up
        </p>
        <p className="font-mono text-xl font-bold text-[#F5F5F5]">{event.title}</p>
        <p className="text-sm text-[#9B9B9B] mt-1">
          {event.host} · {formatEventTime(event.starts_at, event.ends_at)}
        </p>
        <p className="font-mono text-base text-[#FF5B25] mt-2">
          {untilLabel(now, new Date(event.starts_at))}
        </p>
      </div>

      {event.address && (
        <p className="text-sm text-[#9B9B9B]">📍 {event.address}</p>
      )}

      {km !== null && (
        <p className="text-sm text-[#9B9B9B]">
          ~{uberTimeMin(km)} min Uber · {walkingTimeMin(km)} min walk
        </p>
      )}

      {event.lat != null && event.lng != null && (
        <StaticMapImage lat={event.lat} lng={event.lng} width={600} height={200} />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <a
          href={mapsHref(event)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-md bg-[#FF5B25] hover:bg-[#e85a25] text-white font-mono text-sm px-4 py-2"
        >
          Open in Maps →
        </a>
        <Button
          variant="outline"
          className="border-[#333333] text-[#9B9B9B] hover:bg-[#1A1A1A] font-mono"
          onClick={handleSkip}
        >
          Skip this event
        </Button>
      </div>

      <StatusToggle eventId={event.id} />
    </div>
  )
}
