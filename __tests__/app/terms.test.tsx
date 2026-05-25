import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import TermsPage from '../../app/(marketing)/terms/page'

describe('/terms', () => {
  it('renders the H1 and lede', () => {
    render(<TermsPage />)
    expect(screen.getByRole('heading', { level: 1, name: /terms of use/i })).toBeInTheDocument()
    expect(screen.getByText(/use at your own risk/i)).toBeInTheDocument()
  })

  it('renders all section headings', () => {
    render(<TermsPage />)
    expect(screen.getByRole('heading', { level: 2, name: /independence/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /event listings/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /no warranty/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /ai proposals/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /liability/i })).toBeInTheDocument()
  })

  it('says not affiliated with a16z', () => {
    render(<TermsPage />)
    expect(screen.getByText(/not affiliated with a16z, tech week nyc/i)).toBeInTheDocument()
  })

  it('renders the VirtusLabFooter', () => {
    render(<TermsPage />)
    expect(screen.getByText(/not affiliated with a16z or tech week nyc/i)).toBeInTheDocument()
  })
})
