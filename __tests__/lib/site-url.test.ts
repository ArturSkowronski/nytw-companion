import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('SITE_URL', () => {
  const originalEnv = process.env.NEXT_PUBLIC_SITE_URL

  beforeEach(() => {
    vi.resetModules()
    delete process.env.NEXT_PUBLIC_SITE_URL
  })

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
    else process.env.NEXT_PUBLIC_SITE_URL = originalEnv
  })

  it('defaults to http://localhost:3000 when env var is unset', async () => {
    const mod = await import('../../lib/site-url')
    expect(mod.SITE_URL).toBe('http://localhost:3000')
  })

  it('reads NEXT_PUBLIC_SITE_URL when set', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com'
    const mod = await import('../../lib/site-url')
    expect(mod.SITE_URL).toBe('https://example.com')
  })

  it('strips trailing slash', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com/'
    const mod = await import('../../lib/site-url')
    expect(mod.SITE_URL).toBe('https://example.com')
  })
})
