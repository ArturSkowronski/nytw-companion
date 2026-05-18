// lib/geo.ts
export type LatLng = { lat: number; lng: number }

const EARTH_KM = 6371

function toRad(deg: number) {
  return (deg * Math.PI) / 180
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_KM * Math.asin(Math.sqrt(s))
}

export function walkingTimeMin(km: number): number {
  return Math.round(km * 12)
}

export function uberTimeMin(km: number): number {
  return Math.round(km * 4 + 5)
}

export const neighborhoodCentroids: Record<string, LatLng> = {
  'Flatiron':           { lat: 40.7411, lng: -73.9897 },
  'SoHo':               { lat: 40.7233, lng: -74.0030 },
  'Williamsburg':       { lat: 40.7081, lng: -73.9571 },
  'DUMBO':              { lat: 40.7033, lng: -73.9881 },
  'Hudson Yards':       { lat: 40.7536, lng: -74.0014 },
  'Chelsea':            { lat: 40.7465, lng: -74.0014 },
  'Tribeca':            { lat: 40.7163, lng: -74.0086 },
  'NoMad':              { lat: 40.7445, lng: -73.9887 },
  'Greenpoint':         { lat: 40.7290, lng: -73.9540 },
  'Bushwick':           { lat: 40.6944, lng: -73.9213 },
  'Long Island City':   { lat: 40.7447, lng: -73.9485 },
  'Brooklyn Navy Yard': { lat: 40.7019, lng: -73.9719 },
  'Midtown':            { lat: 40.7549, lng: -73.9840 },
  'Lower East Side':    { lat: 40.7150, lng: -73.9843 },
  'East Village':       { lat: 40.7265, lng: -73.9815 },
  'West Village':       { lat: 40.7359, lng: -74.0030 },
  'Financial District': { lat: 40.7074, lng: -74.0113 },
  'Bowery':             { lat: 40.7220, lng: -73.9930 },
  'NoHo':               { lat: 40.7281, lng: -73.9931 },
  'Gowanus':            { lat: 40.6745, lng: -73.9886 },
}

export function staticMapUrl(opts: {
  lat: number
  lng: number
  zoom: number
  width: number
  height: number
  markerColor?: string
}): string {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  if (!token) return ''
  const color = (opts.markerColor ?? 'ff6b35').replace('#', '')
  const pin = `pin-s+${color}(${opts.lng},${opts.lat})`
  return (
    `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/` +
    `${pin}/${opts.lng},${opts.lat},${opts.zoom},0/${opts.width}x${opts.height}@2x` +
    `?access_token=${token}`
  )
}
