import { describe, it, expect } from 'vitest'
import { GET } from '../../app/robots.txt/route'

describe('robots.txt', () => {
  it('allows / and disallows the sensitive /api/ routes', async () => {
    const res = GET()
    const body = await res.text()
    expect(body).toMatch(/User-agent: \*/)
    expect(body).toMatch(/Allow: \//)
    expect(body).toMatch(/Disallow: \/api\/concierge/)
  })

  it('explicitly allows the MCP endpoint and well-known files', async () => {
    const body = await GET().text()
    expect(body).toMatch(/Allow: \/mcp/)
    expect(body).toMatch(/Allow: \/\.well-known\//)
  })

  it('includes Content-Signal opt-ins for AI training and input', async () => {
    const body = await GET().text()
    expect(body).toMatch(/Content-Signal:.*ai-train=yes/)
    expect(body).toMatch(/Content-Signal:.*search=yes/)
  })

  it('lists named AI crawlers', async () => {
    const body = await GET().text()
    expect(body).toMatch(/User-agent: GPTBot/)
    expect(body).toMatch(/User-agent: ClaudeBot/)
    expect(body).toMatch(/User-agent: PerplexityBot/)
  })

  it('references the sitemap URL', async () => {
    const body = await GET().text()
    expect(body).toMatch(/Sitemap: .*\/sitemap\.xml/)
  })
})
