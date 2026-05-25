import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const originalAnthropicKey = process.env.ANTHROPIC_API_KEY
const originalCommitSha = process.env.VERCEL_GIT_COMMIT_SHA

beforeEach(() => {
  vi.resetModules()
  vi.unstubAllEnvs()
  delete process.env.NEXT_PUBLIC_SUPABASE_URL
  delete process.env.ANTHROPIC_API_KEY
  delete process.env.VERCEL_GIT_COMMIT_SHA
})

afterEach(() => {
  if (originalSupabaseUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl
  if (originalAnthropicKey !== undefined) process.env.ANTHROPIC_API_KEY = originalAnthropicKey
  if (originalCommitSha !== undefined) process.env.VERCEL_GIT_COMMIT_SHA = originalCommitSha
})

describe('GET /api/health', () => {
  it('returns 200 with both checks skipped when no env is set', async () => {
    const { GET } = await import('../../app/api/health/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.checks.supabase).toBe('skipped')
    expect(body.checks.anthropic).toBe('skipped')
    expect(body.version).toBe('dev')
    expect(typeof body.timestamp).toBe('string')
  })

  it('reports anthropic ok when ANTHROPIC_API_KEY is set', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test'
    const { GET } = await import('../../app/api/health/route')
    const res = await GET()
    const body = await res.json()
    expect(body.checks.anthropic).toBe('ok')
  })

  it('uses VERCEL_GIT_COMMIT_SHA for version when set', async () => {
    process.env.VERCEL_GIT_COMMIT_SHA = 'abc1234'
    const { GET } = await import('../../app/api/health/route')
    const res = await GET()
    const body = await res.json()
    expect(body.version).toBe('abc1234')
  })

  it('reports supabase fail and returns 503 when client throws', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co'
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: async () => {
        throw new Error('boom')
      },
    }))
    const { GET } = await import('../../app/api/health/route')
    const res = await GET()
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.checks.supabase).toBe('fail')
    expect(body.status).toBe('degraded')
  })

  it('reports supabase ok and returns 200 when client query succeeds', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co'
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: async () => ({
        from: () => ({
          select: () => ({
            limit: () => ({ error: null, count: 1 }),
          }),
        }),
      }),
    }))
    const { GET } = await import('../../app/api/health/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.checks.supabase).toBe('ok')
    expect(body.status).toBe('ok')
  })
})
