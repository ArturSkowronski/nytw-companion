import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VirtusLabFooter } from '../../components/VirtusLabFooter'

describe('VirtusLabFooter', () => {
  it('renders "Made by VirtusLab" with an external link', () => {
    render(<VirtusLabFooter />)
    const link = screen.getByRole('link', { name: /virtuslab/i })
    expect(link).toHaveAttribute('href', 'https://virtuslab.com')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.getAttribute('rel') ?? '').toMatch(/noopener/)
  })

  it('renders the not-affiliated disclaimer', () => {
    render(<VirtusLabFooter />)
    expect(screen.getByText(/not affiliated with a16z or tech week nyc/i)).toBeInTheDocument()
  })

  it('renders About and Beyond internal links', () => {
    render(<VirtusLabFooter />)
    expect(screen.getByRole('link', { name: /about/i })).toHaveAttribute('href', '/about')
    expect(screen.getByRole('link', { name: /beyond/i })).toHaveAttribute('href', '/beyond')
  })
})
