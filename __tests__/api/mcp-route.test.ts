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

  it('POST responses carry the CORS allow-origin header', async () => {
    const { POST } = await importRoute()
    const req = new Request('http://localhost/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'vitest', version: '1' },
        },
      }),
    })
    const res = await POST(req)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('exports GET, POST, DELETE and OPTIONS handlers', async () => {
    const mod = await importRoute()
    expect(typeof mod.GET).toBe('function')
    expect(typeof mod.POST).toBe('function')
    expect(typeof mod.DELETE).toBe('function')
    expect(typeof mod.OPTIONS).toBe('function')
  })
})
