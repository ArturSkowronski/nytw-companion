import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DayChipNav } from '../../components/DayChipNav'

const replace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams('view=map&day=wed'),
  usePathname: () => '/events',
}))

describe('DayChipNav', () => {
  beforeEach(() => {
    replace.mockReset()
  })

  it('renders 7 chips Mon–Sun', () => {
    render(<DayChipNav eventsByDay={{}} />)
    for (const label of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument()
    }
  })

  it('marks the active day from ?day= URL param', () => {
    render(<DayChipNav eventsByDay={{}} />)
    const wed = screen.getByRole('button', { name: /Wed/ })
    expect(wed.className).toMatch(/border-\[#FF6B35\]/)
  })

  it('shows a 0-badge on chips with no events', () => {
    render(<DayChipNav eventsByDay={{ mon: 3, tue: 0 }} />)
    const tue = screen.getByRole('button', { name: /Tue/ })
    expect(tue.textContent).toContain('0')
  })

  it('clicking a chip calls router.replace with updated ?day=', () => {
    render(<DayChipNav eventsByDay={{}} />)
    fireEvent.click(screen.getByRole('button', { name: /Fri/ }))
    expect(replace).toHaveBeenCalledWith('/events?view=map&day=fri', { scroll: false })
  })
})
