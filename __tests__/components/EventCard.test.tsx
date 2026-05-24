// __tests__/components/EventCard.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EventCard } from '../../components/EventCard'
import { usePlanStore } from '../../lib/plan-store'
import type { Event } from '../../lib/types'

const mockEvent: Event = {
  id: 'test-event-1',
  title: 'Test AI Panel',
  description: 'A great test event about AI infrastructure at scale.',
  host: 'TestCo',
  starts_at: '2026-06-03T22:00:00Z',
  ends_at: '2026-06-04T01:00:00Z',
  venue_name: 'Test Venue',
  address: '123 Test St, New York, NY',
  lat: 40.74,
  lng: -73.99,
  neighborhood: 'Flatiron',
  rsvp_url: 'https://lu.ma/test',
  rsvp_platform: 'luma',
  tags: ['ai-infra', 'devtools'],
  audience_tags: ['engineer'],
  format: 'panel',
  capacity: 100,
  is_invite_only: false,
  has_free_food: false,
  has_free_drinks: false,
  is_editors_pick: false,
  editors_pick_blurb: null,
  is_virtuslab_event: false,
  source: 'luma',
  source_url: 'https://lu.ma/test',
  created_at: '2026-05-01T00:00:00Z',
  updated_at: '2026-05-01T00:00:00Z',
}

describe('EventCard', () => {
  beforeEach(() => {
    usePlanStore.getState().clear()
  })

  it('renders the event title and host', () => {
    render(<EventCard event={mockEvent} />)
    expect(screen.getByText('Test AI Panel')).toBeTruthy()
    expect(screen.getByText('TestCo')).toBeTruthy()
  })

  it('renders the neighborhood badge', () => {
    render(<EventCard event={mockEvent} />)
    expect(screen.getByText('Flatiron')).toBeTruthy()
  })

  it('shows "Save" button when event is not in plan', () => {
    render(<EventCard event={mockEvent} />)
    expect(screen.getByText('Save')).toBeTruthy()
  })

  it('clicking "Save" adds event to plan store', () => {
    render(<EventCard event={mockEvent} />)
    fireEvent.click(screen.getByText('Save'))
    expect(usePlanStore.getState().items).toHaveLength(1)
    expect(usePlanStore.getState().items[0].event_id).toBe('test-event-1')
  })

  it('shows "In your plan ✓" when event is already in plan', () => {
    usePlanStore.getState().addItem('test-event-1')
    render(<EventCard event={mockEvent} />)
    expect(screen.getByText(/In your plan/)).toBeTruthy()
  })

  it('renders Editor\'s Pick badge when is_editors_pick is true', () => {
    render(<EventCard event={{ ...mockEvent, is_editors_pick: true }} />)
    expect(screen.getByText("Editor's Pick")).toBeTruthy()
  })

  it('renders "Invite-only" badge when is_invite_only is true', () => {
    render(<EventCard event={{ ...mockEvent, is_invite_only: true }} />)
    expect(screen.getByText('Invite-only')).toBeTruthy()
  })

  it('invokes onTagClick when a tag chip is clicked', () => {
    const onTagClick = vi.fn()
    render(<EventCard event={mockEvent} onTagClick={onTagClick} />)
    fireEvent.click(screen.getByRole('button', { name: /filter by tag ai-infra/i }))
    expect(onTagClick).toHaveBeenCalledWith('ai-infra')
  })
})
