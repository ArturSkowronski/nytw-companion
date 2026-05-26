import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { decodePlan } from '../../lib/share-encoding'

const { toastFn } = vi.hoisted(() => ({ toastFn: vi.fn() }))
vi.mock('sonner', () => ({
  toast: Object.assign(toastFn, { success: vi.fn(), error: vi.fn() }),
}))

import { SharePlanButton } from '../../components/SharePlanButton'

describe('SharePlanButton', () => {
  beforeEach(() => {
    toastFn.mockClear()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  it('is disabled when there are no events', () => {
    render(<SharePlanButton eventIds={[]} />)
    const trigger = screen.getByRole('button', { name: /share my plan/i })
    expect(trigger).toBeDisabled()
  })

  it('opens a dialog whose URL contains a hash payload', async () => {
    render(<SharePlanButton eventIds={['a', 'b']} />)
    fireEvent.click(screen.getByRole('button', { name: /share my plan/i }))
    const url = await screen.findByDisplayValue(/\/plan\/share#.+/)
    expect(url).toBeInTheDocument()
  })

  it('writes the URL to clipboard and toasts on Copy', async () => {
    render(<SharePlanButton eventIds={['a']} />)
    fireEvent.click(screen.getByRole('button', { name: /share my plan/i }))
    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: /copy link/i }))
    })
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1)
    const copied = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(copied).toMatch(/\/plan\/share#.+/)
    expect(toastFn).toHaveBeenCalledWith('Link copied — paste it in your DM')
  })

  it('encodes the optional sender name into the URL', async () => {
    render(<SharePlanButton eventIds={['a']} />)
    fireEvent.click(screen.getByRole('button', { name: /share my plan/i }))
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Marcin' } })
    const input = await screen.findByDisplayValue(/\/plan\/share#.+/) as HTMLInputElement
    const hash = input.value.split('#')[1]
    expect(decodePlan(hash)).toEqual({ ids: ['a'], name: 'Marcin' })
  })
})
