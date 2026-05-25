// /sse — clean public MCP SSE transport endpoint (legacy MCP clients).
// Same handler factory as /mcp; mcp-handler dispatches by URL.pathname.
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
