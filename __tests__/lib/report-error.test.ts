import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { reportError, type ReportErrorPayload } from '../../lib/report-error'

const originalFetch = globalThis.fetch
const originalWindow = globalThis.window

describe('reportError', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response)
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    globalThis.window = originalWindow
    vi.unstubAllGlobals()
  })

  function readBody(): ReportErrorPayload {
    return JSON.parse(fetchMock.mock.calls[0][1].body as string) as ReportErrorPayload
  }

  it('is a no-op when window is undefined (SSR)', () => {
    vi.stubGlobal('window', undefined)
    reportError(new Error('x'), 'boundary')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('POSTs payload with message, stack, url, userAgent, kind', () => {
    const err = new Error('boom')
    err.stack = 'Error: boom\n    at test'
    reportError(err, 'boundary')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/log-error')
    expect(init.method).toBe('POST')
    const body = readBody()
    expect(body.message).toBe('boom')
    expect(body.stack).toBe('Error: boom\n    at test')
    expect(body.kind).toBe('boundary')
    expect(body.url).toContain('http')
    expect(typeof body.userAgent).toBe('string')
  })

  it('truncates message and stack to 2KB with truncated suffix', () => {
    const huge = 'x'.repeat(5000)
    const err = new Error(huge)
    err.stack = huge
    reportError(err, 'window')
    const body = readBody()
    expect(body.message.length).toBeLessThanOrEqual(2048)
    expect(body.message.endsWith('…(truncated)')).toBe(true)
    expect(body.stack!.length).toBeLessThanOrEqual(2048)
  })

  it('does not throw when fetch rejects', () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'))
    expect(() => reportError(new Error('x'), 'rejection')).not.toThrow()
  })

  it('accepts non-Error values (string, plain object)', () => {
    reportError('a plain string failure', 'rejection')
    const body = readBody()
    expect(body.message).toBe('a plain string failure')
    expect(body.stack).toBeUndefined()
  })
})
