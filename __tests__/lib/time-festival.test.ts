// __tests__/lib/time-festival.test.ts
import { describe, it, expect } from 'vitest'
import {
  festivalWindow,
  festivalMode,
  dayKeyForDate,
  dateForDayKey,
  nextEventInPlan,
  msUntil,
} from '../../lib/time'
import type { Event, PlanItem } from '../../lib/types'

const baseEvent = (id: string, starts_at: string, ends_at: string): Event => ({
  id, title: id, description: '', host: '', starts_at, ends_at,
  venue_name: null, address: null, lat: null, lng: null, neighborhood: null,
  rsvp_url: '', rsvp_platform: 'other', tags: [], audience_tags: [],
  format: null, capacity: null, is_invite_only: false, has_free_food: false,
  has_free_drinks: false, is_editors_pick: false, editors_pick_blurb: null,
  is_virtuslab_event: false, source: '', source_url: '',
  created_at: '', updated_at: '',
})

const planItem = (event_id: string, status: PlanItem['status'] = 'interested'): PlanItem => ({
  event_id, status, source: 'manual', added_at: '2026-05-01T00:00:00Z',
})

describe('festivalWindow', () => {
  it('returns Jun 1 00:00 EDT to Jun 7 23:59:59.999 EDT', () => {
    const { start, end } = festivalWindow()
    expect(start.toISOString()).toBe('2026-06-01T04:00:00.000Z')
    expect(end.toISOString()).toBe('2026-06-08T03:59:59.999Z')
  })
})

describe('festivalMode', () => {
  it('returns "pre" for May 20 2026', () => {
    expect(festivalMode(new Date('2026-05-20T12:00:00Z'))).toBe('pre')
  })
  it('returns "in" for June 3 2026 18:00 UTC (14:00 EDT)', () => {
    expect(festivalMode(new Date('2026-06-03T18:00:00Z'))).toBe('in')
  })
  it('returns "post" for June 9 2026', () => {
    expect(festivalMode(new Date('2026-06-09T12:00:00Z'))).toBe('post')
  })
})

describe('dayKeyForDate', () => {
  it('returns "wed" for June 3 2026 14:00 EDT', () => {
    expect(dayKeyForDate(new Date('2026-06-03T18:00:00Z'))).toBe('wed')
  })
  it('returns "mon" for June 1 2026 EDT', () => {
    expect(dayKeyForDate(new Date('2026-06-01T18:00:00Z'))).toBe('mon')
  })
  it('returns "sun" for June 7 2026 EDT', () => {
    expect(dayKeyForDate(new Date('2026-06-07T18:00:00Z'))).toBe('sun')
  })
})

describe('dateForDayKey', () => {
  it('returns 2026-06-03 04:00 UTC (midnight EDT) for "wed"', () => {
    expect(dateForDayKey('wed').toISOString()).toBe('2026-06-03T04:00:00.000Z')
  })
  it('returns 2026-06-01 for "mon"', () => {
    expect(dateForDayKey('mon').toISOString()).toBe('2026-06-01T04:00:00.000Z')
  })
})

describe('nextEventInPlan', () => {
  const now = new Date('2026-06-03T18:00:00Z') // 14:00 EDT Wed
  const events: Event[] = [
    baseEvent('e1', '2026-06-03T19:00:00Z', '2026-06-03T20:00:00Z'), // +1h
    baseEvent('e2', '2026-06-03T22:00:00Z', '2026-06-03T23:00:00Z'), // +4h, outside 2h
    baseEvent('e3', '2026-06-03T18:30:00Z', '2026-06-03T19:00:00Z'), // +30m
  ]
  it('returns soonest event in plan within 2h', () => {
    const items = [planItem('e1'), planItem('e2'), planItem('e3')]
    expect(nextEventInPlan(items, events, now)?.id).toBe('e3')
  })
  it('returns null when no plan items are within 2h', () => {
    const items = [planItem('e2')]
    expect(nextEventInPlan(items, events, now)).toBeNull()
  })
  it('ignores declined items', () => {
    const items = [planItem('e3', 'declined'), planItem('e1')]
    expect(nextEventInPlan(items, events, now)?.id).toBe('e1')
  })
  it('ignores attended items', () => {
    const items = [planItem('e3', 'attended'), planItem('e1')]
    expect(nextEventInPlan(items, events, now)?.id).toBe('e1')
  })
  it('returns null for empty plan', () => {
    expect(nextEventInPlan([], events, now)).toBeNull()
  })
})

describe('msUntil', () => {
  it('returns days/hours/mins to a future target', () => {
    const now = new Date('2026-05-20T12:00:00Z')
    const target = new Date('2026-05-22T15:30:00Z')
    expect(msUntil(target, now)).toEqual({ days: 2, hours: 3, mins: 30 })
  })
  it('clamps negatives to zero', () => {
    const now = new Date('2026-06-10T00:00:00Z')
    const target = new Date('2026-06-09T00:00:00Z')
    expect(msUntil(target, now)).toEqual({ days: 0, hours: 0, mins: 0 })
  })
})
