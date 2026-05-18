// __tests__/components/CountdownCard.test.tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CountdownCard } from '../../components/CountdownCard'
import { usePlanStore } from '../../lib/plan-store'
import type { Event } from '../../lib/types'

const mkEvent = (id: string, starts_at: string, extras: Partial<Event> = {}): Event => ({
  id, title: id.toUpperCase(), description: '', host: '', starts_at,
  ends_at: starts_at, venue_name: null, address: null, lat: null, lng: null,
  neighborhood: null, rsvp_url: '', rsvp_platform: 'other', tags: [],
  audience_tags: [], format: null, capacity: null, is_invite_only: false,
  has_free_food: false, has_free_drinks: false, is_editors_pick: false,
  editors_pick_blurb: null, is_virtuslab_event: false, source: '',
  source_url: '', created_at: '', updated_at: '',
  ...extras,
})

describe('CountdownCard', () => {
  beforeEach(() => {
    usePlanStore.getState().clear()
  })

  it('shows countdown to June 1 from a pre-festival now', () => {
    const now = new Date('2026-05-20T12:00:00Z')
    render(<CountdownCard now={now} events={[]} />)
    expect(screen.getByText(/Tech Week starts in/i)).toBeInTheDocument()
    expect(screen.getByText(/12 days/i)).toBeInTheDocument()
  })

  it('shows Day 1 plan preview when plan has June 1 events', () => {
    const e = mkEvent('e1', '2026-06-01T18:00:00Z')
    usePlanStore.getState().addItem('e1')
    render(<CountdownCard now={new Date('2026-05-20T12:00:00Z')} events={[e]} />)
    expect(screen.getByText(/E1/)).toBeInTheDocument()
    expect(screen.getByText(/From your plan/i)).toBeInTheDocument()
  })

  it('falls back to Editor’s Picks when no plan items on Day 1', () => {
    const pick = mkEvent('p1', '2026-06-03T18:00:00Z', { is_editors_pick: true })
    render(<CountdownCard now={new Date('2026-05-20T12:00:00Z')} events={[pick]} />)
    expect(screen.getByText(/P1/)).toBeInTheDocument()
    expect(screen.getByText(/Editor’s Picks/i)).toBeInTheDocument()
  })
})
