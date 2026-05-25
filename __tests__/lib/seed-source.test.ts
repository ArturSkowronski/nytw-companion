import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const originalEnv = process.env.NEXT_PUBLIC_USE_LOAD_FIXTURE

beforeEach(() => {
  vi.resetModules()
  delete process.env.NEXT_PUBLIC_USE_LOAD_FIXTURE
})

afterEach(() => {
  if (originalEnv === undefined) delete process.env.NEXT_PUBLIC_USE_LOAD_FIXTURE
  else process.env.NEXT_PUBLIC_USE_LOAD_FIXTURE = originalEnv
})

describe('selectSeed', () => {
  it('returns the base seed when env var is unset', async () => {
    const { selectSeed } = await import('../../lib/seed-source')
    const events = selectSeed()
    // seed-events.json is now the LLM-curated subset (~380 events from the
    // 1,390-event raw tech-week.com scrape after two filter passes).
    expect(events.length).toBeGreaterThan(200)
  })

  it('returns the load fixture when NEXT_PUBLIC_USE_LOAD_FIXTURE === "1"', async () => {
    process.env.NEXT_PUBLIC_USE_LOAD_FIXTURE = '1'
    const { selectSeed } = await import('../../lib/seed-source')
    const events = selectSeed()
    expect(events.length).toBe(250)
  })

  it('returns the base seed when env var is anything other than "1"', async () => {
    process.env.NEXT_PUBLIC_USE_LOAD_FIXTURE = '0'
    const { selectSeed } = await import('../../lib/seed-source')
    const events = selectSeed()
    // Should return base seed (not load fixture)
    expect(events[0]?.id).not.toMatch(/^load-/)
  })
})
