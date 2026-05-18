import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NextUpCard } from '../../components/NextUpCard'
import { usePlanStore } from '../../lib/plan-store'
import type { Event } from '../../lib/types'

const event: Event = {
  id: 'e1',
  title: 'OpenAI Rooftop',
  description: '',
  host: 'OpenAI',
  starts_at: '2026-06-03T22:30:00Z',
  ends_at: '2026-06-04T01:00:00Z',
  venue_name: 'Some Roof',
  address: '123 Main St, Brooklyn, NY',
  lat: 40.7081, lng: -73.9571,
  neighborhood: 'Williamsburg',
  rsvp_url: '', rsvp_platform: 'other',
  tags: [], audience_tags: [], format: 'rooftop', capacity: null,
  is_invite_only: false, has_free_food: false, has_free_drinks: false,
  is_editors_pick: false, editors_pick_blurb: null, is_virtuslab_event: false,
  source: '', source_url: '', created_at: '', updated_at: '',
}

describe('NextUpCard', () => {
  beforeEach(() => {
    usePlanStore.getState().clear()
    usePlanStore.getState().addItem('e1', 'interested', 'manual')
  })

  it('renders title, host, and time-until', () => {
    const now = new Date('2026-06-03T22:00:00Z')
    render(<NextUpCard event={event} now={now} geo={null} />)
    expect(screen.getByText(/OpenAI Rooftop/)).toBeInTheDocument()
    expect(screen.getAllByText(/OpenAI/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Starts in 30 min/)).toBeInTheDocument()
  })

  it('shows travel time when geo is provided', () => {
    const now = new Date('2026-06-03T22:00:00Z')
    render(<NextUpCard event={event} now={now} geo={{ lat: 40.7411, lng: -73.9897 }} />)
    expect(screen.getByText(/min Uber/i)).toBeInTheDocument()
  })

  it('"Open in Maps" link points to a maps URL containing the address', () => {
    render(<NextUpCard event={event} now={new Date('2026-06-03T22:00:00Z')} geo={null} />)
    const link = screen.getByRole('link', { name: /Open in Maps/i })
    const href = link.getAttribute('href') ?? ''
    expect(decodeURIComponent(href)).toContain('123 Main St')
  })

  it('"Skip this event" sets status to declined', () => {
    render(<NextUpCard event={event} now={new Date('2026-06-03T22:00:00Z')} geo={null} />)
    fireEvent.click(screen.getByRole('button', { name: /Skip this event/i }))
    expect(usePlanStore.getState().items[0].status).toBe('declined')
  })
})
