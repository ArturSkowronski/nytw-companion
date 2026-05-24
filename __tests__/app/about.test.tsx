import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import AboutPage from '../../app/(marketing)/about/page'

describe('/about', () => {
  it('renders all four section headings', () => {
    render(<AboutPage />)
    expect(screen.getByRole('heading', { level: 1, name: /about nytw companion/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /why this exists/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /how we curate/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /who built this/i })).toBeInTheDocument()
  })

  it('renders the not-affiliated disclaimer', () => {
    render(<AboutPage />)
    expect(screen.getByText(/independent project by virtuslab. not affiliated with a16z/i)).toBeInTheDocument()
  })

  it('renders the AS initials avatar fallback', () => {
    render(<AboutPage />)
    expect(screen.getByLabelText(/artur skowro/i)).toHaveTextContent('AS')
  })

  it('renders the placeholder LinkedIn link', () => {
    render(<AboutPage />)
    const link = screen.getByRole('link', { name: /linkedin/i })
    expect(link).toHaveAttribute('href')
  })
})
