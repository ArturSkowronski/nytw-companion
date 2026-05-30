import { describe, it, expect } from 'vitest'

// Route-level tests for the MCP endpoint. The route delegates JSON-RPC to the
// mcp-handler library; what we own (and must lock in) is the CORS layer that
// lets browser-based MCP clients connect cross-origin.
async function importRoute() {
  return await import('../../app/mcp/route')
}

describe('/mcp route — CORS', () => {
  it('OPTIONS preflight returns 204 with permissive CORS headers', async () => {
    const { OPTIONS } = await importRoute()
    const res = OPTIONS()
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(res.headers.get('access-control-allow-methods')).toContain('POST')
    expect(res.headers.get('access-control-allow-headers')).toContain('Content-Type')
  })

  it('withCors adds the allow-origin header while preserving status and body', async () => {
    const { withCors } = await importRoute()
    // Test the wrapper directly rather than driving the real mcp-handler — the
    // handler replies over an SSE stream whose internal teardown is noisy in
    // the test env. The wrapper is the part we own; the live cross-origin
    // handshake is verified separately in the browser.
    const wrapped = withCors(new Response('{"ok":true}', { status: 200 }))
    expect(wrapped.status).toBe(200)
    expect(wrapped.headers.get('access-control-allow-origin')).toBe('*')
    expect(await wrapped.text()).toBe('{"ok":true}')
  })

  it('exports GET, POST, DELETE and OPTIONS handlers', async () => {
    const mod = await importRoute()
    expect(typeof mod.GET).toBe('function')
    expect(typeof mod.POST).toBe('function')
    expect(typeof mod.DELETE).toBe('function')
    expect(typeof mod.OPTIONS).toBe('function')
  })
})
