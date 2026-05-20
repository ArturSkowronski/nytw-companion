import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConciergeForm } from '../../components/ConciergeForm'

describe('ConciergeForm', () => {
  it('renders hint about existing plan when existingCount > 0', () => {
    render(
      <ConciergeForm existingCount={3} submitting={false} error={null} onSubmit={() => {}} />,
    )
    expect(screen.getByText(/You have 3 events/i)).toBeInTheDocument()
  })

  it('renders neutral hint when existingCount === 0', () => {
    render(
      <ConciergeForm existingCount={0} submitting={false} error={null} onSubmit={() => {}} />,
    )
    expect(screen.getByText(/Tell us about yourself/i)).toBeInTheDocument()
  })

  it('submit button is disabled while text is shorter than 10 chars', () => {
    render(
      <ConciergeForm existingCount={0} submitting={false} error={null} onSubmit={() => {}} />,
    )
    const btn = screen.getByRole('button', { name: /suggestions/i })
    expect(btn).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'short' } })
    expect(btn).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'this is plenty long' } })
    expect(btn).not.toBeDisabled()
  })

  it('submit button is disabled while submitting=true', () => {
    render(
      <ConciergeForm existingCount={0} submitting={true} error={null} onSubmit={() => {}} />,
    )
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'this is plenty long' } })
    expect(screen.getByRole('button', { name: /suggestions/i })).toBeDisabled()
  })

  it('calls onSubmit with profile text on click', () => {
    const onSubmit = vi.fn()
    render(
      <ConciergeForm existingCount={0} submitting={false} error={null} onSubmit={onSubmit} />,
    )
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'I am a solo founder building AI agents' },
    })
    fireEvent.click(screen.getByRole('button', { name: /suggestions/i }))
    expect(onSubmit).toHaveBeenCalledWith('I am a solo founder building AI agents')
  })

  it('shows error banner when error prop set', () => {
    render(
      <ConciergeForm existingCount={0} submitting={false} error="Network down" onSubmit={() => {}} />,
    )
    expect(screen.getByText(/Network down/)).toBeInTheDocument()
  })
})
