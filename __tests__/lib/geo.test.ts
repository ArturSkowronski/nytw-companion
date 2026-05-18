// __tests__/lib/geo.test.ts
import { describe, it, expect } from 'vitest'
import {
  haversineKm,
  walkingTimeMin,
  uberTimeMin,
  neighborhoodCentroids,
  staticMapUrl,
} from '../../lib/geo'

describe('haversineKm', () => {
  it('returns 0 for the same point', () => {
    const p = { lat: 40.7589, lng: -73.9851 }
    expect(haversineKm(p, p)).toBeCloseTo(0, 3)
  })
  it('returns ~5km for Flatiron → Williamsburg', () => {
    const flatiron = { lat: 40.7411, lng: -73.9897 }
    const williamsburg = { lat: 40.7081, lng: -73.9571 }
    const d = haversineKm(flatiron, williamsburg)
    expect(d).toBeGreaterThan(4)
    expect(d).toBeLessThan(6)
  })
})

describe('walkingTimeMin', () => {
  it('returns 12 minutes per km, rounded', () => {
    expect(walkingTimeMin(1)).toBe(12)
    expect(walkingTimeMin(2.5)).toBe(30)
  })
})

describe('uberTimeMin', () => {
  it('returns km*4 + 5 minutes, rounded', () => {
    expect(uberTimeMin(1)).toBe(9)
    expect(uberTimeMin(5)).toBe(25)
  })
})

describe('neighborhoodCentroids', () => {
  it('contains Flatiron, Williamsburg, DUMBO, SoHo, Hudson Yards', () => {
    expect(neighborhoodCentroids['Flatiron']).toBeDefined()
    expect(neighborhoodCentroids['Williamsburg']).toBeDefined()
    expect(neighborhoodCentroids['DUMBO']).toBeDefined()
    expect(neighborhoodCentroids['SoHo']).toBeDefined()
    expect(neighborhoodCentroids['Hudson Yards']).toBeDefined()
  })
  it('returns plausible Manhattan coords for Flatiron', () => {
    const { lat, lng } = neighborhoodCentroids['Flatiron']
    expect(lat).toBeGreaterThan(40.7)
    expect(lat).toBeLessThan(40.8)
    expect(lng).toBeGreaterThan(-74.05)
    expect(lng).toBeLessThan(-73.95)
  })
})

describe('staticMapUrl', () => {
  it('produces a Mapbox Static API URL with marker, lat, lng, zoom, dims', () => {
    const orig = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = 'test_token_123'
    const url = staticMapUrl({
      lat: 40.7411,
      lng: -73.9897,
      zoom: 14,
      width: 400,
      height: 200,
    })
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = orig
    expect(url).toContain('api.mapbox.com/styles/v1/mapbox/dark-v11/static')
    expect(url).toContain('pin-s')
    expect(url).toContain('-73.9897,40.7411')
    expect(url).toContain('14')
    expect(url).toContain('400x200')
    expect(url).toContain('access_token=')
  })
  it('returns empty string when token is not configured', () => {
    const orig = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = ''
    expect(staticMapUrl({ lat: 40, lng: -73, zoom: 12, width: 400, height: 200 })).toBe('')
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = orig
  })
})
