// /mcp — clean public MCP endpoint (streamable HTTP transport).
// mcp-handler derives endpoints as `${basePath}/mcp` and `${basePath}/sse`,
// so basePath='' makes its internal streamableHttpEndpoint exactly '/mcp' —
// matching the URL this route is mounted at.
import { createMcpHandler } from 'mcp-handler'
import { registerCompanionTools, COMPANION_SERVER_INFO } from '@/lib/mcp-tools'
import { CORS_HEADERS, withCors } from '@/lib/cors'

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

// Wrap each handler response so cross-origin browser MCP clients can read it.
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
