import Anthropic from '@anthropic-ai/sdk'
import type { Event } from './types'
import { ClaudeResponseSchema, type Proposal } from './concierge-schema'

export const CONCIERGE_SYSTEM_PROMPT = `You are an event concierge for NYTW Engineer's Companion — a curation tool for Tech Week NYC 2026 (June 1-7, 2026).

Your job: given a user's profile and the list of curated events (and their existing plan), suggest 5-8 additional events the user should consider adding.

PRINCIPLES:
1. Augment, don't replace. The user already has a plan. You're proposing additions, not rebuilding.
2. Quality over quantity. 5-8 max. Tech Week burnout is real.
3. Geographic awareness. Don't suggest Manhattan event at 6pm followed by Brooklyn at 7pm in their existing plan. Account for travel.
4. Diversity of formats. Mix panels, dinners, breakfasts. Don't all be cocktail hours.
5. Strategic spread across days. Don't pile 4 suggestions on one already-busy day.
6. Honor stated priorities. If user says "AI infrastructure", weight those heavily.
7. Include 1 "stretch" suggestion — something tangentially related that might surprise them.
8. Skip duplicates. existing_event_ids are events already in plan — never propose those.
9. Be honest about uncertainty. If the user's profile is highly specific (e.g., "robotics + Polish-speaking + Tuesday only"), and few events match, suggest fewer (3-4) rather than padding with weak matches. The "Beyond" page exists for cases when we don't have enough.

OUTPUT FORMAT (strict JSON, no markdown):
{
  "proposals": [
    {
      "event_id": "string",
      "reasoning": "1-2 sentence explanation of why THIS event for THIS user, referencing their stated interests",
      "priority": "must-attend" | "high" | "medium",
      "is_stretch": boolean
    }
  ],
  "notes": "Optional 1-sentence honest meta-comment, e.g., 'Limited matches for niche interest — consider checking /beyond' or null"
}`

export class MissingKeyError extends Error {
  constructor() {
    super('ANTHROPIC_API_KEY not configured')
    this.name = 'MissingKeyError'
  }
}

interface TrimmedEvent {
  id: string
  title: string
  host: string
  starts_at: string
  ends_at: string
  neighborhood: string | null
  tags: string[]
  audience_tags: string[]
  format: string | null
  is_editors_pick: boolean
  description: string
}

function trim(event: Event): TrimmedEvent {
  return {
    id: event.id,
    title: event.title,
    host: event.host,
    starts_at: event.starts_at,
    ends_at: event.ends_at,
    neighborhood: event.neighborhood,
    tags: event.tags,
    audience_tags: event.audience_tags,
    format: event.format,
    is_editors_pick: event.is_editors_pick,
    description: event.description.slice(0, 200),
  }
}

export async function generateProposals(
  profileText: string,
  candidates: Event[],
): Promise<{ proposals: Proposal[]; notes: string | null; usage: { promptTokens: number; completionTokens: number } }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new MissingKeyError()

  const client = new Anthropic({ apiKey })

  const userMessage = `USER PROFILE:
${profileText}

CANDIDATE EVENTS:
${JSON.stringify(candidates.map(trim), null, 2)}

Suggest 5-8 events to add (or fewer if matches are weak — be honest).`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: CONCIERGE_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  })

  const firstText = response.content.find((block) => block.type === 'text')
  if (!firstText || firstText.type !== 'text') {
    throw new Error('Concierge response had no text content')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(firstText.text)
  } catch {
    throw new Error('Concierge response not JSON')
  }

  const validated = ClaudeResponseSchema.parse(parsed)
  return {
    proposals: validated.proposals,
    notes: validated.notes ?? null,
    usage: {
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
    },
  }
}
