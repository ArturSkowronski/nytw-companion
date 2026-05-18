import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SiteNav } from '../../components/SiteNav'

let currentPath = '/'
vi.mock('next/navigation', () => ({
  usePathname: () => currentPath,
}))

describe('SiteNav', () => {
  beforeEach(() => {
    currentPath = '/'
  })

  it('renders live routes as links and dead routes as disabled "Coming soon"', () => {
    render(<SiteNav />)
    expect(screen.getByRole('link', { name: /^Browse/i })).toHaveAttribute('href', '/events')
    expect(screen.getByRole('link', { name: /^Now/i })).toHaveAttribute('href', '/now')
    const myPlan = screen.getAllByText(/My Plan/i)[0]
    expect(myPlan.closest('a')).toBeNull()
    expect(screen.getAllByText(/Coming soon/i).length).toBeGreaterThanOrEqual(1)
  })

  it('highlights the active route from usePathname', () => {
    currentPath = '/events'
    render(<SiteNav />)
    const browse = screen.getByRole('link', { name: /^Browse/i })
    expect(browse.className).toMatch(/text-\[#FF6B35\]/)
  })
})
