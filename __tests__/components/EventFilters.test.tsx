import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EventFilters } from '../../components/filters/EventFilters'
import type { Filters } from '../../lib/filters'

const EMPTY: Filters = { tags: [], editorsPicks: false, freeFood: false, hideInviteOnly: false }

const tagPalette = [
  { tag: 'ai-infra', count: 5 },
  { tag: 'devtools', count: 3 },
]

describe('EventFilters', () => {
  it('renders all three toggles and the tag chips', () => {
    render(
      <EventFilters
        filters={EMPTY}
        tagPalette={tagPalette}
        onToggleTag={() => {}}
        onSetFilter={() => {}}
        onReset={() => {}}
      />
    )
    expect(screen.getByLabelText(/editor.s picks/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/free food/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/hide invite-only/i)).toBeInTheDocument()
    expect(screen.getByText('ai-infra')).toBeInTheDocument()
    expect(screen.getByText('devtools')).toBeInTheDocument()
  })

  it('clicking a tag chip invokes onToggleTag', () => {
    const onToggleTag = vi.fn()
    render(
      <EventFilters
        filters={EMPTY}
        tagPalette={tagPalette}
        onToggleTag={onToggleTag}
        onSetFilter={() => {}}
        onReset={() => {}}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /^ai-infra/i }))
    expect(onToggleTag).toHaveBeenCalledWith('ai-infra')
  })

  it("toggling Editor's Picks invokes onSetFilter", () => {
    const onSetFilter = vi.fn()
    render(
      <EventFilters
        filters={EMPTY}
        tagPalette={tagPalette}
        onToggleTag={() => {}}
        onSetFilter={onSetFilter}
        onReset={() => {}}
      />
    )
    fireEvent.click(screen.getByLabelText(/editor.s picks/i))
    expect(onSetFilter).toHaveBeenCalledWith('editorsPicks', true)
  })

  it('Reset all invokes onReset', () => {
    const onReset = vi.fn()
    render(
      <EventFilters
        filters={{ ...EMPTY, editorsPicks: true }}
        tagPalette={tagPalette}
        onToggleTag={() => {}}
        onSetFilter={() => {}}
        onReset={onReset}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /reset all/i }))
    expect(onReset).toHaveBeenCalledOnce()
  })

  it('shows empty-palette fallback when no tags', () => {
    render(
      <EventFilters
        filters={EMPTY}
        tagPalette={[]}
        onToggleTag={() => {}}
        onSetFilter={() => {}}
        onReset={() => {}}
      />
    )
    expect(screen.getByText(/no tags available/i)).toBeInTheDocument()
  })
})
