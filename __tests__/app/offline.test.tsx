import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import OfflinePage from '../../app/offline/page'

describe('/offline', () => {
  it('renders the offline heading and lede', () => {
    render(<OfflinePage />)
    expect(screen.getByRole('heading', { level: 1, name: /you're offline/i })).toBeInTheDocument()
    expect(screen.getByText(/can't reach the network/i)).toBeInTheDocument()
  })

  it('renders links to My Plan, Now, and Browse', () => {
    render(<OfflinePage />)
    expect(screen.getByRole('link', { name: /my plan/i })).toHaveAttribute('href', '/my-plan')
    expect(screen.getByRole('link', { name: /^now/i })).toHaveAttribute('href', '/now')
    expect(screen.getByRole('link', { name: /browse events/i })).toHaveAttribute('href', '/events')
  })

  it('renders the VirtusLabFooter (not-affiliated text)', () => {
    render(<OfflinePage />)
    expect(screen.getByText(/not affiliated with a16z or tech week nyc/i)).toBeInTheDocument()
  })
})
