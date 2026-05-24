import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TagFilterChips } from '../../components/filters/TagFilterChips'

const top21 = Array.from({ length: 21 }, (_, i) => ({ tag: `tag-${i}`, count: 21 - i }))
const top5 = top21.slice(0, 5)

describe('TagFilterChips', () => {
  it('renders all tags when ≤ 20, no Show all button', () => {
    render(<TagFilterChips tags={top5} selected={[]} onToggle={() => {}} />)
    expect(screen.getByText('tag-0')).toBeInTheDocument()
    expect(screen.getByText('tag-4')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /show all/i })).toBeNull()
  })

  it('renders top 20 and a Show all button when > 20; clicking reveals all', () => {
    render(<TagFilterChips tags={top21} selected={[]} onToggle={() => {}} />)
    expect(screen.getByText('tag-0')).toBeInTheDocument()
    expect(screen.queryByText('tag-20')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /show all/i }))
    expect(screen.getByText('tag-20')).toBeInTheDocument()
  })
})
