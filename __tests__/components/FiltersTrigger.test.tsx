import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FiltersTrigger } from '../../components/filters/FiltersTrigger'

describe('FiltersTrigger', () => {
  it('renders Filters label with no badge when activeCount is 0', () => {
    render(<FiltersTrigger activeCount={0} onClick={() => {}} />)
    expect(screen.getByText('Filters')).toBeInTheDocument()
    expect(screen.queryByTestId('filters-badge')).toBeNull()
  })

  it('renders badge with active count when > 0', () => {
    render(<FiltersTrigger activeCount={3} onClick={() => {}} />)
    expect(screen.getByTestId('filters-badge')).toHaveTextContent('3')
  })

  it('invokes onClick when pressed', () => {
    const onClick = vi.fn()
    render(<FiltersTrigger activeCount={0} onClick={onClick} />)
    fireEvent.click(screen.getByRole('button', { name: /filters/i }))
    expect(onClick).toHaveBeenCalledOnce()
  })
})
