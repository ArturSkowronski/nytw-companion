'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { dayKeyForDate, type DayKey } from '@/lib/time'
import { haversineKm, uberTimeMin, walkingTimeMin } from '@/lib/geo'
import { MapTokenFallback } from '@/components/MapTokenFallback'
import { DayChipNav } from '@/components/DayChipNav'
import type { Event, PlanItem } from '@/lib/types'

const STATUS_COLOR: Record<PlanItem['status'], string> = {
  interested:   '#A3A3A3',
  rsvp_pending: '#f59e0b',
  confirmed:    '#22c55e',
  waitlist:     '#f59e0b',
  declined:     '#ef4444',
  attended:     '#16a34a',
}

interface MyPlanMapProps {
  planEvents: Array<{ item: PlanItem; event: Event }>
  initialDay: DayKey
}

export function MyPlanMap({ planEvents, initialDay }: MyPlanMapProps) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<unknown>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const params = useSearchParams()
  const urlDay = params.get('day') as DayKey | null
  const day = urlDay ?? initialDay

  const planByDay = useMemo(() => {
    const grouped: Record<DayKey, Array<{ item: PlanItem; event: Event }>> = {
      sun: [], mon: [], tue: [], wed: [], thu: [], fri: [], sat: [],
    }
    for (const p of planEvents) {
      const k = dayKeyForDate(new Date(p.event.starts_at))
      grouped[k].push(p)
    }
    for (const k of Object.keys(grouped) as DayKey[]) {
      grouped[k].sort((a, b) =>
        new Date(a.event.starts_at).getTime() - new Date(b.event.starts_at).getTime()
      )
    }
    return grouped
  }, [planEvents])

  const eventsByDayCounts = useMemo(() => {
    return Object.fromEntries(
      Object.entries(planByDay).map(([k, v]) => [k, v.length])
    ) as Record<DayKey, number>
  }, [planByDay])

  const visible = useMemo(() => {
    return planByDay[day].filter((p) => p.event.lat != null && p.event.lng != null)
  }, [planByDay, day])

  // Init map once
  useEffect(() => {
    if (!token || !containerRef.current) return
    let cancelled = false
    let mapInstance: { remove?: () => void } | null = null

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
    }
  }, [token])

  // Update sources/layers when visible changes
  useEffect(() => {
    const map = mapRef.current as null | {
      isStyleLoaded: () => boolean
      on: (ev: string, cb: () => void) => void
      getSource: (id: string) => null | { setData: (data: unknown) => void }
      addSource: (id: string, src: unknown) => void
      addLayer: (layer: unknown) => void
    }
    if (!map) return

    const pinFeatures = visible.map((p) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [p.event.lng as number, p.event.lat as number] },
      properties: {
        id: p.event.id,
        color: STATUS_COLOR[p.item.status],
        title: p.event.title,
      },
    }))

    const lineFeatures: unknown[] = []
    const labelFeatures: unknown[] = []
    for (let i = 0; i < visible.length - 1; i++) {
      const a = visible[i].event
      const b = visible[i + 1].event
      const aLng = a.lng as number, aLat = a.lat as number
      const bLng = b.lng as number, bLat = b.lat as number
      lineFeatures.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [[aLng, aLat], [bLng, bLat]] },
        properties: {},
      })
      const km = haversineKm({ lat: aLat, lng: aLng }, { lat: bLat, lng: bLng })
      labelFeatures.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [(aLng + bLng) / 2, (aLat + bLat) / 2] },
        properties: { label: `~${uberTimeMin(km)} min Uber · ${walkingTimeMin(km)} min walk` },
      })
    }

    const setOrAdd = () => {
      const pinSrc = map.getSource('plan-pins')
      if (pinSrc) {
        pinSrc.setData({ type: 'FeatureCollection', features: pinFeatures })
      } else {
        map.addSource('plan-pins', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: pinFeatures },
        })
        map.addLayer({
          id: 'plan-pin-circles',
          type: 'circle',
          source: 'plan-pins',
          paint: {
            'circle-radius': 8,
            'circle-color': ['get', 'color'],
            'circle-stroke-color': '#0A0A0A',
            'circle-stroke-width': 2,
          },
        })
      }

      const lineSrc = map.getSource('plan-lines')
      if (lineSrc) {
        lineSrc.setData({ type: 'FeatureCollection', features: lineFeatures })
      } else {
        map.addSource('plan-lines', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: lineFeatures },
        })
        map.addLayer({
          id: 'plan-line-strokes',
          type: 'line',
          source: 'plan-lines',
          paint: {
            'line-color': '#FF6B35',
            'line-opacity': 0.5,
            'line-width': 2,
            'line-dasharray': [2, 2],
          },
        })
      }

      const labelSrc = map.getSource('plan-labels')
      if (labelSrc) {
        labelSrc.setData({ type: 'FeatureCollection', features: labelFeatures })
      } else {
        map.addSource('plan-labels', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: labelFeatures },
        })
        map.addLayer({
          id: 'plan-label-text',
          type: 'symbol',
          source: 'plan-labels',
          minzoom: 13,
          layout: {
            'text-field': ['get', 'label'],
            'text-size': 10,
            'text-offset': [0, 0],
            'text-anchor': 'center',
          },
          paint: {
            'text-color': '#FAFAFA',
            'text-halo-color': '#0A0A0A',
            'text-halo-width': 2,
          },
        })
      }
    }

    if (map.isStyleLoaded()) setOrAdd()
    else map.on('load', setOrAdd)
  }, [visible])

  if (!token) return <MapTokenFallback />
  if (loadError) return <MapTokenFallback message={`Map failed to load: ${loadError}`} />

  return (
    <div className="space-y-4">
      <DayChipNav eventsByDay={eventsByDayCounts} />
      <div className="relative w-full h-[600px] rounded-md overflow-hidden border border-[#1A1A1A]">
        <div ref={containerRef} className="w-full h-full" />
        {visible.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-[#111111]/95 border border-[#1A1A1A] rounded-md px-4 py-3 text-center pointer-events-auto">
              <p className="font-mono text-sm text-[#A3A3A3]">No plan events on this day.</p>
              <p className="text-xs text-[#7A7A7A] mt-1">Try another day →</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
