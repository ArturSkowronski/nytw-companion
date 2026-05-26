import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock plan store so EditorsPicksCarousel can render
vi.mock('../../lib/plan-store', async () => {
  const actual = await vi.importActual<typeof import('../../lib/plan-store')>('../../lib/plan-store')
  return {
    ...actual,
    usePlanStore: () => ({ items: [], addItem: () => {} }),
  }
})

import HomePage from '../../app/(marketing)/page'

describe('Landing page', () => {
  it('renders the hero with the scrape→kept headline', () => {
    render(<HomePage />)
    expect(screen.getByText(/1,390 events scraped/i)).toBeInTheDocument()
    expect(screen.getByText(/for humans/i)).toBeInTheDocument()
  })

  it('renders the MCP integration section with endpoint and tool list', () => {
    render(<HomePage />)
    expect(screen.getByRole('heading', { level: 2, name: /companion is mcp-native/i })).toBeInTheDocument()
    expect(screen.getAllByText(/nytw\.dev\/mcp/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/catalogue_stats/i)).toBeInTheDocument()
    expect(screen.getByText(/search_events/i)).toBeInTheDocument()
  })

  it('renders the subtle Beyond link in the hero', () => {
    render(<HomePage />)
    const link = screen.getByRole('link', { name: /see \/beyond if you want it all/i })
    expect(link).toHaveAttribute('href', '/beyond')
  })

  it('renders the 3-step flow strip', () => {
    render(<HomePage />)
    expect(screen.getByText(/Browse or AI-plan/i)).toBeInTheDocument()
    expect(screen.getByText(/Add to My Plan/i)).toBeInTheDocument()
    expect(screen.getByText(/Sync to your calendar/i)).toBeInTheDocument()
  })

  // VirtusLab editor-pick disclosure test removed — raw tech-week.com scrape
  // has no curated picks yet. Re-add once Artur designates Editor's Picks.

  it('renders "Why we built this" section with author signature', () => {
    render(<HomePage />)
    expect(screen.getByRole('heading', { level: 2, name: /why we built this/i })).toBeInTheDocument()
    // Author signature line in the editorial footer of the section.
    // (Artur is also named in the PartnerInvite blurb, so we match the
    // mono-font byline specifically.)
    expect(screen.getByText(/—\s*Artur Skowro/i)).toBeInTheDocument()
  })

  it("renders \"What we don't do\" with three bullets", () => {
    render(<HomePage />)
    expect(screen.getByRole('heading', { level: 2, name: /what we don.?t do/i })).toBeInTheDocument()
    expect(screen.getByText(/we don.?t rsvp for you/i)).toBeInTheDocument()
    expect(screen.getByText(/we.?d recommend to an engineer friend/i)).toBeInTheDocument()
    expect(screen.getByText(/we don.?t track you/i)).toBeInTheDocument()
  })

  it('renders the VirtusLabFooter (not affiliated text)', () => {
    render(<HomePage />)
    expect(screen.getByText(/not affiliated with a16z or tech week nyc/i)).toBeInTheDocument()
  })
})
