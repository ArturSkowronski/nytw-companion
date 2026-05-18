'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createRoot, type Root } from 'react-dom/client'
import { dayKeyForDate, type DayKey } from '@/lib/time'
import { MapTokenFallback } from '@/components/MapTokenFallback'
import { DayChipNav } from '@/components/DayChipNav'
import { EventMapPopup } from '@/components/EventMapPopup'
import { EventDetailModal } from '@/components/EventDetailModal'
import { usePlanStore } from '@/lib/plan-store'
import type { Event } from '@/lib/types'

const FORMAT_COLORS: Record<string, string> = {
  rooftop:   '#f59e0b',
  dinner:    '#ef4444',
  panel:     '#3b82f6',
  breakfast: '#22c55e',
  hackathon: '#a855f7',
  workshop:  '#14b8a6',
}
const DEFAULT_COLOR = '#A3A3A3'

interface EventMapProps {
  events: Event[]
  initialDay: DayKey
}

export function EventMap({ events, initialDay }: EventMapProps) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<unknown>(null)
  const popupRootRef = useRef<Root | null>(null)
  const popupElRef = useRef<HTMLDivElement | null>(null)
  const [showOnlyMyPlan, setShowOnlyMyPlan] = useState(false)
  const [modalEventId, setModalEventId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const params = useSearchParams()
  const urlDay = params.get('day') as DayKey | null
  const day = urlDay ?? initialDay

  const planItemIds = usePlanStore((s) => s.items.map((i) => i.event_id))

  const eventsByDay = useMemo(() => {
    const grouped: Record<DayKey, Event[]> = {
      sun: [], mon: [], tue: [], wed: [], thu: [], fri: [], sat: [],
    }
    for (const e of events) {
      const k = dayKeyForDate(new Date(e.starts_at))
      grouped[k].push(e)
    }
    return grouped
  }, [events])

  const eventsByDayCounts = useMemo(() => {
    return Object.fromEntries(
      Object.entries(eventsByDay).map(([k, v]) => [k, v.length])
    ) as Record<DayKey, number>
  }, [eventsByDay])

  const visibleEvents = useMemo(() => {
    const dayEvents = eventsByDay[day].filter(
      (e) => e.lat != null && e.lng != null
    )
    if (!showOnlyMyPlan) return dayEvents
    const setIds = new Set(planItemIds)
    return dayEvents.filter((e) => setIds.has(e.id))
  }, [eventsByDay, day, showOnlyMyPlan, planItemIds])

  const eventLookup = useMemo(() => {
    const m = new Map<string, Event>()
    for (const e of events) m.set(e.id, e)
    return m
  }, [events])

  const modalEvent = modalEventId ? eventLookup.get(modalEventId) : null

  // Init map once
  useEffect(() => {
    if (!token || !containerRef.current) return
    let cancelled = false
    let mapInstance: { remove?: () => void; on?: (...args: unknown[]) => void } | null = null

    import('mapbox-gl').then(async (mod) => {
      if (cancelled || !containerRef.current) return
      const mapboxgl = mod.default
      await import('mapbox-gl/dist/mapbox-gl.css')

      mapboxgl.accessToken = token
      mapInstance = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [-73.9851, 40.7589],
        zoom: 12,
      })
      mapRef.current = mapInstance
    }).catch((err) => {
      if (!cancelled) setLoadError(err?.message ?? 'Failed to load Mapbox')
    })

    return () => {
      cancelled = true
      mapInstance?.remove?.()
      popupRootRef.current?.unmount()
      popupRootRef.current = null
    }
  }, [token])

  // Update pin source whenever visibleEvents changes
  useEffect(() => {
    const map = mapRef.current as null | {
      isStyleLoaded: () => boolean
      on: (ev: string, cb: () => void) => void
      getSource: (id: string) => null | { setData: (data: unknown) => void }
      addSource: (id: string, src: unknown) => void
      addLayer: (layer: unknown) => void
      getLayer: (id: string) => unknown
      removeLayer: (id: string) => void
      removeSource: (id: string) => void
    }
    if (!map) return

    const featureCollection = {
      type: 'FeatureCollection',
      features: visibleEvents.map((e) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [e.lng as number, e.lat as number] },
        properties: {
          id: e.id,
          color: FORMAT_COLORS[e.format ?? ''] ?? DEFAULT_COLOR,
          isVirtuslab: e.is_virtuslab_event,
          isEditorsPick: e.is_editors_pick,
          title: e.title,
        },
      })),
    }

    const setOrAdd = () => {
      const existing = map.getSource('events')
      if (existing) {
        existing.setData(featureCollection)
      } else {
        map.addSource('events', { type: 'geojson', data: featureCollection, cluster: true, clusterRadius: 40 })
        map.addLayer({
          id: 'event-pins',
          type: 'circle',
          source: 'events',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-radius': ['case', ['==', ['get', 'isVirtuslab'], true], 10, 6],
            'circle-color': ['get', 'color'],
            'circle-stroke-color': '#0A0A0A',
            'circle-stroke-width': 2,
          },
        })
        map.addLayer({
          id: 'event-clusters',
          type: 'circle',
          source: 'events',
          filter: ['has', 'point_count'],
          paint: {
            'circle-radius': 14,
            'circle-color': '#FF6B35',
            'circle-stroke-color': '#0A0A0A',
            'circle-stroke-width': 2,
          },
        })
      }
    }

    if (map.isStyleLoaded()) setOrAdd()
    else map.on('load', setOrAdd)
  }, [visibleEvents])

  // Click handler — open popup
  useEffect(() => {
    const map = mapRef.current as null | {
      on: (ev: string, layer: string, cb: (e: unknown) => void) => void
    }
    if (!map) return
    let popup: { remove: () => void } | null = null

    const handler = async (mapEvent: unknown) => {
      const e = mapEvent as { features?: Array<{ properties: { id: string }; geometry: { coordinates: [number, number] } }> }
      const feature = e.features?.[0]
      if (!feature) return
      const event = eventLookup.get(feature.properties.id)
      if (!event) return

      const mapboxgl = (await import('mapbox-gl')).default
      popup?.remove()

      if (!popupElRef.current) {
        popupElRef.current = document.createElement('div')
      }
      if (!popupRootRef.current) {
        popupRootRef.current = createRoot(popupElRef.current)
      }
      popupRootRef.current.render(
        <EventMapPopup
          event={event}
          sameDayEvents={eventsByDay[dayKeyForDate(new Date(event.starts_at))]}
          onOpenDetails={(id) => {
            setModalEventId(id)
            popup?.remove()
          }}
        />
      )

      popup = new mapboxgl.Popup({ closeButton: true, offset: 12, className: 'nytw-popup' })
        .setLngLat(feature.geometry.coordinates)
        .setDOMContent(popupElRef.current)
        .addTo(mapRef.current as Parameters<typeof mapboxgl.Popup.prototype.addTo>[0])
    }

    map.on('click', 'event-pins', handler)
    return () => {
      popup?.remove()
    }
  }, [eventsByDay, eventLookup])

  if (!token) {
    return <MapTokenFallback />
  }
  if (loadError) {
    return <MapTokenFallback message={`Map failed to load: ${loadError}`} />
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <DayChipNav eventsByDay={eventsByDayCounts} />
        <label className="flex items-center gap-2 text-xs font-mono text-[#A3A3A3]">
          <input
            type="checkbox"
            checked={showOnlyMyPlan}
            onChange={(e) => setShowOnlyMyPlan(e.target.checked)}
            className="accent-[#FF6B35]"
          />
          Show only My Plan
        </label>
      </div>

      <div className="relative w-full h-[600px] rounded-md overflow-hidden border border-[#1A1A1A]">
        <div ref={containerRef} className="w-full h-full" />
        {visibleEvents.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-[#111111]/95 border border-[#1A1A1A] rounded-md px-4 py-3 text-center pointer-events-auto">
              <p className="font-mono text-sm text-[#A3A3A3]">
                {showOnlyMyPlan
                  ? 'No plan events on this day.'
                  : 'No events on this day.'}
              </p>
              <p className="text-xs text-[#666666] mt-1">Try another day →</p>
            </div>
          </div>
        )}
      </div>

      {modalEvent && (
        <EventDetailModal
          event={modalEvent}
          open={modalEvent !== null}
          onClose={() => setModalEventId(null)}
        />
      )}
    </div>
  )
}
