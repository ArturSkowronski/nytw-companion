import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('POST /api/log-error', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  async function importRoute() {
    return await import('../../app/api/log-error/route')
  }

  it('returns 204 on valid payload and console.errors once with [client-error] prefix', async () => {
    const { POST } = await importRoute()
    const request = new Request('http://localhost/api/log-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'boom', kind: 'boundary' }),
    })
    const res = await POST(request)
    expect(res.status).toBe(204)
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
    expect(consoleErrorSpy.mock.calls[0][0]).toBe('[client-error]')
    expect(consoleErrorSpy.mock.calls[0][1]).toContain('"message":"boom"')
    expect(consoleErrorSpy.mock.calls[0][1]).toContain('"kind":"boundary"')
  })

  it('returns 400 when message is missing', async () => {
    const { POST } = await importRoute()
    const request = new Request('http://localhost/api/log-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'boundary' }),
    })
    const res = await POST(request)
    expect(res.status).toBe(400)
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it('returns 400 on non-JSON body', async () => {
    const { POST } = await importRoute()
    const request = new Request('http://localhost/api/log-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    })
    const res = await POST(request)
    expect(res.status).toBe(400)
  })

  it('returns 405 on GET', async () => {
    const { GET } = await importRoute()
    const res = await GET()
    expect(res.status).toBe(405)
  })
})
