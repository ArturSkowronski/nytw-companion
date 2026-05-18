// components/NowClient.tsx
'use client'

import { useEffect, useState } from 'react'
import { festivalMode, nextEventInPlan, nowInNYC } from '@/lib/time'
import { usePlanStore } from '@/lib/plan-store'
import { CountdownCard } from '@/components/CountdownCard'
import { NextUpCard } from '@/components/NextUpCard'
import { AfterThisCard } from '@/components/AfterThisCard'
import { SuggestionsCard } from '@/components/SuggestionsCard'
import { RetroCard } from '@/components/RetroCard'
import { Button } from '@/components/ui/button'
import type { Event } from '@/lib/types'
import type { LatLng } from '@/lib/geo'

interface NowClientProps {
  events: Event[]
}

export function NowClient({ events }: NowClientProps) {
  const [mounted, setMounted] = useState(false)
  const [now, setNow] = useState<Date>(() => nowInNYC())
  const [geo, setGeo] = useState<LatLng | null>(null)
  const [geoError, setGeoError] = useState<string | null>(null)
  const items = usePlanStore((s) => s.items)

  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard SSR hydration guard; single synchronous call on mount, no cascading risk
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    const id = setInterval(() => setNow(nowInNYC()), 60_000)
    return () => clearInterval(id)
  }, [])

  function requestGeo() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoError('Geolocation not supported')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGeoError(null)
      },
      (err) => setGeoError(err.message),
      { enableHighAccuracy: false, maximumAge: 5 * 60_000, timeout: 10_000 },
    )
  }

  if (!mounted) {
    return (
      <div className="bg-[#111111] border border-[#1A1A1A] rounded-md p-6">
        <p className="font-mono text-sm text-[#666666]">Loading…</p>
      </div>
    )
  }

  const mode = festivalMode(now)

  if (mode === 'pre') {
    return (
      <div className="space-y-4">
        <CountdownCard now={now} events={events} />
      </div>
    )
  }

  if (mode === 'post') {
    return (
      <div className="space-y-4">
        <RetroCard />
      </div>
    )
  }

  // mode === 'in'
  const upcoming = nextEventInPlan(items, events, now, 2)
  const afterThis = upcoming
    ? nextEventInPlan(items, events, new Date(upcoming.starts_at), 24)
    : null

  const todayKey = upcoming
    ? new Date(upcoming.starts_at).toISOString().slice(0, 10)
    : new Date(now).toISOString().slice(0, 10)
  const planSet = new Set(items.filter((i) => i.status !== 'declined').map((i) => i.event_id))
  const laterToday = events
    .filter(
      (e) =>
        new Date(e.starts_at) > now &&
        e.starts_at.startsWith(todayKey) &&
        planSet.has(e.id),
    )
    .slice(0, 3)
  const editorsPicks = events.filter((e) => e.is_editors_pick).slice(0, 3)
  const suggestions = laterToday.length > 0 ? laterToday : editorsPicks
  const suggestionsFromPlan = laterToday.length > 0

  return (
    <div className="space-y-4">
      {upcoming ? (
        <>
          <NextUpCard event={upcoming} now={now} geo={geo} />
          <AfterThisCard event={afterThis} />
        </>
      ) : (
        <SuggestionsCard suggestions={suggestions} fromPlan={suggestionsFromPlan} />
      )}

      {!geo && !geoError && (
        <Button
          variant="outline"
          className="border-[#333333] text-[#A3A3A3] hover:bg-[#1A1A1A] font-mono"
          onClick={requestGeo}
        >
          Enable location for travel times →
        </Button>
      )}
      {geoError && (
        <p className="text-xs text-[#666666] font-mono">
          Location unavailable — addresses shown without travel times.
        </p>
      )}
    </div>
  )
}
