// Shared CORS helpers for the public MCP endpoint.
//
// mcp-handler (0.1.21) only sets CORS on its OAuth metadata endpoints, not on
// the streamable-HTTP transport responses. Browser-based MCP clients
// (claude.ai web connectors, the MCP Inspector) make cross-origin requests and
// send a preflight, so without these headers the connection fails before the
// JSON-RPC handshake. The catalogue is public and unauthenticated → `*`.
//
// This lives in lib/ (not in the route file) because a Next.js route module may
// only export valid route handlers — exporting `withCors` from route.ts breaks
// the build with "not a valid Route export field".
export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Authorization',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id',
  'Access-Control-Max-Age': '86400',
}

// Re-emit a response with CORS headers added. Rebuilding via
// `new Response(res.body, …)` passes the body stream through untouched, so SSE
// (text/event-stream) responses keep streaming.
export function withCors(res: Response): Response {
  const headers = new Headers(res.headers)
  for (const [key, value] of Object.entries(CORS_HEADERS)) headers.set(key, value)
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  })
}
