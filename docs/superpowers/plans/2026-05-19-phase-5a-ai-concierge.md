# Phase 5a — AI Concierge — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship v1.5a — a `/plan` page where the user describes themselves in 1–3 sentences and gets 5–8 AI-curated event proposals from Claude, with per-event Accept/Skip + "Add all", graceful mock fallback when the key is missing, and a 5-per-hour-per-IP rate limit.

**Architecture:** Single new route (`/plan`) + single new API endpoint (`POST /api/concierge`). The route handler is the only code that touches the Anthropic SDK. Four pure library modules (`lib/anthropic.ts`, `lib/concierge-mock.ts`, `lib/concierge-schema.ts`, `lib/rate-limit.ts`) carry the testable logic. UI is a Server Component shell + client island, mirroring the patterns from `/events`, `/now`, `/my-plan`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind 4, shadcn/ui (Textarea, Button, Badge), Zustand + localStorage (existing `usePlanStore`), `@anthropic-ai/sdk` ^0.96.0, `zod` ^4.4.3, `sonner` ^2.0.7, vitest + Testing Library + jsdom.

**Source design:** `docs/superpowers/specs/2026-05-19-phase-5a-ai-concierge-design.md`

**⚠ Next 16 caveat:** Per `AGENTS.md`, this is NOT the Next.js you know. Page `searchParams` is `Promise`-typed; `next/dynamic({ ssr: false })` only legal inside a Client Component (see `EventMapLoader.tsx` for the pattern). Route Handlers in App Router use the new `NextRequest`/`NextResponse` API and export `POST(request)` as a named function. **Before implementing the route handler, glance at `node_modules/next/dist/docs/` for any signature drift.**

---

## File map

**New files (no edits):**

```
lib/rate-limit.ts
lib/concierge-schema.ts
lib/concierge-mock.ts
lib/anthropic.ts

app/api/concierge/route.ts
app/plan/page.tsx

components/ConciergeClient.tsx
components/ConciergeForm.tsx
components/ConciergeProposals.tsx
components/ConciergeProposalCard.tsx

__tests__/lib/rate-limit.test.ts
__tests__/lib/concierge-schema.test.ts
__tests__/lib/concierge-mock.test.ts
__tests__/lib/anthropic.test.ts
__tests__/api/concierge-route.test.ts
__tests__/components/ConciergeForm.test.tsx
__tests__/components/ConciergeProposalCard.test.tsx
```

**No edits to existing source files.** `usePlanStore` is consumed read/write but unchanged. `lib/types.ts` already includes `'concierge'` as a valid `PlanItemSource`.

---

## Task ordering rationale

1. **Pure libraries first** (`rate-limit` → `concierge-schema` → `concierge-mock` → `anthropic`) — each TDD-able in isolation; later tasks depend on their types.
2. **Route handler** (`/api/concierge`) — composes all four libraries; tests with mocked SDK.
3. **Leaf UI components** (`ConciergeProposalCard` → `ConciergeForm`) — testable individually.
4. **Composite UI** (`ConciergeProposals` → `ConciergeClient`) — composed from leaves; no unit tests.
5. **Page wiring** (`/plan/page.tsx`) — Server Component shell.
6. **Final smoke** — full test suite, lint, build, manual walk.

Each task ends with a commit.

---

## Task 1: `lib/rate-limit.ts`

**Files:**
- Create: `/Users/askowronski/Projects/nytw-companion/lib/rate-limit.ts`
- Test: `/Users/askowronski/Projects/nytw-companion/__tests__/lib/rate-limit.test.ts`

**Background:** Sliding-window-counter (per key, per fixed window). Module-scoped `Map` for state. `nowMs` is an injectable parameter so tests can pass deterministic time. `resetForTests()` clears the map.

- [ ] **Step 1: Write failing tests**

```ts
// __tests__/lib/rate-limit.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { checkLimit, resetForTests } from '../../lib/rate-limit'

describe('checkLimit', () => {
  beforeEach(() => {
    resetForTests()
  })

  it('allows the first hit', () => {
    const r = checkLimit('1.2.3.4', 5, 60_000, 1_000_000)
    expect(r).toEqual({ ok: true })
  })

  it('allows up to `max` hits in the same window', () => {
    for (let i = 0; i < 5; i++) {
      expect(checkLimit('1.2.3.4', 5, 60_000, 1_000_000 + i).ok).toBe(true)
    }
  })

  it('rejects the (max+1)-th hit with retryAfterMs > 0', () => {
    for (let i = 0; i < 5; i++) checkLimit('1.2.3.4', 5, 60_000, 1_000_000)
    const r = checkLimit('1.2.3.4', 5, 60_000, 1_010_000) as { ok: false; retryAfterMs: number }
    expect(r.ok).toBe(false)
    expect(r.retryAfterMs).toBeGreaterThan(0)
  })

  it('resets after the window expires', () => {
    for (let i = 0; i < 5; i++) checkLimit('1.2.3.4', 5, 60_000, 1_000_000)
    expect(checkLimit('1.2.3.4', 5, 60_000, 1_000_000 + 60_001).ok).toBe(true)
  })

  it('keeps separate budgets per key', () => {
    for (let i = 0; i < 5; i++) checkLimit('1.2.3.4', 5, 60_000, 1_000_000)
    expect(checkLimit('5.6.7.8', 5, 60_000, 1_000_000).ok).toBe(true)
  })

  it('default nowMs uses Date.now()', () => {
    const r = checkLimit('fresh-ip-default', 5, 60_000)
    expect(r.ok).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests — expect fail (module not found)**

```bash
npm test -- rate-limit
```

- [ ] **Step 3: Implement**

```ts
// lib/rate-limit.ts
type Window = { resetAt: number; count: number }

const store = new Map<string, Window>()

export function checkLimit(
  key: string,
  max: number,
  windowMs: number,
  nowMs: number = Date.now(),
): { ok: true } | { ok: false; retryAfterMs: number } {
  const existing = store.get(key)
  if (!existing || nowMs >= existing.resetAt) {
    store.set(key, { resetAt: nowMs + windowMs, count: 1 })
    return { ok: true }
  }
  if (existing.count < max) {
    existing.count += 1
    return { ok: true }
  }
  return { ok: false, retryAfterMs: existing.resetAt - nowMs }
}

export function resetForTests(): void {
  store.clear()
}
```

- [ ] **Step 4: Run tests — expect pass (6 tests green)**

```bash
npm test -- rate-limit
```

- [ ] **Step 5: Commit**

```bash
git add lib/rate-limit.ts __tests__/lib/rate-limit.test.ts
git commit -m "feat(rate-limit): add in-memory sliding-window rate limiter"
```

---

## Task 2: `lib/concierge-schema.ts`

**Files:**
- Create: `/Users/askowronski/Projects/nytw-companion/lib/concierge-schema.ts`
- Test: `/Users/askowronski/Projects/nytw-companion/__tests__/lib/concierge-schema.test.ts`

**Background:** Three zod schemas: request body, single proposal shape, Claude response. Types exported for use across the codebase.

- [ ] **Step 1: Write failing tests**

```ts
// __tests__/lib/concierge-schema.test.ts
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
```

- [ ] **Step 2: Run tests — expect fail**

```bash
npm test -- concierge-schema
```

- [ ] **Step 3: Implement**

```ts
// lib/concierge-schema.ts
import { z } from 'zod'

export const ConciergeRequestSchema = z.object({
  profile_text: z.string().min(10).max(1000),
  existing_event_ids: z.array(z.string()).max(500),
})

export const ProposalSchema = z.object({
  event_id: z.string(),
  reasoning: z.string(),
  priority: z.enum(['must-attend', 'high', 'medium']),
  is_stretch: z.boolean(),
})

export const ClaudeResponseSchema = z.object({
  proposals: z.array(ProposalSchema).min(0).max(10),
  notes: z.string().nullable().optional(),
})

export type ConciergeRequest = z.infer<typeof ConciergeRequestSchema>
export type Proposal = z.infer<typeof ProposalSchema>
export type ClaudeResponse = z.infer<typeof ClaudeResponseSchema>
```

- [ ] **Step 4: Run tests — expect pass (9 tests green)**

```bash
npm test -- concierge-schema
```

- [ ] **Step 5: Commit**

```bash
git add lib/concierge-schema.ts __tests__/lib/concierge-schema.test.ts
git commit -m "feat(concierge): add zod schemas for request, proposal, and Claude response"
```

---

## Task 3: `lib/concierge-mock.ts`

**Files:**
- Create: `/Users/askowronski/Projects/nytw-companion/lib/concierge-mock.ts`
- Test: `/Users/askowronski/Projects/nytw-companion/__tests__/lib/concierge-mock.test.ts`

**Background:** Deterministic mock proposals built from Editor's Picks. Used when `ANTHROPIC_API_KEY` is missing. Input is the **already-filtered** candidate list (route handler removes `existing_event_ids` before calling).

- [ ] **Step 1: Write failing tests**

```ts
// __tests__/lib/concierge-mock.test.ts
import { describe, it, expect } from 'vitest'
import { buildMockProposals } from '../../lib/concierge-mock'
import type { Event } from '../../lib/types'

const mkEvent = (id: string, isEditorPick: boolean, starts_at: string): Event => ({
  id, title: `Event ${id}`, description: '', host: '', starts_at, ends_at: starts_at,
  venue_name: null, address: null, lat: null, lng: null, neighborhood: null,
  rsvp_url: '', rsvp_platform: 'other', tags: [], audience_tags: [],
  format: null, capacity: null, is_invite_only: false, has_free_food: false,
  has_free_drinks: false, is_editors_pick: isEditorPick, editors_pick_blurb: null,
  is_virtuslab_event: false, source: '', source_url: '',
  created_at: '', updated_at: '',
})

describe('buildMockProposals', () => {
  it('returns up to `count` proposals', () => {
    const events = [
      mkEvent('a', true, '2026-06-01T18:00:00Z'),
      mkEvent('b', true, '2026-06-02T18:00:00Z'),
      mkEvent('c', true, '2026-06-03T18:00:00Z'),
    ]
    const result = buildMockProposals(events, 5)
    expect(result.proposals).toHaveLength(3)
  })

  it('first proposal has priority must-attend or high; rest medium', () => {
    const events = [
      mkEvent('a', true, '2026-06-01T18:00:00Z'),
      mkEvent('b', true, '2026-06-02T18:00:00Z'),
    ]
    const result = buildMockProposals(events, 5)
    expect(['must-attend', 'high']).toContain(result.proposals[0].priority)
    expect(result.proposals[1].priority).toBe('medium')
  })

  it('prefers editor picks first, then fills with non-picks by starts_at', () => {
    const events = [
      mkEvent('a', false, '2026-06-01T18:00:00Z'),
      mkEvent('b', true,  '2026-06-02T18:00:00Z'),
      mkEvent('c', false, '2026-06-03T18:00:00Z'),
    ]
    const result = buildMockProposals(events, 3)
    expect(result.proposals.map((p) => p.event_id)).toEqual(['b', 'a', 'c'])
  })

  it('all proposals have is_stretch: false', () => {
    const events = [mkEvent('a', true, '2026-06-01T18:00:00Z')]
    const result = buildMockProposals(events, 5)
    expect(result.proposals.every((p) => p.is_stretch === false)).toBe(true)
  })

  it('returns empty proposals + helpful note when candidates is empty', () => {
    const result = buildMockProposals([], 5)
    expect(result.proposals).toEqual([])
    expect(result.notes).toContain('ANTHROPIC_API_KEY')
  })

  it('notes mentions mock mode', () => {
    const events = [mkEvent('a', true, '2026-06-01T18:00:00Z')]
    const result = buildMockProposals(events, 5)
    expect(result.notes).toMatch(/Mock proposals/i)
    expect(result.notes).toContain('ANTHROPIC_API_KEY')
  })
})
```

- [ ] **Step 2: Run tests — expect fail**

```bash
npm test -- concierge-mock
```

- [ ] **Step 3: Implement**

```ts
// lib/concierge-mock.ts
import type { Event } from './types'
import type { Proposal } from './concierge-schema'

const MOCK_NOTE =
  'Mock proposals (ANTHROPIC_API_KEY not configured — set it for real suggestions).'

export function buildMockProposals(
  candidates: Event[],
  count: number,
): { proposals: Proposal[]; notes: string } {
  const byStart = (a: Event, b: Event) =>
    new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()

  const picks = candidates.filter((e) => e.is_editors_pick).slice().sort(byStart)
  const rest = candidates.filter((e) => !e.is_editors_pick).slice().sort(byStart)
  const chosen = [...picks, ...rest].slice(0, count)

  const proposals: Proposal[] = chosen.map((event, idx) => ({
    event_id: event.id,
    reasoning: 'Editor pick — featured curated event for Tech Week.',
    priority: idx === 0 ? 'must-attend' : idx < 2 ? 'high' : 'medium',
    is_stretch: false,
  }))

  return { proposals, notes: MOCK_NOTE }
}
```

- [ ] **Step 4: Run tests — expect pass (6 tests green)**

```bash
npm test -- concierge-mock
```

- [ ] **Step 5: Commit**

```bash
git add lib/concierge-mock.ts __tests__/lib/concierge-mock.test.ts
git commit -m "feat(concierge): add deterministic mock proposals from Editor's Picks"
```

---

## Task 4: `lib/anthropic.ts`

**Files:**
- Create: `/Users/askowronski/Projects/nytw-companion/lib/anthropic.ts`
- Test: `/Users/askowronski/Projects/nytw-companion/__tests__/lib/anthropic.test.ts`

**Background:** Wraps the Anthropic SDK. Exports the system prompt verbatim from SPEC §6 and a `generateProposals(profileText, candidates)` function. Throws `MissingKeyError` when env unset so the route handler can switch to mock. Parses the assistant's first text block as JSON, validates with `ClaudeResponseSchema`.

- [ ] **Step 1: Write failing tests**

```ts
// __tests__/lib/anthropic.test.ts
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
        text: JSON.stringify({ proposals: [{ event_id: 'a' }] }),  // missing fields
      }],
      usage: { input_tokens: 1, output_tokens: 1 },
    })
    await expect(generateProposals('A profile.', [mkEvent('a')])).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run tests — expect fail**

```bash
npm test -- anthropic
```

- [ ] **Step 3: Implement**

```ts
// lib/anthropic.ts
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
```

- [ ] **Step 4: Run tests — expect pass (8 tests green)**

```bash
npm test -- anthropic
```

- [ ] **Step 5: Commit**

```bash
git add lib/anthropic.ts __tests__/lib/anthropic.test.ts
git commit -m "feat(anthropic): add Claude SDK wrapper with MissingKeyError + schema validation"
```

---

## Task 5: `app/api/concierge/route.ts`

**Files:**
- Create: `/Users/askowronski/Projects/nytw-companion/app/api/concierge/route.ts`
- Test: `/Users/askowronski/Projects/nytw-companion/__tests__/api/concierge-route.test.ts`

**Background:** POST handler. Validates body, applies rate limit, fetches catalog, calls `generateProposals` (falls back to mock on `MissingKeyError`), best-effort logs to `concierge_logs`, returns proposals.

- [ ] **Step 1: Write failing tests**

```ts
// __tests__/api/concierge-route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the seed events import — the route handler will read this when Supabase env is absent
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
```

- [ ] **Step 2: Run tests — expect fail**

```bash
npm test -- concierge-route
```

- [ ] **Step 3: Implement**

```ts
// app/api/concierge/route.ts
import { NextResponse } from 'next/server'
import seedEvents from '@/data/seed-events.json' with { type: 'json' }
import { createClient } from '@/lib/supabase/server'
import { checkLimit } from '@/lib/rate-limit'
import { ConciergeRequestSchema, type Proposal } from '@/lib/concierge-schema'
import { generateProposals, MissingKeyError } from '@/lib/anthropic'
import { buildMockProposals } from '@/lib/concierge-mock'
import type { Event } from '@/lib/types'

const RATE_MAX = 5
const RATE_WINDOW_MS = 60 * 60 * 1000

async function fetchEvents(): Promise<Event[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return seedEvents as Event[]
  }
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('starts_at', { ascending: true })
    if (error || !data) return []
    return data as Event[]
  } catch {
    return []
  }
}

function ipFromRequest(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  const real = request.headers.get('x-real-ip')
  if (real) return real
  return 'unknown'
}

async function logConcierge(args: {
  profile_text: string
  proposals: Proposal[]
  promptTokens?: number
  completionTokens?: number
}): Promise<void> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return
  try {
    const supabase = await createClient()
    await supabase.from('concierge_logs').insert({
      profile_text: args.profile_text,
      recommended_event_ids: args.proposals.map((p) => p.event_id),
      prompt_tokens: args.promptTokens ?? null,
      completion_tokens: args.completionTokens ?? null,
    })
  } catch (err) {
    console.warn('concierge_logs insert failed', err)
  }
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = ConciergeRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }
  const { profile_text, existing_event_ids } = parsed.data

  const ip = ipFromRequest(request)
  const limit = checkLimit(ip, RATE_MAX, RATE_WINDOW_MS)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfterMs: limit.retryAfterMs },
      { status: 429 },
    )
  }

  const events = await fetchEvents()
  const existing = new Set(existing_event_ids)
  const candidates = events.filter((e) => !existing.has(e.id))

  let proposals: Proposal[]
  let notes: string | null
  let usage: { promptTokens?: number; completionTokens?: number } = {}

  try {
    const result = await generateProposals(profile_text, candidates)
    proposals = result.proposals
    notes = result.notes
    usage = result.usage
  } catch (err) {
    if (err instanceof MissingKeyError) {
      const mock = buildMockProposals(candidates, 5)
      proposals = mock.proposals
      notes = mock.notes
    } else {
      console.error('Concierge generation failed', err)
      return NextResponse.json(
        { error: 'Concierge unavailable, please try again' },
        { status: 500 },
      )
    }
  }

  // Drop proposals pointing to non-existent events (defense in depth)
  const eventIds = new Set(events.map((e) => e.id))
  proposals = proposals.filter((p) => eventIds.has(p.event_id))

  // Best-effort logging — never blocks the response
  void logConcierge({
    profile_text,
    proposals,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
  })

  return NextResponse.json({ proposals, notes })
}
```

- [ ] **Step 4: Run tests — expect pass (7 tests green)**

```bash
npm test -- concierge-route
```

- [ ] **Step 5: Commit**

```bash
git add app/api/concierge/route.ts __tests__/api/concierge-route.test.ts
git commit -m "feat(api): add POST /api/concierge with rate limit + mock fallback + best-effort logging"
```

---

## Task 6: `ConciergeProposalCard` component

**Files:**
- Create: `/Users/askowronski/Projects/nytw-companion/components/ConciergeProposalCard.tsx`
- Test: `/Users/askowronski/Projects/nytw-companion/__tests__/components/ConciergeProposalCard.test.tsx`

**Background:** One proposal as a card. Renders the event's metadata, the reasoning, a priority badge, and Accept/Skip buttons. When `accepted` becomes true, the buttons collapse to an "Added ✓ — see /my-plan" link.

- [ ] **Step 1: Write failing tests**

```tsx
// __tests__/components/ConciergeProposalCard.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConciergeProposalCard } from '../../components/ConciergeProposalCard'
import type { Event } from '../../lib/types'
import type { Proposal } from '../../lib/concierge-schema'

const event: Event = {
  id: 'e1', title: 'OpenAI Rooftop', description: 'desc', host: 'OpenAI',
  starts_at: '2026-06-03T22:30:00Z', ends_at: '2026-06-04T01:00:00Z',
  venue_name: 'Roof', address: '1 Main', lat: 40, lng: -74,
  neighborhood: 'Williamsburg', rsvp_url: 'https://x', rsvp_platform: 'luma',
  tags: [], audience_tags: [], format: 'rooftop', capacity: null,
  is_invite_only: false, has_free_food: false, has_free_drinks: false,
  is_editors_pick: false, editors_pick_blurb: null, is_virtuslab_event: false,
  source: '', source_url: '', created_at: '', updated_at: '',
}

const proposal: Proposal = {
  event_id: 'e1',
  reasoning: 'Matches your AI infrastructure interest.',
  priority: 'must-attend',
  is_stretch: false,
}

describe('ConciergeProposalCard', () => {
  it('renders title, host, time, reasoning', () => {
    render(
      <ConciergeProposalCard
        event={event}
        proposal={proposal}
        accepted={false}
        skipped={false}
        onAccept={() => {}}
        onSkip={() => {}}
      />,
    )
    expect(screen.getByText(/OpenAI Rooftop/)).toBeInTheDocument()
    expect(screen.getByText(/Matches your AI infrastructure interest/)).toBeInTheDocument()
  })

  it('renders priority badge text', () => {
    render(
      <ConciergeProposalCard
        event={event}
        proposal={proposal}
        accepted={false}
        skipped={false}
        onAccept={() => {}}
        onSkip={() => {}}
      />,
    )
    expect(screen.getByText(/must-attend/i)).toBeInTheDocument()
  })

  it('renders Stretch badge when proposal.is_stretch', () => {
    render(
      <ConciergeProposalCard
        event={event}
        proposal={{ ...proposal, is_stretch: true }}
        accepted={false}
        skipped={false}
        onAccept={() => {}}
        onSkip={() => {}}
      />,
    )
    expect(screen.getByText(/Stretch/i)).toBeInTheDocument()
  })

  it('calls onAccept when Accept clicked', () => {
    const onAccept = vi.fn()
    render(
      <ConciergeProposalCard
        event={event}
        proposal={proposal}
        accepted={false}
        skipped={false}
        onAccept={onAccept}
        onSkip={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Accept/i }))
    expect(onAccept).toHaveBeenCalledTimes(1)
  })

  it('calls onSkip when Skip clicked', () => {
    const onSkip = vi.fn()
    render(
      <ConciergeProposalCard
        event={event}
        proposal={proposal}
        accepted={false}
        skipped={false}
        onAccept={() => {}}
        onSkip={onSkip}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Skip/i }))
    expect(onSkip).toHaveBeenCalledTimes(1)
  })

  it('shows Added ✓ link when accepted=true', () => {
    render(
      <ConciergeProposalCard
        event={event}
        proposal={proposal}
        accepted={true}
        skipped={false}
        onAccept={() => {}}
        onSkip={() => {}}
      />,
    )
    expect(screen.queryByRole('button', { name: /Accept/i })).toBeNull()
    expect(screen.getByText(/Added/i)).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /see \/my-plan/i })
    expect(link).toHaveAttribute('href', '/my-plan')
  })
})
```

- [ ] **Step 2: Run tests — expect fail**

```bash
npm test -- ConciergeProposalCard
```

- [ ] **Step 3: Implement**

```tsx
// components/ConciergeProposalCard.tsx
'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatEventTime } from '@/lib/events'
import type { Event } from '@/lib/types'
import type { Proposal } from '@/lib/concierge-schema'

const PRIORITY_TONE: Record<Proposal['priority'], string> = {
  'must-attend': 'bg-[#FF6B35]/20 text-[#FF6B35] border-[#FF6B35]/40',
  'high':        'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'medium':      'bg-[#1A1A1A] text-[#A3A3A3] border-[#2A2A2A]',
}

interface ConciergeProposalCardProps {
  event: Event
  proposal: Proposal
  accepted: boolean
  skipped: boolean
  onAccept: () => void
  onSkip: () => void
}

export function ConciergeProposalCard({
  event,
  proposal,
  accepted,
  skipped,
  onAccept,
  onSkip,
}: ConciergeProposalCardProps) {
  return (
    <div
      className={
        `bg-[#111111] border border-[#1A1A1A] rounded-md p-5 space-y-3 transition-opacity ` +
        (skipped ? 'opacity-40' : '')
      }
    >
      <div className="flex flex-wrap items-start gap-2">
        <Badge className={`text-[10px] ${PRIORITY_TONE[proposal.priority]}`}>
          {proposal.priority}
        </Badge>
        {proposal.is_stretch && (
          <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[10px]">
            Stretch
          </Badge>
        )}
      </div>

      <div>
        <p className="font-mono text-base font-bold text-[#FAFAFA]">{event.title}</p>
        <p className="text-xs text-[#A3A3A3] mt-1">
          {event.host} · {formatEventTime(event.starts_at, event.ends_at)}
          {event.neighborhood ? ` · ${event.neighborhood}` : ''}
        </p>
      </div>

      <div className="bg-[#0F0F0F] border-l-2 border-[#FF6B35]/40 pl-3 py-2">
        <p className="text-[10px] font-mono text-[#666666] uppercase tracking-widest mb-1">
          Why for you
        </p>
        <p className="text-sm text-[#A3A3A3]">{proposal.reasoning}</p>
      </div>

      {accepted ? (
        <p className="text-xs font-mono text-emerald-400">
          Added ✓ —{' '}
          <Link href="/my-plan" className="underline hover:text-emerald-300">
            see /my-plan
          </Link>
        </p>
      ) : (
        <div className="flex gap-2">
          <Button
            onClick={onAccept}
            className="bg-[#FF6B35] hover:bg-[#e85a25] text-white font-mono text-sm"
          >
            Accept
          </Button>
          <Button
            onClick={onSkip}
            variant="outline"
            className="border-[#333333] text-[#A3A3A3] hover:bg-[#1A1A1A] font-mono text-sm"
          >
            Skip
          </Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests — expect pass (6 tests green)**

```bash
npm test -- ConciergeProposalCard
```

- [ ] **Step 5: Commit**

```bash
git add components/ConciergeProposalCard.tsx __tests__/components/ConciergeProposalCard.test.tsx
git commit -m "feat(concierge): add ConciergeProposalCard with priority + reasoning + Accept/Skip"
```

---

## Task 7: `ConciergeForm` component

**Files:**
- Create: `/Users/askowronski/Projects/nytw-companion/components/ConciergeForm.tsx`
- Test: `/Users/askowronski/Projects/nytw-companion/__tests__/components/ConciergeForm.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// __tests__/components/ConciergeForm.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConciergeForm } from '../../components/ConciergeForm'

describe('ConciergeForm', () => {
  it('renders hint about existing plan when existingCount > 0', () => {
    render(
      <ConciergeForm existingCount={3} submitting={false} error={null} onSubmit={() => {}} />,
    )
    expect(screen.getByText(/You have 3 events/i)).toBeInTheDocument()
  })

  it('renders neutral hint when existingCount === 0', () => {
    render(
      <ConciergeForm existingCount={0} submitting={false} error={null} onSubmit={() => {}} />,
    )
    expect(screen.getByText(/Tell us about yourself/i)).toBeInTheDocument()
  })

  it('submit button is disabled while text is shorter than 10 chars', () => {
    render(
      <ConciergeForm existingCount={0} submitting={false} error={null} onSubmit={() => {}} />,
    )
    const btn = screen.getByRole('button', { name: /suggestions/i })
    expect(btn).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'short' } })
    expect(btn).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'this is plenty long' } })
    expect(btn).not.toBeDisabled()
  })

  it('submit button is disabled while submitting=true', () => {
    render(
      <ConciergeForm existingCount={0} submitting={true} error={null} onSubmit={() => {}} />,
    )
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'this is plenty long' } })
    expect(screen.getByRole('button', { name: /suggestions/i })).toBeDisabled()
  })

  it('calls onSubmit with profile text on click', () => {
    const onSubmit = vi.fn()
    render(
      <ConciergeForm existingCount={0} submitting={false} error={null} onSubmit={onSubmit} />,
    )
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'I am a solo founder building AI agents' },
    })
    fireEvent.click(screen.getByRole('button', { name: /suggestions/i }))
    expect(onSubmit).toHaveBeenCalledWith('I am a solo founder building AI agents')
  })

  it('shows error banner when error prop set', () => {
    render(
      <ConciergeForm existingCount={0} submitting={false} error="Network down" onSubmit={() => {}} />,
    )
    expect(screen.getByText(/Network down/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests — expect fail**

```bash
npm test -- ConciergeForm
```

- [ ] **Step 3: Implement**

```tsx
// components/ConciergeForm.tsx
'use client'

import { useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

interface ConciergeFormProps {
  existingCount: number
  submitting: boolean
  error: string | null
  onSubmit: (profileText: string) => void
}

const PLACEHOLDER =
  "I'm a CTO at a 30-person AI startup, flying in from Warsaw. Looking for GenAI infrastructure talks, fundraising contacts, and AI talent. Available Tue-Fri."

export function ConciergeForm({ existingCount, submitting, error, onSubmit }: ConciergeFormProps) {
  const [text, setText] = useState('')
  const isTooShort = text.trim().length < 10

  function handleSubmit() {
    if (isTooShort || submitting) return
    onSubmit(text.trim())
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#A3A3A3]">
        {existingCount > 0
          ? `You have ${existingCount} events in your plan. AI will suggest more — it won't replace your plan.`
          : 'Tell us about yourself and AI will pick 5–8 events you\'d like.'}
      </p>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={PLACEHOLDER}
        rows={4}
        className="bg-[#111111] border-[#1A1A1A] text-[#FAFAFA] font-mono text-sm"
      />

      <div className="flex items-center gap-3">
        <Button
          onClick={handleSubmit}
          disabled={isTooShort || submitting}
          className="bg-[#FF6B35] hover:bg-[#e85a25] text-white font-mono"
        >
          {submitting ? 'Thinking…' : 'Get 5–8 suggestions →'}
        </Button>
        {submitting && (
          <span className="text-xs font-mono text-[#666666]">
            Claude is reading the catalog…
          </span>
        )}
      </div>

      {error && (
        <p className="text-sm font-mono text-red-400 bg-red-500/10 border border-red-500/30 rounded-md p-3">
          {error}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests — expect pass (6 tests green)**

```bash
npm test -- ConciergeForm
```

- [ ] **Step 5: Commit**

```bash
git add components/ConciergeForm.tsx __tests__/components/ConciergeForm.test.tsx
git commit -m "feat(concierge): add ConciergeForm with profile textarea and submit state"
```

---

## Task 8: `ConciergeProposals` component

**Files:**
- Create: `/Users/askowronski/Projects/nytw-companion/components/ConciergeProposals.tsx`

No unit test — composed from `ConciergeProposalCard`. Empty state and Add-all button covered by visual smoke.

- [ ] **Step 1: Implement**

```tsx
// components/ConciergeProposals.tsx
'use client'

import { ConciergeProposalCard } from '@/components/ConciergeProposalCard'
import { Button } from '@/components/ui/button'
import type { Event } from '@/lib/types'
import type { Proposal } from '@/lib/concierge-schema'

interface ConciergeProposalsProps {
  proposals: Proposal[]
  events: Event[]
  notes: string | null
  acceptedIds: ReadonlySet<string>
  skippedIds: ReadonlySet<string>
  onAccept: (eventId: string) => void
  onSkip: (eventId: string) => void
  onAddAll: () => void
}

export function ConciergeProposals({
  proposals,
  events,
  notes,
  acceptedIds,
  skippedIds,
  onAccept,
  onSkip,
  onAddAll,
}: ConciergeProposalsProps) {
  const eventById = new Map(events.map((e) => [e.id, e]))
  const renderable = proposals.filter((p) => eventById.has(p.event_id))
  const undecidedCount = renderable.filter(
    (p) => !acceptedIds.has(p.event_id) && !skippedIds.has(p.event_id),
  ).length

  if (renderable.length === 0) {
    return (
      <div className="bg-[#111111] border border-[#1A1A1A] rounded-md p-6 text-center">
        <p className="font-mono text-sm text-[#A3A3A3]">
          No matches for that profile.
        </p>
        <p className="text-xs text-[#666666] mt-1">
          Try broader interests, or check{' '}
          <a href="/beyond" className="text-[#FF6B35] hover:underline">
            other aggregators →
          </a>
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-sm text-[#FAFAFA]">
          {renderable.length} suggestion{renderable.length !== 1 ? 's' : ''} for you
        </p>
        {undecidedCount > 1 && (
          <Button
            onClick={onAddAll}
            variant="outline"
            className="border-[#FF6B35]/40 text-[#FF6B35] hover:bg-[#FF6B35]/10 font-mono text-sm"
          >
            Add all {undecidedCount} →
          </Button>
        )}
      </div>

      {notes && (
        <p className="text-xs italic text-[#A3A3A3] font-mono">{notes}</p>
      )}

      <div className="grid gap-3">
        {renderable.map((proposal) => {
          const event = eventById.get(proposal.event_id)!
          return (
            <ConciergeProposalCard
              key={proposal.event_id}
              event={event}
              proposal={proposal}
              accepted={acceptedIds.has(proposal.event_id)}
              skipped={skippedIds.has(proposal.event_id)}
              onAccept={() => onAccept(proposal.event_id)}
              onSkip={() => onSkip(proposal.event_id)}
            />
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Lint + tests**

```bash
npm run lint && npm test
```

Expected: clean, all tests still pass.

- [ ] **Step 3: Commit**

```bash
git add components/ConciergeProposals.tsx
git commit -m "feat(concierge): add ConciergeProposals list with Add-all + empty state"
```

---

## Task 9: `ConciergeClient` orchestrator

**Files:**
- Create: `/Users/askowronski/Projects/nytw-companion/components/ConciergeClient.tsx`

No unit test — orchestrator over already-tested pieces.

- [ ] **Step 1: Implement**

```tsx
// components/ConciergeClient.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { usePlanStore } from '@/lib/plan-store'
import { ConciergeForm } from '@/components/ConciergeForm'
import { ConciergeProposals } from '@/components/ConciergeProposals'
import type { Event } from '@/lib/types'
import type { Proposal } from '@/lib/concierge-schema'

interface ConciergeClientProps {
  events: Event[]
}

export function ConciergeClient({ events }: ConciergeClientProps) {
  const [mounted, setMounted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [proposals, setProposals] = useState<Proposal[] | null>(null)
  const [notes, setNotes] = useState<string | null>(null)
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set())
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set())

  const items = usePlanStore((s) => s.items)
  const addItem = usePlanStore((s) => s.addItem)

  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard SSR hydration guard
  useEffect(() => setMounted(true), [])

  const existingIds = useMemo(() => items.map((i) => i.event_id), [items])

  async function handleSubmit(profileText: string) {
    setSubmitting(true)
    setError(null)
    setProposals(null)
    setNotes(null)
    setAcceptedIds(new Set())
    setSkippedIds(new Set())
    try {
      const res = await fetch('/api/concierge', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          profile_text: profileText,
          existing_event_ids: existingIds,
        }),
      })
      if (res.status === 429) {
        const body = (await res.json()) as { retryAfterMs: number }
        const mins = Math.ceil(body.retryAfterMs / 60_000)
        throw new Error(`Too many requests — try again in ${mins} min.`)
      }
      if (!res.ok) {
        throw new Error("Concierge unavailable — please try again.")
      }
      const body = (await res.json()) as { proposals: Proposal[]; notes: string | null }
      setProposals(body.proposals)
      setNotes(body.notes)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach concierge.")
    } finally {
      setSubmitting(false)
    }
  }

  function acceptOne(eventId: string) {
    addItem(eventId, 'interested', 'concierge')
    setAcceptedIds((prev) => new Set(prev).add(eventId))
    toast('Added to plan')
  }

  function skipOne(eventId: string) {
    setSkippedIds((prev) => new Set(prev).add(eventId))
  }

  function addAll() {
    if (!proposals) return
    let added = 0
    const nextAccepted = new Set(acceptedIds)
    for (const p of proposals) {
      if (acceptedIds.has(p.event_id) || skippedIds.has(p.event_id)) continue
      addItem(p.event_id, 'interested', 'concierge')
      nextAccepted.add(p.event_id)
      added += 1
    }
    setAcceptedIds(nextAccepted)
    if (added > 0) toast(`Added ${added} event${added !== 1 ? 's' : ''} to plan`)
  }

  if (!mounted) {
    return (
      <div className="bg-[#111111] border border-[#1A1A1A] rounded-md p-6">
        <p className="font-mono text-sm text-[#666666]">Loading…</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <ConciergeForm
        existingCount={items.length}
        submitting={submitting}
        error={error}
        onSubmit={handleSubmit}
      />

      {proposals !== null && (
        <ConciergeProposals
          proposals={proposals}
          events={events}
          notes={notes}
          acceptedIds={acceptedIds}
          skippedIds={skippedIds}
          onAccept={acceptOne}
          onSkip={skipOne}
          onAddAll={addAll}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Lint + tests + build**

```bash
npm run lint && npm test && npm run build
```

Expected: clean, tests pass, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/ConciergeClient.tsx
git commit -m "feat(concierge): add ConciergeClient orchestrator with fetch, Accept/Skip, Add-all"
```

---

## Task 10: `/plan` page

**Files:**
- Create: `/Users/askowronski/Projects/nytw-companion/app/plan/page.tsx`

- [ ] **Step 1: Implement**

```tsx
// app/plan/page.tsx
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { ConciergeClient } from '@/components/ConciergeClient'
import type { Event } from '@/lib/types'
import seedEvents from '@/data/seed-events.json' with { type: 'json' }

export const metadata: Metadata = {
  title: "Plan with AI — NYTW Engineer's Companion",
  description: 'Describe yourself; AI picks 5–8 events for you.',
}

export const revalidate = 3600

async function fetchEvents(): Promise<Event[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return seedEvents as Event[]
  }
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('starts_at', { ascending: true })
    if (error || !data) return []
    return data as Event[]
  } catch {
    return []
  }
}

export default async function PlanPage() {
  const events = await fetchEvents()

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-[#FAFAFA]">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <header className="mb-8">
          <p className="font-mono text-2xl font-bold text-[#FAFAFA]">Plan with AI</p>
          <p className="text-sm text-[#A3A3A3] mt-1">
            Describe what you're looking for. Claude picks 5–8 events you'd like.
          </p>
        </header>
        <ConciergeClient events={events} />
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Update `SiteNav` to mark `/plan` as a live route**

The route is now live. Edit `/Users/askowronski/Projects/nytw-companion/components/SiteNav.tsx`. Find the `ITEMS` array — the entry currently reads:

```ts
{ label: 'Plan with AI', href: '/plan', live: false },
```

Change it to:

```ts
{ label: 'Plan with AI', href: '/plan', live: true },
```

- [ ] **Step 3: Also update `MyPlanEmptyState` to make "Plan with AI" a real Link**

Edit `/Users/askowronski/Projects/nytw-companion/components/MyPlanEmptyState.tsx`. The "Plan with AI" card currently renders as a disabled `<div>` with "Coming soon". Replace it with a real `<Link href="/plan">` card. Existing test asserts the disabled state, so the test will fail — that's expected, fix it in the same edit.

Updated component:

```tsx
// components/MyPlanEmptyState.tsx
import Link from 'next/link'

export function MyPlanEmptyState() {
  return (
    <div className="text-center py-16 px-6">
      <p className="font-mono text-2xl font-bold text-[#FAFAFA] mb-2">
        Your plan is empty.
      </p>
      <p className="text-sm text-[#A3A3A3] mb-8">
        □ → □ → □
      </p>
      <div className="grid sm:grid-cols-3 gap-3 max-w-2xl mx-auto">
        <Link
          href="/events"
          className="bg-[#111111] border border-[#1A1A1A] rounded-md p-5 text-left hover:border-[#FF6B35] transition-colors"
        >
          <p className="font-mono text-sm text-[#FAFAFA] font-bold mb-1">Browse events →</p>
          <p className="text-xs text-[#A3A3A3]">87 curated picks, day-grouped timeline</p>
        </Link>
        <Link
          href="/events"
          className="bg-[#111111] border border-[#1A1A1A] rounded-md p-5 text-left hover:border-[#FF6B35] transition-colors"
        >
          <p className="font-mono text-sm text-[#FAFAFA] font-bold mb-1">Editor&rsquo;s Picks →</p>
          <p className="text-xs text-[#A3A3A3]">5–7 must-attend events with a blurb each</p>
        </Link>
        <Link
          href="/plan"
          className="bg-[#111111] border border-[#1A1A1A] rounded-md p-5 text-left hover:border-[#FF6B35] transition-colors"
        >
          <p className="font-mono text-sm text-[#FAFAFA] font-bold mb-1">Plan with AI →</p>
          <p className="text-xs text-[#A3A3A3]">Describe yourself, get 5–8 picks</p>
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Update the `MyPlanEmptyState` test for the new behavior**

Edit `/Users/askowronski/Projects/nytw-companion/__tests__/components/MyPlanEmptyState.test.tsx`. Replace the third test (which asserts the disabled state) with one that asserts the Link to `/plan`:

```tsx
// __tests__/components/MyPlanEmptyState.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MyPlanEmptyState } from '../../components/MyPlanEmptyState'

describe('MyPlanEmptyState', () => {
  it('renders the headline', () => {
    render(<MyPlanEmptyState />)
    expect(screen.getByText(/Your plan is empty/i)).toBeInTheDocument()
  })

  it('renders Browse events and Editor\'s Picks as links to /events', () => {
    render(<MyPlanEmptyState />)
    const browse = screen.getByRole('link', { name: /Browse events/i })
    expect(browse).toHaveAttribute('href', '/events')
    const picks = screen.getByRole('link', { name: /Editor.s Picks/i })
    expect(picks).toHaveAttribute('href', '/events')
  })

  it('renders Plan with AI as a link to /plan', () => {
    render(<MyPlanEmptyState />)
    const ai = screen.getByRole('link', { name: /Plan with AI/i })
    expect(ai).toHaveAttribute('href', '/plan')
  })
})
```

- [ ] **Step 5: Update the `SiteNav` test for the new live state**

Edit `/Users/askowronski/Projects/nytw-companion/__tests__/components/SiteNav.test.tsx`. The first test currently asserts "Plan with AI" is NOT a link. That's no longer true — it's now live. The test currently uses `screen.getAllByText(/My Plan/i)` and `screen.getAllByText(/Coming soon/i)` to verify dead routes exist; since at least one dead route remains (`/my-plan`, `/beyond`, `/about`), the assertion that "Coming soon" appears at least once stays valid. The only change needed: update the existing "first test" so it doesn't specifically check that Plan with AI is dead.

Replace the entire `SiteNav.test.tsx` content with:

```tsx
// __tests__/components/SiteNav.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SiteNav } from '../../components/SiteNav'

let currentPath = '/'
vi.mock('next/navigation', () => ({
  usePathname: () => currentPath,
}))

describe('SiteNav', () => {
  beforeEach(() => {
    currentPath = '/'
  })

  it('renders live routes as links (Browse, Now, Plan with AI) and dead routes as disabled', () => {
    render(<SiteNav />)
    expect(screen.getByRole('link', { name: /^Browse/i })).toHaveAttribute('href', '/events')
    expect(screen.getByRole('link', { name: /^Now/i })).toHaveAttribute('href', '/now')
    expect(screen.getByRole('link', { name: /Plan with AI/i })).toHaveAttribute('href', '/plan')
    // At least one dead route still exists (/my-plan, /beyond, /about)
    expect(screen.getAllByText(/Coming soon/i).length).toBeGreaterThanOrEqual(1)
  })

  it('highlights the active route from usePathname', () => {
    currentPath = '/events'
    render(<SiteNav />)
    const browse = screen.getByRole('link', { name: /^Browse/i })
    expect(browse.className).toMatch(/text-\[#FF6B35\]/)
  })
})
```

- [ ] **Step 6: Run the full suite**

```bash
npm test
```

Expected: all green including the updated SiteNav + MyPlanEmptyState tests.

- [ ] **Step 7: Lint + build**

```bash
npm run lint && npm run build
```

Expected: clean lint, build succeeds, `/plan` appears in route list.

- [ ] **Step 8: Commit**

```bash
git add app/plan/page.tsx components/SiteNav.tsx components/MyPlanEmptyState.tsx __tests__/components/SiteNav.test.tsx __tests__/components/MyPlanEmptyState.test.tsx
git commit -m "feat(plan): add /plan page; mark route live in SiteNav and MyPlanEmptyState"
```

---

## Task 11: Final smoke + acceptance

**Files:** none changed. Verification only.

- [ ] **Step 1: Full test suite**

```bash
npm test
```

Expected: every test passes. Phase 5a added:
- `rate-limit.test.ts` (6 tests)
- `concierge-schema.test.ts` (9 tests)
- `concierge-mock.test.ts` (6 tests)
- `anthropic.test.ts` (8 tests)
- `concierge-route.test.ts` (7 tests)
- `ConciergeProposalCard.test.tsx` (6 tests)
- `ConciergeForm.test.tsx` (6 tests)
- Updated: `SiteNav.test.tsx` (2 tests, same count as before)
- Updated: `MyPlanEmptyState.test.tsx` (3 tests, same count as before)

Net new: 48 tests. Phase 4 left 103, so total ≈ 151.

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: 0 errors.

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: clean build, `/plan` and `/api/concierge` listed in the route table.

- [ ] **Step 4: Inventory commits**

```bash
git log --oneline 23843ae..HEAD
```

Expected: ~10–11 commits.

- [ ] **Step 5: Manual acceptance walk**

Run `npm run dev` (or use the existing background server). With `NEXT_PUBLIC_MAPBOX_TOKEN` unset and `ANTHROPIC_API_KEY` unset:

- Visit `/plan` — see the form. Hint reads "Tell us about yourself…".
- Type a 50-char profile, click "Get 5–8 suggestions →". Loading spinner appears; ~50 ms later mock proposals render (5 Editor's Picks). `notes` line reads "Mock proposals (ANTHROPIC_API_KEY not configured — set it for real suggestions)."
- Click Accept on one card. Toast "Added to plan" appears. Card collapses to "Added ✓ — see /my-plan".
- Click "Add all" → remaining proposals accept.
- Visit `/my-plan` — see the added events with `source='concierge'`.
- Visit `/events` — verify `MyPlanWidget` shows correct count.
- Open the form again, type a profile, submit 6 times in a row — the 6th call returns 429; UI shows "Too many requests — try again in N min".

If `ANTHROPIC_API_KEY` is set in `.env.local` (skip this if you don't have one): real Claude proposals come back with reasoning specific to the typed profile.

- [ ] **Step 6: Final fix commit if smoke surfaced anything**

If something needed adjustment, commit the fix. Otherwise skip.

---

## Done criteria (matches design's Definition of Done)

- [ ] `/plan` page renders `ConciergeForm`.
- [ ] Form submit → POST `/api/concierge` → proposals rendered as cards.
- [ ] When `ANTHROPIC_API_KEY` set, real Claude proposals returned.
- [ ] When missing, deterministic mock proposals (5 Editor's Picks) with informative `notes`.
- [ ] Rate limit kicks in after 5 calls/IP/hour with 429.
- [ ] Per-event Accept adds to `usePlanStore` with `source='concierge'`, triggers toast.
- [ ] "Add all" accepts all not-yet-decided proposals.
- [ ] `concierge_logs` write attempted; failures swallowed.
- [ ] `SiteNav` marks `/plan` as live (Coming soon removed).
- [ ] `MyPlanEmptyState` "Plan with AI" card links to `/plan`.
- [ ] `npm test` green; `npm run lint` clean; `npm run build` succeeds.

---

## Out-of-scope reminders

- Magic link recovery — Phase 5b.
- DB plan sync — Phase 5b.
- Streaming proposals — Phase 5b.
- "Tell me more" modal per proposal — deferred.
- AI re-ranking after Accept/Skip — single shot per submit.
- Content moderation / abuse filters — defer to launch hardening.
