import { describe, it, expect } from 'vitest'
import { CORS_HEADERS, withCors } from '../../lib/cors'

// The /mcp route delegates JSON-RPC to the mcp-handler library; what we own
// (and must lock in) is the CORS layer that lets browser-based MCP clients
// connect cross-origin. We test that wrapper directly — driving the real
// handler would open an SSE stream whose teardown is noisy in the test env.
// The end-to-end cross-origin handshake is verified live in the browser.

describe('CORS helpers', () => {
  it('CORS_HEADERS allows any origin and the methods the route serves', () => {
    expect(CORS_HEADERS['Access-Control-Allow-Origin']).toBe('*')
    expect(CORS_HEADERS['Access-Control-Allow-Methods']).toContain('POST')
    expect(CORS_HEADERS['Access-Control-Allow-Methods']).toContain('OPTIONS')
    expect(CORS_HEADERS['Access-Control-Allow-Headers']).toContain('Content-Type')
  })

  it('withCors adds the allow-origin header while preserving status and body', async () => {
    const wrapped = withCors(new Response('{"ok":true}', { status: 200 }))
    expect(wrapped.status).toBe(200)
    expect(wrapped.headers.get('access-control-allow-origin')).toBe('*')
    expect(await wrapped.text()).toBe('{"ok":true}')
  })
})

describe('/mcp route', () => {
  it('OPTIONS preflight returns 204 with permissive CORS headers', async () => {
    const { OPTIONS } = await import('../../app/mcp/route')
    const res = OPTIONS()
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('exports GET, POST, DELETE and OPTIONS handlers', async () => {
    const mod = await import('../../app/mcp/route')
    expect(typeof mod.GET).toBe('function')
    expect(typeof mod.POST).toBe('function')
    expect(typeof mod.DELETE).toBe('function')
    expect(typeof mod.OPTIONS).toBe('function')
  })
})
