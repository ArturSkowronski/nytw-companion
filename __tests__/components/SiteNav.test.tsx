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

  it('renders live routes as links (Browse, Now, Plan with AI) and dead routes as disabled', () => {
    render(<SiteNav />)
    expect(screen.getByRole('link', { name: /^Browse/i })).toHaveAttribute('href', '/events')
    expect(screen.getByRole('link', { name: /^Now/i })).toHaveAttribute('href', '/now')
    expect(screen.getByRole('link', { name: /Plan with AI/i })).toHaveAttribute('href', '/plan')
    // At least one dead route still exists (/my-plan, /beyond, /about)
    expect(screen.getAllByText(/Coming soon/i).length).toBeGreaterThanOrEqual(1)
  })

  it('highlights the active route from usePathname', () => {
    currentPath = '/events'
    render(<SiteNav />)
    const browse = screen.getByRole('link', { name: /^Browse/i })
    expect(browse.className).toMatch(/text-\[#FF6B35\]/)
  })
})
