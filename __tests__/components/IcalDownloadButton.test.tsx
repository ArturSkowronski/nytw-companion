import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { IcalDownloadButton } from '../../components/IcalDownloadButton'
import type { Event, PlanItem } from '../../lib/types'

const mkEvent = (id: string): Event => ({
  id, title: `Event ${id}`, description: '', host: 'H',
  starts_at: '2026-06-03T22:30:00Z', ends_at: '2026-06-04T01:00:00Z',
  venue_name: 'V', address: '1 Main', lat: null, lng: null,
  neighborhood: null, rsvp_url: 'https://x', rsvp_platform: 'other',
  tags: [], audience_tags: [], format: null, capacity: null,
  is_invite_only: false, has_free_food: false, has_free_drinks: false,
  is_editors_pick: false, editors_pick_blurb: null, is_virtuslab_event: false,
  source: '', source_url: '', created_at: '', updated_at: '',
})
const mkItem = (event_id: string, status: PlanItem['status']): PlanItem => ({
  event_id, status, source: 'manual', added_at: '2026-05-01T00:00:00Z',
})

describe('IcalDownloadButton', () => {
  let createObjectURL: ReturnType<typeof vi.fn>
  let revokeObjectURL: ReturnType<typeof vi.fn>

  beforeEach(() => {
    createObjectURL = vi.fn(() => 'blob:fake')
    revokeObjectURL = vi.fn()
    Object.defineProperty(globalThis.URL, 'createObjectURL', { value: createObjectURL, configurable: true })
    Object.defineProperty(globalThis.URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true })
  })

  it('renders disabled when no exportable items', () => {
    const events = [mkEvent('a')]
    const items = [mkItem('a', 'interested')]
    render(<IcalDownloadButton items={items} events={events} />)
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
    expect(btn.textContent).toMatch(/Nothing to export/i)
  })

  it('renders enabled with "Download .ics" when items exportable', () => {
    const events = [mkEvent('a')]
    const items = [mkItem('a', 'confirmed')]
    render(<IcalDownloadButton items={items} events={events} />)
    const btn = screen.getByRole('button')
    expect(btn).not.toBeDisabled()
    expect(btn.textContent).toMatch(/Download \.ics/i)
  })

  it('clicking calls URL.createObjectURL and revokeObjectURL', () => {
    const events = [mkEvent('a')]
    const items = [mkItem('a', 'confirmed')]
    render(<IcalDownloadButton items={items} events={events} />)
    fireEvent.click(screen.getByRole('button'))
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledTimes(1)
    const blob = createObjectURL.mock.calls[0][0] as Blob
    expect(blob.type).toBe('text/calendar')
  })
})
