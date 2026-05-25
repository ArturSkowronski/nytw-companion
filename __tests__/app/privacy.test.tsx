import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PrivacyPage from '../../app/(marketing)/privacy/page'

describe('/privacy', () => {
  it('renders the H1 and lede', () => {
    render(<PrivacyPage />)
    expect(screen.getByRole('heading', { level: 1, name: /^privacy$/i })).toBeInTheDocument()
    expect(screen.getByText(/built to be unintrusive/i)).toBeInTheDocument()
  })

  it('renders all section headings', () => {
    render(<PrivacyPage />)
    expect(screen.getByRole('heading', { level: 2, name: /plan storage/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /ai concierge/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /analytics/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /map tiles/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /geolocation/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /cookies/i })).toBeInTheDocument()
  })

  it('mentions Anthropic, Mapbox, Vercel', () => {
    render(<PrivacyPage />)
    expect(screen.getByText(/anthropic/i)).toBeInTheDocument()
    expect(screen.getByText(/mapbox/i)).toBeInTheDocument()
    expect(screen.getByText(/vercel/i)).toBeInTheDocument()
  })

  it('renders the VirtusLabFooter (not-affiliated text)', () => {
    render(<PrivacyPage />)
    expect(screen.getByText(/not affiliated with a16z or tech week nyc/i)).toBeInTheDocument()
  })
})
