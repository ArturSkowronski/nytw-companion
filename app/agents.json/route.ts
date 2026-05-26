// Root /agents.json alias — some scanners check the root path instead of
// /.well-known/agents.json. Returns identical payload.
export { GET } from '../.well-known/agents.json/route'
export const dynamic = 'force-static'
