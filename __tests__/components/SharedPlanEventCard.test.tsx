import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const { addItemMock } = vi.hoisted(() => ({ addItemMock: vi.fn() }))
const { toastFn } = vi.hoisted(() => ({ toastFn: vi.fn() }))

vi.mock('sonner', () => ({
  toast: Object.assign(toastFn, { success: vi.fn(), error: vi.fn() }),
}))

vi.mock('../../lib/plan-store', () => ({
  usePlanStore: (selector: (s: { items: { event_id: string }[]; addItem: typeof addItemMock }) => unknown) =>
    selector({ items: [], addItem: addItemMock }),
}))

import { SharedPlanEventCard } from '../../components/SharedPlanEventCard'
import type { Event } from '../../lib/types'

const event: Event = {
  id: 'evt-1', title: 'AI Meetup', description: '', host: 'OpenAI',
  starts_at: '2026-06-03T22:30:00Z', ends_at: '2026-06-04T01:00:00Z',
  venue_name: 'V', address: null, lat: null, lng: null,
  neighborhood: 'SoHo', rsvp_url: 'https://x', rsvp_platform: 'other',
  tags: [], audience_tags: [], format: null, capacity: null,
  is_invite_only: false, has_free_food: false, has_free_drinks: false,
  is_editors_pick: false, editors_pick_blurb: null, is_virtuslab_event: false,
  source: '', source_url: '', created_at: '', updated_at: '',
}

describe('SharedPlanEventCard', () => {
  beforeEach(() => {
    addItemMock.mockClear()
    toastFn.mockClear()
  })

  it('renders title, host, neighborhood', () => {
    render(<SharedPlanEventCard event={event} alreadyInPlan={false} />)
    expect(screen.getByText('AI Meetup')).toBeInTheDocument()
    expect(screen.getByText(/OpenAI/)).toBeInTheDocument()
    expect(screen.getByText(/SoHo/)).toBeInTheDocument()
  })

  it('calls addItem with source share when "Add to my plan" clicked', () => {
    render(<SharedPlanEventCard event={event} alreadyInPlan={false} />)
    fireEvent.click(screen.getByRole('button', { name: /add to my plan/i }))
    expect(addItemMock).toHaveBeenCalledWith('evt-1', 'interested', 'share')
    expect(toastFn).toHaveBeenCalled()
  })

  it('shows "In your plan" state when alreadyInPlan is true', () => {
    render(<SharedPlanEventCard event={event} alreadyInPlan={true} />)
    expect(screen.getByText(/in your plan/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add to my plan/i })).toBeNull()
  })
})

import { SharedPlanView } from '../../components/SharedPlanView'

describe('SharedPlanView', () => {
  const events: Event[] = [
    { ...event, id: 'a', starts_at: '2026-06-03T15:00:00Z', ends_at: '2026-06-03T16:00:00Z' },
    { ...event, id: 'b', starts_at: '2026-06-04T15:00:00Z', ends_at: '2026-06-04T16:00:00Z' },
  ]

  it('renders the sender name in the header when provided', () => {
    render(<SharedPlanView ids={['a']} senderName="Marcin" allEvents={events} />)
    expect(screen.getByText(/marcin's nytw plan/i)).toBeInTheDocument()
  })

  it('renders a generic header when no name is provided', () => {
    render(<SharedPlanView ids={['a']} senderName={undefined} allEvents={events} />)
    expect(screen.getByText(/shared nytw plan/i)).toBeInTheDocument()
  })

  it('shows a footer note when some ids are unknown', () => {
    render(<SharedPlanView ids={['a', 'missing-1', 'missing-2']} senderName={undefined} allEvents={events} />)
    expect(screen.getByText(/2 events from this plan are no longer available/i)).toBeInTheDocument()
  })

  it('renders an empty state when ids list is empty', () => {
    render(<SharedPlanView ids={[]} senderName={undefined} allEvents={events} />)
    expect(screen.getByText(/this share link is empty/i)).toBeInTheDocument()
  })
})
