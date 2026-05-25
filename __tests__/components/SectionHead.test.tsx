import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SectionHead } from '../../components/SectionHead'

describe('SectionHead', () => {
  it('renders num, label, and title', () => {
    render(<SectionHead num="01" label="Honesty" title="What we don't do" />)
    expect(screen.getByText('§ 01')).toBeInTheDocument()
    expect(screen.getByText('Honesty')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /what we don.?t do/i })).toBeInTheDocument()
  })

  it('renders meta when provided', () => {
    render(<SectionHead num="04" label="Curated" title="Editor's Picks" meta="5 picks" />)
    expect(screen.getByText('5 picks')).toBeInTheDocument()
  })

  it('omits meta when not provided', () => {
    render(<SectionHead num="01" label="x" title="y" />)
    // meta would add a third text element; verify it's absent
    expect(screen.queryByText('5 picks')).toBeNull()
  })
})
