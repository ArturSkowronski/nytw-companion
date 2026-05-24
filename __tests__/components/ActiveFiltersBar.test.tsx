import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ActiveFiltersBar } from '../../components/filters/ActiveFiltersBar'
import type { Filters } from '../../lib/filters'

const EMPTY: Filters = { tags: [], editorsPicks: false, freeFood: false, hideInviteOnly: false }

describe('ActiveFiltersBar', () => {
  it('renders nothing when no filters active', () => {
    const { container } = render(
      <ActiveFiltersBar filters={EMPTY} onToggleTag={() => {}} onSetFilter={() => {}} onReset={() => {}} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders a chip per active filter', () => {
    render(
      <ActiveFiltersBar
        filters={{ ...EMPTY, tags: ['ai-infra', 'devtools'], editorsPicks: true }}
        onToggleTag={() => {}}
        onSetFilter={() => {}}
        onReset={() => {}}
      />
    )
    expect(screen.getByText('ai-infra')).toBeInTheDocument()
    expect(screen.getByText('devtools')).toBeInTheDocument()
    expect(screen.getByText(/editor.s picks/i)).toBeInTheDocument()
  })

  it('clicking a tag chip × invokes onToggleTag with that tag', () => {
    const onToggleTag = vi.fn()
    render(
      <ActiveFiltersBar
        filters={{ ...EMPTY, tags: ['ai-infra'] }}
        onToggleTag={onToggleTag}
        onSetFilter={() => {}}
        onReset={() => {}}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /remove ai-infra filter/i }))
    expect(onToggleTag).toHaveBeenCalledWith('ai-infra')
  })

  it('Clear all invokes onReset', () => {
    const onReset = vi.fn()
    render(
      <ActiveFiltersBar
        filters={{ ...EMPTY, editorsPicks: true }}
        onToggleTag={() => {}}
        onSetFilter={() => {}}
        onReset={onReset}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /clear all/i }))
    expect(onReset).toHaveBeenCalledOnce()
  })
})
