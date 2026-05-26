import { describe, it, expect } from 'vitest'
import { encodePlan, decodePlan, MAX_SHARE_EVENTS } from '../../lib/share-encoding'

describe('share-encoding', () => {
  it('round-trips ids without a name', () => {
    const encoded = encodePlan({ ids: ['a', 'b', 'c'] })
    expect(decodePlan(encoded)).toEqual({ ids: ['a', 'b', 'c'], name: undefined })
  })

  it('round-trips ids with a name', () => {
    const encoded = encodePlan({ ids: ['x', 'y'], name: 'Marcin' })
    expect(decodePlan(encoded)).toEqual({ ids: ['x', 'y'], name: 'Marcin' })
  })

  it('uses base64url safe alphabet (no +, /, =)', () => {
    const encoded = encodePlan({ ids: ['evt-12345'], name: 'A B C' })
    expect(encoded).not.toMatch(/[+/=]/)
  })

  it('caps encoded ids at MAX_SHARE_EVENTS', () => {
    const tooMany = Array.from({ length: MAX_SHARE_EVENTS + 5 }, (_, i) => `id-${i}`)
    const decoded = decodePlan(encodePlan({ ids: tooMany }))
    expect(decoded.ids).toHaveLength(MAX_SHARE_EVENTS)
    expect(decoded.ids[0]).toBe('id-0')
  })

  it('returns empty ids for garbage hash', () => {
    expect(decodePlan('not-real-base64!!!')).toEqual({ ids: [], name: undefined })
  })

  it('returns empty ids for empty input', () => {
    expect(decodePlan('')).toEqual({ ids: [], name: undefined })
    expect(decodePlan('#')).toEqual({ ids: [], name: undefined })
  })

  it('ignores unknown payload keys (forward-compatible)', () => {
    // Manually craft a payload with extra key.
    const payload = 'x=ignored|i=one,two|future=stuff'
    const base64 = Buffer.from(payload, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    const decoded = decodePlan(base64)
    expect(decoded.ids).toEqual(['one', 'two'])
  })

  it('strips a leading # if present', () => {
    const encoded = encodePlan({ ids: ['a'] })
    expect(decodePlan('#' + encoded)).toEqual({ ids: ['a'], name: undefined })
  })

  it('dedupes ids on encode', () => {
    const decoded = decodePlan(encodePlan({ ids: ['a', 'b', 'a'] }))
    expect(decoded.ids).toEqual(['a', 'b'])
  })
})

import type { PlanItemSource } from '../../lib/types'

describe('PlanItemSource', () => {
  it("includes 'share'", () => {
    const allowed: PlanItemSource[] = ['manual', 'concierge', 'editors_pick', 'map', 'share']
    expect(allowed).toContain('share')
  })
})
