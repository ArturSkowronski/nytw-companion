// __tests__/lib/events.test.ts
import { describe, it, expect } from 'vitest'
import { groupEventsByDay, getTimePeriod, formatEventTime, formatStartTime, formatEndTime } from '../../lib/events'
import type { Event } from '../../lib/types'

function makeEvent(overrides: Partial<Event> & { starts_at: string; ends_at: string }): Event {
  return {
    id: 'test-event',
    title: 'Test Event',
    description: 'A test event',
    host: 'Test Host',
    venue_name: 'Test Venue',
    address: '123 Test St, New York, NY',
    lat: 40.74,
    lng: -73.99,
    neighborhood: 'Flatiron',
    rsvp_url: 'https://lu.ma/test',
    rsvp_platform: 'luma',
    tags: [],
    audience_tags: [],
    format: 'panel',
    capacity: null,
    is_invite_only: false,
    has_free_food: false,
    has_free_drinks: false,
    is_editors_pick: false,
    editors_pick_blurb: null,
    is_virtuslab_event: false,
    source: 'manual',
    source_url: 'https://lu.ma/test',
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
    ...overrides,
  }
}

describe('getTimePeriod', () => {
  it('returns EARLY for events before noon NYC', () => {
    // 2026-06-01T14:00:00Z = 10:00 AM EDT
    expect(getTimePeriod('2026-06-01T14:00:00Z')).toBe('EARLY')
  })

  it('returns MID for events between noon and 5pm NYC', () => {
    // 2026-06-01T17:00:00Z = 1:00 PM EDT
    expect(getTimePeriod('2026-06-01T17:00:00Z')).toBe('MID')
  })

  it('returns LATE for events at or after 5pm NYC', () => {
    // 2026-06-01T21:00:00Z = 5:00 PM EDT
    expect(getTimePeriod('2026-06-01T21:00:00Z')).toBe('LATE')
  })
})

describe('groupEventsByDay', () => {
  it('groups events into arrays keyed by NYC date string YYYY-MM-DD', () => {
    const events = [
      makeEvent({ id: 'a', starts_at: '2026-06-01T14:00:00Z', ends_at: '2026-06-01T16:00:00Z' }),
      makeEvent({ id: 'b', starts_at: '2026-06-01T19:00:00Z', ends_at: '2026-06-01T21:00:00Z' }),
      makeEvent({ id: 'c', starts_at: '2026-06-02T14:00:00Z', ends_at: '2026-06-02T16:00:00Z' }),
    ]
    const groups = groupEventsByDay(events)
    expect(Object.keys(groups)).toHaveLength(2)
    expect(groups['2026-06-01']).toHaveLength(2)
    expect(groups['2026-06-02']).toHaveLength(1)
  })

  it('returns events within each day sorted by starts_at ascending', () => {
    const events = [
      makeEvent({ id: 'b', starts_at: '2026-06-01T19:00:00Z', ends_at: '2026-06-01T21:00:00Z' }),
      makeEvent({ id: 'a', starts_at: '2026-06-01T14:00:00Z', ends_at: '2026-06-01T16:00:00Z' }),
    ]
    const groups = groupEventsByDay(events)
    expect(groups['2026-06-01'][0].id).toBe('a')
    expect(groups['2026-06-01'][1].id).toBe('b')
  })

  it('returns an empty object for empty input', () => {
    expect(groupEventsByDay([])).toEqual({})
  })
})

describe('formatEventTime', () => {
  it('formats start and end in NYC timezone', () => {
    // 2026-06-03T22:00:00Z = 6:00 PM EDT, 2026-06-04T01:00:00Z = 9:00 PM EDT
    const result = formatEventTime('2026-06-03T22:00:00Z', '2026-06-04T01:00:00Z')
    expect(result).toBe('Wed 6:00 PM – 9:00 PM')
  })
})

describe('formatStartTime / formatEndTime', () => {
  it('formatStartTime returns NYC time in h:mm aa format', () => {
    // 2026-06-03T22:00:00Z = 6:00 PM EDT (NYC June = UTC-4)
    expect(formatStartTime('2026-06-03T22:00:00Z')).toMatch(/6:00\s*PM/i)
  })

  it('formatEndTime returns NYC time in h:mm aa format', () => {
    // 2026-06-04T01:00:00Z = 9:00 PM EDT
    expect(formatEndTime('2026-06-04T01:00:00Z')).toMatch(/9:00\s*PM/i)
  })
})
