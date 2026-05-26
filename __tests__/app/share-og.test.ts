import { describe, it, expect } from 'vitest'

describe('share-og opengraph-image', () => {
  it('exports a default function and the expected metadata constants', async () => {
    const mod = await import('../../app/plan/share/opengraph-image')
    expect(typeof mod.default).toBe('function')
    expect(mod.size).toEqual({ width: 1200, height: 630 })
    expect(mod.contentType).toBe('image/png')
    expect(typeof mod.alt).toBe('string')
    expect(mod.alt.length).toBeGreaterThan(0)
    expect(mod.alt).toMatch(/plan|NYTW/i)
  })
})
