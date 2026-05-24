import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import EventsLoading from '../../app/events/loading'
import MyPlanLoading from '../../app/my-plan/loading'
import PlanLoading from '../../app/plan/loading'
import NowLoading from '../../app/now/loading'

describe('loading skeletons', () => {
  it.each([
    ['events', EventsLoading],
    ['my-plan', MyPlanLoading],
    ['plan', PlanLoading],
    ['now', NowLoading],
  ])('%s loading renders without crashing', (_name, Component) => {
    const { container } = render(<Component />)
    expect(container.firstChild).not.toBeNull()
  })
})
