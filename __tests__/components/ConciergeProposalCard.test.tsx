import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConciergeProposalCard } from '../../components/ConciergeProposalCard'
import type { Event } from '../../lib/types'
import type { Proposal } from '../../lib/concierge-schema'

const event: Event = {
  id: 'e1', title: 'OpenAI Rooftop', description: 'desc', host: 'OpenAI',
  starts_at: '2026-06-03T22:30:00Z', ends_at: '2026-06-04T01:00:00Z',
  venue_name: 'Roof', address: '1 Main', lat: 40, lng: -74,
  neighborhood: 'Williamsburg', rsvp_url: 'https://x', rsvp_platform: 'luma',
  tags: [], audience_tags: [], format: 'rooftop', capacity: null,
  is_invite_only: false, has_free_food: false, has_free_drinks: false,
  is_editors_pick: false, editors_pick_blurb: null, is_virtuslab_event: false,
  source: '', source_url: '', created_at: '', updated_at: '',
}

const proposal: Proposal = {
  event_id: 'e1',
  reasoning: 'Matches your AI infrastructure interest.',
  priority: 'must-attend',
  is_stretch: false,
}

describe('ConciergeProposalCard', () => {
  it('renders title, host, time, reasoning', () => {
    render(
      <ConciergeProposalCard
        event={event}
        proposal={proposal}
        accepted={false}
        skipped={false}
        onAccept={() => {}}
        onSkip={() => {}}
      />,
    )
    expect(screen.getByText(/OpenAI Rooftop/)).toBeInTheDocument()
    expect(screen.getByText(/Matches your AI infrastructure interest/)).toBeInTheDocument()
  })

  it('renders priority badge text', () => {
    render(
      <ConciergeProposalCard
        event={event}
        proposal={proposal}
        accepted={false}
        skipped={false}
        onAccept={() => {}}
        onSkip={() => {}}
      />,
    )
    expect(screen.getByText(/must-attend/i)).toBeInTheDocument()
  })

  it('renders Stretch badge when proposal.is_stretch', () => {
    render(
      <ConciergeProposalCard
        event={event}
        proposal={{ ...proposal, is_stretch: true }}
        accepted={false}
        skipped={false}
        onAccept={() => {}}
        onSkip={() => {}}
      />,
    )
    expect(screen.getByText(/Stretch/i)).toBeInTheDocument()
  })

  it('calls onAccept when Accept clicked', () => {
    const onAccept = vi.fn()
    render(
      <ConciergeProposalCard
        event={event}
        proposal={proposal}
        accepted={false}
        skipped={false}
        onAccept={onAccept}
        onSkip={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Accept/i }))
    expect(onAccept).toHaveBeenCalledTimes(1)
  })

  it('calls onSkip when Skip clicked', () => {
    const onSkip = vi.fn()
    render(
      <ConciergeProposalCard
        event={event}
        proposal={proposal}
        accepted={false}
        skipped={false}
        onAccept={() => {}}
        onSkip={onSkip}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Skip/i }))
    expect(onSkip).toHaveBeenCalledTimes(1)
  })

  it('shows Added ✓ link when accepted=true', () => {
    render(
      <ConciergeProposalCard
        event={event}
        proposal={proposal}
        accepted={true}
        skipped={false}
        onAccept={() => {}}
        onSkip={() => {}}
      />,
    )
    expect(screen.queryByRole('button', { name: /Accept/i })).toBeNull()
    expect(screen.getByText(/Added/i)).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /see \/my-plan/i })
    expect(link).toHaveAttribute('href', '/my-plan')
  })
})
