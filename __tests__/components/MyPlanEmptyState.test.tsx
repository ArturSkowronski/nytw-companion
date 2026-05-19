import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MyPlanEmptyState } from '../../components/MyPlanEmptyState'

describe('MyPlanEmptyState', () => {
  it('renders the headline', () => {
    render(<MyPlanEmptyState />)
    expect(screen.getByText(/Your plan is empty/i)).toBeInTheDocument()
  })

  it('renders Browse events and Editor\'s Picks as links to /events', () => {
    render(<MyPlanEmptyState />)
    const browse = screen.getByRole('link', { name: /Browse events/i })
    expect(browse).toHaveAttribute('href', '/events')
    const picks = screen.getByRole('link', { name: /Editor.s Picks/i })
    expect(picks).toHaveAttribute('href', '/events')
  })

  it('renders Plan with AI as disabled with Coming soon', () => {
    render(<MyPlanEmptyState />)
    const ai = screen.getByText(/Plan with AI/i)
    expect(ai.closest('a')).toBeNull()
    expect(screen.getByText(/Coming soon/i)).toBeInTheDocument()
  })
})
