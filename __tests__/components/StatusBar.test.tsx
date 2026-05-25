import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('StatusBar', () => {
  it('renders the festival-mode label during the festival', async () => {
    vi.doMock('@/lib/time', () => ({
      festivalMode: () => 'in',
      nowInNYC: () => new Date('2026-06-03T16:00:00-04:00'),
    }))
    const { StatusBar } = await import('../../components/StatusBar')
    render(<StatusBar />)
    await act(async () => {})
    expect(screen.getByText(/live/i)).toBeInTheDocument()
    expect(screen.getByText(/tech week/i)).toBeInTheDocument()
  })

  it("renders 'T-Nd' label before the festival", async () => {
    vi.doMock('@/lib/time', () => ({
      festivalMode: () => 'pre',
      nowInNYC: () => new Date('2026-05-25T12:00:00-04:00'),
    }))
    const { StatusBar } = await import('../../components/StatusBar')
    render(<StatusBar />)
    await act(async () => {})
    expect(screen.getByText(/T-\d+d/i)).toBeInTheDocument()
  })

  it("renders 'Past' label after the festival", async () => {
    vi.doMock('@/lib/time', () => ({
      festivalMode: () => 'post',
      nowInNYC: () => new Date('2026-06-15T12:00:00-04:00'),
    }))
    const { StatusBar } = await import('../../components/StatusBar')
    render(<StatusBar />)
    await act(async () => {})
    expect(screen.getByText(/past/i)).toBeInTheDocument()
  })

  it('renders a NYC time string', async () => {
    vi.doMock('@/lib/time', () => ({
      festivalMode: () => 'in',
      nowInNYC: () => new Date('2026-06-03T16:00:00-04:00'),
    }))
    const { StatusBar } = await import('../../components/StatusBar')
    render(<StatusBar />)
    await act(async () => {})
    expect(screen.getByText(/NYC/i)).toBeInTheDocument()
    expect(screen.getByText(/\d{1,2}:\d{2}\s*(AM|PM)/i)).toBeInTheDocument()
  })
})
