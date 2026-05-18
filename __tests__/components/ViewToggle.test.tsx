import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ViewToggle } from '../../components/ViewToggle'

const replace = vi.fn()
let params = new URLSearchParams()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => params,
  usePathname: () => '/events',
}))

describe('ViewToggle', () => {
  beforeEach(() => {
    replace.mockReset()
    params = new URLSearchParams()
  })

  it('renders Timeline and Map buttons; Timeline active by default', () => {
    render(<ViewToggle />)
    const timeline = screen.getByRole('button', { name: /Timeline/ })
    const map = screen.getByRole('button', { name: /Map/ })
    expect(timeline.getAttribute('aria-pressed')).toBe('true')
    expect(map.getAttribute('aria-pressed')).toBe('false')
  })

  it('marks Map active when ?view=map', () => {
    params = new URLSearchParams('view=map')
    render(<ViewToggle />)
    const map = screen.getByRole('button', { name: /Map/ })
    expect(map.getAttribute('aria-pressed')).toBe('true')
  })

  it('clicking Map calls router.replace with ?view=map, preserving day', () => {
    params = new URLSearchParams('day=wed')
    render(<ViewToggle />)
    fireEvent.click(screen.getByRole('button', { name: /Map/ }))
    expect(replace).toHaveBeenCalledWith('/events?day=wed&view=map', { scroll: false })
  })

  it('clicking Timeline removes ?view= from the URL', () => {
    params = new URLSearchParams('view=map&day=wed')
    render(<ViewToggle />)
    fireEvent.click(screen.getByRole('button', { name: /Timeline/ }))
    expect(replace).toHaveBeenCalledWith('/events?day=wed', { scroll: false })
  })
})
