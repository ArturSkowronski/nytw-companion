import { describe, it, expect } from 'vitest'

// Route-level tests for the MCP endpoint. Focus: the CORS handshake that
// browser-based MCP clients (claude.ai web connectors, MCP Inspector) need,
// plus the core JSON-RPC methods.
async function importRoute() {
  return await import('../../app/mcp/route')
}

function mcpPost(payload: unknown): Request {
  return new Request('http://localhost/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  })
}

describe('/mcp route — CORS', () => {
  it('OPTIONS preflight returns 204 with permissive CORS headers', async () => {
    const { OPTIONS } = await importRoute()
    const res = await OPTIONS()
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(res.headers.get('access-control-allow-methods')).toContain('POST')
    expect(res.headers.get('access-control-allow-headers')).toContain('Content-Type')
  })

  it('GET returns 405 but still carries CORS headers', async () => {
    const { GET } = await importRoute()
    const res = await GET()
    expect(res.status).toBe(405)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('POST responses carry CORS headers', async () => {
    const { POST } = await importRoute()
    const res = await POST(mcpPost({ jsonrpc: '2.0', id: 1, method: 'initialize' }))
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })
})

describe('/mcp route — JSON-RPC handshake', () => {
  it('initialize returns the protocol version and server info', async () => {
    const { POST } = await importRoute()
    const res = await POST(mcpPost({ jsonrpc: '2.0', id: 1, method: 'initialize' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.result.protocolVersion).toBe('2025-06-18')
    expect(json.result.serverInfo.name).toBe('nytw-companion')
    expect(json.result.capabilities.tools).toBeDefined()
  })

  it('notifications/initialized is accepted with 204 and no body', async () => {
    const { POST } = await importRoute()
    const res = await POST(mcpPost({ jsonrpc: '2.0', method: 'notifications/initialized' }))
    expect(res.status).toBe(204)
  })

  it('tools/list returns all five tools', async () => {
    const { POST } = await importRoute()
    const res = await POST(mcpPost({ jsonrpc: '2.0', id: 2, method: 'tools/list' }))
    const json = await res.json()
    const names = json.result.tools.map((t: { name: string }) => t.name)
    expect(names).toEqual([
      'search_events',
      'list_events',
      'get_event',
      'catalogue_stats',
      'next_up',
    ])
  })

  it('unknown method returns a JSON-RPC method-not-found error', async () => {
    const { POST } = await importRoute()
    const res = await POST(mcpPost({ jsonrpc: '2.0', id: 3, method: 'bogus/method' }))
    const json = await res.json()
    expect(json.error.code).toBe(-32601)
  })

  it('invalid JSON returns a parse error', async () => {
    const { POST } = await importRoute()
    const res = await POST(
      new Request('http://localhost/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json',
      })
    )
    const json = await res.json()
    expect(json.error.code).toBe(-32700)
  })
})
