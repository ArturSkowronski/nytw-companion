// __tests__/components/SiteNav.test.tsx
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

  it('renders all live routes as links (Browse, Now, My Plan, Plan, Beyond, About)', () => {
    render(<SiteNav />)
    expect(screen.getByRole('link', { name: /^Browse/i })).toHaveAttribute('href', '/events')
    expect(screen.getByRole('link', { name: /^Now/i })).toHaveAttribute('href', '/now')
    expect(screen.getByRole('link', { name: /my plan/i })).toHaveAttribute('href', '/my-plan')
    expect(screen.getByRole('link', { name: /^Plan$/i })).toHaveAttribute('href', '/plan')
    expect(screen.getByRole('link', { name: /^Beyond/i })).toHaveAttribute('href', '/beyond')
    expect(screen.getByRole('link', { name: /^About/i })).toHaveAttribute('href', '/about')
    // No "Coming soon" stubs — all routes are live
    expect(screen.queryByText(/Coming soon/i)).toBeNull()
  })

  it('highlights the active route from usePathname', () => {
    currentPath = '/events'
    render(<SiteNav />)
    const browse = screen.getByRole('link', { name: /^Browse/i })
    expect(browse.className).toMatch(/text-black/)
  })

  it('renders the brand mark with NYTW text', () => {
    render(<SiteNav />)
    expect(screen.getByText(/NYTW/i)).toBeTruthy()
  })
})
