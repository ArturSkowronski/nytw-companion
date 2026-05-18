// __tests__/components/MyPlanWidget.test.tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MyPlanWidget } from '../../components/MyPlanWidget'
import { usePlanStore } from '../../lib/plan-store'

describe('MyPlanWidget', () => {
  beforeEach(() => {
    usePlanStore.getState().clear()
  })

  it('is not rendered when the plan is empty', () => {
    const { container } = render(<MyPlanWidget />)
    expect(container.firstChild).toBeNull()
  })

  it('shows the event count when plan has items', () => {
    usePlanStore.getState().addItem('event-1')
    usePlanStore.getState().addItem('event-2')
    render(<MyPlanWidget />)
    expect(screen.getAllByText(/My Plan \(2\)/).length).toBeGreaterThan(0)
  })

  it('toggles the mini-preview open and closed', () => {
    usePlanStore.getState().addItem('event-1')
    render(<MyPlanWidget />)
    const buttons = screen.getAllByText(/My Plan \(1\)/)
    // Initially collapsed (no "Open full plan" visible)
    expect(screen.queryByText(/Open full plan/)).toBeNull()
    fireEvent.click(buttons[0])
    // Now expanded
    expect(screen.getAllByText(/Open full plan/).length).toBeGreaterThan(0)
  })
})
