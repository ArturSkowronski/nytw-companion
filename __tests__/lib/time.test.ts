// __tests__/lib/time.test.ts
import { describe, it, expect } from 'vitest'
import { formatInNYC, isHappeningNow } from '../../lib/time'

describe('isHappeningNow', () => {
  it('returns true when current time is between start and end', () => {
    const now = Date.now()
    const starts_at = new Date(now - 30 * 60 * 1000).toISOString()
    const ends_at = new Date(now + 30 * 60 * 1000).toISOString()
    expect(isHappeningNow(starts_at, ends_at)).toBe(true)
  })

  it('returns false when event has not started yet', () => {
    const now = Date.now()
    const starts_at = new Date(now + 60 * 60 * 1000).toISOString()
    const ends_at = new Date(now + 2 * 60 * 60 * 1000).toISOString()
    expect(isHappeningNow(starts_at, ends_at)).toBe(false)
  })

  it('returns false when event has already ended', () => {
    const now = Date.now()
    const starts_at = new Date(now - 2 * 60 * 60 * 1000).toISOString()
    const ends_at = new Date(now - 60 * 60 * 1000).toISOString()
    expect(isHappeningNow(starts_at, ends_at)).toBe(false)
  })

  it('accepts Date objects as well as ISO strings', () => {
    const now = new Date()
    const starts_at = new Date(now.getTime() - 10 * 60 * 1000)
    const ends_at = new Date(now.getTime() + 10 * 60 * 1000)
    expect(isHappeningNow(starts_at, ends_at)).toBe(true)
  })
})

describe('formatInNYC', () => {
  it('formats a UTC timestamp as NYC local time (EDT = UTC-4)', () => {
    // 2026-06-03T22:00:00Z = 18:00 EDT
    const date = new Date('2026-06-03T22:00:00Z')
    expect(formatInNYC(date, 'HH:mm')).toBe('18:00')
  })
})
