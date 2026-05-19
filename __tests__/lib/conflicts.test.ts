import { describe, it, expect } from 'vitest'
import { detectConflicts } from '../../lib/conflicts'
import type { Event, PlanItem } from '../../lib/types'

const mkEvent = (id: string, starts_at: string, ends_at: string): Event => ({
  id, title: id, description: '', host: '', starts_at, ends_at,
  venue_name: null, address: null, lat: null, lng: null, neighborhood: null,
  rsvp_url: '', rsvp_platform: 'other', tags: [], audience_tags: [],
  format: null, capacity: null, is_invite_only: false, has_free_food: false,
  has_free_drinks: false, is_editors_pick: false, editors_pick_blurb: null,
  is_virtuslab_event: false, source: '', source_url: '',
  created_at: '', updated_at: '',
})

const mkItem = (event_id: string, status: PlanItem['status']): PlanItem => ({
  event_id, status, source: 'manual', added_at: '2026-05-01T00:00:00Z',
})

describe('detectConflicts', () => {
  it('returns empty for empty input', () => {
    expect(detectConflicts([], [])).toEqual([])
  })

  it('returns empty when only interested items overlap', () => {
    const events = [
      mkEvent('a', '2026-06-03T18:00:00Z', '2026-06-03T20:00:00Z'),
      mkEvent('b', '2026-06-03T19:00:00Z', '2026-06-03T21:00:00Z'),
    ]
    const items = [mkItem('a', 'interested'), mkItem('b', 'interested')]
    expect(detectConflicts(items, events)).toEqual([])
  })

  it('flags two overlapping confirmed items', () => {
    const events = [
      mkEvent('a', '2026-06-03T18:00:00Z', '2026-06-03T20:00:00Z'),
      mkEvent('b', '2026-06-03T19:00:00Z', '2026-06-03T21:00:00Z'),
    ]
    const items = [mkItem('a', 'confirmed'), mkItem('b', 'confirmed')]
    const pairs = detectConflicts(items, events)
    expect(pairs).toHaveLength(1)
    expect([pairs[0].a.event_id, pairs[0].b.event_id].sort()).toEqual(['a', 'b'])
  })

  it('flags one confirmed + one rsvp_pending', () => {
    const events = [
      mkEvent('a', '2026-06-03T18:00:00Z', '2026-06-03T20:00:00Z'),
      mkEvent('b', '2026-06-03T19:00:00Z', '2026-06-03T21:00:00Z'),
    ]
    const items = [mkItem('a', 'confirmed'), mkItem('b', 'rsvp_pending')]
    expect(detectConflicts(items, events)).toHaveLength(1)
  })

  it('does NOT flag back-to-back events that just touch', () => {
    const events = [
      mkEvent('a', '2026-06-03T18:00:00Z', '2026-06-03T19:00:00Z'),
      mkEvent('b', '2026-06-03T19:00:00Z', '2026-06-03T20:00:00Z'),
    ]
    const items = [mkItem('a', 'confirmed'), mkItem('b', 'confirmed')]
    expect(detectConflicts(items, events)).toEqual([])
  })

  it('flags three mutually overlapping events as three pairs', () => {
    const events = [
      mkEvent('a', '2026-06-03T18:00:00Z', '2026-06-03T20:00:00Z'),
      mkEvent('b', '2026-06-03T18:30:00Z', '2026-06-03T20:30:00Z'),
      mkEvent('c', '2026-06-03T19:00:00Z', '2026-06-03T21:00:00Z'),
    ]
    const items = [mkItem('a', 'confirmed'), mkItem('b', 'confirmed'), mkItem('c', 'confirmed')]
    expect(detectConflicts(items, events)).toHaveLength(3)
  })

  it('ignores items whose event_id is not in events', () => {
    const events = [mkEvent('a', '2026-06-03T18:00:00Z', '2026-06-03T20:00:00Z')]
    const items = [mkItem('a', 'confirmed'), mkItem('ghost', 'confirmed')]
    expect(detectConflicts(items, events)).toEqual([])
  })

  it('ignores declined, attended, waitlist', () => {
    const events = [
      mkEvent('a', '2026-06-03T18:00:00Z', '2026-06-03T20:00:00Z'),
      mkEvent('b', '2026-06-03T19:00:00Z', '2026-06-03T21:00:00Z'),
    ]
    for (const status of ['declined', 'attended', 'waitlist'] as const) {
      const items = [mkItem('a', 'confirmed'), mkItem('b', status)]
      expect(detectConflicts(items, events)).toEqual([])
    }
  })
})
