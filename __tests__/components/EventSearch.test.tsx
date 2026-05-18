// __tests__/components/EventSearch.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EventSearch } from '../../components/EventSearch'

describe('EventSearch', () => {
  it('renders a search input', () => {
    render(<EventSearch onSearch={() => {}} />)
    expect(screen.getByRole('searchbox')).toBeTruthy()
  })

  it('calls onSearch with the typed query', () => {
    let captured = ''
    render(<EventSearch onSearch={(q) => { captured = q }} />)
    const input = screen.getByRole('searchbox')
    fireEvent.change(input, { target: { value: 'OpenAI' } })
    expect(captured).toBe('OpenAI')
  })

  it('calls onSearch with empty string when cleared via ESC', () => {
    let captured = 'initial'
    render(<EventSearch onSearch={(q) => { captured = q }} />)
    const input = screen.getByRole('searchbox')
    fireEvent.change(input, { target: { value: 'something' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(captured).toBe('')
  })
})
