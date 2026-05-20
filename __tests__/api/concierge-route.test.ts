import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/data/seed-events.json', () => ({
  default: [
    {
      id: 'pick-1', title: 'Pick One', description: 'desc1', host: 'H1',
      starts_at: '2026-06-01T18:00:00Z', ends_at: '2026-06-01T20:00:00Z',
      venue_name: 'V', address: 'A', lat: 40.7, lng: -74.0, neighborhood: 'Flatiron',
      rsvp_url: 'https://x', rsvp_platform: 'luma', tags: ['ai-infra'], audience_tags: ['cto'],
      format: 'panel', capacity: null, is_invite_only: false, has_free_food: false,
      has_free_drinks: false, is_editors_pick: true, editors_pick_blurb: 'b',
      is_virtuslab_event: false, source: '', source_url: '',
      created_at: '', updated_at: '',
    },
    {
      id: 'pick-2', title: 'Pick Two', description: 'desc2', host: 'H2',
      starts_at: '2026-06-02T18:00:00Z', ends_at: '2026-06-02T20:00:00Z',
      venue_name: 'V', address: 'A', lat: 40.7, lng: -74.0, neighborhood: 'SoHo',
      rsvp_url: 'https://y', rsvp_platform: 'luma', tags: ['devtools'], audience_tags: ['engineer'],
      format: 'dinner', capacity: null, is_invite_only: false, has_free_food: false,
      has_free_drinks: false, is_editors_pick: true, editors_pick_blurb: 'b',
      is_virtuslab_event: false, source: '', source_url: '',
      created_at: '', updated_at: '',
    },
  ],
}))

const sdkCreate = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({
  default: class Anthropic {
    messages = { create: sdkCreate }
  },
}))

import { POST } from '../../app/api/concierge/route'
import { resetForTests as resetRateLimit } from '../../lib/rate-limit'

function makeRequest(body: unknown, ip: string = '1.2.3.4'): Request {
  return new Request('http://localhost/api/concierge', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  })
}

describe('POST /api/concierge', () => {
  const ORIGINAL_KEY = process.env.ANTHROPIC_API_KEY

  beforeEach(() => {
    resetRateLimit()
    sdkCreate.mockReset()
    process.env.ANTHROPIC_API_KEY = ORIGINAL_KEY
  })

  it('400 on invalid body', async () => {
    const r = await POST(makeRequest({ profile_text: 'short' }))
    expect(r.status).toBe(400)
  })

  it('200 with mock proposals when ANTHROPIC_API_KEY missing', async () => {
    process.env.ANTHROPIC_API_KEY = ''
    const r = await POST(makeRequest({ profile_text: 'I am a founder building AI agents.', existing_event_ids: [] }))
    expect(r.status).toBe(200)
    const body = await r.json()
    expect(body.proposals.length).toBeGreaterThan(0)
    expect(body.notes).toMatch(/Mock proposals/i)
  })

  it('200 with parsed proposals when SDK returns valid response', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    sdkCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: JSON.stringify({
          proposals: [
            { event_id: 'pick-1', reasoning: 'r', priority: 'high', is_stretch: false },
          ],
          notes: null,
        }),
      }],
      usage: { input_tokens: 10, output_tokens: 5 },
    })
    const r = await POST(makeRequest({ profile_text: 'I am a founder building AI agents.', existing_event_ids: [] }))
    expect(r.status).toBe(200)
    const body = await r.json()
    expect(body.proposals).toEqual([
      { event_id: 'pick-1', reasoning: 'r', priority: 'high', is_stretch: false },
    ])
  })

  it('drops proposals whose event_id is not in the catalog', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    sdkCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: JSON.stringify({
          proposals: [
            { event_id: 'pick-1', reasoning: 'real', priority: 'high', is_stretch: false },
            { event_id: 'ghost', reasoning: 'fake', priority: 'high', is_stretch: false },
          ],
          notes: null,
        }),
      }],
      usage: { input_tokens: 1, output_tokens: 1 },
    })
    const r = await POST(makeRequest({ profile_text: 'A real profile.', existing_event_ids: [] }))
    const body = await r.json()
    expect(body.proposals.map((p: { event_id: string }) => p.event_id)).toEqual(['pick-1'])
  })

  it('429 after 5 calls from the same IP', async () => {
    process.env.ANTHROPIC_API_KEY = ''
    for (let i = 0; i < 5; i++) {
      const ok = await POST(makeRequest({ profile_text: 'I am a founder.', existing_event_ids: [] }, '9.9.9.9'))
      expect(ok.status).toBe(200)
    }
    const sixth = await POST(makeRequest({ profile_text: 'I am a founder.', existing_event_ids: [] }, '9.9.9.9'))
    expect(sixth.status).toBe(429)
    const body = await sixth.json()
    expect(body.retryAfterMs).toBeGreaterThan(0)
  })

  it('500 when SDK throws a non-MissingKey error (does NOT fall back to mock)', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    sdkCreate.mockRejectedValueOnce(new Error('API down'))
    const r = await POST(makeRequest({ profile_text: 'Profile here.', existing_event_ids: [] }))
    expect(r.status).toBe(500)
  })

  it('filters out existing_event_ids before calling Claude', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    sdkCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify({ proposals: [], notes: null }) }],
      usage: { input_tokens: 1, output_tokens: 1 },
    })
    await POST(makeRequest({ profile_text: 'Profile here.', existing_event_ids: ['pick-1'] }))
    const messages = sdkCreate.mock.calls[0][0].messages
    expect(messages[0].content).not.toContain('pick-1')
    expect(messages[0].content).toContain('pick-2')
  })
})
