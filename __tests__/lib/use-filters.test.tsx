import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFilters } from '../../lib/use-filters'

const replaceMock = vi.fn()
let currentParams = new URLSearchParams('')
const pathnameMock = '/events'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => currentParams,
  usePathname: () => pathnameMock,
}))

beforeEach(() => {
  replaceMock.mockClear()
  currentParams = new URLSearchParams('')
})

describe('useFilters', () => {
  it('returns defaults when URL is empty', () => {
    const { result } = renderHook(() => useFilters())
    expect(result.current.filters).toEqual({
      tags: [], editorsPicks: false, freeFood: false, hideInviteOnly: false,
    })
    expect(result.current.activeCount).toBe(0)
  })

  it('parses filters from URL', () => {
    currentParams = new URLSearchParams('tags=ai-infra&editorsPicks=1')
    const { result } = renderHook(() => useFilters())
    expect(result.current.filters.tags).toEqual(['ai-infra'])
    expect(result.current.filters.editorsPicks).toBe(true)
    expect(result.current.activeCount).toBe(2)
  })

  it('toggleTag adds tag when absent', () => {
    const { result } = renderHook(() => useFilters())
    act(() => { result.current.toggleTag('ai-infra') })
    expect(replaceMock).toHaveBeenCalledWith('/events?tags=ai-infra', { scroll: false })
  })

  it('toggleTag removes tag when present', () => {
    currentParams = new URLSearchParams('tags=ai-infra,devtools')
    const { result } = renderHook(() => useFilters())
    act(() => { result.current.toggleTag('ai-infra') })
    expect(replaceMock).toHaveBeenCalledWith('/events?tags=devtools', { scroll: false })
  })

  it('setFilter writes boolean to URL', () => {
    const { result } = renderHook(() => useFilters())
    act(() => { result.current.setFilter('editorsPicks', true) })
    expect(replaceMock).toHaveBeenCalledWith('/events?editorsPicks=1', { scroll: false })
  })

  it('reset clears filter params but preserves day/view/q', () => {
    currentParams = new URLSearchParams('tags=ai-infra&editorsPicks=1&day=wed&view=map&q=hack')
    const { result } = renderHook(() => useFilters())
    act(() => { result.current.reset() })
    expect(replaceMock).toHaveBeenCalledWith('/events?day=wed&q=hack&view=map', { scroll: false })
  })
})
