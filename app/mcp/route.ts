// /mcp — clean public MCP endpoint (streamable HTTP transport).
// mcp-handler derives endpoints as `${basePath}/mcp` and `${basePath}/sse`,
// so basePath='' makes its internal streamableHttpEndpoint exactly '/mcp' —
// matching the URL this route is mounted at.
import { createMcpHandler } from 'mcp-handler'
import { registerCompanionTools, COMPANION_SERVER_INFO } from '@/lib/mcp-tools'

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

export { handler as GET, handler as POST, handler as DELETE }
