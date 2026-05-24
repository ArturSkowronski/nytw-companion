import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import BeyondPage from '../../app/(marketing)/beyond/page'
import sources from '../../data/external-sources.json'

describe('/beyond', () => {
  it('renders the page header and lede', () => {
    render(<BeyondPage />)
    expect(screen.getByRole('heading', { level: 1, name: /other places/i })).toBeInTheDocument()
    expect(screen.getByText(/we curate 87 engineering-relevant events/i)).toBeInTheDocument()
  })

  it('renders every source name from external-sources.json', () => {
    render(<BeyondPage />)
    for (const s of sources) {
      expect(screen.getByText(s.name)).toBeInTheDocument()
    }
  })

  it('renders Why we link the competition footer paragraph', () => {
    render(<BeyondPage />)
    expect(screen.getByRole('heading', { level: 2, name: /why we link the competition/i })).toBeInTheDocument()
    expect(screen.getByText(/curated engineering layer/i)).toBeInTheDocument()
  })

  it('every external link opens in a new tab with rel="noopener noreferrer"', () => {
    const { container } = render(<BeyondPage />)
    const links = container.querySelectorAll('a[href^="http"]')
    expect(links.length).toBeGreaterThanOrEqual(sources.length)
    links.forEach((a) => {
      expect(a.getAttribute('target')).toBe('_blank')
      expect(a.getAttribute('rel') ?? '').toMatch(/noopener/)
      expect(a.getAttribute('rel') ?? '').toMatch(/noreferrer/)
    })
  })
})
