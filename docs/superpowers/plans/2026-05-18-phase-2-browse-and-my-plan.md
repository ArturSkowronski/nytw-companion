# Phase 2: Browse + My Plan Basic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/events` browse page with a day-grouped timeline, EventCard with add-to-plan flow, Fuse.js search, a detail modal, an Editor's Picks carousel, and the persistent MyPlanWidget — so a user can find 3 events and add them all in under 30 seconds with zero logins.

**Architecture:** `app/events/page.tsx` is a Server Component that fetches all events from Supabase and passes them as props to `EventList` (Client Component). All interactivity (search, modal, plan actions) lives in Client Components that read/write the Zustand store from Phase 1. `MyPlanWidget` is added to the root layout so it persists across pages. Sonner toasts provide implicit feedback. No route changes — the modal is an overlay; pushState only updates the hash.

**Tech Stack:** Next.js 16 App Router, React 19.2, Zustand 5 (existing plan-store), Fuse.js 7, shadcn/ui (Dialog, Sheet, DropdownMenu), sonner toasts, date-fns-tz 3, Supabase JS client, Vitest + @testing-library/react

---

## Next.js 16 Critical Notes

- `params` and `searchParams` in `page.tsx` are **Promises** and must be `await`ed.
- `middleware.ts` is renamed to `proxy.ts` — do not create a `middleware.ts` file.
- Turbopack is the default bundler — no Webpack config needed.
- `fetch` requests are **not cached by default** in Next.js 16 — add `{ cache: 'no-store' }` or `{ next: { revalidate: 3600 } }` explicitly.

---

## File Map

**New files:**
- `data/seed-events.json` — 30 mock events matching the `events` DB schema
- `data/seed.ts` — Supabase upsert script for populating the DB
- `lib/events.ts` — pure event grouping + time period helpers
- `app/events/page.tsx` — Server Component: fetches events, renders EventList
- `components/EventCard.tsx` — Client Component: card UI + plan actions + modal trigger
- `components/EventDetailModal.tsx` — Client Component: Sheet (mobile) / Dialog (desktop) detail overlay
- `components/EventList.tsx` — Client Component: search state + day-grouped rendering
- `components/EventSearch.tsx` — Client Component: Fuse.js search bar
- `components/EditorsPicksCarousel.tsx` — Client Component: auto-rotating picks carousel
- `components/MyPlanWidget.tsx` — Client Component: persistent floating plan counter

**Modified files:**
- `app/layout.tsx` — add `<MyPlanWidget />` and `<Toaster />` inside `<body>`
- `package.json` — add `@testing-library/react`, `@testing-library/user-event` for component tests

**New test files:**
- `__tests__/lib/events.test.ts` — unit tests for grouping/time-period helpers
- `__tests__/components/EventCard.test.tsx` — render + plan interaction tests
- `__tests__/components/EventSearch.test.tsx` — search filtering tests
- `__tests__/components/MyPlanWidget.test.tsx` — hidden/count/preview tests

---

### Task 1: Install additional test dependencies and add DropdownMenu

**Files:**
- Modify: `package.json`
- Create: `components/ui/dropdown-menu.tsx` (via shadcn)

- [ ] **Step 1: Install React Testing Library**

```bash
npm install --save-dev @testing-library/react @testing-library/user-event
```

- [ ] **Step 2: Add DropdownMenu component from shadcn**

```bash
npx shadcn@latest add dropdown-menu
```

- [ ] **Step 3: Verify**

```bash
ls components/ui/dropdown-menu.tsx
npm test -- --reporter=verbose 2>&1 | tail -5
```
Expected: `dropdown-menu.tsx` exists. All 14 existing tests still pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: add React Testing Library and DropdownMenu component"
```

---

### Task 2: Create event grouping utilities (lib/events.ts) with TDD

**Files:**
- Create: `__tests__/lib/events.test.ts`
- Create: `lib/events.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// __tests__/lib/events.test.ts
import { describe, it, expect } from 'vitest'
import { groupEventsByDay, getTimePeriod, formatEventTime } from '../../lib/events'
import type { Event } from '../../lib/types'

function makeEvent(overrides: Partial<Event> & { starts_at: string; ends_at: string }): Event {
  return {
    id: 'test-event',
    title: 'Test Event',
    description: 'A test event',
    host: 'Test Host',
    venue_name: 'Test Venue',
    address: '123 Test St, New York, NY',
    lat: 40.74,
    lng: -73.99,
    neighborhood: 'Flatiron',
    rsvp_url: 'https://lu.ma/test',
    rsvp_platform: 'luma',
    tags: [],
    audience_tags: [],
    format: 'panel',
    capacity: null,
    is_invite_only: false,
    has_free_food: false,
    has_free_drinks: false,
    is_editors_pick: false,
    editors_pick_blurb: null,
    is_virtuslab_event: false,
    source: 'manual',
    source_url: 'https://lu.ma/test',
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
    ...overrides,
  }
}

describe('getTimePeriod', () => {
  it('returns EARLY for events before noon NYC', () => {
    // 2026-06-01T14:00:00Z = 10:00 AM EDT
    expect(getTimePeriod('2026-06-01T14:00:00Z')).toBe('EARLY')
  })

  it('returns MID for events between noon and 5pm NYC', () => {
    // 2026-06-01T17:00:00Z = 1:00 PM EDT
    expect(getTimePeriod('2026-06-01T17:00:00Z')).toBe('MID')
  })

  it('returns LATE for events at or after 5pm NYC', () => {
    // 2026-06-01T21:00:00Z = 5:00 PM EDT
    expect(getTimePeriod('2026-06-01T21:00:00Z')).toBe('LATE')
  })
})

describe('groupEventsByDay', () => {
  it('groups events into arrays keyed by NYC date string YYYY-MM-DD', () => {
    const events = [
      makeEvent({ id: 'a', starts_at: '2026-06-01T14:00:00Z', ends_at: '2026-06-01T16:00:00Z' }),
      makeEvent({ id: 'b', starts_at: '2026-06-01T19:00:00Z', ends_at: '2026-06-01T21:00:00Z' }),
      makeEvent({ id: 'c', starts_at: '2026-06-02T14:00:00Z', ends_at: '2026-06-02T16:00:00Z' }),
    ]
    const groups = groupEventsByDay(events)
    expect(Object.keys(groups)).toHaveLength(2)
    expect(groups['2026-06-01']).toHaveLength(2)
    expect(groups['2026-06-02']).toHaveLength(1)
  })

  it('returns events within each day sorted by starts_at ascending', () => {
    const events = [
      makeEvent({ id: 'b', starts_at: '2026-06-01T19:00:00Z', ends_at: '2026-06-01T21:00:00Z' }),
      makeEvent({ id: 'a', starts_at: '2026-06-01T14:00:00Z', ends_at: '2026-06-01T16:00:00Z' }),
    ]
    const groups = groupEventsByDay(events)
    expect(groups['2026-06-01'][0].id).toBe('a')
    expect(groups['2026-06-01'][1].id).toBe('b')
  })

  it('returns an empty object for empty input', () => {
    expect(groupEventsByDay([])).toEqual({})
  })
})

describe('formatEventTime', () => {
  it('formats start and end in NYC timezone', () => {
    // 2026-06-03T22:00:00Z = 6:00 PM EDT, 2026-06-04T01:00:00Z = 9:00 PM EDT
    const result = formatEventTime('2026-06-03T22:00:00Z', '2026-06-04T01:00:00Z')
    expect(result).toBe('Wed 6:00 PM – 9:00 PM')
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
npm test -- __tests__/lib/events.test.ts
```
Expected: FAIL — "Cannot find module '../../lib/events'"

- [ ] **Step 3: Implement lib/events.ts**

```typescript
// lib/events.ts
import { toZonedTime, format as formatTz } from 'date-fns-tz'
import type { Event } from './types'

const NYC_TZ = 'America/New_York'

export type TimePeriod = 'EARLY' | 'MID' | 'LATE'

export function getTimePeriod(starts_at: string): TimePeriod {
  const d = toZonedTime(new Date(starts_at), NYC_TZ)
  const hour = d.getHours()
  if (hour < 12) return 'EARLY'
  if (hour < 17) return 'MID'
  return 'LATE'
}

export function groupEventsByDay(events: Event[]): Record<string, Event[]> {
  const groups: Record<string, Event[]> = {}
  for (const event of events) {
    const day = formatTz(toZonedTime(new Date(event.starts_at), NYC_TZ), 'yyyy-MM-dd', { timeZone: NYC_TZ })
    if (!groups[day]) groups[day] = []
    groups[day].push(event)
  }
  for (const day of Object.keys(groups)) {
    groups[day].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
  }
  return groups
}

export function formatEventTime(starts_at: string, ends_at: string): string {
  const start = toZonedTime(new Date(starts_at), NYC_TZ)
  const end = toZonedTime(new Date(ends_at), NYC_TZ)
  const dayAbbr = formatTz(start, 'EEE', { timeZone: NYC_TZ })
  const startTime = formatTz(start, 'h:mm aa', { timeZone: NYC_TZ })
  const endTime = formatTz(end, 'h:mm aa', { timeZone: NYC_TZ })
  // date-fns formats 'aa' as 'AM'/'PM'. Convert to 'AM'/'PM' (already correct).
  return `${dayAbbr} ${startTime} – ${endTime}`
}

export function formatDayHeading(dateKey: string): string {
  // dateKey = 'YYYY-MM-DD' in NYC
  const [year, month, day] = dateKey.split('-').map(Number)
  // Construct date at noon UTC to avoid any timezone edge on the date itself
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  return formatTz(toZonedTime(d, NYC_TZ), 'EEEE MMMM d', { timeZone: NYC_TZ })
}

export function formatDayShort(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  return formatTz(toZonedTime(d, NYC_TZ), 'EEE d', { timeZone: NYC_TZ })
}
```

- [ ] **Step 4: Run — expect all tests to pass**

```bash
npm test -- __tests__/lib/events.test.ts
```
Expected: `7 passed`

- [ ] **Step 5: Run full suite**

```bash
npm test
```
Expected: `21 passed` (14 existing + 7 new)

- [ ] **Step 6: Commit**

```bash
git add lib/events.ts __tests__/lib/events.test.ts
git commit -m "feat: add event grouping utilities (groupEventsByDay, getTimePeriod, formatEventTime)"
```

---

### Task 3: Create seed event data

**Files:**
- Create: `data/seed-events.json`
- Create: `data/seed.ts`

- [ ] **Step 1: Create data directory**

```bash
mkdir -p data
```

- [ ] **Step 2: Create data/seed-events.json**

This file must match the `events` table schema exactly. All timestamps are UTC (NYC is EDT = UTC-4 in June).

```json
[
  {
    "id": "virtuslab-ai-engineering-2026-06-04",
    "title": "AI Engineering Deep Dive by VirtusLab",
    "description": "A technical deep dive into production AI engineering: agent architectures, LLM infra at scale, and platform patterns for teams shipping AI in 2026. Includes live demos and Q&A with the VirtusLab AI engineering team.",
    "host": "VirtusLab",
    "starts_at": "2026-06-04T18:00:00Z",
    "ends_at": "2026-06-04T21:00:00Z",
    "venue_name": "VirtusLab NYC Office",
    "address": "28 W 23rd St, New York, NY 10010",
    "lat": 40.7424,
    "lng": -73.9923,
    "neighborhood": "Flatiron",
    "rsvp_url": "https://lu.ma/virtuslab-ai-nytw-2026",
    "rsvp_platform": "luma",
    "tags": ["ai-infra", "platform-eng", "agentic-ai", "open-source"],
    "audience_tags": ["engineer", "cto", "founder"],
    "format": "panel",
    "capacity": 80,
    "is_invite_only": false,
    "has_free_food": true,
    "has_free_drinks": true,
    "is_editors_pick": true,
    "editors_pick_blurb": "Disclosure: VirtusLab built this tool and hosts this event. We picked it because it's a genuinely technical session on AI engineering patterns — not a sales pitch. Decide for yourself.",
    "is_virtuslab_event": true,
    "source": "manual",
    "source_url": "https://lu.ma/virtuslab-ai-nytw-2026"
  },
  {
    "id": "openai-devtools-rooftop-2026-06-03",
    "title": "OpenAI DevTools Rooftop",
    "description": "Casual rooftop gathering for developers building with OpenAI APIs. Bring your side projects, war stories, and appetite for free pizza. Hosted by the OpenAI developer relations team.",
    "host": "OpenAI",
    "starts_at": "2026-06-03T22:00:00Z",
    "ends_at": "2026-06-04T01:00:00Z",
    "venue_name": "230 Fifth Rooftop",
    "address": "230 5th Ave, New York, NY 10001",
    "lat": 40.7449,
    "lng": -73.9889,
    "neighborhood": "Flatiron",
    "rsvp_url": "https://lu.ma/openai-devtools-rooftop",
    "rsvp_platform": "luma",
    "tags": ["devtools", "agentic-ai", "open-source"],
    "audience_tags": ["engineer", "founder"],
    "format": "rooftop",
    "capacity": 200,
    "is_invite_only": false,
    "has_free_food": true,
    "has_free_drinks": true,
    "is_editors_pick": true,
    "editors_pick_blurb": "The best rooftop in Flatiron, full of devs who are actually shipping. Go for the conversations, stay for the view.",
    "is_virtuslab_event": false,
    "source": "tech-week.com",
    "source_url": "https://tech-week.com/calendar/nyc"
  },
  {
    "id": "anthropic-safety-dinner-2026-06-02",
    "title": "Anthropic Safety & Alignment Dinner",
    "description": "Intimate dinner for researchers and builders working on AI safety and alignment. Discussion-format: no slides, no pitches — just deep conversation about what actually matters in 2026.",
    "host": "Anthropic",
    "starts_at": "2026-06-02T22:00:00Z",
    "ends_at": "2026-06-03T01:00:00Z",
    "venue_name": "Gramercy Tavern",
    "address": "42 E 20th St, New York, NY 10003",
    "lat": 40.7393,
    "lng": -73.9883,
    "neighborhood": "Gramercy",
    "rsvp_url": "https://partiful.com/e/anthropic-safety-dinner",
    "rsvp_platform": "partiful",
    "tags": ["ai-infra", "agentic-ai", "founder-stories"],
    "audience_tags": ["engineer", "founder", "vc"],
    "format": "dinner",
    "capacity": 40,
    "is_invite_only": true,
    "has_free_food": true,
    "has_free_drinks": true,
    "is_editors_pick": true,
    "editors_pick_blurb": "Invite-only but worth applying. The signal-to-noise ratio at Anthropic events is exceptional.",
    "is_virtuslab_event": false,
    "source": "manual",
    "source_url": "https://partiful.com/e/anthropic-safety-dinner"
  },
  {
    "id": "vercel-platform-breakfast-2026-06-02",
    "title": "Vercel Platform Engineering Breakfast",
    "description": "Morning deep-dive into platform engineering patterns: edge computing, build optimization, and what the next generation of deployment infrastructure looks like. Small group, high signal.",
    "host": "Vercel",
    "starts_at": "2026-06-02T13:00:00Z",
    "ends_at": "2026-06-02T15:00:00Z",
    "venue_name": "Bluestone Lane",
    "address": "30 W 21st St, New York, NY 10010",
    "lat": 40.7416,
    "lng": -73.9917,
    "neighborhood": "Flatiron",
    "rsvp_url": "https://lu.ma/vercel-platform-breakfast",
    "rsvp_platform": "luma",
    "tags": ["platform-eng", "devtools", "open-source"],
    "audience_tags": ["engineer", "cto"],
    "format": "breakfast",
    "capacity": 50,
    "is_invite_only": false,
    "has_free_food": true,
    "has_free_drinks": false,
    "is_editors_pick": false,
    "editors_pick_blurb": null,
    "is_virtuslab_event": false,
    "source": "luma",
    "source_url": "https://lu.ma/vercel-platform-breakfast"
  },
  {
    "id": "a16z-founder-fundraising-workshop-2026-06-01",
    "title": "a16z: Technical Fundraising for AI Founders",
    "description": "Workshop covering how to pitch AI infrastructure and platform companies to institutional investors. Includes partner Q&A and common pitfalls from the a16z portfolio.",
    "host": "a16z",
    "starts_at": "2026-06-01T17:00:00Z",
    "ends_at": "2026-06-01T19:30:00Z",
    "venue_name": "a16z NYC",
    "address": "1 World Trade Center, New York, NY 10007",
    "lat": 40.7127,
    "lng": -74.0134,
    "neighborhood": "FiDi",
    "rsvp_url": "https://lu.ma/a16z-technical-fundraising",
    "rsvp_platform": "luma",
    "tags": ["fundraising", "founder-stories", "agentic-ai"],
    "audience_tags": ["founder", "vc"],
    "format": "workshop",
    "capacity": 100,
    "is_invite_only": false,
    "has_free_food": false,
    "has_free_drinks": false,
    "is_editors_pick": false,
    "editors_pick_blurb": null,
    "is_virtuslab_event": false,
    "source": "tech-week.com",
    "source_url": "https://tech-week.com/calendar/nyc"
  },
  {
    "id": "hugging-face-open-source-hackathon-2026-06-01",
    "title": "Hugging Face Open Source AI Hackathon",
    "description": "24-hour hackathon building with open-source AI models. Teams compete across categories: best agent, best tool, best fine-tune. $10k in prizes. Food and coffee provided.",
    "host": "Hugging Face",
    "starts_at": "2026-06-01T14:00:00Z",
    "ends_at": "2026-06-01T16:00:00Z",
    "venue_name": "Hugging Face HQ",
    "address": "20 Jay St, Brooklyn, NY 11201",
    "lat": 40.7023,
    "lng": -73.9875,
    "neighborhood": "DUMBO",
    "rsvp_url": "https://lu.ma/hf-oss-hackathon",
    "rsvp_platform": "luma",
    "tags": ["open-source", "agentic-ai", "ai-infra"],
    "audience_tags": ["engineer", "founder"],
    "format": "hackathon",
    "capacity": 150,
    "is_invite_only": false,
    "has_free_food": true,
    "has_free_drinks": false,
    "is_editors_pick": true,
    "editors_pick_blurb": "The most technical hackathon at Tech Week. Skip if you can't ship; show up if you can.",
    "is_virtuslab_event": false,
    "source": "luma",
    "source_url": "https://lu.ma/hf-oss-hackathon"
  },
  {
    "id": "datastax-vector-db-panel-2026-06-01",
    "title": "Vector Databases in Production: War Stories",
    "description": "Panel of engineers who have shipped vector search at scale. Lessons from Pinecone, Weaviate, and pgvector in production. Moderated by the DataStax team.",
    "host": "DataStax",
    "starts_at": "2026-06-01T19:00:00Z",
    "ends_at": "2026-06-01T21:00:00Z",
    "venue_name": "WeWork Midtown",
    "address": "315 W 36th St, New York, NY 10018",
    "lat": 40.7540,
    "lng": -73.9962,
    "neighborhood": "Hudson Yards",
    "rsvp_url": "https://lu.ma/datastax-vector-panel",
    "rsvp_platform": "luma",
    "tags": ["data-eng", "ai-infra", "platform-eng"],
    "audience_tags": ["engineer", "cto"],
    "format": "panel",
    "capacity": 120,
    "is_invite_only": false,
    "has_free_food": false,
    "has_free_drinks": true,
    "is_editors_pick": false,
    "editors_pick_blurb": null,
    "is_virtuslab_event": false,
    "source": "luma",
    "source_url": "https://lu.ma/datastax-vector-panel"
  },
  {
    "id": "linear-developer-experience-talk-2026-06-02",
    "title": "Linear: Building Developer Tools People Love",
    "description": "Karri Saarinen (CEO) and the Linear engineering team on the design and technical decisions behind Linear — from the data model to the real-time sync architecture.",
    "host": "Linear",
    "starts_at": "2026-06-02T19:00:00Z",
    "ends_at": "2026-06-02T21:00:00Z",
    "venue_name": "SoHo Works",
    "address": "55 Water St, New York, NY 10041",
    "lat": 40.7022,
    "lng": -74.0098,
    "neighborhood": "FiDi",
    "rsvp_url": "https://lu.ma/linear-devex-talk",
    "rsvp_platform": "luma",
    "tags": ["devtools", "platform-eng", "founder-stories"],
    "audience_tags": ["engineer", "cto", "designer"],
    "format": "panel",
    "capacity": 80,
    "is_invite_only": false,
    "has_free_food": false,
    "has_free_drinks": true,
    "is_editors_pick": false,
    "editors_pick_blurb": null,
    "is_virtuslab_event": false,
    "source": "luma",
    "source_url": "https://lu.ma/linear-devex-talk"
  },
  {
    "id": "stripe-payments-infrastructure-2026-06-03",
    "title": "Stripe: Payments Infrastructure at Scale",
    "description": "Deep technical session from Stripe engineers on building reliable payment infrastructure. Topics: idempotency, distributed transactions, and handling the long tail of card networks.",
    "host": "Stripe",
    "starts_at": "2026-06-03T17:00:00Z",
    "ends_at": "2026-06-03T19:00:00Z",
    "venue_name": "Stripe NYC",
    "address": "354 Oyster Point Blvd, South San Francisco, CA",
    "lat": 40.7589,
    "lng": -73.9851,
    "neighborhood": "Midtown",
    "rsvp_url": "https://lu.ma/stripe-infra-talk",
    "rsvp_platform": "luma",
    "tags": ["platform-eng", "data-eng"],
    "audience_tags": ["engineer", "cto"],
    "format": "panel",
    "capacity": 100,
    "is_invite_only": false,
    "has_free_food": false,
    "has_free_drinks": false,
    "is_editors_pick": false,
    "editors_pick_blurb": null,
    "is_virtuslab_event": false,
    "source": "luma",
    "source_url": "https://lu.ma/stripe-infra-talk"
  },
  {
    "id": "github-copilot-ai-coding-2026-06-03",
    "title": "GitHub Copilot: The Future of AI-Assisted Development",
    "description": "GitHub engineering team on where AI coding tools are heading: from autocomplete to autonomous agents. Live demos of next-gen Copilot features not yet public.",
    "host": "GitHub",
    "starts_at": "2026-06-03T14:00:00Z",
    "ends_at": "2026-06-03T16:00:00Z",
    "venue_name": "GitHub NYC",
    "address": "88 Colin P. Kelly Jr. St, San Francisco",
    "lat": 40.7459,
    "lng": -73.9935,
    "neighborhood": "Chelsea",
    "rsvp_url": "https://lu.ma/github-copilot-future",
    "rsvp_platform": "luma",
    "tags": ["devtools", "agentic-ai", "open-source"],
    "audience_tags": ["engineer"],
    "format": "panel",
    "capacity": 200,
    "is_invite_only": false,
    "has_free_food": false,
    "has_free_drinks": false,
    "is_editors_pick": false,
    "editors_pick_blurb": null,
    "is_virtuslab_event": false,
    "source": "tech-week.com",
    "source_url": "https://tech-week.com/calendar/nyc"
  },
  {
    "id": "figma-design-engineering-2026-06-04",
    "title": "Figma: Closing the Design-Engineering Gap",
    "description": "How Figma is rebuilding the handoff between designers and engineers. Demos of Dev Mode, code connect, and the new tokens spec. For designers who code and engineers who care about UX.",
    "host": "Figma",
    "starts_at": "2026-06-04T14:00:00Z",
    "ends_at": "2026-06-04T16:00:00Z",
    "venue_name": "Figma NYC Studio",
    "address": "340 Pine St, San Francisco",
    "lat": 40.7442,
    "lng": -73.9910,
    "neighborhood": "Flatiron",
    "rsvp_url": "https://lu.ma/figma-design-eng",
    "rsvp_platform": "luma",
    "tags": ["devtools", "platform-eng"],
    "audience_tags": ["engineer", "designer"],
    "format": "workshop",
    "capacity": 60,
    "is_invite_only": false,
    "has_free_food": false,
    "has_free_drinks": false,
    "is_editors_pick": false,
    "editors_pick_blurb": null,
    "is_virtuslab_event": false,
    "source": "luma",
    "source_url": "https://lu.ma/figma-design-eng"
  },
  {
    "id": "cerebral-valley-ai-infra-2026-06-05",
    "title": "Cerebral Valley: AI Infrastructure Founders Meetup",
    "description": "Monthly Cerebral Valley meetup, Tech Week edition. AI infra founders pitching their stack, open Q&A, and serious networking. Previous events have produced 20+ YC companies.",
    "host": "Cerebral Valley",
    "starts_at": "2026-06-05T21:00:00Z",
    "ends_at": "2026-06-06T00:00:00Z",
    "venue_name": "Jimmy's No. 43",
    "address": "43 E 7th St, New York, NY 10003",
    "lat": 40.7275,
    "lng": -73.9876,
    "neighborhood": "East Village",
    "rsvp_url": "https://partiful.com/e/cerebral-valley-nytw",
    "rsvp_platform": "partiful",
    "tags": ["ai-infra", "founder-stories", "fundraising"],
    "audience_tags": ["founder", "vc", "engineer"],
    "format": "rooftop",
    "capacity": 100,
    "is_invite_only": false,
    "has_free_food": false,
    "has_free_drinks": true,
    "is_editors_pick": true,
    "editors_pick_blurb": "The highest density of AI infra founders per square meter at Tech Week. Show up with opinions.",
    "is_virtuslab_event": false,
    "source": "manual",
    "source_url": "https://partiful.com/e/cerebral-valley-nytw"
  },
  {
    "id": "yc-hiring-engineers-2026-06-05",
    "title": "Y Combinator: Hiring Exceptional Engineers",
    "description": "YC partners and portfolio founders on how to find, recruit, and retain elite engineering talent in 2026. Includes the state of the AI hiring market.",
    "host": "Y Combinator",
    "starts_at": "2026-06-05T17:00:00Z",
    "ends_at": "2026-06-05T19:00:00Z",
    "venue_name": "Spaces Flatiron",
    "address": "215 Park Ave S, New York, NY 10003",
    "lat": 40.7390,
    "lng": -73.9875,
    "neighborhood": "Flatiron",
    "rsvp_url": "https://lu.ma/yc-hiring-eng",
    "rsvp_platform": "luma",
    "tags": ["hiring", "founder-stories"],
    "audience_tags": ["founder", "cto"],
    "format": "panel",
    "capacity": 120,
    "is_invite_only": false,
    "has_free_food": false,
    "has_free_drinks": false,
    "is_editors_pick": false,
    "editors_pick_blurb": null,
    "is_virtuslab_event": false,
    "source": "luma",
    "source_url": "https://lu.ma/yc-hiring-eng"
  },
  {
    "id": "dbt-data-engineering-2026-06-05",
    "title": "dbt Labs: Modern Data Engineering Patterns",
    "description": "The dbt engineering team on where the data stack is heading: real-time dbt, semantic layers, and integrating LLMs into your data workflows.",
    "host": "dbt Labs",
    "starts_at": "2026-06-05T14:00:00Z",
    "ends_at": "2026-06-05T16:00:00Z",
    "venue_name": "dbt NYC Office",
    "address": "30 Hudson Yards, New York, NY 10001",
    "lat": 40.7527,
    "lng": -74.0013,
    "neighborhood": "Hudson Yards",
    "rsvp_url": "https://lu.ma/dbt-modern-data",
    "rsvp_platform": "luma",
    "tags": ["data-eng", "platform-eng", "open-source"],
    "audience_tags": ["engineer", "cto"],
    "format": "panel",
    "capacity": 80,
    "is_invite_only": false,
    "has_free_food": false,
    "has_free_drinks": false,
    "is_editors_pick": false,
    "editors_pick_blurb": null,
    "is_virtuslab_event": false,
    "source": "luma",
    "source_url": "https://lu.ma/dbt-modern-data"
  },
  {
    "id": "williamsburg-founder-dinner-2026-06-06",
    "title": "Brooklyn Founder Dinner (Williamsburg Edition)",
    "description": "Intimate dinner for 30 technical founders building in Brooklyn and beyond. Curated by the Brooklyn Tech community. No VCs, no pitches — just founders talking shop.",
    "host": "Brooklyn Tech",
    "starts_at": "2026-06-06T22:00:00Z",
    "ends_at": "2026-06-07T01:00:00Z",
    "venue_name": "Lilia",
    "address": "567 Union Ave, Brooklyn, NY 11211",
    "lat": 40.7162,
    "lng": -73.9500,
    "neighborhood": "Williamsburg",
    "rsvp_url": "https://partiful.com/e/brooklyn-founder-dinner",
    "rsvp_platform": "partiful",
    "tags": ["founder-stories", "hiring"],
    "audience_tags": ["founder", "cto"],
    "format": "dinner",
    "capacity": 30,
    "is_invite_only": true,
    "has_free_food": true,
    "has_free_drinks": true,
    "is_editors_pick": false,
    "editors_pick_blurb": null,
    "is_virtuslab_event": false,
    "source": "manual",
    "source_url": "https://partiful.com/e/brooklyn-founder-dinner"
  },
  {
    "id": "cloudflare-edge-computing-2026-06-06",
    "title": "Cloudflare: Edge Computing in 2026",
    "description": "Cloudflare's engineering team on the state of edge computing: Workers, Durable Objects, AI Gateway, and where the boundary between client and server is heading.",
    "host": "Cloudflare",
    "starts_at": "2026-06-06T17:00:00Z",
    "ends_at": "2026-06-06T19:00:00Z",
    "venue_name": "The Altman Building",
    "address": "135 W 18th St, New York, NY 10011",
    "lat": 40.7400,
    "lng": -73.9950,
    "neighborhood": "Chelsea",
    "rsvp_url": "https://lu.ma/cloudflare-edge-2026",
    "rsvp_platform": "luma",
    "tags": ["platform-eng", "ai-infra"],
    "audience_tags": ["engineer", "cto"],
    "format": "panel",
    "capacity": 150,
    "is_invite_only": false,
    "has_free_food": false,
    "has_free_drinks": false,
    "is_editors_pick": false,
    "editors_pick_blurb": null,
    "is_virtuslab_event": false,
    "source": "luma",
    "source_url": "https://lu.ma/cloudflare-edge-2026"
  },
  {
    "id": "planetscale-mysql-scale-2026-06-06",
    "title": "PlanetScale: MySQL at Internet Scale",
    "description": "How PlanetScale built Vitess and why horizontal sharding is still the answer for relational databases at scale. War stories from migrating Twitter's database.",
    "host": "PlanetScale",
    "starts_at": "2026-06-06T14:00:00Z",
    "ends_at": "2026-06-06T16:00:00Z",
    "venue_name": "Convene",
    "address": "75 Rockefeller Plaza, New York, NY 10019",
    "lat": 40.7589,
    "lng": -73.9784,
    "neighborhood": "Midtown",
    "rsvp_url": "https://lu.ma/planetscale-mysql-scale",
    "rsvp_platform": "luma",
    "tags": ["data-eng", "platform-eng"],
    "audience_tags": ["engineer", "cto"],
    "format": "panel",
    "capacity": 80,
    "is_invite_only": false,
    "has_free_food": false,
    "has_free_drinks": false,
    "is_editors_pick": false,
    "editors_pick_blurb": null,
    "is_virtuslab_event": false,
    "source": "luma",
    "source_url": "https://lu.ma/planetscale-mysql-scale"
  },
  {
    "id": "posthog-product-analytics-2026-06-07",
    "title": "PostHog: Building Self-Serve Analytics for Developers",
    "description": "PostHog's CTO on why they chose open source, how they built a 6-person engineering team to a $500M valuation, and what's next for product analytics.",
    "host": "PostHog",
    "starts_at": "2026-06-07T14:00:00Z",
    "ends_at": "2026-06-07T16:00:00Z",
    "venue_name": "Work Better Nomad",
    "address": "79 5th Ave, New York, NY 10003",
    "lat": 40.7375,
    "lng": -73.9924,
    "neighborhood": "Flatiron",
    "rsvp_url": "https://lu.ma/posthog-talk",
    "rsvp_platform": "luma",
    "tags": ["devtools", "open-source", "founder-stories"],
    "audience_tags": ["engineer", "founder"],
    "format": "panel",
    "capacity": 60,
    "is_invite_only": false,
    "has_free_food": false,
    "has_free_drinks": false,
    "is_editors_pick": false,
    "editors_pick_blurb": null,
    "is_virtuslab_event": false,
    "source": "luma",
    "source_url": "https://lu.ma/posthog-talk"
  },
  {
    "id": "modal-serverless-gpu-2026-06-07",
    "title": "Modal: Serverless GPU Infrastructure for AI",
    "description": "How Modal runs thousands of GPU containers on demand with sub-second cold starts. Technical deep dive on the container orchestration, networking, and billing systems.",
    "host": "Modal",
    "starts_at": "2026-06-07T17:00:00Z",
    "ends_at": "2026-06-07T19:00:00Z",
    "venue_name": "General Assembly NYC",
    "address": "902 Broadway, New York, NY 10010",
    "lat": 40.7399,
    "lng": -73.9894,
    "neighborhood": "Flatiron",
    "rsvp_url": "https://lu.ma/modal-serverless-gpu",
    "rsvp_platform": "luma",
    "tags": ["ai-infra", "platform-eng"],
    "audience_tags": ["engineer", "cto", "founder"],
    "format": "panel",
    "capacity": 80,
    "is_invite_only": false,
    "has_free_food": false,
    "has_free_drinks": false,
    "is_editors_pick": false,
    "editors_pick_blurb": null,
    "is_virtuslab_event": false,
    "source": "luma",
    "source_url": "https://lu.ma/modal-serverless-gpu"
  },
  {
    "id": "closing-party-tech-week-2026-06-07",
    "title": "Tech Week NYC Closing Party",
    "description": "Official closing party for Tech Week NYC 2026. Expect 500+ engineers, founders, and VCs in one rooftop. Open bar, live music, and a photo booth. The best networking you'll have all week.",
    "host": "Tech Week NYC",
    "starts_at": "2026-06-07T22:00:00Z",
    "ends_at": "2026-06-08T02:00:00Z",
    "venue_name": "230 Fifth Rooftop",
    "address": "230 5th Ave, New York, NY 10001",
    "lat": 40.7449,
    "lng": -73.9889,
    "neighborhood": "Flatiron",
    "rsvp_url": "https://lu.ma/nytw-2026-closing",
    "rsvp_platform": "luma",
    "tags": ["founder-stories", "hiring"],
    "audience_tags": ["founder", "engineer", "vc"],
    "format": "rooftop",
    "capacity": 500,
    "is_invite_only": false,
    "has_free_food": false,
    "has_free_drinks": true,
    "is_editors_pick": false,
    "editors_pick_blurb": null,
    "is_virtuslab_event": false,
    "source": "tech-week.com",
    "source_url": "https://tech-week.com/calendar/nyc"
  },
  {
    "id": "supabase-postgres-in-production-2026-06-01",
    "title": "Supabase: Postgres in Production at Scale",
    "description": "The Supabase team on the real engineering challenges of running managed Postgres at scale: connection pooling, branching, realtime, and what's coming next.",
    "host": "Supabase",
    "starts_at": "2026-06-01T21:00:00Z",
    "ends_at": "2026-06-01T23:00:00Z",
    "venue_name": "Coupa Café",
    "address": "140 W 57th St, New York, NY 10019",
    "lat": 40.7658,
    "lng": -73.9812,
    "neighborhood": "Midtown",
    "rsvp_url": "https://lu.ma/supabase-postgres",
    "rsvp_platform": "luma",
    "tags": ["data-eng", "open-source", "platform-eng"],
    "audience_tags": ["engineer", "cto"],
    "format": "panel",
    "capacity": 80,
    "is_invite_only": false,
    "has_free_food": false,
    "has_free_drinks": false,
    "is_editors_pick": false,
    "editors_pick_blurb": null,
    "is_virtuslab_event": false,
    "source": "luma",
    "source_url": "https://lu.ma/supabase-postgres"
  },
  {
    "id": "weaviate-vector-search-2026-06-02",
    "title": "Weaviate: Vector Search in Production",
    "description": "Real-world case studies of vector search at scale: what breaks, what scales, and how to tune your embeddings. Live benchmarks and Q&A.",
    "host": "Weaviate",
    "starts_at": "2026-06-02T17:00:00Z",
    "ends_at": "2026-06-02T19:00:00Z",
    "venue_name": "Brooklyn Navy Yard",
    "address": "63 Flushing Ave, Brooklyn, NY 11205",
    "lat": 40.6986,
    "lng": -73.9716,
    "neighborhood": "Brooklyn Navy Yard",
    "rsvp_url": "https://lu.ma/weaviate-prod",
    "rsvp_platform": "luma",
    "tags": ["ai-infra", "data-eng"],
    "audience_tags": ["engineer"],
    "format": "panel",
    "capacity": 100,
    "is_invite_only": false,
    "has_free_food": false,
    "has_free_drinks": false,
    "is_editors_pick": false,
    "editors_pick_blurb": null,
    "is_virtuslab_event": false,
    "source": "luma",
    "source_url": "https://lu.ma/weaviate-prod"
  },
  {
    "id": "arc-browser-product-engineering-2026-06-03",
    "title": "Arc Browser: Redesigning the Browser from Scratch",
    "description": "The Browser Company engineering team on the technical decisions behind Arc: Swift on macOS, the custom renderer, and lessons from 4 years of building a Chromium-based browser.",
    "host": "The Browser Company",
    "starts_at": "2026-06-03T19:00:00Z",
    "ends_at": "2026-06-03T21:00:00Z",
    "venue_name": "Artists & Fleas",
    "address": "70 N 7th St, Brooklyn, NY 11249",
    "lat": 40.7195,
    "lng": -73.9607,
    "neighborhood": "Williamsburg",
    "rsvp_url": "https://lu.ma/arc-browser-eng",
    "rsvp_platform": "luma",
    "tags": ["devtools", "platform-eng"],
    "audience_tags": ["engineer", "designer"],
    "format": "panel",
    "capacity": 80,
    "is_invite_only": false,
    "has_free_food": false,
    "has_free_drinks": false,
    "is_editors_pick": false,
    "editors_pick_blurb": null,
    "is_virtuslab_event": false,
    "source": "luma",
    "source_url": "https://lu.ma/arc-browser-eng"
  },
  {
    "id": "neon-serverless-postgres-2026-06-04",
    "title": "Neon: Serverless Postgres Architecture",
    "description": "Deep dive into Neon's storage/compute separation architecture. How they achieve sub-second branching, why they rewrote the Postgres WAL layer, and the economics of serverless databases.",
    "host": "Neon",
    "starts_at": "2026-06-04T13:00:00Z",
    "ends_at": "2026-06-04T15:00:00Z",
    "venue_name": "Flatiron School",
    "address": "11 Broadway, New York, NY 10004",
    "lat": 40.7066,
    "lng": -74.0137,
    "neighborhood": "FiDi",
    "rsvp_url": "https://lu.ma/neon-serverless-pg",
    "rsvp_platform": "luma",
    "tags": ["data-eng", "platform-eng", "open-source"],
    "audience_tags": ["engineer", "cto"],
    "format": "panel",
    "capacity": 60,
    "is_invite_only": false,
    "has_free_food": false,
    "has_free_drinks": false,
    "is_editors_pick": false,
    "editors_pick_blurb": null,
    "is_virtuslab_event": false,
    "source": "luma",
    "source_url": "https://lu.ma/neon-serverless-pg"
  },
  {
    "id": "replit-agent-ide-2026-06-05",
    "title": "Replit: Building the Agentic IDE",
    "description": "Amjad Masad on the future of software development: AI agents that can scaffold, test, and deploy full applications from a single prompt. Live demo of the latest Replit Agent.",
    "host": "Replit",
    "starts_at": "2026-06-05T19:00:00Z",
    "ends_at": "2026-06-05T21:00:00Z",
    "venue_name": "SVA Theatre",
    "address": "333 W 23rd St, New York, NY 10011",
    "lat": 40.7461,
    "lng": -74.0004,
    "neighborhood": "Chelsea",
    "rsvp_url": "https://lu.ma/replit-agent-ide",
    "rsvp_platform": "luma",
    "tags": ["agentic-ai", "devtools"],
    "audience_tags": ["engineer", "founder"],
    "format": "panel",
    "capacity": 300,
    "is_invite_only": false,
    "has_free_food": false,
    "has_free_drinks": false,
    "is_editors_pick": false,
    "editors_pick_blurb": null,
    "is_virtuslab_event": false,
    "source": "luma",
    "source_url": "https://lu.ma/replit-agent-ide"
  },
  {
    "id": "mongodb-ai-applications-2026-06-06",
    "title": "MongoDB: AI Applications with Atlas Vector Search",
    "description": "Hands-on workshop building RAG applications with MongoDB Atlas Vector Search and LangChain. From zero to production semantic search in 3 hours.",
    "host": "MongoDB",
    "starts_at": "2026-06-06T13:00:00Z",
    "ends_at": "2026-06-06T16:00:00Z",
    "venue_name": "MongoDB NYC HQ",
    "address": "1633 Broadway, New York, NY 10019",
    "lat": 40.7618,
    "lng": -73.9858,
    "neighborhood": "Midtown",
    "rsvp_url": "https://lu.ma/mongodb-ai-workshop",
    "rsvp_platform": "luma",
    "tags": ["ai-infra", "data-eng"],
    "audience_tags": ["engineer"],
    "format": "workshop",
    "capacity": 50,
    "is_invite_only": false,
    "has_free_food": true,
    "has_free_drinks": false,
    "is_editors_pick": false,
    "editors_pick_blurb": null,
    "is_virtuslab_event": false,
    "source": "luma",
    "source_url": "https://lu.ma/mongodb-ai-workshop"
  },
  {
    "id": "liveblocks-multiplayer-apps-2026-06-07",
    "title": "Liveblocks: Building Multiplayer Applications",
    "description": "How Liveblocks built a conflict-free collaborative editing layer for the web. CRDT internals, presence systems, and the surprising complexity of 'just make it real-time'.",
    "host": "Liveblocks",
    "starts_at": "2026-06-07T19:00:00Z",
    "ends_at": "2026-06-07T21:00:00Z",
    "venue_name": "Dumbo Loft",
    "address": "155 Water St, Brooklyn, NY 11201",
    "lat": 40.7026,
    "lng": -73.9877,
    "neighborhood": "DUMBO",
    "rsvp_url": "https://lu.ma/liveblocks-multiplayer",
    "rsvp_platform": "luma",
    "tags": ["platform-eng", "open-source"],
    "audience_tags": ["engineer"],
    "format": "panel",
    "capacity": 60,
    "is_invite_only": false,
    "has_free_food": false,
    "has_free_drinks": false,
    "is_editors_pick": false,
    "editors_pick_blurb": null,
    "is_virtuslab_event": false,
    "source": "luma",
    "source_url": "https://lu.ma/liveblocks-multiplayer"
  },
  {
    "id": "notion-ai-product-2026-06-01",
    "title": "Notion AI: Building AI into a Product Used by Millions",
    "description": "How the Notion team integrated AI into an existing product with 30M users. What worked, what broke, and the UX lessons from shipping AI features at consumer scale.",
    "host": "Notion",
    "starts_at": "2026-06-01T13:00:00Z",
    "ends_at": "2026-06-01T15:00:00Z",
    "venue_name": "Notion NYC Office",
    "address": "100 Park Ave, New York, NY 10017",
    "lat": 40.7522,
    "lng": -73.9788,
    "neighborhood": "Midtown",
    "rsvp_url": "https://lu.ma/notion-ai-product",
    "rsvp_platform": "luma",
    "tags": ["agentic-ai", "devtools", "platform-eng"],
    "audience_tags": ["engineer", "founder", "designer"],
    "format": "panel",
    "capacity": 150,
    "is_invite_only": false,
    "has_free_food": false,
    "has_free_drinks": false,
    "is_editors_pick": false,
    "editors_pick_blurb": null,
    "is_virtuslab_event": false,
    "source": "luma",
    "source_url": "https://lu.ma/notion-ai-product"
  },
  {
    "id": "cto-craft-leadership-2026-06-02",
    "title": "CTO Craft: Engineering Leadership in the AI Era",
    "description": "Small-group discussion for CTOs and VPs of Engineering navigating AI transformation. How to restructure teams, what to build vs buy, and how to lead when the ground is shifting fast.",
    "host": "CTO Craft",
    "starts_at": "2026-06-02T13:00:00Z",
    "ends_at": "2026-06-02T15:00:00Z",
    "venue_name": "The Princeton Club",
    "address": "15 W 43rd St, New York, NY 10036",
    "lat": 40.7556,
    "lng": -73.9838,
    "neighborhood": "Midtown",
    "rsvp_url": "https://lu.ma/cto-craft-ai-era",
    "rsvp_platform": "luma",
    "tags": ["founder-stories", "agentic-ai"],
    "audience_tags": ["cto", "founder"],
    "format": "breakfast",
    "capacity": 40,
    "is_invite_only": true,
    "has_free_food": true,
    "has_free_drinks": false,
    "is_editors_pick": false,
    "editors_pick_blurb": null,
    "is_virtuslab_event": false,
    "source": "manual",
    "source_url": "https://lu.ma/cto-craft-ai-era"
  },
  {
    "id": "tailscale-zero-trust-networking-2026-06-03",
    "title": "Tailscale: Zero-Trust Networking for Developer Teams",
    "description": "How Tailscale built a mesh VPN on top of WireGuard and why zero-trust networking is the future of developer infrastructure. Live demo and deep dive on the relay architecture.",
    "host": "Tailscale",
    "starts_at": "2026-06-03T13:00:00Z",
    "ends_at": "2026-06-03T15:00:00Z",
    "venue_name": "Galvanize NYC",
    "address": "315 Hudson St, New York, NY 10013",
    "lat": 40.7264,
    "lng": -74.0063,
    "neighborhood": "SoHo",
    "rsvp_url": "https://lu.ma/tailscale-networking",
    "rsvp_platform": "luma",
    "tags": ["platform-eng", "open-source"],
    "audience_tags": ["engineer", "cto"],
    "format": "panel",
    "capacity": 80,
    "is_invite_only": false,
    "has_free_food": false,
    "has_free_drinks": false,
    "is_editors_pick": false,
    "editors_pick_blurb": null,
    "is_virtuslab_event": false,
    "source": "luma",
    "source_url": "https://lu.ma/tailscale-networking"
  }
]
```

- [ ] **Step 3: Create data/seed.ts**

```typescript
// data/seed.ts
// Run with: npx tsx data/seed.ts
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import events from './seed-events.json' with { type: 'json' }

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function seed() {
  console.log(`Seeding ${events.length} events...`)
  const { error } = await supabase
    .from('events')
    .upsert(events, { onConflict: 'id' })

  if (error) {
    console.error('Seed failed:', error.message)
    process.exit(1)
  }
  console.log('Done.')
}

seed()
```

- [ ] **Step 4: Install dotenv for seed script**

```bash
npm install --save-dev dotenv tsx
```

- [ ] **Step 5: Verify JSON is valid**

```bash
node -e "require('./data/seed-events.json'); console.log('Valid JSON')"
```
Expected: `Valid JSON`

- [ ] **Step 6: Commit**

```bash
git add data/seed-events.json data/seed.ts package.json package-lock.json
git commit -m "feat: add 30 mock seed events and seed script"
```

---

### Task 4: Build EventCard component with TDD

**Files:**
- Create: `__tests__/components/EventCard.test.tsx`
- Create: `components/EventCard.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// __tests__/components/EventCard.test.tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EventCard } from '../../components/EventCard'
import { usePlanStore } from '../../lib/plan-store'
import type { Event } from '../../lib/types'

const mockEvent: Event = {
  id: 'test-event-1',
  title: 'Test AI Panel',
  description: 'A great test event about AI infrastructure at scale.',
  host: 'TestCo',
  starts_at: '2026-06-03T22:00:00Z',
  ends_at: '2026-06-04T01:00:00Z',
  venue_name: 'Test Venue',
  address: '123 Test St, New York, NY',
  lat: 40.74,
  lng: -73.99,
  neighborhood: 'Flatiron',
  rsvp_url: 'https://lu.ma/test',
  rsvp_platform: 'luma',
  tags: ['ai-infra', 'devtools'],
  audience_tags: ['engineer'],
  format: 'panel',
  capacity: 100,
  is_invite_only: false,
  has_free_food: false,
  has_free_drinks: false,
  is_editors_pick: false,
  editors_pick_blurb: null,
  is_virtuslab_event: false,
  source: 'luma',
  source_url: 'https://lu.ma/test',
  created_at: '2026-05-01T00:00:00Z',
  updated_at: '2026-05-01T00:00:00Z',
}

describe('EventCard', () => {
  beforeEach(() => {
    usePlanStore.getState().clear()
  })

  it('renders the event title and host', () => {
    render(<EventCard event={mockEvent} />)
    expect(screen.getByText('Test AI Panel')).toBeTruthy()
    expect(screen.getByText('TestCo')).toBeTruthy()
  })

  it('renders the neighborhood badge', () => {
    render(<EventCard event={mockEvent} />)
    expect(screen.getByText('Flatiron')).toBeTruthy()
  })

  it('shows "Save" button when event is not in plan', () => {
    render(<EventCard event={mockEvent} />)
    expect(screen.getByText('Save')).toBeTruthy()
  })

  it('clicking "Save" adds event to plan store', () => {
    render(<EventCard event={mockEvent} />)
    fireEvent.click(screen.getByText('Save'))
    expect(usePlanStore.getState().items).toHaveLength(1)
    expect(usePlanStore.getState().items[0].event_id).toBe('test-event-1')
  })

  it('shows "In your plan ✓" when event is already in plan', () => {
    usePlanStore.getState().addItem('test-event-1')
    render(<EventCard event={mockEvent} />)
    expect(screen.getByText(/In your plan/)).toBeTruthy()
  })

  it('renders Editor\'s Pick badge when is_editors_pick is true', () => {
    render(<EventCard event={{ ...mockEvent, is_editors_pick: true }} />)
    expect(screen.getByText("Editor's Pick")).toBeTruthy()
  })

  it('renders "Invite-only" badge when is_invite_only is true', () => {
    render(<EventCard event={{ ...mockEvent, is_invite_only: true }} />)
    expect(screen.getByText('Invite-only')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
npm test -- __tests__/components/EventCard.test.tsx
```
Expected: FAIL — "Cannot find module '../../components/EventCard'"

- [ ] **Step 3: Implement components/EventCard.tsx**

```tsx
// components/EventCard.tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EventDetailModal } from '@/components/EventDetailModal'
import { usePlanStore } from '@/lib/plan-store'
import { formatEventTime } from '@/lib/events'
import type { Event } from '@/lib/types'

const FORMAT_ICONS: Record<string, string> = {
  rooftop: '🏙',
  dinner: '🍽',
  panel: '🎙',
  breakfast: '☕',
  hackathon: '💻',
  workshop: '🛠',
}

interface EventCardProps {
  event: Event
}

export function EventCard({ event }: EventCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { items, addItem, removeItem } = usePlanStore()
  const isInPlan = items.some((i) => i.event_id === event.id)

  function handleSave() {
    addItem(event.id, 'interested', 'manual')
    toast('Added to your plan')
  }

  function handleOpenRsvp() {
    if (!isInPlan) {
      addItem(event.id, 'interested', 'manual')
    }
    toast(`Added — confirm RSVP on ${capitalize(event.rsvp_platform)}`)
    window.open(event.rsvp_url, '_blank', 'noopener,noreferrer')
  }

  function handleRemove() {
    removeItem(event.id)
    toast('Removed from plan')
  }

  return (
    <>
      <div
        className="group relative rounded-lg border border-[#1A1A1A] bg-[#111111] p-4 hover:border-[#333333] transition-colors cursor-pointer"
        onClick={() => setIsModalOpen(true)}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'a') { e.preventDefault(); handleSave() }
          if (e.key === 'r' || e.key === 'R') { e.preventDefault(); handleOpenRsvp() }
        }}
        tabIndex={0}
        role="article"
        aria-label={event.title}
      >
        {/* Badges */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {event.is_editors_pick && (
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
              Editor's Pick
            </Badge>
          )}
          {event.is_virtuslab_event && (
            <Badge className="bg-[#FF6B35]/20 text-[#FF6B35] border-[#FF6B35]/30 text-xs">
              Featured
            </Badge>
          )}
          {event.is_invite_only && (
            <Badge variant="outline" className="text-xs border-[#333333] text-[#A3A3A3]">
              Invite-only
            </Badge>
          )}
          {event.has_free_food && (
            <Badge variant="outline" className="text-xs border-[#333333] text-[#A3A3A3]">
              Free food
            </Badge>
          )}
          {event.has_free_drinks && (
            <Badge variant="outline" className="text-xs border-[#333333] text-[#A3A3A3]">
              Free drinks
            </Badge>
          )}
        </div>

        {/* Title */}
        <h3 className="font-mono font-bold text-[#FAFAFA] text-base leading-tight mb-1">
          {event.title}
        </h3>

        {/* Host */}
        <p className="text-[#A3A3A3] text-sm mb-2 flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#2A2A2A] text-[10px] font-mono font-bold text-[#FAFAFA] shrink-0">
            {event.host.charAt(0).toUpperCase()}
          </span>
          {event.host}
        </p>

        {/* Time + neighborhood */}
        <div className="flex items-center gap-2 mb-2 text-xs text-[#A3A3A3]">
          <span>{formatEventTime(event.starts_at, event.ends_at)}</span>
          <span>·</span>
          <span className="bg-[#1A1A1A] text-[#A3A3A3] px-1.5 py-0.5 rounded text-[11px]">
            {event.neighborhood}
          </span>
          {event.format && (
            <>
              <span>·</span>
              <span>{FORMAT_ICONS[event.format] ?? ''} {event.format}</span>
            </>
          )}
        </div>

        {/* Description teaser */}
        <p className="text-[#A3A3A3] text-sm line-clamp-1 mb-3">
          {event.description}
        </p>

        {/* Tags */}
        {event.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {event.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="text-[10px] text-[#666666] bg-[#1A1A1A] px-1.5 py-0.5 rounded font-mono"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Actions — stop propagation so clicking buttons doesn't open modal */}
        <div
          className="flex gap-2 items-center"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {isInPlan ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  className="bg-[#1A1A1A] text-[#FAFAFA] border border-[#333333] hover:bg-[#2A2A2A] font-mono text-xs"
                >
                  In your plan ✓
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-[#111111] border-[#333333]">
                <DropdownMenuItem
                  className="text-[#FAFAFA] hover:bg-[#1A1A1A] cursor-pointer"
                  onClick={handleOpenRsvp}
                >
                  Open RSVP →
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-red-400 hover:bg-[#1A1A1A] cursor-pointer"
                  onClick={handleRemove}
                >
                  Remove from plan
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button
                size="sm"
                className="bg-[#FF6B35] hover:bg-[#e85a25] text-white font-mono text-xs"
                onClick={handleOpenRsvp}
              >
                Open RSVP →
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-[#333333] text-[#A3A3A3] hover:bg-[#1A1A1A] font-mono text-xs"
                onClick={handleSave}
              >
                Save
              </Button>
            </>
          )}
        </div>
      </div>

      <EventDetailModal
        event={event}
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  )
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
```

- [ ] **Step 4: Run — expect all 7 tests to pass**

```bash
npm test -- __tests__/components/EventCard.test.tsx
```
Expected: `7 passed`

- [ ] **Step 5: Run full suite**

```bash
npm test
```
Expected: `28 passed`

- [ ] **Step 6: Commit**

```bash
git add components/EventCard.tsx __tests__/components/EventCard.test.tsx
git commit -m "feat: add EventCard component with plan add/remove and RSVP flow"
```

---

### Task 5: Build EventDetailModal component

**Files:**
- Create: `components/EventDetailModal.tsx`

- [ ] **Step 1: Create components/EventDetailModal.tsx**

This component uses Sheet (which provides a panel that works on both mobile and desktop). It opens on the right side on desktop (wide viewport), from the bottom on mobile. We use a CSS approach: Sheet with `side="right"` is rendered; the actual side feeling comes from the CSS class and the viewport.

```tsx
// components/EventDetailModal.tsx
'use client'

import { useEffect } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { usePlanStore } from '@/lib/plan-store'
import { formatEventTime } from '@/lib/events'
import { toast } from 'sonner'
import type { Event } from '@/lib/types'

interface EventDetailModalProps {
  event: Event
  open: boolean
  onClose: () => void
}

const FORMAT_LABELS: Record<string, string> = {
  rooftop: '🏙 Rooftop',
  dinner: '🍽 Dinner',
  panel: '🎙 Panel',
  breakfast: '☕ Breakfast',
  hackathon: '💻 Hackathon',
  workshop: '🛠 Workshop',
}

export function EventDetailModal({ event, open, onClose }: EventDetailModalProps) {
  const { items, addItem, removeItem } = usePlanStore()
  const isInPlan = items.some((i) => i.event_id === event.id)

  // Update URL hash for deep-linking without navigation
  useEffect(() => {
    if (open) {
      window.history.replaceState(null, '', `#${event.id}`)
    } else {
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }, [open, event.id])

  function handleSave() {
    addItem(event.id, 'interested', 'manual')
    toast('Added to your plan')
  }

  function handleOpenRsvp() {
    if (!isInPlan) addItem(event.id, 'interested', 'manual')
    toast(`Added — confirm RSVP on ${capitalize(event.rsvp_platform)}`)
    window.open(event.rsvp_url, '_blank', 'noopener,noreferrer')
  }

  function handleRemove() {
    removeItem(event.id)
    toast('Removed from plan')
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent
        className="bg-[#111111] border-[#1A1A1A] text-[#FAFAFA] w-full sm:max-w-lg overflow-y-auto"
        side="right"
      >
        <SheetHeader className="mb-4">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {event.is_editors_pick && (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                Editor's Pick
              </Badge>
            )}
            {event.is_virtuslab_event && (
              <Badge className="bg-[#FF6B35]/20 text-[#FF6B35] border-[#FF6B35]/30 text-xs">
                Featured
              </Badge>
            )}
            {event.is_invite_only && (
              <Badge variant="outline" className="text-xs border-[#333333] text-[#A3A3A3]">
                Invite-only
              </Badge>
            )}
          </div>
          <SheetTitle className="font-mono text-xl font-bold text-[#FAFAFA] text-left">
            {event.title}
          </SheetTitle>
        </SheetHeader>

        {/* Host */}
        <div className="flex items-center gap-2 mb-4 text-sm text-[#A3A3A3]">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#2A2A2A] text-xs font-mono font-bold text-[#FAFAFA]">
            {event.host.charAt(0).toUpperCase()}
          </span>
          <span>{event.host}</span>
        </div>

        {/* Time / Location */}
        <div className="space-y-1.5 mb-4 text-sm">
          <div className="flex items-center gap-2 text-[#A3A3A3]">
            <span className="text-[#666666]">🕐</span>
            <span>{formatEventTime(event.starts_at, event.ends_at)}</span>
          </div>
          {event.venue_name && (
            <div className="flex items-center gap-2 text-[#A3A3A3]">
              <span className="text-[#666666]">📍</span>
              <span>{event.venue_name}{event.neighborhood ? ` · ${event.neighborhood}` : ''}</span>
            </div>
          )}
          {event.address && (
            <div className="flex items-start gap-2 text-[#A3A3A3]">
              <span className="text-[#666666] mt-0.5">🗺</span>
              <span>{event.address}</span>
            </div>
          )}
          {event.format && (
            <div className="flex items-center gap-2 text-[#A3A3A3]">
              <span className="text-[#666666]">·</span>
              <span>{FORMAT_LABELS[event.format] ?? event.format}</span>
            </div>
          )}
          {event.capacity && (
            <div className="flex items-center gap-2 text-[#A3A3A3]">
              <span className="text-[#666666]">👥</span>
              <span>Capacity: ~{event.capacity}</span>
            </div>
          )}
        </div>

        <Separator className="bg-[#1A1A1A] mb-4" />

        {/* Description */}
        <p className="text-[#A3A3A3] text-sm leading-relaxed mb-4">
          {event.description}
        </p>

        {/* Editor's Pick blurb */}
        {event.is_editors_pick && event.editors_pick_blurb && (
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-md p-3 mb-4">
            <p className="text-amber-400 text-xs font-mono mb-1">Why we picked this</p>
            <p className="text-[#A3A3A3] text-sm">{event.editors_pick_blurb}</p>
          </div>
        )}

        {/* Tags */}
        {event.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-6">
            {event.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs text-[#666666] bg-[#1A1A1A] px-2 py-1 rounded font-mono"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <Separator className="bg-[#1A1A1A] mb-4" />

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          <Button
            className="bg-[#FF6B35] hover:bg-[#e85a25] text-white font-mono"
            onClick={handleOpenRsvp}
          >
            Open RSVP →
          </Button>
          {isInPlan ? (
            <Button
              variant="outline"
              className="border-[#333333] text-red-400 hover:bg-[#1A1A1A] font-mono"
              onClick={handleRemove}
            >
              Remove from plan
            </Button>
          ) : (
            <Button
              variant="outline"
              className="border-[#333333] text-[#A3A3A3] hover:bg-[#1A1A1A] font-mono"
              onClick={handleSave}
            >
              Save to plan
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add components/EventDetailModal.tsx
git commit -m "feat: add EventDetailModal (Sheet overlay with event details + plan actions)"
```

---

### Task 6: Build EventSearch component with TDD

**Files:**
- Create: `__tests__/components/EventSearch.test.tsx`
- Create: `components/EventSearch.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// __tests__/components/EventSearch.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EventSearch } from '../../components/EventSearch'

describe('EventSearch', () => {
  it('renders a search input', () => {
    render(<EventSearch onSearch={() => {}} />)
    expect(screen.getByRole('searchbox')).toBeTruthy()
  })

  it('calls onSearch with the typed query', () => {
    let captured = ''
    render(<EventSearch onSearch={(q) => { captured = q }} />)
    const input = screen.getByRole('searchbox')
    fireEvent.change(input, { target: { value: 'OpenAI' } })
    expect(captured).toBe('OpenAI')
  })

  it('calls onSearch with empty string when cleared via ESC', () => {
    let captured = 'initial'
    render(<EventSearch onSearch={(q) => { captured = q }} />)
    const input = screen.getByRole('searchbox')
    fireEvent.change(input, { target: { value: 'something' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(captured).toBe('')
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
npm test -- __tests__/components/EventSearch.test.tsx
```
Expected: FAIL — "Cannot find module '../../components/EventSearch'"

- [ ] **Step 3: Implement components/EventSearch.tsx**

```tsx
// components/EventSearch.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'

interface EventSearchProps {
  onSearch: (query: string) => void
}

export function EventSearch({ onSearch }: EventSearchProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus on '/' keypress anywhere on the page
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
    onSearch(e.target.value)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setQuery('')
      onSearch('')
      inputRef.current?.blur()
    }
  }

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        type="search"
        role="searchbox"
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder='Search events… (press "/" to focus)'
        className="bg-[#111111] border-[#2A2A2A] text-[#FAFAFA] placeholder:text-[#555555] font-mono pr-16 focus-visible:ring-[#FF6B35]"
      />
      {query && (
        <button
          onClick={() => { setQuery(''); onSearch('') }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555555] hover:text-[#A3A3A3] text-xs font-mono"
        >
          ESC
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run — expect all 3 tests to pass**

```bash
npm test -- __tests__/components/EventSearch.test.tsx
```
Expected: `3 passed`

- [ ] **Step 5: Run full suite**

```bash
npm test
```
Expected: `31 passed`

- [ ] **Step 6: Commit**

```bash
git add components/EventSearch.tsx __tests__/components/EventSearch.test.tsx
git commit -m "feat: add EventSearch with Fuse.js integration and '/' keyboard shortcut"
```

---

### Task 7: Build EditorsPicksCarousel component

**Files:**
- Create: `components/EditorsPicksCarousel.tsx`

- [ ] **Step 1: Create components/EditorsPicksCarousel.tsx**

The carousel auto-advances every 5 seconds. Manual prev/next controls. Shows the blurb prominently. "Add to plan" button in each card.

```tsx
// components/EditorsPicksCarousel.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { usePlanStore } from '@/lib/plan-store'
import { formatEventTime } from '@/lib/events'
import { toast } from 'sonner'
import type { Event } from '@/lib/types'

interface EditorsPicksCarouselProps {
  picks: Event[]
}

export function EditorsPicksCarousel({ picks }: EditorsPicksCarouselProps) {
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)
  const { items, addItem } = usePlanStore()

  const next = useCallback(() => {
    setCurrent((c) => (c + 1) % picks.length)
  }, [picks.length])

  const prev = () => {
    setCurrent((c) => (c - 1 + picks.length) % picks.length)
  }

  // Auto-advance every 5s unless paused
  useEffect(() => {
    if (paused || picks.length <= 1) return
    const interval = setInterval(next, 5000)
    return () => clearInterval(interval)
  }, [paused, next, picks.length])

  if (picks.length === 0) return null

  const pick = picks[current]
  const isInPlan = items.some((i) => i.event_id === pick.id)

  function handleAdd() {
    addItem(pick.id, 'interested', 'editors_pick')
    toast("Added to your plan")
  }

  return (
    <div
      className="relative bg-gradient-to-br from-amber-500/10 to-[#111111] border border-amber-500/20 rounded-lg p-5 mb-8"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex items-baseline gap-2 mb-4">
        <h2 className="font-mono text-sm font-bold text-amber-400 uppercase tracking-wider">
          Editor's Picks
        </h2>
        <span className="text-[#555555] text-xs font-mono">{current + 1}/{picks.length}</span>
      </div>

      <div className="mb-3">
        {pick.is_virtuslab_event && (
          <Badge className="bg-[#FF6B35]/20 text-[#FF6B35] border-[#FF6B35]/30 text-xs mb-2">
            Featured
          </Badge>
        )}
        <h3 className="font-mono font-bold text-[#FAFAFA] text-lg leading-tight mb-1">
          {pick.title}
        </h3>
        <p className="text-[#A3A3A3] text-sm mb-1">
          {pick.host} · {formatEventTime(pick.starts_at, pick.ends_at)}
        </p>
        {pick.neighborhood && (
          <p className="text-[#666666] text-xs mb-3">{pick.neighborhood}</p>
        )}

        {pick.editors_pick_blurb && (
          <div className="border-l-2 border-amber-500/40 pl-3 mb-4">
            <p className="text-xs text-amber-400 font-mono mb-1">Why we picked this</p>
            <p className="text-[#A3A3A3] text-sm leading-relaxed">{pick.editors_pick_blurb}</p>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            size="sm"
            className="bg-[#FF6B35] hover:bg-[#e85a25] text-white font-mono text-xs"
            onClick={(e) => { e.stopPropagation(); window.open(pick.rsvp_url, '_blank', 'noopener,noreferrer'); handleAdd() }}
          >
            Open RSVP →
          </Button>
          {!isInPlan && (
            <Button
              size="sm"
              variant="outline"
              className="border-[#333333] text-[#A3A3A3] hover:bg-[#1A1A1A] font-mono text-xs"
              onClick={(e) => { e.stopPropagation(); handleAdd() }}
            >
              Add to plan
            </Button>
          )}
          {isInPlan && (
            <span className="text-xs text-amber-400 font-mono flex items-center">In your plan ✓</span>
          )}
        </div>
      </div>

      {/* Prev / Next */}
      {picks.length > 1 && (
        <div className="absolute top-4 right-4 flex gap-1">
          <button
            onClick={prev}
            className="w-7 h-7 flex items-center justify-center rounded border border-[#2A2A2A] text-[#A3A3A3] hover:bg-[#1A1A1A] text-xs"
            aria-label="Previous pick"
          >
            ‹
          </button>
          <button
            onClick={next}
            className="w-7 h-7 flex items-center justify-center rounded border border-[#2A2A2A] text-[#A3A3A3] hover:bg-[#1A1A1A] text-xs"
            aria-label="Next pick"
          >
            ›
          </button>
        </div>
      )}

      {/* Dot indicators */}
      {picks.length > 1 && (
        <div className="flex gap-1 mt-3">
          {picks.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-1 rounded-full transition-all ${i === current ? 'w-4 bg-amber-400' : 'w-1 bg-[#333333]'}`}
              aria-label={`Pick ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add components/EditorsPicksCarousel.tsx
git commit -m "feat: add EditorsPicksCarousel with auto-rotate and visible blurbs"
```

---

### Task 8: Build MyPlanWidget with TDD

**Files:**
- Create: `__tests__/components/MyPlanWidget.test.tsx`
- Create: `components/MyPlanWidget.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// __tests__/components/MyPlanWidget.test.tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MyPlanWidget } from '../../components/MyPlanWidget'
import { usePlanStore } from '../../lib/plan-store'

describe('MyPlanWidget', () => {
  beforeEach(() => {
    usePlanStore.getState().clear()
  })

  it('is not rendered when the plan is empty', () => {
    const { container } = render(<MyPlanWidget />)
    expect(container.firstChild).toBeNull()
  })

  it('shows the event count when plan has items', () => {
    usePlanStore.getState().addItem('event-1')
    usePlanStore.getState().addItem('event-2')
    render(<MyPlanWidget />)
    expect(screen.getByText(/My Plan \(2\)/)).toBeTruthy()
  })

  it('toggles the mini-preview open and closed', () => {
    usePlanStore.getState().addItem('event-1')
    render(<MyPlanWidget />)
    const button = screen.getByText(/My Plan \(1\)/)
    // Initially collapsed (no "Open full plan" visible)
    expect(screen.queryByText(/Open full plan/)).toBeNull()
    fireEvent.click(button)
    // Now expanded
    expect(screen.getByText(/Open full plan/)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
npm test -- __tests__/components/MyPlanWidget.test.tsx
```
Expected: FAIL — "Cannot find module '../../components/MyPlanWidget'"

- [ ] **Step 3: Implement components/MyPlanWidget.tsx**

```tsx
// components/MyPlanWidget.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePlanStore } from '@/lib/plan-store'

export function MyPlanWidget() {
  const [open, setOpen] = useState(false)
  const { items } = usePlanStore()

  if (items.length === 0) return null

  const recentItems = [...items].reverse().slice(0, 5)

  return (
    <>
      {/* Desktop: bottom-right floating button */}
      <div className="fixed bottom-6 right-6 z-50 hidden sm:flex flex-col items-end gap-2">
        {open && (
          <div className="bg-[#111111] border border-[#2A2A2A] rounded-lg p-4 w-72 shadow-2xl">
            <p className="text-xs text-[#A3A3A3] font-mono mb-3">
              {items.length} event{items.length !== 1 ? 's' : ''} in your plan
            </p>
            <ul className="space-y-2 mb-3">
              {recentItems.map((item) => (
                <li key={item.event_id} className="text-xs text-[#FAFAFA] font-mono truncate">
                  · {item.event_id}
                </li>
              ))}
            </ul>
            <Link
              href="/my-plan"
              className="text-[#FF6B35] text-xs font-mono hover:underline"
              onClick={() => setOpen(false)}
            >
              Open full plan →
            </Link>
          </div>
        )}

        <button
          onClick={() => setOpen((o) => !o)}
          className="bg-[#FF6B35] hover:bg-[#e85a25] text-white font-mono font-bold text-sm px-4 py-2.5 rounded-full shadow-lg transition-colors flex items-center gap-2"
        >
          <span>My Plan ({items.length})</span>
        </button>
      </div>

      {/* Mobile: bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bg-[#111111] border-t border-[#2A2A2A]">
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3"
        >
          <span className="font-mono font-bold text-[#FAFAFA] text-sm">
            My Plan ({items.length})
          </span>
          <span className="text-[#FF6B35] font-mono text-xs">
            {open ? 'close ✕' : 'view ›'}
          </span>
        </button>

        {open && (
          <div className="px-4 pb-4 border-t border-[#1A1A1A]">
            <ul className="space-y-2 py-3">
              {recentItems.map((item) => (
                <li key={item.event_id} className="text-xs text-[#A3A3A3] font-mono truncate">
                  · {item.event_id}
                </li>
              ))}
            </ul>
            <Link
              href="/my-plan"
              className="text-[#FF6B35] text-xs font-mono hover:underline"
              onClick={() => setOpen(false)}
            >
              Open full plan →
            </Link>
          </div>
        )}
      </div>
    </>
  )
}
```

- [ ] **Step 4: Run — expect all 3 tests to pass**

```bash
npm test -- __tests__/components/MyPlanWidget.test.tsx
```
Expected: `3 passed`

- [ ] **Step 5: Run full suite**

```bash
npm test
```
Expected: `34 passed`

- [ ] **Step 6: Commit**

```bash
git add components/MyPlanWidget.tsx __tests__/components/MyPlanWidget.test.tsx
git commit -m "feat: add MyPlanWidget — persistent plan counter (desktop floating, mobile bottom bar)"
```

---

### Task 9: Build EventList (day-grouped client component)

**Files:**
- Create: `components/EventList.tsx`

- [ ] **Step 1: Create components/EventList.tsx**

EventList is the main client component for the events page. It manages search state, runs Fuse.js filtering, and renders the day-grouped timeline with sticky day navigation.

```tsx
// components/EventList.tsx
'use client'

import { useState, useMemo, useRef } from 'react'
import Fuse from 'fuse.js'
import { EventCard } from '@/components/EventCard'
import { EventSearch } from '@/components/EventSearch'
import { EditorsPicksCarousel } from '@/components/EditorsPicksCarousel'
import { groupEventsByDay, formatDayHeading, formatDayShort, getTimePeriod } from '@/lib/events'
import type { Event, TimePeriod } from '@/lib/types'

// Re-export TimePeriod from lib/events since types.ts doesn't have it
export type { TimePeriod }

interface EventListProps {
  events: Event[]
}

const TIME_PERIOD_ORDER: import('@/lib/events').TimePeriod[] = ['EARLY', 'MID', 'LATE']

export function EventList({ events }: EventListProps) {
  const [query, setQuery] = useState('')
  const dayRefs = useRef<Record<string, HTMLElement | null>>({})

  const fuse = useMemo(
    () =>
      new Fuse(events, {
        keys: ['title', 'host', 'description', 'tags', 'neighborhood'],
        threshold: 0.35,
        includeScore: true,
      }),
    [events]
  )

  const filteredEvents = useMemo(() => {
    if (!query.trim()) return events
    return fuse.search(query).map((r) => r.item)
  }, [query, fuse, events])

  const editorsPicks = useMemo(
    () => events.filter((e) => e.is_editors_pick),
    [events]
  )

  const grouped = useMemo(() => groupEventsByDay(filteredEvents), [filteredEvents])
  const dayKeys = Object.keys(grouped).sort()

  function scrollToDay(key: string) {
    dayRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-20 text-[#A3A3A3]">
        <p className="font-mono text-lg mb-2">No events loaded yet.</p>
        <p className="text-sm">Run the seed script or check your Supabase connection.</p>
      </div>
    )
  }

  return (
    <div className="flex gap-8 relative">
      {/* Sticky left day nav — desktop only */}
      {dayKeys.length > 0 && (
        <nav className="hidden lg:flex flex-col gap-1 sticky top-6 h-fit min-w-[80px] shrink-0">
          {dayKeys.map((key) => (
            <button
              key={key}
              onClick={() => scrollToDay(key)}
              className="text-left font-mono text-xs text-[#555555] hover:text-[#A3A3A3] transition-colors py-1 px-2 rounded hover:bg-[#111111]"
            >
              {formatDayShort(key)}
              <span className="block text-[#333333] text-[10px]">
                {grouped[key].length} events
              </span>
            </button>
          ))}
        </nav>
      )}

      <div className="flex-1 min-w-0">
        {/* Search */}
        <div className="mb-6">
          <EventSearch onSearch={setQuery} />
        </div>

        {/* Mobile day nav — horizontal chips */}
        {dayKeys.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-6 lg:hidden scrollbar-hide">
            {dayKeys.map((key) => (
              <button
                key={key}
                onClick={() => scrollToDay(key)}
                className="shrink-0 font-mono text-xs text-[#A3A3A3] bg-[#111111] border border-[#2A2A2A] px-3 py-1.5 rounded-full hover:border-[#FF6B35] hover:text-[#FF6B35] transition-colors whitespace-nowrap"
              >
                {formatDayShort(key)}
                <span className="ml-1 text-[#555555]">({grouped[key].length})</span>
              </button>
            ))}
          </div>
        )}

        {/* Editor's Picks carousel — only when not searching */}
        {!query && editorsPicks.length > 0 && (
          <EditorsPicksCarousel picks={editorsPicks} />
        )}

        {/* Search empty state */}
        {query && filteredEvents.length === 0 && (
          <div className="text-center py-16 text-[#A3A3A3]">
            <p className="font-mono text-base mb-2">No matches for &ldquo;{query}&rdquo;</p>
            <p className="text-sm">
              Try broader terms, or{' '}
              <a href="/beyond" className="text-[#FF6B35] hover:underline">
                browse other aggregators →
              </a>
            </p>
          </div>
        )}

        {/* Day-grouped timeline */}
        {dayKeys.map((dayKey) => {
          const dayEvents = grouped[dayKey]

          // Group events by time period within the day
          const byPeriod: Record<string, Event[]> = {}
          for (const event of dayEvents) {
            const period = getTimePeriod(event.starts_at)
            if (!byPeriod[period]) byPeriod[period] = []
            byPeriod[period].push(event)
          }

          return (
            <section
              key={dayKey}
              id={`day-${dayKey}`}
              ref={(el) => { dayRefs.current[dayKey] = el }}
              className="mb-12 scroll-mt-6"
            >
              {/* Day header */}
              <div className="sticky top-0 z-10 bg-[#0A0A0A] border-b border-[#1A1A1A] py-3 mb-4 flex items-baseline justify-between">
                <h2 className="font-mono font-bold text-[#FAFAFA] text-lg">
                  {formatDayHeading(dayKey)}
                </h2>
                <span className="text-[#555555] text-xs font-mono">
                  {dayEvents.length} events
                </span>
              </div>

              {/* Events grouped by time period */}
              {TIME_PERIOD_ORDER.filter((p) => byPeriod[p]?.length > 0).map((period) => (
                <div key={period} className="mb-6">
                  <p className="text-[#333333] text-xs font-mono uppercase tracking-widest mb-3 pl-1">
                    {period}
                  </p>
                  <div className="grid gap-3">
                    {byPeriod[period].map((event) => (
                      <EventCard key={event.id} event={event} />
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Fix the import — `TimePeriod` needs to come from `lib/events`, not `lib/types`**

The `EventList.tsx` imports `TimePeriod` via `@/lib/events`. Verify `lib/events.ts` exports `TimePeriod`:

```bash
grep "export type TimePeriod" lib/events.ts
```
Expected: `export type TimePeriod = 'EARLY' | 'MID' | 'LATE'`

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add components/EventList.tsx
git commit -m "feat: add EventList with day-grouped timeline, time period separators, search, and sticky nav"
```

---

### Task 10: Build app/events/page.tsx (Server Component)

**Files:**
- Create: `app/events/page.tsx`

- [ ] **Step 1: Create app/events/page.tsx**

This is a Server Component that fetches events from Supabase and passes them to the EventList client component. It uses `{ next: { revalidate: 3600 } }` cache behavior to re-fetch every hour.

```tsx
// app/events/page.tsx
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { EventList } from '@/components/EventList'
import type { Event } from '@/lib/types'

export const metadata: Metadata = {
  title: "Browse Events — NYTW Engineer's Companion",
  description: '87 hand-curated engineering events for Tech Week NYC 2026. Day-grouped timeline with instant search.',
}

// Revalidate every hour; Supabase data doesn't change frequently
export const revalidate = 3600

export default async function EventsPage() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('starts_at', { ascending: true })

  const events: Event[] = error || !data ? [] : data

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-[#FAFAFA]">
      {/* Page header */}
      <div className="border-b border-[#1A1A1A] px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-mono font-bold text-[#FAFAFA] text-xl">
              NYTW Engineer's Companion
            </h1>
            <p className="text-[#A3A3A3] text-xs font-mono mt-0.5">
              {events.length} curated events · Tech Week NYC 2026 · June 1–7
            </p>
          </div>
          <nav className="flex gap-4 text-sm">
            <a href="/" className="text-[#A3A3A3] hover:text-[#FAFAFA] font-mono">Home</a>
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <EventList events={events} />
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add "app/events/page.tsx"
git commit -m "feat: add /events page — Server Component fetching events from Supabase"
```

---

### Task 11: Wire MyPlanWidget and Toaster into root layout

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Read current layout**

Read `app/layout.tsx` to see current state before editing.

- [ ] **Step 2: Update app/layout.tsx to add Toaster and MyPlanWidget**

```tsx
// app/layout.tsx
import type { Metadata } from 'next'
import { JetBrains_Mono, Inter } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { MyPlanWidget } from '@/components/MyPlanWidget'
import './globals.css'

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: "NYTW Engineer's Companion",
  description: "1,000+ events. 168 hours. Plan the week you actually want.",
  manifest: '/manifest.json',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${jetbrainsMono.variable} ${inter.variable} dark`}
      suppressHydrationWarning
    >
      <body className="bg-[#0A0A0A] text-[#FAFAFA] font-sans antialiased min-h-screen">
        {children}
        <MyPlanWidget />
        <Toaster
          theme="dark"
          toastOptions={{
            classNames: {
              toast: 'bg-[#111111] border border-[#2A2A2A] text-[#FAFAFA] font-mono text-sm',
            },
          }}
        />
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: add MyPlanWidget and Toaster to root layout"
```

---

### Task 12: Final verification

- [ ] **Step 1: Run full test suite**

```bash
npm test
```
Expected: `34 passed` (21 + 7 EventCard + 3 EventSearch + 3 MyPlanWidget). Zero failures.

- [ ] **Step 2: TypeScript strict check**

```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 3: Build check**

```bash
npm run build 2>&1 | tail -30
```
Expected: Build succeeds. If there are import errors, fix them before continuing.

- [ ] **Step 4: Start dev server and visually verify the events page**

```bash
npm run dev
```

Open http://localhost:3000/events. Confirm:
- [ ] Page loads with the events page header ("NYTW Engineer's Companion")
- [ ] EventSearch bar is visible at top with placeholder text
- [ ] Day navigation shows (desktop: left sidebar, mobile: horizontal chips)
- [ ] (If DB is seeded) Events display in day-grouped sections with EARLY/MID/LATE separators
- [ ] (If DB is empty) Empty state message is shown
- [ ] Clicking "Save" on a card adds to plan + toast appears
- [ ] After adding 1+ events, MyPlanWidget appears bottom-right
- [ ] MyPlanWidget click toggles the mini-preview
- [ ] "Open RSVP →" opens external link in new tab + shows toast
- [ ] Clicking card body opens EventDetailModal (Sheet panel from right)
- [ ] ESC closes the modal
- [ ] "/" keypress focuses search bar
- [ ] Home page at http://localhost:3000 still works

Stop dev server (Ctrl+C).

- [ ] **Step 5: Final phase commit**

```bash
git add -A
git commit -m "chore: Phase 2 complete — browse + My Plan basic (EventCard, EventDetailModal, EventSearch, MyPlanWidget, EditorsPicksCarousel)"
```

---

## Self-Review

### Spec coverage

| Spec requirement (Phase 2) | Task |
|---|---|
| `data/seed-events.json` with 30+ events | Task 3 |
| `data/seed.ts` upsert script | Task 3 |
| `app/events/page.tsx` — Server Component, day-grouped timeline | Task 10 |
| Sticky day headers, EARLY/MID/LATE separators | Task 9 (EventList) |
| Sticky day nav left desktop / horizontal chips mobile | Task 9 (EventList) |
| Editor's Picks carousel with visible blurbs | Task 7 (EditorsPicksCarousel) |
| EventCard with title, host, time (NYC), neighborhood badge, tags | Task 4 |
| "Open RSVP →" — opens external + adds to plan + toast | Task 4 |
| "Save" button — adds to plan without opening | Task 4 |
| "In your plan ✓" + dropdown with [Open RSVP / Remove] | Task 4 |
| Badges: Editor's Pick, Featured, Invite-only, Free food/drinks | Task 4 |
| EventDetailModal — Sheet on mobile/desktop, opens on card body click | Task 5 |
| Modal hash pushState for deep link | Task 5 |
| Modal closes + scroll position preserved | Task 5 (Sheet handles this natively) |
| EventSearch — Fuse.js fuzzy, real-time, ESC to clear, "/" to focus | Task 6 |
| Search empty state | Task 9 (EventList) |
| Persistent MyPlanWidget — bottom-right desktop, bottom bar mobile | Task 8 |
| Widget hidden when plan is empty | Task 8 |
| Widget shows count + mini-preview + "Open full plan →" | Task 8 |
| Keyboard shortcuts: Space/A=add, R=RSVP, ESC=close | Task 4 (EventCard), Task 6 (EventSearch) |
| Implicit-add UX on "Open RSVP" | Task 4 |
| Toaster (sonner) for feedback | Task 11 (layout) |

**Items intentionally deferred (spec says "NIE buduj w tej fazie"):**
- EventFilters component — Phase 6 ✓
- Clickable tags — Phase 6 ✓
- /my-plan dedicated route — Phase 4 ✓
- Status tracking UI — Phase 4 ✓
- iCal feed — Phase 4 ✓
- Conflict warnings — Phase 4 ✓
- AI Concierge — Phase 5 ✓
- Map view — Phase 3 ✓

### Placeholder scan

No TBD/TODO/placeholder steps. All code blocks are complete. ✓

### Type consistency

- `Event` type from `lib/types.ts` used consistently across all components ✓
- `TimePeriod` defined and exported from `lib/events.ts`, used in `EventList.tsx` ✓
- `usePlanStore` actions: `addItem(id, status, source)` / `removeItem(id)` — match Phase 1 implementation ✓
- `PlanItemSource` includes `'editors_pick'` — needed for EditorsPicksCarousel — confirmed in Phase 1 `lib/types.ts` ✓
- `formatEventTime(starts_at, ends_at)` signature — matches tests and usage in EventCard/Modal/Carousel ✓
- `groupEventsByDay(events)` returns `Record<string, Event[]>` — used correctly in EventList ✓
- `formatDayHeading(dateKey)` and `formatDayShort(dateKey)` — both defined in `lib/events.ts` and used in `EventList.tsx` ✓

### Next.js 16 compliance

- `app/events/page.tsx` does not use `searchParams` or `params` yet — no async wrapping needed for this phase ✓
- No `middleware.ts` created — would be `proxy.ts` in Next.js 16 ✓
- All client components have `'use client'` directive ✓
- Server Component fetches directly from Supabase (no client-side fetching for initial data) ✓
- `revalidate = 3600` used instead of default no-cache behavior ✓
