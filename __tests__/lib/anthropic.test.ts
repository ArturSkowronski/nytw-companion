import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Event } from '../../lib/types'

const create = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({
  default: class Anthropic {
    messages = { create }
  },
}))

import { generateProposals, MissingKeyError, CONCIERGE_SYSTEM_PROMPT } from '../../lib/anthropic'

const mkEvent = (id: string): Event => ({
  id, title: id, description: '', host: '', starts_at: '2026-06-01T18:00:00Z',
  ends_at: '2026-06-01T20:00:00Z',
  venue_name: null, address: null, lat: null, lng: null, neighborhood: null,
  rsvp_url: '', rsvp_platform: 'other', tags: [], audience_tags: [],
  format: null, capacity: null, is_invite_only: false, has_free_food: false,
  has_free_drinks: false, is_editors_pick: false, editors_pick_blurb: null,
  is_virtuslab_event: false, source: '', source_url: '',
  created_at: '', updated_at: '',
})

describe('CONCIERGE_SYSTEM_PROMPT', () => {
  it('contains the Augment, don\'t replace principle', () => {
    expect(CONCIERGE_SYSTEM_PROMPT).toContain('Augment, don\'t replace')
  })
  it('asks for JSON output', () => {
    expect(CONCIERGE_SYSTEM_PROMPT).toMatch(/JSON/i)
  })
})

describe('generateProposals', () => {
  const ORIGINAL_KEY = process.env.ANTHROPIC_API_KEY

  beforeEach(() => {
    create.mockReset()
    process.env.ANTHROPIC_API_KEY = ORIGINAL_KEY
  })

  it('throws MissingKeyError when env unset', async () => {
    process.env.ANTHROPIC_API_KEY = ''
    await expect(generateProposals('A profile.', [mkEvent('a')])).rejects.toThrow(MissingKeyError)
  })

  it('calls messages.create with the system prompt and user content', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    create.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify({ proposals: [], notes: null }) }],
      usage: { input_tokens: 10, output_tokens: 5 },
    })
    await generateProposals('My profile is here.', [mkEvent('a')])
    expect(create).toHaveBeenCalledTimes(1)
    const args = create.mock.calls[0][0]
    expect(args.system).toBe(CONCIERGE_SYSTEM_PROMPT)
    expect(args.messages[0].role).toBe('user')
    expect(args.messages[0].content).toContain('My profile is here.')
  })

  it('parses valid Claude JSON into { proposals, notes }', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    create.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: JSON.stringify({
          proposals: [{ event_id: 'a', reasoning: 'r', priority: 'high', is_stretch: false }],
          notes: 'some note',
        }),
      }],
      usage: { input_tokens: 10, output_tokens: 5 },
    })
    const result = await generateProposals('My profile.', [mkEvent('a')])
    expect(result.proposals).toHaveLength(1)
    expect(result.notes).toBe('some note')
    expect(result.usage.promptTokens).toBe(10)
    expect(result.usage.completionTokens).toBe(5)
  })

  it('throws when Claude returns non-JSON text', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    create.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'not json at all' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    })
    await expect(generateProposals('A profile.', [mkEvent('a')])).rejects.toThrow()
  })

  it('throws when Claude returns no text content', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    create.mockResolvedValueOnce({
      content: [],
      usage: { input_tokens: 10, output_tokens: 0 },
    })
    await expect(generateProposals('A profile.', [mkEvent('a')])).rejects.toThrow()
  })

  it('throws when Claude JSON fails schema validation', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    create.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: JSON.stringify({ proposals: [{ event_id: 'a' }] }),
      }],
      usage: { input_tokens: 1, output_tokens: 1 },
    })
    await expect(generateProposals('A profile.', [mkEvent('a')])).rejects.toThrow()
  })
})
