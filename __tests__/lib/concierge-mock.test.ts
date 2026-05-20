import { describe, it, expect } from 'vitest'
import { buildMockProposals } from '../../lib/concierge-mock'
import type { Event } from '../../lib/types'

const mkEvent = (id: string, isEditorPick: boolean, starts_at: string): Event => ({
  id, title: `Event ${id}`, description: '', host: '', starts_at, ends_at: starts_at,
  venue_name: null, address: null, lat: null, lng: null, neighborhood: null,
  rsvp_url: '', rsvp_platform: 'other', tags: [], audience_tags: [],
  format: null, capacity: null, is_invite_only: false, has_free_food: false,
  has_free_drinks: false, is_editors_pick: isEditorPick, editors_pick_blurb: null,
  is_virtuslab_event: false, source: '', source_url: '',
  created_at: '', updated_at: '',
})

describe('buildMockProposals', () => {
  it('returns up to `count` proposals', () => {
    const events = [
      mkEvent('a', true, '2026-06-01T18:00:00Z'),
      mkEvent('b', true, '2026-06-02T18:00:00Z'),
      mkEvent('c', true, '2026-06-03T18:00:00Z'),
    ]
    const result = buildMockProposals(events, 5)
    expect(result.proposals).toHaveLength(3)
  })

  it('first proposal has priority must-attend or high; rest medium', () => {
    const events = [
      mkEvent('a', true, '2026-06-01T18:00:00Z'),
      mkEvent('b', true, '2026-06-02T18:00:00Z'),
    ]
    const result = buildMockProposals(events, 5)
    expect(['must-attend', 'high']).toContain(result.proposals[0].priority)
    expect(result.proposals[1].priority).toBe('medium')
  })

  it('prefers editor picks first, then fills with non-picks by starts_at', () => {
    const events = [
      mkEvent('a', false, '2026-06-01T18:00:00Z'),
      mkEvent('b', true,  '2026-06-02T18:00:00Z'),
      mkEvent('c', false, '2026-06-03T18:00:00Z'),
    ]
    const result = buildMockProposals(events, 3)
    expect(result.proposals.map((p) => p.event_id)).toEqual(['b', 'a', 'c'])
  })

  it('all proposals have is_stretch: false', () => {
    const events = [mkEvent('a', true, '2026-06-01T18:00:00Z')]
    const result = buildMockProposals(events, 5)
    expect(result.proposals.every((p) => p.is_stretch === false)).toBe(true)
  })

  it('returns empty proposals + helpful note when candidates is empty', () => {
    const result = buildMockProposals([], 5)
    expect(result.proposals).toEqual([])
    expect(result.notes).toContain('ANTHROPIC_API_KEY')
  })

  it('notes mentions mock mode', () => {
    const events = [mkEvent('a', true, '2026-06-01T18:00:00Z')]
    const result = buildMockProposals(events, 5)
    expect(result.notes).toMatch(/Mock proposals/i)
    expect(result.notes).toContain('ANTHROPIC_API_KEY')
  })
})
