import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock Dialog primitives to render contents inline based on open state
vi.mock('@/components/ui/dialog', () => {
  return {
    Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
      open ? <div data-testid="dialog">{children}</div> : null,
    DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  }
})

import { HelpModal } from '../../components/HelpModal'

describe('HelpModal', () => {
  it('does not render the dialog content by default', () => {
    render(<HelpModal />)
    expect(screen.queryByText(/keyboard shortcuts/i)).toBeNull()
  })

  it('opens when "?" is pressed on document', () => {
    render(<HelpModal />)
    fireEvent.keyDown(document, { key: '?' })
    expect(screen.getByText(/keyboard shortcuts/i)).toBeInTheDocument()
  })

  it('does not open when target is an input', () => {
    render(
      <div>
        <input data-testid="search" />
        <HelpModal />
      </div>
    )
    const input = screen.getByTestId('search')
    input.focus()
    fireEvent.keyDown(input, { key: '?' })
    expect(screen.queryByText(/keyboard shortcuts/i)).toBeNull()
  })

  it('lists the documented shortcuts', () => {
    render(<HelpModal />)
    fireEvent.keyDown(document, { key: '?' })
    expect(screen.getByText('?')).toBeInTheDocument()
    expect(screen.getByText('/')).toBeInTheDocument()
    expect(screen.getByText('m')).toBeInTheDocument()
    expect(screen.getByText(/esc/i)).toBeInTheDocument()
  })
})
