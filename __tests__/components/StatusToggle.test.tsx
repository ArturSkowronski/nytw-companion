import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StatusToggle } from '../../components/StatusToggle'
import { usePlanStore } from '../../lib/plan-store'

describe('StatusToggle', () => {
  beforeEach(() => {
    usePlanStore.getState().clear()
    usePlanStore.getState().addItem('event-1', 'interested', 'manual')
  })

  it('renders all six statuses with labels', () => {
    render(<StatusToggle eventId="event-1" />)
    for (const label of ['Interested', 'RSVPed', 'Confirmed', 'Waitlist', 'Declined', 'Attended']) {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument()
    }
  })

  it('marks the current status with aria-pressed=true', () => {
    render(<StatusToggle eventId="event-1" />)
    const interested = screen.getByRole('button', { name: /Interested/ })
    expect(interested.getAttribute('aria-pressed')).toBe('true')
    const confirmed = screen.getByRole('button', { name: /Confirmed/ })
    expect(confirmed.getAttribute('aria-pressed')).toBe('false')
  })

  it('clicking a status updates the plan store', () => {
    render(<StatusToggle eventId="event-1" />)
    fireEvent.click(screen.getByRole('button', { name: /Declined/ }))
    expect(usePlanStore.getState().items[0].status).toBe('declined')
  })

  it('returns null when the event is not in the plan', () => {
    const { container } = render(<StatusToggle eventId="missing" />)
    expect(container.firstChild).toBeNull()
  })
})
