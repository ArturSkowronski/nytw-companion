import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StatusPickerInline } from '../../components/StatusPickerInline'
import { usePlanStore } from '../../lib/plan-store'

describe('StatusPickerInline', () => {
  beforeEach(() => {
    usePlanStore.getState().clear()
    usePlanStore.getState().addItem('event-1', 'interested', 'manual')
  })

  it('renders all six statuses', () => {
    render(<StatusPickerInline eventId="event-1" />)
    for (const label of ['Interested', 'RSVPed', 'Confirmed', 'Waitlist', 'Declined', 'Attended']) {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument()
    }
  })

  it('highlights the current status', () => {
    render(<StatusPickerInline eventId="event-1" />)
    const interested = screen.getByRole('button', { name: /Interested/ })
    expect(interested.getAttribute('aria-pressed')).toBe('true')
  })

  it('clicking a status updates the plan store', () => {
    render(<StatusPickerInline eventId="event-1" />)
    fireEvent.click(screen.getByRole('button', { name: /Declined/ }))
    expect(usePlanStore.getState().items[0].status).toBe('declined')
  })

  it('returns null when the event is not in the plan', () => {
    const { container } = render(<StatusPickerInline eventId="missing" />)
    expect(container.firstChild).toBeNull()
  })
})
