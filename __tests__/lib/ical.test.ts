import { describe, it, expect } from 'vitest'
import { buildIcs } from '../../lib/ical'
import type { Event, PlanItem } from '../../lib/types'

const mkEvent = (id: string, overrides: Partial<Event> = {}): Event => ({
  id,
  title: `Event ${id}`,
  description: 'desc',
  host: 'Host',
  starts_at: '2026-06-03T22:30:00.000Z',
  ends_at: '2026-06-04T01:00:00.000Z',
  venue_name: 'Some Roof',
  address: '123 Main St, Brooklyn, NY',
  lat: 40.7081, lng: -73.9571,
  neighborhood: 'Williamsburg',
  rsvp_url: 'https://lu.ma/e/abc',
  rsvp_platform: 'luma',
  tags: [], audience_tags: [], format: 'rooftop', capacity: null,
  is_invite_only: false, has_free_food: false, has_free_drinks: false,
  is_editors_pick: false, editors_pick_blurb: null, is_virtuslab_event: false,
  source: '', source_url: '', created_at: '', updated_at: '',
  ...overrides,
})

const mkItem = (event_id: string, status: PlanItem['status']): PlanItem => ({
  event_id, status, source: 'manual', added_at: '2026-05-01T00:00:00Z',
})

describe('buildIcs', () => {
  it('returns a string starting with BEGIN:VCALENDAR', () => {
    const events = [mkEvent('a')]
    const items = [mkItem('a', 'confirmed')]
    const ics = buildIcs(items, events)
    expect(typeof ics).toBe('string')
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true)
    expect(ics).toContain('END:VCALENDAR')
  })

  it('filters out interested, declined, attended', () => {
    const events = [mkEvent('a'), mkEvent('b'), mkEvent('c'), mkEvent('d')]
    const items = [
      mkItem('a', 'interested'),
      mkItem('b', 'declined'),
      mkItem('c', 'attended'),
      mkItem('d', 'confirmed'),
    ]
    const ics = buildIcs(items, events)
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(1)
    expect(ics).toContain('Event d')
    expect(ics).not.toContain('Event a')
    expect(ics).not.toContain('Event b')
    expect(ics).not.toContain('Event c')
  })

  it('includes confirmed, rsvp_pending, waitlist statuses', () => {
    const events = [mkEvent('a'), mkEvent('b'), mkEvent('c')]
    const items = [
      mkItem('a', 'confirmed'),
      mkItem('b', 'rsvp_pending'),
      mkItem('c', 'waitlist'),
    ]
    const ics = buildIcs(items, events)
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(3)
  })

  it('prefixes status emoji in SUMMARY', () => {
    const events = [mkEvent('a'), mkEvent('b'), mkEvent('c')]
    const items = [
      mkItem('a', 'confirmed'),
      mkItem('b', 'rsvp_pending'),
      mkItem('c', 'waitlist'),
    ]
    const ics = buildIcs(items, events)
    expect(ics).toMatch(/SUMMARY[^\n]*✅[^\n]*Event a/)
    expect(ics).toMatch(/SUMMARY[^\n]*⏳[^\n]*Event b/)
    expect(ics).toMatch(/SUMMARY[^\n]*📋[^\n]*Event c/)
  })

  it('emits LOCATION, URL, UID, DTSTART, DTEND', () => {
    const events = [mkEvent('a')]
    const items = [mkItem('a', 'confirmed')]
    const ics = buildIcs(items, events)
    expect(ics).toContain('LOCATION:123 Main St')
    expect(ics).toContain('URL:https://lu.ma/e/abc')
    expect(ics).toContain('UID:a@nytw-companion')
    expect(ics).toContain('DTSTART')
    expect(ics).toContain('DTEND')
  })

  it('falls back to venue_name when address is null', () => {
    const events = [mkEvent('a', { address: null, venue_name: 'Some Roof' })]
    const items = [mkItem('a', 'confirmed')]
    const ics = buildIcs(items, events)
    expect(ics).toContain('LOCATION:Some Roof')
  })

  it('drops items whose event_id is not in events', () => {
    const events = [mkEvent('a')]
    const items = [mkItem('a', 'confirmed'), mkItem('ghost', 'confirmed')]
    const ics = buildIcs(items, events)
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(1)
  })

  it('returns an empty calendar when no items qualify', () => {
    const events = [mkEvent('a')]
    const items = [mkItem('a', 'interested')]
    const ics = buildIcs(items, events)
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('END:VCALENDAR')
    expect(ics.match(/BEGIN:VEVENT/g) ?? []).toHaveLength(0)
  })

  it('throws when ics package returns an error', () => {
    const events = [mkEvent('a', { starts_at: 'not-a-date', ends_at: '2026-06-04T01:00:00.000Z' })]
    const items = [mkItem('a', 'confirmed')]
    expect(() => buildIcs(items, events)).toThrow()
  })
})
