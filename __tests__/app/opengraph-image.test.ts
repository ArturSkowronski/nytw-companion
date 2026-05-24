import { describe, it, expect } from 'vitest'

describe('opengraph-image', () => {
  it('can be imported', async () => {
    const mod = await import('../../app/opengraph-image')
    expect(typeof mod.default).toBe('function')
    expect(mod.size).toEqual({ width: 1200, height: 630 })
    expect(mod.contentType).toBe('image/png')
  })
})
