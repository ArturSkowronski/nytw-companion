import { describe, it, expect } from 'vitest'
import {
  ConciergeRequestSchema,
  ProposalSchema,
  ClaudeResponseSchema,
} from '../../lib/concierge-schema'

describe('ConciergeRequestSchema', () => {
  it('accepts valid input', () => {
    const r = ConciergeRequestSchema.safeParse({
      profile_text: 'I am a solo founder building AI agents.',
      existing_event_ids: ['a', 'b'],
    })
    expect(r.success).toBe(true)
  })

  it('rejects profile_text shorter than 10 chars', () => {
    const r = ConciergeRequestSchema.safeParse({
      profile_text: 'short',
      existing_event_ids: [],
    })
    expect(r.success).toBe(false)
  })

  it('rejects profile_text longer than 1000 chars', () => {
    const r = ConciergeRequestSchema.safeParse({
      profile_text: 'x'.repeat(1001),
      existing_event_ids: [],
    })
    expect(r.success).toBe(false)
  })

  it('rejects existing_event_ids longer than 500', () => {
    const r = ConciergeRequestSchema.safeParse({
      profile_text: 'A reasonable profile.',
      existing_event_ids: Array.from({ length: 501 }, (_, i) => `e${i}`),
    })
    expect(r.success).toBe(false)
  })
})

describe('ProposalSchema', () => {
  it('accepts a well-formed proposal', () => {
    const r = ProposalSchema.safeParse({
      event_id: 'evt-1',
      reasoning: 'Matches your profile.',
      priority: 'high',
      is_stretch: false,
    })
    expect(r.success).toBe(true)
  })

  it('rejects unknown priority', () => {
    const r = ProposalSchema.safeParse({
      event_id: 'evt-1',
      reasoning: 'x',
      priority: 'urgent',
      is_stretch: false,
    })
    expect(r.success).toBe(false)
  })
})

describe('ClaudeResponseSchema', () => {
  it('parses { proposals, notes }', () => {
    const r = ClaudeResponseSchema.safeParse({
      proposals: [
        { event_id: 'a', reasoning: 'x', priority: 'must-attend', is_stretch: false },
      ],
      notes: 'note',
    })
    expect(r.success).toBe(true)
  })

  it('accepts notes: null', () => {
    const r = ClaudeResponseSchema.safeParse({ proposals: [], notes: null })
    expect(r.success).toBe(true)
  })

  it('accepts missing notes field', () => {
    const r = ClaudeResponseSchema.safeParse({ proposals: [] })
    expect(r.success).toBe(true)
  })
})
