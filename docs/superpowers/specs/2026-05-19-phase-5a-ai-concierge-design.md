# Phase 5a — AI Concierge — Design

**Date:** 2026-05-19
**Phase:** 5a (subset of v1.5)
**Source spec:** `SPEC.md` §5 Phase 5 + §6 (Concierge system prompt)
**Status:** Draft, awaiting user review

---

## Goal

Ship the AI Concierge half of v1.5: a `/plan` page where the user types a 1–3 sentence self-description and gets 5–8 curated event proposals from Claude, with per-event Accept/Skip and a bulk "Add all" — all routed back into the existing `usePlanStore`. Plans stay in localStorage; auth + DB sync land in Phase 5b.

v1.5a acceptance test (trimmed from SPEC):

> User opens `/plan`, writes "Solo founder pre-seed building AI agents, Tue–Fri available", clicks Get suggestions. Within ~3 seconds, 5–8 event cards appear, each with a "Why for you" reasoning line and a priority badge. User clicks Accept on three of them; each one drops into `MyPlanWidget` immediately with `source='concierge'`. User clicks "Add all" on the remaining; widget count goes up.

---

## Decisions captured during brainstorm

| Topic | Decision |
| --- | --- |
| Scope | **Phase 5a only.** Concierge UI + API route + Claude integration. **Out:** magic link auth, DB plan sync, `MagicLinkPrompt` component — Phase 5b. |
| ANTHROPIC_API_KEY missing | Route returns **mock proposals** = 5 of the existing Editor's Picks (filtered against `existing_event_ids`) so the UI flow is testable in dev without a key. Mirrors the Phase 2 seed-JSON / Phase 3 MapTokenFallback patterns. Production sets the key. |
| `concierge_logs` DB write | Best-effort. After Claude returns, attempt a Supabase insert; if env missing or insert fails, log to server console and continue serving the response. |
| Rate limiting | In-memory `Map<ip, timestamps[]>` keyed by client IP from request headers. 5 calls / IP / hour per server instance. Resets on restart. Sufficient for v1.5 MVP traffic. |
| Acceptance UX | Per-event Accept/Skip + "Add all" bulk button. Spec-faithful. |
| Catalog payload | Full catalog passed to Claude with trimmed fields: `{ id, title, host, starts_at, ends_at, neighborhood, tags, audience_tags, format, is_editors_pick, description: first 200 chars }`. ~30 KB at current scale. |
| API shape | POST `/api/concierge` Route Handler (not Server Action). Matches SPEC line 195. |
| Tests | Unit-test the pure helpers (rate limiter, validation schema, mock-mode selector, Anthropic SDK call shape) using `vi.mock('@anthropic-ai/sdk', …)`. No real API calls in CI. Skip route-handler-as-server e2e — Playwright stays in Phase 9. |

---

## Architecture

One new route, one new API endpoint, one external SDK wrapper, three new client components, one pure rate-limiter library.

```
app/
  plan/page.tsx                (new)      — Server Component shell, fetches events, hands to <ConciergeClient/>
  api/concierge/route.ts       (new)      — POST handler; validates, rate-limits, calls Claude (or mock), writes log

components/
  ConciergeClient.tsx          (new)      — client island; owns form state and proposals state
  ConciergeForm.tsx            (new)      — textarea + submit; calls fetch('/api/concierge'); reports loading/error
  ConciergeProposals.tsx       (new)      — list of proposal cards with Accept/Skip + "Add all" bulk
  ConciergeProposalCard.tsx    (new)      — one proposal card (title, host, time, reasoning, priority badge)

lib/
  anthropic.ts                 (new)      — Claude SDK wrapper; CONCIERGE_SYSTEM_PROMPT, generateProposals()
  concierge-mock.ts            (new)      — pure: builds mock proposals from Editor's Picks when ANTHROPIC key missing
  concierge-schema.ts          (new)      — zod schema for request body + Claude response parse
  rate-limit.ts                (new)      — pure in-memory rate limiter; testable
```

**Key boundaries**

- `/api/concierge` Route Handler is the **only** code that touches Anthropic SDK. The client never calls Claude directly.
- `lib/concierge-mock.ts` is pure — given the events list and `existing_event_ids`, it deterministically returns mock proposals from Editor's Picks. Fully unit-testable.
- `lib/concierge-schema.ts` is pure zod definitions, no I/O.
- `lib/rate-limit.ts` is a pure module with `checkLimit(ip, max, windowMs)` returning `{ ok, retryAfterMs }`. Internal Map state lives at module scope (per-instance), testable with `clear()` helper.
- `lib/anthropic.ts` exports `CONCIERGE_SYSTEM_PROMPT` (verbatim from SPEC §6) and a `generateProposals(profileText, candidates): Promise<{ proposals; notes }>` function. The function reads `ANTHROPIC_API_KEY` from env and throws a tagged error (`MissingKeyError`) when absent — the route handler catches it and switches to mock mode.

**State ownership**

- Form state (`profile_text`, loading, error, proposals) lives in `ConciergeClient`. No URL state needed.
- `usePlanStore.addItem(eventId, status='interested', source='concierge')` is the only writer.

---

## Components

### `/plan/page.tsx` (Server Component)

Mirrors `/events`, `/now`, `/my-plan`. Async, fetches events (Supabase or seed JSON), passes serialized events to `<ConciergeClient events={events}/>`.

### `ConciergeClient` (~80 LOC)

Props: `{ events: Event[] }`.

State:
- `profile_text: string`
- `submitting: boolean`
- `error: string | null`
- `proposals: Proposal[] | null` (null = not yet submitted; empty array = submitted, none returned)
- `notes: string | null` (Claude's optional meta-comment)

Reads `usePlanStore.items` to compute `existing_event_ids = items.map(i => i.event_id)`.

On submit: POST `/api/concierge` with `{ profile_text, existing_event_ids }`. Renders either:
- `<ConciergeForm/>` (always at top)
- `<ConciergeProposals/>` underneath (when `proposals !== null`)

### `ConciergeForm` (~60 LOC)

Props: `{ existingCount: number; submitting: boolean; error: string | null; onSubmit: (profileText: string) => void }`.

- shadcn `Textarea` with placeholder from SPEC ("I'm a CTO at a 30-person AI startup, flying in from Warsaw…").
- Pre-fill hint above the form: when `existingCount > 0`, show "You have N events. AI will suggest more — won't replace your plan." Otherwise show "Tell us about yourself and AI will pick 5–8 events you'd like."
- Submit button: "Get 5–8 suggestions →" (disabled when `submitting` or when `profile_text.trim().length < 10`).
- Error banner below button if `error` set.

### `ConciergeProposals` (~80 LOC)

Props: `{ proposals: Proposal[]; events: Event[]; notes: string | null; onAccept: (eventId: string) => void; onSkip: (eventId: string) => void; onAddAll: () => void }`.

- Header: "{N} suggestions for you" + optional "Add all {N} →" button.
- `notes` rendered as a subtle italic line above the cards (e.g., "Limited matches for niche interest — consider checking /beyond").
- Maps each proposal to a `<ConciergeProposalCard/>`. Proposals already accepted/skipped this session are visually marked but stay in the list (so the user sees what they decided).
- Empty state when zero proposals: "No matches for that profile — try broader interests, or check /beyond →".

### `ConciergeProposalCard` (~100 LOC)

Props: `{ proposal: Proposal; event: Event; accepted: boolean; skipped: boolean; onAccept: () => void; onSkip: () => void }`.

- Mini event card: title, host, formatted time (`formatEventTime`), neighborhood, format icon.
- **"Why for you:"** the proposal's `reasoning` field as a quoted line.
- **Priority badge**: must-attend (red `#FF6B35`), high (amber), medium (neutral grey). Plus "Stretch" badge if `is_stretch`.
- Buttons: Accept (→ `addItem(eventId, 'interested', 'concierge')` + sonner toast "Added to plan"). Skip (→ visually fades the card).
- When `accepted`: replace Accept/Skip with a muted "Added ✓ — see /my-plan" link.

### `Proposal` type (in `lib/concierge-schema.ts`)

```ts
type Proposal = {
  event_id: string
  reasoning: string
  priority: 'must-attend' | 'high' | 'medium'
  is_stretch: boolean
}
```

### `/api/concierge/route.ts`

```
POST /api/concierge
Request: { profile_text: string, existing_event_ids: string[] }
Response: { proposals: Proposal[], notes: string | null }
Errors:
  400 — invalid input (zod fail)
  429 — rate limit exceeded; body { retryAfterMs }
  500 — internal error (Claude API call failed AND mock fallback unavailable)
```

Steps:
1. Parse body via `ConciergeRequestSchema` → 400 on fail.
2. Resolve client IP from `request.headers.get('x-forwarded-for')` (Vercel-friendly) → fall back to `'unknown'`.
3. `rate-limit.checkLimit(ip, 5, 60*60*1000)` → 429 on fail.
4. Fetch event catalog (Supabase fallback to seed JSON, same as other pages).
5. `candidates = events.filter(e => !existing_event_ids.includes(e.id))`. Do NOT filter by `lat/lng` — the concierge picks regardless of whether the event has map coords.
6. Try `generateProposals(profile_text, candidates)`. If `MissingKeyError`, switch to `concierge-mock.buildMockProposals(candidates, 5)`. Other errors → 500.
7. Best-effort log to `concierge_logs`: catch and swallow any failure.
8. Return `{ proposals, notes }`.

### `lib/anthropic.ts`

```ts
export const CONCIERGE_SYSTEM_PROMPT = `<verbatim from SPEC §6>`

export class MissingKeyError extends Error {
  constructor() { super('ANTHROPIC_API_KEY not configured') }
}

export async function generateProposals(
  profileText: string,
  candidates: TrimmedEvent[],
): Promise<{ proposals: Proposal[]; notes: string | null; usage: { promptTokens?: number; completionTokens?: number } }>
```

- Reads `process.env.ANTHROPIC_API_KEY`. Throws `MissingKeyError` if blank.
- Calls `client.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 4096, system: CONCIERGE_SYSTEM_PROMPT, messages: [{ role: 'user', content: userMessage }] })`.
- `userMessage` mirrors SPEC §6: user profile, existing event ids, candidate events JSON.
- Parses the assistant's first text content block as JSON. If parsing fails, throws `Error('Concierge response not JSON')` — the route returns 500.
- Returns parsed `{ proposals, notes }` + usage metadata (for log row).

### `lib/concierge-mock.ts`

```ts
export function buildMockProposals(
  candidates: Event[],
  count: number,
): { proposals: Proposal[]; notes: string }
```

- Picks the first `count` events where `is_editors_pick === true`. If fewer than `count` exist, fills the remainder with the next Editor-pick events sorted by `starts_at`.
- For each, returns:
  - `event_id` = event id
  - `reasoning` = `'Editor pick — featured curated event for Tech Week.'` (deterministic)
  - `priority` = `'high'` for the first, `'medium'` for the rest
  - `is_stretch` = `false`
- `notes` = `'Mock proposals (ANTHROPIC_API_KEY not configured — set it for real suggestions).'`
- Pure: no env reads, deterministic given the input.

### `lib/rate-limit.ts`

```ts
type Window = { resetAt: number; count: number }
const store = new Map<string, Window>()

export function checkLimit(
  key: string,
  max: number,
  windowMs: number,
  nowMs: number = Date.now(),
): { ok: true } | { ok: false; retryAfterMs: number }

export function resetForTests(): void
```

- Sliding-window-counter style: each key has `{ resetAt, count }`. If `nowMs >= resetAt`, reset to `{ resetAt: nowMs + windowMs, count: 1 }`. Else if `count < max`, increment and ok. Else not ok, `retryAfterMs = resetAt - nowMs`.
- `nowMs` parameter lets tests pass deterministic time.
- `resetForTests()` clears the Map — called from `beforeEach`.

### `lib/concierge-schema.ts`

```ts
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

---

## Data flow

```
Browser
  └─ /plan loads → <ConciergeClient/> reads usePlanStore.items
       ↓ user types profile, clicks submit
  POST /api/concierge { profile_text, existing_event_ids }
       ↓
Server route
  ├─ zod validate → 400 on fail
  ├─ checkLimit(ip, 5, 1h) → 429 on fail
  ├─ fetchEvents() → catalog (seed JSON or Supabase)
  ├─ candidates = events filter(e => !existing_event_ids.includes(e.id))
  ├─ try generateProposals(profile_text, candidates)
  │    catch MissingKeyError → buildMockProposals(candidates, 5)
  │    catch other → 500
  ├─ best-effort logToConciergeLogs({...}) (swallow errors)
  └─ return { proposals, notes }
       ↓
<ConciergeProposals> renders
       ↓ user clicks Accept
  usePlanStore.addItem(eventId, 'interested', 'concierge')
  sonner toast 'Added to plan'
       ↓ MyPlanWidget count increments
```

### Persisted state

- `usePlanStore` writes only (same as today). New `source='concierge'` value, which already exists in the union type at `lib/types.ts: PlanItemSource = 'manual' | 'concierge' | 'editors_pick' | 'map'`. No type change.
- `concierge_logs` rows written best-effort when Supabase env is present (analytics; not load-bearing for the user flow).

### New env

- `ANTHROPIC_API_KEY` — required for real Claude calls; falls back to mock when missing. Already in `.env.local.example`.

---

## Error handling & edge cases

### Route handler

- **Validation fail:** 400 with zod's `error.flatten()` for dev debuggability.
- **Rate limit:** 429 with `{ retryAfterMs }`. Client shows "Too many requests — try again in N min".
- **Anthropic SDK rejection** (network/quota): 500 with `{ message: 'Concierge unavailable, please try again' }`. Do NOT fall back to mock when key is configured but call fails — that would mask quota issues.
- **Claude returns non-JSON text:** Catch parse failure, return 500. Optional refinement (deferred): retry once with a stricter system reminder. Not in 5a.
- **Claude returns proposal pointing to a non-existent event_id:** Drop that proposal in the response (defense in depth). Log to console.
- **All proposals dropped:** Return `{ proposals: [], notes: <Claude's notes ?? 'No matches found'> }` — client renders empty state.
- **concierge_logs write fails:** swallow; `console.warn(...)` only.

### Client

- **Submit while submitting:** button disabled; double-submit guarded.
- **Empty/short profile:** button disabled below 10 chars.
- **HTTP error response:** error banner shown; form stays editable.
- **Network failure (offline):** error banner "Couldn't reach concierge — check your connection".
- **Accept event already in plan:** `addItem` already guards duplicates (Phase 1 store); shows "Already in your plan" toast variant.
- **Hydration:** `ConciergeClient` reads `usePlanStore`; gates on `mounted` like the rest.

---

## Testing

```
__tests__/lib/
  rate-limit.test.ts           (new)
  concierge-mock.test.ts       (new)
  concierge-schema.test.ts     (new)
  anthropic.test.ts            (new)        — mocks @anthropic-ai/sdk

__tests__/api/
  concierge-route.test.ts      (new)        — calls the route handler directly (it exports the POST function)

__tests__/components/
  ConciergeForm.test.tsx       (new)
  ConciergeProposalCard.test.tsx (new)
```

**Coverage highlights**

- `rate-limit.test.ts`:
  - empty store → first hit ok
  - 5 hits ok, 6th 429 with `retryAfterMs > 0`
  - after window expires, fresh 5-hit budget
  - different IPs are independent
- `concierge-mock.test.ts`:
  - returns up to `count` proposals, all with `is_stretch: false`
  - first proposal `priority: 'must-attend'` or `'high'`, rest `'medium'`
  - skips events already in `existing_event_ids` (via the caller pre-filtering; mock receives pre-filtered list)
  - returns deterministic order
- `concierge-schema.test.ts`:
  - rejects `profile_text` shorter than 10 chars
  - rejects `existing_event_ids` longer than 500
  - accepts valid request
  - parses a sample Claude JSON response correctly
- `anthropic.test.ts`:
  - throws `MissingKeyError` when env unset
  - calls `client.messages.create` with the system prompt and a user message containing profile + candidates
  - parses a mocked `messages.create` response into `{ proposals, notes }`
  - throws `'Concierge response not JSON'` on malformed text
- `concierge-route.test.ts`:
  - 400 on invalid body
  - 429 after 5 calls from the same IP
  - 200 with mock proposals when no key
  - 200 with parsed proposals when SDK mock returns a valid response
  - filters out proposals whose event_id is not in the catalog
  - swallows log-write failures
- `ConciergeForm.test.tsx`:
  - disabled when text < 10 chars
  - disabled while `submitting=true`
  - calls `onSubmit(profileText)` on click
  - shows error banner when `error` prop set
- `ConciergeProposalCard.test.tsx`:
  - renders title, host, time, reasoning, priority badge
  - Accept calls `onAccept`; replaces buttons with "Added ✓" link
  - Skip calls `onSkip`; visually fades

**Mocking**

```ts
// in anthropic.test.ts and concierge-route.test.ts
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(),  // or class Anthropic { messages = { create: vi.fn() } }
}))
```

The test asserts call shape, doesn't hit the network.

**Pre-merge check**

- `npm test` green (existing 103 + ~30 new tests).
- `npm run lint` clean.
- `npm run build` succeeds.
- Manual smoke: visit `/plan` (without `ANTHROPIC_API_KEY`), type a 50-char profile, click submit → see 5 mock proposals → Accept two → check `MyPlanWidget` count increments → visit `/my-plan` → see them marked `source: concierge` (no UI cue today, but data is correct).

---

## Out of scope (explicit non-goals)

- **Magic link recovery** — Phase 5b.
- **DB plan sync** (`syncPlanToDb()` Server Action) — Phase 5b.
- `MagicLinkPrompt` component — Phase 5b.
- Server-side filtering of `existing_event_ids` from the catalog beyond the simple `filter` — no embedding-based pre-ranking.
- Streaming proposals — single JSON response only. Streaming is a Phase 5b polish.
- Persistent rate limiting across deployments — in-memory only.
- "Tell me more" modal on each proposal card — the inline reasoning is enough for v1.5a.
- AI re-ranking after Accept/Skip — single shot per submit.
- Custom email template for Anthropic outage messages.

---

## Risks

- **Claude latency** — typically 2–4s for this prompt size. Mitigation: submit button shows a clear spinner; form stays editable so the user knows where they are. If perceived as too slow, future phase can add streaming.
- **Mock-mode confusion** — without the key, mock proposals always come back. We surface this via the `notes` field ("Mock proposals — set ANTHROPIC_API_KEY for real suggestions") so dev/QA know.
- **Rate limit per-instance** — Vercel may scale to multiple lambdas, effectively giving the same IP `N × 5` calls/hour. For MVP that's fine (Claude cost still capped by quota at the provider).
- **Prompt-injection / abuse via `profile_text`** — system prompt + structured-output constraint mitigates most injection. Validation caps length at 1000 chars. If we see real abuse, Phase 6+ adds content moderation.
- **Anthropic SDK version drift** — pinned at `@anthropic-ai/sdk@^0.96.0` in package.json. We isolate the call inside `lib/anthropic.ts` so version bumps only touch one file.

---

## Definition of done

- [ ] `/plan` page renders the `ConciergeForm`.
- [ ] Form submit → POST `/api/concierge` → proposals rendered as cards.
- [ ] When `ANTHROPIC_API_KEY` is set, real Claude proposals returned.
- [ ] When key missing, deterministic mock proposals (5 Editor's Picks) returned with informative `notes`.
- [ ] Rate limit kicks in after 5 calls per IP per hour; returns 429.
- [ ] Per-event Accept adds to `usePlanStore` with `source='concierge'`, triggers toast.
- [ ] "Add all" button accepts all not-yet-decided proposals.
- [ ] `concierge_logs` insert attempted; failures swallowed.
- [ ] `npm test` green (≈30 new tests); `npm run lint` clean; `npm run build` succeeds.
- [ ] Manual smoke: full flow works end-to-end against mock and (if key is set) against real Claude.
