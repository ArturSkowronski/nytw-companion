import { describe, it, expect, beforeEach } from 'vitest'
import { checkLimit, resetForTests } from '../../lib/rate-limit'

describe('checkLimit', () => {
  beforeEach(() => {
    resetForTests()
  })

  it('allows the first hit', () => {
    const r = checkLimit('1.2.3.4', 5, 60_000, 1_000_000)
    expect(r).toEqual({ ok: true })
  })

  it('allows up to `max` hits in the same window', () => {
    for (let i = 0; i < 5; i++) {
      expect(checkLimit('1.2.3.4', 5, 60_000, 1_000_000 + i).ok).toBe(true)
    }
  })

  it('rejects the (max+1)-th hit with retryAfterMs > 0', () => {
    for (let i = 0; i < 5; i++) checkLimit('1.2.3.4', 5, 60_000, 1_000_000)
    const r = checkLimit('1.2.3.4', 5, 60_000, 1_010_000) as { ok: false; retryAfterMs: number }
    expect(r.ok).toBe(false)
    expect(r.retryAfterMs).toBeGreaterThan(0)
  })

  it('resets after the window expires', () => {
    for (let i = 0; i < 5; i++) checkLimit('1.2.3.4', 5, 60_000, 1_000_000)
    expect(checkLimit('1.2.3.4', 5, 60_000, 1_000_000 + 60_001).ok).toBe(true)
  })

  it('keeps separate budgets per key', () => {
    for (let i = 0; i < 5; i++) checkLimit('1.2.3.4', 5, 60_000, 1_000_000)
    expect(checkLimit('5.6.7.8', 5, 60_000, 1_000_000).ok).toBe(true)
  })

  it('default nowMs uses Date.now()', () => {
    const r = checkLimit('fresh-ip-default', 5, 60_000)
    expect(r.ok).toBe(true)
  })
})
