import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import GlobalError from '../../app/error'

describe('app/error.tsx', () => {
  it('renders the fallback message and the error message', () => {
    const reset = vi.fn()
    render(<GlobalError error={new Error('boom')} reset={reset} />)
    expect(screen.getByText(/something broke/i)).toBeInTheDocument()
    expect(screen.getByText(/boom/)).toBeInTheDocument()
  })

  it('Try again button calls reset', () => {
    const reset = vi.fn()
    render(<GlobalError error={new Error('x')} reset={reset} />)
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(reset).toHaveBeenCalledOnce()
  })

  it('renders a Home link', () => {
    const reset = vi.fn()
    render(<GlobalError error={new Error('x')} reset={reset} />)
    expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/')
  })
})
