// /mcp — clean public MCP endpoint (streamable HTTP transport).
// mcp-handler derives endpoints as `${basePath}/mcp` and `${basePath}/sse`,
// so basePath='' makes its internal streamableHttpEndpoint exactly '/mcp' —
// matching the URL this route is mounted at.
import { createMcpHandler } from 'mcp-handler'
import { registerCompanionTools, COMPANION_SERVER_INFO } from '@/lib/mcp-tools'

// mcp-handler (0.1.21) only sets CORS on its OAuth metadata endpoints, not on
// the streamable-HTTP transport responses. Browser-based MCP clients
// (claude.ai web connectors, the MCP Inspector) make cross-origin requests
// and send a preflight, so without these the connection fails before the
// JSON-RPC handshake. The catalogue is public and unauthenticated → `*`.
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Authorization',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id',
  'Access-Control-Max-Age': '86400',
}

const handler = createMcpHandler(
  (server) => registerCompanionTools(server),
  {
    serverInfo: COMPANION_SERVER_INFO,
    capabilities: { tools: {} },
  },
  {
    basePath: '',
    maxDuration: 60,
    verboseLogs: process.env.NODE_ENV !== 'production',
  },
)

// Re-emit the handler's response with CORS headers added. Rebuilding via
// `new Response(res.body, …)` passes the body stream through untouched, so
// SSE (text/event-stream) responses keep streaming.
export function withCors(res: Response): Response {
  const headers = new Headers(res.headers)
  for (const [key, value] of Object.entries(CORS_HEADERS)) headers.set(key, value)
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  })
}

async function handle(request: Request): Promise<Response> {
  return withCors(await handler(request))
}

export const GET = handle
export const POST = handle
export const DELETE = handle

// CORS preflight — browsers send this before the cross-origin POST.
export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}
