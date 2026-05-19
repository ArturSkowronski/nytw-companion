# Phase 4 — /my-plan + status tracking + iCal + conflicts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship v1.4 of NYTW Companion — a dedicated `/my-plan` page with Timeline + Map tabs, rich status writer, conflict highlighting between overlapping confirmed events, and one-click `.ics` download.

**Architecture:** `/my-plan/page.tsx` is a Server Component (same pattern as `/events` and `/now`) that fetches all events once and hands them to a `<MyPlanClient/>` island. The client joins `usePlanStore.items` with events, routes between Timeline and Map tabs (URL state), and triggers a client-side `.ics` download. Two pure libraries — `lib/conflicts.ts` and `lib/ical.ts` — are fully unit-tested.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind 4, shadcn/ui (Tabs, Button, Badge, Sheet), Zustand + localStorage (`usePlanStore`), `mapbox-gl` ^3.24, `ics` ^3.12, vitest + Testing Library + jsdom.

**Source design:** `docs/superpowers/specs/2026-05-19-phase-4-my-plan-design.md`

**⚠ Next 16 caveat:** Per `AGENTS.md`, this is NOT the Next.js you know. **Before implementing any task that touches Next APIs** (async `searchParams`, `next/dynamic({ ssr: false })`, `useSearchParams`, `usePathname`, `useRouter`), check the relevant guide in `node_modules/next/dist/docs/`. Phase 3 hit and resolved several Next 16 boundary issues — follow the same patterns established there. In particular: `next/dynamic({ ssr: false })` must be called inside a Client Component (see `components/EventMapLoader.tsx` from Phase 3 for the pattern), and `searchParams` on Page props is a `Promise` that must be `await`ed.

---

## File map

**New files (no edits):**

```
lib/conflicts.ts
lib/ical.ts

components/StatusToggle.tsx
components/MyPlanEmptyState.tsx
components/IcalDownloadButton.tsx
components/MyPlanEventCard.tsx
components/ConflictWarnings.tsx
components/MyPlanTimeline.tsx
components/MyPlanMap.tsx
components/MyPlanMapLoader.tsx
components/MyPlanClient.tsx

app/my-plan/page.tsx

__tests__/lib/conflicts.test.ts
__tests__/lib/ical.test.ts
__tests__/components/StatusToggle.test.tsx
__tests__/components/MyPlanEmptyState.test.tsx
__tests__/components/IcalDownloadButton.test.tsx
```

**Edits:**

```
components/NextUpCard.tsx               — swap StatusPickerInline import for StatusToggle
components/MyPlanWidget.tsx             — hide when pathname === '/my-plan'
__tests__/components/MyPlanWidget.test.tsx — add: hide on /my-plan
```

**Deletes:**

```
components/StatusPickerInline.tsx
__tests__/components/StatusPickerInline.test.tsx
```

---

## Task ordering rationale

1. **Pure helpers first** (`lib/conflicts.ts`, `lib/ical.ts`) — everything else consumes them, easiest to TDD.
2. **`StatusToggle`** before `NextUpCard` migration — new component must exist before swap.
3. **Migrate `NextUpCard` + delete `StatusPickerInline`** in one step — keeps the tree green at every commit.
4. **Small leaf components** (`MyPlanEmptyState`, `IcalDownloadButton`) — TDD-friendly, independent.
5. **Composite UI** (`MyPlanEventCard`, `ConflictWarnings`, `MyPlanTimeline`, `MyPlanMap`, `MyPlanMapLoader`, `MyPlanClient`) — built up from leaves.
6. **Route wiring** (`/my-plan/page.tsx`).
7. **`MyPlanWidget` edit** — needs `/my-plan` to exist so the test can verify the hide.
8. **Final smoke** — build, lint, full test suite, manual acceptance walk.

Each task ends with a commit.

---

## Task 1: `lib/conflicts.ts` — pure conflict detector

**Files:**
- Create: `/Users/askowronski/Projects/nytw-companion/lib/conflicts.ts`
- Test: `/Users/askowronski/Projects/nytw-companion/__tests__/lib/conflicts.test.ts`

**Background:** Two plan items "conflict" when both have status `confirmed` or `rsvp_pending` and their `[starts_at, ends_at]` intervals overlap by any amount. Touching boundaries (`a.ends_at === b.starts_at`) do NOT count. Output is the list of unordered pairs.

- [ ] **Step 1: Write failing tests**

```ts
// __tests__/lib/conflicts.test.ts
import { describe, it, expect } from 'vitest'
import { detectConflicts } from '../../lib/conflicts'
import type { Event, PlanItem } from '../../lib/types'

const mkEvent = (id: string, starts_at: string, ends_at: string): Event => ({
  id, title: id, description: '', host: '', starts_at, ends_at,
  venue_name: null, address: null, lat: null, lng: null, neighborhood: null,
  rsvp_url: '', rsvp_platform: 'other', tags: [], audience_tags: [],
  format: null, capacity: null, is_invite_only: false, has_free_food: false,
  has_free_drinks: false, is_editors_pick: false, editors_pick_blurb: null,
  is_virtuslab_event: false, source: '', source_url: '',
  created_at: '', updated_at: '',
})

const mkItem = (event_id: string, status: PlanItem['status']): PlanItem => ({
  event_id, status, source: 'manual', added_at: '2026-05-01T00:00:00Z',
})

describe('detectConflicts', () => {
  it('returns empty for empty input', () => {
    expect(detectConflicts([], [])).toEqual([])
  })

  it('returns empty when only interested items overlap', () => {
    const events = [
      mkEvent('a', '2026-06-03T18:00:00Z', '2026-06-03T20:00:00Z'),
      mkEvent('b', '2026-06-03T19:00:00Z', '2026-06-03T21:00:00Z'),
    ]
    const items = [mkItem('a', 'interested'), mkItem('b', 'interested')]
    expect(detectConflicts(items, events)).toEqual([])
  })

  it('flags two overlapping confirmed items', () => {
    const events = [
      mkEvent('a', '2026-06-03T18:00:00Z', '2026-06-03T20:00:00Z'),
      mkEvent('b', '2026-06-03T19:00:00Z', '2026-06-03T21:00:00Z'),
    ]
    const items = [mkItem('a', 'confirmed'), mkItem('b', 'confirmed')]
    const pairs = detectConflicts(items, events)
    expect(pairs).toHaveLength(1)
    expect([pairs[0].a.event_id, pairs[0].b.event_id].sort()).toEqual(['a', 'b'])
  })

  it('flags one confirmed + one rsvp_pending', () => {
    const events = [
      mkEvent('a', '2026-06-03T18:00:00Z', '2026-06-03T20:00:00Z'),
      mkEvent('b', '2026-06-03T19:00:00Z', '2026-06-03T21:00:00Z'),
    ]
    const items = [mkItem('a', 'confirmed'), mkItem('b', 'rsvp_pending')]
    expect(detectConflicts(items, events)).toHaveLength(1)
  })

  it('does NOT flag back-to-back events that just touch', () => {
    const events = [
      mkEvent('a', '2026-06-03T18:00:00Z', '2026-06-03T19:00:00Z'),
      mkEvent('b', '2026-06-03T19:00:00Z', '2026-06-03T20:00:00Z'),
    ]
    const items = [mkItem('a', 'confirmed'), mkItem('b', 'confirmed')]
    expect(detectConflicts(items, events)).toEqual([])
  })

  it('flags three mutually overlapping events as three pairs', () => {
    const events = [
      mkEvent('a', '2026-06-03T18:00:00Z', '2026-06-03T20:00:00Z'),
      mkEvent('b', '2026-06-03T18:30:00Z', '2026-06-03T20:30:00Z'),
      mkEvent('c', '2026-06-03T19:00:00Z', '2026-06-03T21:00:00Z'),
    ]
    const items = [mkItem('a', 'confirmed'), mkItem('b', 'confirmed'), mkItem('c', 'confirmed')]
    expect(detectConflicts(items, events)).toHaveLength(3)
  })

  it('ignores items whose event_id is not in events', () => {
    const events = [mkEvent('a', '2026-06-03T18:00:00Z', '2026-06-03T20:00:00Z')]
    const items = [mkItem('a', 'confirmed'), mkItem('ghost', 'confirmed')]
    expect(detectConflicts(items, events)).toEqual([])
  })

  it('ignores declined, attended, waitlist', () => {
    const events = [
      mkEvent('a', '2026-06-03T18:00:00Z', '2026-06-03T20:00:00Z'),
      mkEvent('b', '2026-06-03T19:00:00Z', '2026-06-03T21:00:00Z'),
    ]
    for (const status of ['declined', 'attended', 'waitlist'] as const) {
      const items = [mkItem('a', 'confirmed'), mkItem('b', status)]
      expect(detectConflicts(items, events)).toEqual([])
    }
  })
})
```

- [ ] **Step 2: Run tests — expect fail (module not found)**

```bash
npm test -- conflicts
```

- [ ] **Step 3: Implement `lib/conflicts.ts`**

```ts
// lib/conflicts.ts
import type { Event, PlanItem } from './types'

export type ConflictPair = { a: PlanItem; b: PlanItem }

const ELIGIBLE_STATUSES: ReadonlySet<PlanItem['status']> = new Set([
  'confirmed',
  'rsvp_pending',
])

export function detectConflicts(items: PlanItem[], events: Event[]): ConflictPair[] {
  const eventById = new Map(events.map((e) => [e.id, e]))

  const eligible = items
    .filter((i) => ELIGIBLE_STATUSES.has(i.status))
    .map((i) => {
      const event = eventById.get(i.event_id)
      if (!event) return null
      return {
        item: i,
        startMs: new Date(event.starts_at).getTime(),
        endMs: new Date(event.ends_at).getTime(),
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.startMs - b.startMs)

  const pairs: ConflictPair[] = []
  for (let i = 0; i < eligible.length; i++) {
    for (let j = i + 1; j < eligible.length; j++) {
      // eligible is sorted by start; if j's start is >= i's end, no overlap with i
      if (eligible[j].startMs >= eligible[i].endMs) break
      pairs.push({ a: eligible[i].item, b: eligible[j].item })
    }
  }
  return pairs
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm test -- conflicts
```

Expected: 8 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/conflicts.ts __tests__/lib/conflicts.test.ts
git commit -m "feat(conflicts): add pure detectConflicts for overlapping confirmed/RSVPed plan items"
```

---

## Task 2: `lib/ical.ts` — pure plan → ICS builder

**Files:**
- Create: `/Users/askowronski/Projects/nytw-companion/lib/ical.ts`
- Test: `/Users/askowronski/Projects/nytw-companion/__tests__/lib/ical.test.ts`

**Background:** Build an ICS string from plan items + events. Filter to `rsvp_pending`, `confirmed`, `waitlist`. Status emoji prefix in title (✅ ⏳ 📋). Use the `ics` package (already a dep, ^3.12.0). The package's `createEvents()` returns `{ error: Error | null; value: string | null }`.

- [ ] **Step 1: Write failing tests**

```ts
// __tests__/lib/ical.test.ts
import { describe, it, expect } from 'vitest'
import { buildIcs } from '../../lib/ical'
import type { Event, PlanItem } from '../../lib/types'

const mkEvent = (id: string, overrides: Partial<Event> = {}): Event => ({
  id,
  title: `Event ${id}`,
  description: 'desc',
  host: 'Host',
  starts_at: '2026-06-03T22:30:00.000Z',
  ends_at: '2026-06-04T01:00:00.000Z',
  venue_name: 'Some Roof',
  address: '123 Main St, Brooklyn, NY',
  lat: 40.7081, lng: -73.9571,
  neighborhood: 'Williamsburg',
  rsvp_url: 'https://lu.ma/e/abc',
  rsvp_platform: 'luma',
  tags: [], audience_tags: [], format: 'rooftop', capacity: null,
  is_invite_only: false, has_free_food: false, has_free_drinks: false,
  is_editors_pick: false, editors_pick_blurb: null, is_virtuslab_event: false,
  source: '', source_url: '', created_at: '', updated_at: '',
  ...overrides,
})

const mkItem = (event_id: string, status: PlanItem['status']): PlanItem => ({
  event_id, status, source: 'manual', added_at: '2026-05-01T00:00:00Z',
})

describe('buildIcs', () => {
  it('returns a string starting with BEGIN:VCALENDAR', () => {
    const events = [mkEvent('a')]
    const items = [mkItem('a', 'confirmed')]
    const ics = buildIcs(items, events)
    expect(typeof ics).toBe('string')
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true)
    expect(ics).toContain('END:VCALENDAR')
  })

  it('filters out interested, declined, attended', () => {
    const events = [mkEvent('a'), mkEvent('b'), mkEvent('c'), mkEvent('d')]
    const items = [
      mkItem('a', 'interested'),
      mkItem('b', 'declined'),
      mkItem('c', 'attended'),
      mkItem('d', 'confirmed'),
    ]
    const ics = buildIcs(items, events)
    // 'd' is the only confirmed one — exactly one VEVENT
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(1)
    expect(ics).toContain('Event d')
    expect(ics).not.toContain('Event a')
    expect(ics).not.toContain('Event b')
    expect(ics).not.toContain('Event c')
  })

  it('includes confirmed, rsvp_pending, waitlist statuses', () => {
    const events = [mkEvent('a'), mkEvent('b'), mkEvent('c')]
    const items = [
      mkItem('a', 'confirmed'),
      mkItem('b', 'rsvp_pending'),
      mkItem('c', 'waitlist'),
    ]
    const ics = buildIcs(items, events)
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(3)
  })

  it('prefixes status emoji in SUMMARY', () => {
    const events = [mkEvent('a'), mkEvent('b'), mkEvent('c')]
    const items = [
      mkItem('a', 'confirmed'),
      mkItem('b', 'rsvp_pending'),
      mkItem('c', 'waitlist'),
    ]
    const ics = buildIcs(items, events)
    expect(ics).toMatch(/SUMMARY[^\n]*✅[^\n]*Event a/)
    expect(ics).toMatch(/SUMMARY[^\n]*⏳[^\n]*Event b/)
    expect(ics).toMatch(/SUMMARY[^\n]*📋[^\n]*Event c/)
  })

  it('emits LOCATION, URL, UID, DTSTART, DTEND', () => {
    const events = [mkEvent('a')]
    const items = [mkItem('a', 'confirmed')]
    const ics = buildIcs(items, events)
    expect(ics).toContain('LOCATION:123 Main St')
    expect(ics).toContain('URL:https://lu.ma/e/abc')
    expect(ics).toContain('UID:a@nytw-companion')
    expect(ics).toContain('DTSTART')
    expect(ics).toContain('DTEND')
  })

  it('falls back to venue_name when address is null', () => {
    const events = [mkEvent('a', { address: null, venue_name: 'Some Roof' })]
    const items = [mkItem('a', 'confirmed')]
    const ics = buildIcs(items, events)
    expect(ics).toContain('LOCATION:Some Roof')
  })

  it('drops items whose event_id is not in events', () => {
    const events = [mkEvent('a')]
    const items = [mkItem('a', 'confirmed'), mkItem('ghost', 'confirmed')]
    const ics = buildIcs(items, events)
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(1)
  })

  it('returns an empty calendar when no items qualify', () => {
    const events = [mkEvent('a')]
    const items = [mkItem('a', 'interested')]
    const ics = buildIcs(items, events)
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('END:VCALENDAR')
    expect(ics.match(/BEGIN:VEVENT/g) ?? []).toHaveLength(0)
  })

  it('throws when ics package returns an error', () => {
    const events = [mkEvent('a', { starts_at: 'not-a-date', ends_at: '2026-06-04T01:00:00.000Z' })]
    const items = [mkItem('a', 'confirmed')]
    expect(() => buildIcs(items, events)).toThrow()
  })
})
```

- [ ] **Step 2: Run tests — expect fail (module not found)**

```bash
npm test -- ical
```

- [ ] **Step 3: Implement `lib/ical.ts`**

```ts
// lib/ical.ts
import { createEvents, type EventAttributes, type DateArray } from 'ics'
import type { Event, PlanItem } from './types'

const STATUS_PREFIX: Partial<Record<PlanItem['status'], string>> = {
  confirmed: '✅ ',
  rsvp_pending: '⏳ ',
  waitlist: '📋 ',
}

const EXPORT_STATUSES: ReadonlySet<PlanItem['status']> = new Set([
  'confirmed',
  'rsvp_pending',
  'waitlist',
])

function toDateArray(iso: string): DateArray {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${iso}`)
  return [
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
  ]
}

export function buildIcs(items: PlanItem[], events: Event[]): string {
  const eventById = new Map(events.map((e) => [e.id, e]))
  const attrs: EventAttributes[] = []

  for (const item of items) {
    if (!EXPORT_STATUSES.has(item.status)) continue
    const event = eventById.get(item.event_id)
    if (!event) continue

    const prefix = STATUS_PREFIX[item.status] ?? ''
    attrs.push({
      uid: `${event.id}@nytw-companion`,
      title: `${prefix}${event.title}`,
      description: `Host: ${event.host}\nRSVP: ${event.rsvp_url}`,
      location: event.address ?? event.venue_name ?? '',
      url: event.rsvp_url || undefined,
      start: toDateArray(event.starts_at),
      startInputType: 'utc',
      startOutputType: 'utc',
      end: toDateArray(event.ends_at),
      endInputType: 'utc',
      endOutputType: 'utc',
      productId: 'nytw-companion/ics',
      calName: 'NYTW Plan',
    })
  }

  const { error, value } = createEvents(attrs)
  if (error) throw error
  if (!value) {
    // Empty calendar — synthesize a valid skeleton (ics returns null for an empty array).
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//nytw-companion/ics//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:NYTW Plan',
      'END:VCALENDAR',
      '',
    ].join('\r\n')
  }
  return value
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm test -- ical
```

Expected: 9 tests green. The `'throws when ics package returns an error'` test relies on `toDateArray` throwing on the invalid `starts_at`, which propagates out of `buildIcs`.

- [ ] **Step 5: Commit**

```bash
git add lib/ical.ts __tests__/lib/ical.test.ts
git commit -m "feat(ical): add pure plan→ICS builder with status emoji prefix"
```

---

## Task 3: `StatusToggle` component (new, replaces StatusPickerInline next task)

**Files:**
- Create: `/Users/askowronski/Projects/nytw-companion/components/StatusToggle.tsx`
- Test: `/Users/askowronski/Projects/nytw-companion/__tests__/components/StatusToggle.test.tsx`

**Background:** Richer six-status picker. Same semantics as the (about-to-be-deleted) `StatusPickerInline` — returns `null` if eventId not in plan, writes via `usePlanStore.updateStatus`. Visual upgrade: status icons + label always visible; better tap targets on mobile.

- [ ] **Step 1: Write failing tests**

```tsx
// __tests__/components/StatusToggle.test.tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StatusToggle } from '../../components/StatusToggle'
import { usePlanStore } from '../../lib/plan-store'

describe('StatusToggle', () => {
  beforeEach(() => {
    usePlanStore.getState().clear()
    usePlanStore.getState().addItem('event-1', 'interested', 'manual')
  })

  it('renders all six statuses with labels', () => {
    render(<StatusToggle eventId="event-1" />)
    for (const label of ['Interested', 'RSVPed', 'Confirmed', 'Waitlist', 'Declined', 'Attended']) {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument()
    }
  })

  it('marks the current status with aria-pressed=true', () => {
    render(<StatusToggle eventId="event-1" />)
    const interested = screen.getByRole('button', { name: /Interested/ })
    expect(interested.getAttribute('aria-pressed')).toBe('true')
    const confirmed = screen.getByRole('button', { name: /Confirmed/ })
    expect(confirmed.getAttribute('aria-pressed')).toBe('false')
  })

  it('clicking a status updates the plan store', () => {
    render(<StatusToggle eventId="event-1" />)
    fireEvent.click(screen.getByRole('button', { name: /Declined/ }))
    expect(usePlanStore.getState().items[0].status).toBe('declined')
  })

  it('returns null when the event is not in the plan', () => {
    const { container } = render(<StatusToggle eventId="missing" />)
    expect(container.firstChild).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests — expect fail**

```bash
npm test -- StatusToggle
```

- [ ] **Step 3: Implement**

```tsx
// components/StatusToggle.tsx
'use client'

import { usePlanStore } from '@/lib/plan-store'
import type { PlanStatus } from '@/lib/types'

const STATUSES: { value: PlanStatus; label: string; icon: string }[] = [
  { value: 'interested',   label: 'Interested', icon: '👀' },
  { value: 'rsvp_pending', label: 'RSVPed',     icon: '⏳' },
  { value: 'confirmed',    label: 'Confirmed',  icon: '✅' },
  { value: 'waitlist',     label: 'Waitlist',   icon: '📋' },
  { value: 'declined',     label: 'Declined',   icon: '❌' },
  { value: 'attended',     label: 'Attended',   icon: '✔' },
]

interface StatusToggleProps {
  eventId: string
}

export function StatusToggle({ eventId }: StatusToggleProps) {
  const item = usePlanStore((s) => s.items.find((i) => i.event_id === eventId))
  const updateStatus = usePlanStore((s) => s.updateStatus)

  if (!item) return null

  return (
    <div
      className="inline-flex flex-wrap gap-1 rounded-md border border-[#2A2A2A] bg-[#111111] p-1"
      role="group"
      aria-label="Update status"
    >
      {STATUSES.map(({ value, label, icon }) => {
        const active = item.status === value
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => updateStatus(eventId, value)}
            className={
              `font-mono text-xs px-2.5 py-1.5 rounded transition-colors flex items-center gap-1.5 ` +
              (active
                ? 'bg-[#FF6B35] text-white font-bold'
                : 'text-[#A3A3A3] hover:text-[#FAFAFA] hover:bg-[#1A1A1A]')
            }
          >
            <span aria-hidden="true">{icon}</span>
            <span>{label}</span>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm test -- StatusToggle
```

- [ ] **Step 5: Commit**

```bash
git add components/StatusToggle.tsx __tests__/components/StatusToggle.test.tsx
git commit -m "feat(plan): add StatusToggle rich six-status picker with icons"
```

---

## Task 4: Migrate `NextUpCard` → `StatusToggle`; delete `StatusPickerInline`

**Files:**
- Modify: `/Users/askowronski/Projects/nytw-companion/components/NextUpCard.tsx`
- Delete: `/Users/askowronski/Projects/nytw-companion/components/StatusPickerInline.tsx`
- Delete: `/Users/askowronski/Projects/nytw-companion/__tests__/components/StatusPickerInline.test.tsx`

- [ ] **Step 1: Edit `NextUpCard.tsx`**

Change the import line:

```diff
- import { StatusPickerInline } from '@/components/StatusPickerInline'
+ import { StatusToggle } from '@/components/StatusToggle'
```

And the usage near the bottom of the JSX:

```diff
-      <StatusPickerInline eventId={event.id} />
+      <StatusToggle eventId={event.id} />
```

- [ ] **Step 2: Delete the old component and test via `git rm` (stages the deletion in one step)**

```bash
git rm components/StatusPickerInline.tsx
git rm __tests__/components/StatusPickerInline.test.tsx
```

- [ ] **Step 3: Run the full test suite**

```bash
npm test
```

Expected: NextUpCard's existing 4 tests still pass (its UI shape didn't change; status picker is at the same location with the same semantics). StatusPickerInline tests are gone. Total should be down by 4 (StatusPickerInline) and unchanged otherwise, **plus** the 4 new StatusToggle tests from Task 3 — net same count.

- [ ] **Step 4: Lint**

```bash
npm run lint
```

Expected: no dangling imports.

- [ ] **Step 5: Commit (the deletes are already staged from Step 2)**

```bash
git add components/NextUpCard.tsx
git commit -m "refactor(plan): swap StatusPickerInline for richer StatusToggle"
```

---

## Task 5: `MyPlanEmptyState` component

**Files:**
- Create: `/Users/askowronski/Projects/nytw-companion/components/MyPlanEmptyState.tsx`
- Test: `/Users/askowronski/Projects/nytw-companion/__tests__/components/MyPlanEmptyState.test.tsx`

**Background:** Empty `/my-plan` state. Three cards: Browse events (live), Editor's Picks (live, both link to `/events`), Plan with AI (disabled, "Coming soon" matching SiteNav treatment).

- [ ] **Step 1: Write failing tests**

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

  it('renders Plan with AI as disabled with Coming soon', () => {
    render(<MyPlanEmptyState />)
    const ai = screen.getByText(/Plan with AI/i)
    expect(ai.closest('a')).toBeNull()
    expect(screen.getByText(/Coming soon/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests — expect fail**

```bash
npm test -- MyPlanEmptyState
```

- [ ] **Step 3: Implement**

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
        <div
          aria-disabled="true"
          className="bg-[#0F0F0F] border border-[#1A1A1A] rounded-md p-5 text-left cursor-not-allowed"
        >
          <p className="font-mono text-sm text-[#555555] font-bold mb-1">Plan with AI</p>
          <p className="text-xs text-[#333333]">Coming soon</p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm test -- MyPlanEmptyState
```

- [ ] **Step 5: Commit**

```bash
git add components/MyPlanEmptyState.tsx __tests__/components/MyPlanEmptyState.test.tsx
git commit -m "feat(plan): add MyPlanEmptyState with three CTA cards"
```

---

## Task 6: `IcalDownloadButton` component

**Files:**
- Create: `/Users/askowronski/Projects/nytw-companion/components/IcalDownloadButton.tsx`
- Test: `/Users/askowronski/Projects/nytw-companion/__tests__/components/IcalDownloadButton.test.tsx`

**Background:** Builds ICS via `lib/ical.ts buildIcs()` and triggers a Blob download. Disabled when no exportable items (items filtered to `rsvp_pending`, `confirmed`, `waitlist`).

- [ ] **Step 1: Write failing tests**

```tsx
// __tests__/components/IcalDownloadButton.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { IcalDownloadButton } from '../../components/IcalDownloadButton'
import type { Event, PlanItem } from '../../lib/types'

const mkEvent = (id: string): Event => ({
  id, title: `Event ${id}`, description: '', host: 'H',
  starts_at: '2026-06-03T22:30:00Z', ends_at: '2026-06-04T01:00:00Z',
  venue_name: 'V', address: '1 Main', lat: null, lng: null,
  neighborhood: null, rsvp_url: 'https://x', rsvp_platform: 'other',
  tags: [], audience_tags: [], format: null, capacity: null,
  is_invite_only: false, has_free_food: false, has_free_drinks: false,
  is_editors_pick: false, editors_pick_blurb: null, is_virtuslab_event: false,
  source: '', source_url: '', created_at: '', updated_at: '',
})
const mkItem = (event_id: string, status: PlanItem['status']): PlanItem => ({
  event_id, status, source: 'manual', added_at: '2026-05-01T00:00:00Z',
})

describe('IcalDownloadButton', () => {
  let createObjectURL: ReturnType<typeof vi.fn>
  let revokeObjectURL: ReturnType<typeof vi.fn>

  beforeEach(() => {
    createObjectURL = vi.fn(() => 'blob:fake')
    revokeObjectURL = vi.fn()
    Object.defineProperty(globalThis.URL, 'createObjectURL', { value: createObjectURL, configurable: true })
    Object.defineProperty(globalThis.URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true })
  })

  it('renders disabled when no exportable items', () => {
    const events = [mkEvent('a')]
    const items = [mkItem('a', 'interested')]
    render(<IcalDownloadButton items={items} events={events} />)
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
    expect(btn.textContent).toMatch(/Nothing to export/i)
  })

  it('renders enabled with "Download .ics" when items exportable', () => {
    const events = [mkEvent('a')]
    const items = [mkItem('a', 'confirmed')]
    render(<IcalDownloadButton items={items} events={events} />)
    const btn = screen.getByRole('button')
    expect(btn).not.toBeDisabled()
    expect(btn.textContent).toMatch(/Download \.ics/i)
  })

  it('clicking calls URL.createObjectURL and revokeObjectURL', () => {
    const events = [mkEvent('a')]
    const items = [mkItem('a', 'confirmed')]
    render(<IcalDownloadButton items={items} events={events} />)
    fireEvent.click(screen.getByRole('button'))
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledTimes(1)
    const blob = createObjectURL.mock.calls[0][0] as Blob
    expect(blob.type).toBe('text/calendar')
  })
})
```

- [ ] **Step 2: Run tests — expect fail**

```bash
npm test -- IcalDownloadButton
```

- [ ] **Step 3: Implement**

```tsx
// components/IcalDownloadButton.tsx
'use client'

import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { buildIcs } from '@/lib/ical'
import type { Event, PlanItem } from '@/lib/types'

const EXPORT_STATUSES = new Set<PlanItem['status']>(['confirmed', 'rsvp_pending', 'waitlist'])

interface IcalDownloadButtonProps {
  items: PlanItem[]
  events: Event[]
}

export function IcalDownloadButton({ items, events }: IcalDownloadButtonProps) {
  const exportableCount = useMemo(() => {
    const ids = new Set(events.map((e) => e.id))
    return items.filter((i) => EXPORT_STATUSES.has(i.status) && ids.has(i.event_id)).length
  }, [items, events])

  function handleDownload() {
    const ics = buildIcs(items, events)
    const blob = new Blob([ics], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'nytw-plan.ics'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (exportableCount === 0) {
    return (
      <Button variant="outline" disabled className="font-mono">
        Nothing to export yet
      </Button>
    )
  }

  return (
    <Button
      onClick={handleDownload}
      className="bg-[#FF6B35] hover:bg-[#e85a25] text-white font-mono"
    >
      Download .ics ({exportableCount})
    </Button>
  )
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm test -- IcalDownloadButton
```

- [ ] **Step 5: Commit**

```bash
git add components/IcalDownloadButton.tsx __tests__/components/IcalDownloadButton.test.tsx
git commit -m "feat(ical): add IcalDownloadButton client-side download trigger"
```

---

## Task 7: `MyPlanEventCard` component

**Files:**
- Create: `/Users/askowronski/Projects/nytw-companion/components/MyPlanEventCard.tsx`

No unit test — composed presentational component; downstream covered by manual smoke.

- [ ] **Step 1: Implement**

```tsx
// components/MyPlanEventCard.tsx
'use client'

import { forwardRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatusToggle } from '@/components/StatusToggle'
import { formatEventTime } from '@/lib/events'
import { usePlanStore } from '@/lib/plan-store'
import type { Event, PlanItem } from '@/lib/types'

const STATUS_LABEL: Record<PlanItem['status'], string> = {
  interested:   'Interested',
  rsvp_pending: 'RSVPed',
  confirmed:    'Confirmed',
  waitlist:     'Waitlist',
  declined:     'Declined',
  attended:     'Attended',
}

const STATUS_TONE: Record<PlanItem['status'], string> = {
  interested:   'bg-[#1A1A1A] text-[#A3A3A3] border-[#2A2A2A]',
  rsvp_pending: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  confirmed:    'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  waitlist:     'bg-amber-500/10 text-amber-400 border-amber-500/30',
  declined:     'bg-red-500/10 text-red-400 border-red-500/30 line-through',
  attended:     'bg-emerald-500/10 text-emerald-400/60 border-emerald-500/30',
}

interface MyPlanEventCardProps {
  planItem: PlanItem
  event: Event
}

export const MyPlanEventCard = forwardRef<HTMLDivElement, MyPlanEventCardProps>(
  function MyPlanEventCard({ planItem, event }, ref) {
    const removeItem = usePlanStore((s) => s.removeItem)

    return (
      <div
        ref={ref}
        className="bg-[#111111] border border-[#1A1A1A] rounded-md p-5 space-y-3"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <Badge className={`text-[10px] ${STATUS_TONE[planItem.status]}`}>
                {STATUS_LABEL[planItem.status]}
              </Badge>
              {event.is_editors_pick && (
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">
                  Editor&rsquo;s Pick
                </Badge>
              )}
              {event.is_virtuslab_event && (
                <Badge className="bg-[#FF6B35]/20 text-[#FF6B35] border-[#FF6B35]/30 text-[10px]">
                  Featured
                </Badge>
              )}
            </div>
            <p className="font-mono text-base font-bold text-[#FAFAFA]">{event.title}</p>
            <p className="text-xs text-[#A3A3A3] mt-1">
              {event.host} · {formatEventTime(event.starts_at, event.ends_at)}
              {event.neighborhood ? ` · ${event.neighborhood}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => removeItem(event.id)}
            className="text-[10px] text-[#555555] hover:text-red-400 font-mono"
          >
            Remove
          </button>
        </div>

        <StatusToggle eventId={event.id} />

        <div>
          <Button asChild className="bg-[#FF6B35] hover:bg-[#e85a25] text-white font-mono text-sm">
            <a href={event.rsvp_url} target="_blank" rel="noopener noreferrer">
              Open RSVP →
            </a>
          </Button>
        </div>
      </div>
    )
  },
)
```

⚠ The `Button asChild` here matches the pattern already in use in this repo's `Button` (cva variants). If runtime errors with `asChild` on this shadcn `Button`, replace with a styled `<a>` like in `NextUpCard.tsx` (see commit `071bf54` for the same pattern). Verify in dev.

- [ ] **Step 2: Lint + tests**

```bash
npm run lint && npm test
```

Expected: clean lint, all tests still pass.

- [ ] **Step 3: Commit**

```bash
git add components/MyPlanEventCard.tsx
git commit -m "feat(plan): add MyPlanEventCard with status badge and StatusToggle"
```

---

## Task 8: `ConflictWarnings` component

**Files:**
- Create: `/Users/askowronski/Projects/nytw-companion/components/ConflictWarnings.tsx`

No unit test — DOM-positioning is complex and best verified visually. Logic of which pairs to show comes from the (already-tested) `lib/conflicts.ts`.

- [ ] **Step 1: Implement**

```tsx
// components/ConflictWarnings.tsx
'use client'

import { useEffect, useState, type RefObject } from 'react'
import type { ConflictPair } from '@/lib/conflicts'

interface ConflictWarningsProps {
  pairs: ConflictPair[]
  cardRefs: Map<string, RefObject<HTMLDivElement | null>>
  containerRef: RefObject<HTMLDivElement | null>
}

interface BracketBox {
  key: string
  top: number
  height: number
}

export function ConflictWarnings({ pairs, cardRefs, containerRef }: ConflictWarningsProps) {
  const [brackets, setBrackets] = useState<BracketBox[]>([])

  useEffect(() => {
    function recompute() {
      const container = containerRef.current
      if (!container) {
        setBrackets([])
        return
      }
      const containerTop = container.getBoundingClientRect().top
      const next: BracketBox[] = []
      for (const pair of pairs) {
        const aRef = cardRefs.get(pair.a.event_id)
        const bRef = cardRefs.get(pair.b.event_id)
        const aEl = aRef?.current
        const bEl = bRef?.current
        if (!aEl || !bEl) continue
        const aRect = aEl.getBoundingClientRect()
        const bRect = bEl.getBoundingClientRect()
        const top = Math.min(aRect.top, bRect.top) - containerTop
        const bottom = Math.max(aRect.bottom, bRect.bottom) - containerTop
        next.push({
          key: `${pair.a.event_id}~${pair.b.event_id}`,
          top,
          height: bottom - top,
        })
      }
      setBrackets(next)
    }

    recompute()
    const ro = new ResizeObserver(recompute)
    if (containerRef.current) ro.observe(containerRef.current)
    window.addEventListener('resize', recompute)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', recompute)
    }
  }, [pairs, cardRefs, containerRef])

  return (
    <>
      {brackets.map((b) => (
        <div
          key={b.key}
          className="pointer-events-none absolute left-0 w-1 border-l-2 border-t-2 border-b-2 border-red-500/60 rounded-sm"
          style={{ top: b.top, height: b.height }}
          aria-hidden="true"
        >
          <span
            className="pointer-events-auto absolute -left-1 -translate-x-full top-1/2 -translate-y-1/2 text-[10px] text-red-400 bg-[#0A0A0A] font-mono whitespace-nowrap pr-2"
          >
            Conflict
          </span>
        </div>
      ))}
    </>
  )
}
```

- [ ] **Step 2: Lint**

```bash
npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add components/ConflictWarnings.tsx
git commit -m "feat(plan): add ConflictWarnings bracket overlay for overlapping events"
```

---

## Task 9: `MyPlanTimeline` component

**Files:**
- Create: `/Users/askowronski/Projects/nytw-companion/components/MyPlanTimeline.tsx`

No unit test — composed from already-tested pieces (`MyPlanEventCard`, `ConflictWarnings`, `lib/events.groupEventsByDay`).

- [ ] **Step 1: Implement**

```tsx
// components/MyPlanTimeline.tsx
'use client'

import { createRef, useMemo, useRef } from 'react'
import { MyPlanEventCard } from '@/components/MyPlanEventCard'
import { ConflictWarnings } from '@/components/ConflictWarnings'
import { groupEventsByDay, formatDayHeading } from '@/lib/events'
import type { ConflictPair } from '@/lib/conflicts'
import type { Event, PlanItem } from '@/lib/types'

interface MyPlanTimelineProps {
  planEvents: Array<{ item: PlanItem; event: Event }>
  conflicts: ConflictPair[]
}

export function MyPlanTimeline({ planEvents, conflicts }: MyPlanTimelineProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  const cardRefs = useMemo(() => {
    const m = new Map<string, ReturnType<typeof createRef<HTMLDivElement>>>()
    for (const { event } of planEvents) m.set(event.id, createRef<HTMLDivElement>())
    return m
  }, [planEvents])

  const events = useMemo(() => planEvents.map((p) => p.event), [planEvents])
  const grouped = useMemo(() => groupEventsByDay(events), [events])
  const dayKeys = Object.keys(grouped).sort()
  const itemByEventId = useMemo(() => {
    const m = new Map<string, PlanItem>()
    for (const { item } of planEvents) m.set(item.event_id, item)
    return m
  }, [planEvents])

  return (
    <div ref={containerRef} className="relative pl-4">
      <ConflictWarnings
        pairs={conflicts}
        cardRefs={cardRefs}
        containerRef={containerRef}
      />
      {dayKeys.map((dayKey) => (
        <section key={dayKey} className="mb-10">
          <h2 className="sticky top-0 z-10 bg-[#0A0A0A] border-b border-[#1A1A1A] py-3 mb-4 font-mono font-bold text-[#FAFAFA] text-lg">
            {formatDayHeading(dayKey)}
          </h2>
          <div className="grid gap-3">
            {grouped[dayKey].map((event) => {
              const item = itemByEventId.get(event.id)
              if (!item) return null
              return (
                <MyPlanEventCard
                  key={event.id}
                  ref={cardRefs.get(event.id)}
                  planItem={item}
                  event={event}
                />
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Lint**

```bash
npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add components/MyPlanTimeline.tsx
git commit -m "feat(plan): add MyPlanTimeline day-grouped view with ConflictWarnings"
```

---

## Task 10: `MyPlanMap` component (and `MyPlanMapLoader` wrapper)

**Files:**
- Create: `/Users/askowronski/Projects/nytw-companion/components/MyPlanMap.tsx`
- Create: `/Users/askowronski/Projects/nytw-companion/components/MyPlanMapLoader.tsx`

Background: Same dynamic-import pattern as Phase 3's `EventMap` + `EventMapLoader`. Next 16 forbids `next/dynamic({ ssr: false })` in Server Components, so the loader is a Client Component that does the dynamic import.

No unit tests (mapbox-gl needs WebGL, not available in jsdom).

- [ ] **Step 1: Implement `MyPlanMap`**

```tsx
// components/MyPlanMap.tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { dayKeyForDate, type DayKey } from '@/lib/time'
import { haversineKm, uberTimeMin, walkingTimeMin } from '@/lib/geo'
import { MapTokenFallback } from '@/components/MapTokenFallback'
import { DayChipNav } from '@/components/DayChipNav'
import type { Event, PlanItem } from '@/lib/types'

const STATUS_COLOR: Record<PlanItem['status'], string> = {
  interested:   '#A3A3A3',
  rsvp_pending: '#f59e0b',
  confirmed:    '#22c55e',
  waitlist:     '#f59e0b',
  declined:     '#ef4444',
  attended:     '#16a34a',
}

interface MyPlanMapProps {
  planEvents: Array<{ item: PlanItem; event: Event }>
  initialDay: DayKey
}

export function MyPlanMap({ planEvents, initialDay }: MyPlanMapProps) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<unknown>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const params = useSearchParams()
  const urlDay = params.get('day') as DayKey | null
  const day = urlDay ?? initialDay

  const planByDay = useMemo(() => {
    const grouped: Record<DayKey, Array<{ item: PlanItem; event: Event }>> = {
      sun: [], mon: [], tue: [], wed: [], thu: [], fri: [], sat: [],
    }
    for (const p of planEvents) {
      const k = dayKeyForDate(new Date(p.event.starts_at))
      grouped[k].push(p)
    }
    for (const k of Object.keys(grouped) as DayKey[]) {
      grouped[k].sort((a, b) =>
        new Date(a.event.starts_at).getTime() - new Date(b.event.starts_at).getTime()
      )
    }
    return grouped
  }, [planEvents])

  const eventsByDayCounts = useMemo(() => {
    return Object.fromEntries(
      Object.entries(planByDay).map(([k, v]) => [k, v.length])
    ) as Record<DayKey, number>
  }, [planByDay])

  const visible = useMemo(() => {
    return planByDay[day].filter((p) => p.event.lat != null && p.event.lng != null)
  }, [planByDay, day])

  // Init map once
  useEffect(() => {
    if (!token || !containerRef.current) return
    let cancelled = false
    let mapInstance: { remove?: () => void } | null = null

    import('mapbox-gl').then(async (mod) => {
      if (cancelled || !containerRef.current) return
      const mapboxgl = mod.default
      await import('mapbox-gl/dist/mapbox-gl.css')

      mapboxgl.accessToken = token
      mapInstance = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [-73.9851, 40.7589],
        zoom: 12,
      })
      mapRef.current = mapInstance
    }).catch((err) => {
      if (!cancelled) setLoadError(err?.message ?? 'Failed to load Mapbox')
    })

    return () => {
      cancelled = true
      mapInstance?.remove?.()
    }
  }, [token])

  // Update sources/layers when visible changes
  useEffect(() => {
    const map = mapRef.current as null | {
      isStyleLoaded: () => boolean
      on: (ev: string, cb: () => void) => void
      getSource: (id: string) => null | { setData: (data: unknown) => void }
      addSource: (id: string, src: unknown) => void
      addLayer: (layer: unknown) => void
    }
    if (!map) return

    const pinFeatures = visible.map((p) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [p.event.lng as number, p.event.lat as number] },
      properties: {
        id: p.event.id,
        color: STATUS_COLOR[p.item.status],
        title: p.event.title,
      },
    }))

    // Build connecting lines + midpoint labels
    const lineFeatures: unknown[] = []
    const labelFeatures: unknown[] = []
    for (let i = 0; i < visible.length - 1; i++) {
      const a = visible[i].event
      const b = visible[i + 1].event
      const aLng = a.lng as number, aLat = a.lat as number
      const bLng = b.lng as number, bLat = b.lat as number
      lineFeatures.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [[aLng, aLat], [bLng, bLat]] },
        properties: {},
      })
      const km = haversineKm({ lat: aLat, lng: aLng }, { lat: bLat, lng: bLng })
      labelFeatures.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [(aLng + bLng) / 2, (aLat + bLat) / 2] },
        properties: { label: `~${uberTimeMin(km)} min Uber · ${walkingTimeMin(km)} min walk` },
      })
    }

    const setOrAdd = () => {
      const pinSrc = map.getSource('plan-pins')
      if (pinSrc) {
        pinSrc.setData({ type: 'FeatureCollection', features: pinFeatures })
      } else {
        map.addSource('plan-pins', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: pinFeatures },
        })
        map.addLayer({
          id: 'plan-pin-circles',
          type: 'circle',
          source: 'plan-pins',
          paint: {
            'circle-radius': 8,
            'circle-color': ['get', 'color'],
            'circle-stroke-color': '#0A0A0A',
            'circle-stroke-width': 2,
          },
        })
      }

      const lineSrc = map.getSource('plan-lines')
      if (lineSrc) {
        lineSrc.setData({ type: 'FeatureCollection', features: lineFeatures })
      } else {
        map.addSource('plan-lines', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: lineFeatures },
        })
        map.addLayer({
          id: 'plan-line-strokes',
          type: 'line',
          source: 'plan-lines',
          paint: {
            'line-color': '#FF6B35',
            'line-opacity': 0.5,
            'line-width': 2,
            'line-dasharray': [2, 2],
          },
        })
      }

      const labelSrc = map.getSource('plan-labels')
      if (labelSrc) {
        labelSrc.setData({ type: 'FeatureCollection', features: labelFeatures })
      } else {
        map.addSource('plan-labels', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: labelFeatures },
        })
        map.addLayer({
          id: 'plan-label-text',
          type: 'symbol',
          source: 'plan-labels',
          minzoom: 13,
          layout: {
            'text-field': ['get', 'label'],
            'text-size': 10,
            'text-offset': [0, 0],
            'text-anchor': 'center',
          },
          paint: {
            'text-color': '#FAFAFA',
            'text-halo-color': '#0A0A0A',
            'text-halo-width': 2,
          },
        })
      }
    }

    if (map.isStyleLoaded()) setOrAdd()
    else map.on('load', setOrAdd)
  }, [visible])

  if (!token) return <MapTokenFallback />
  if (loadError) return <MapTokenFallback message={`Map failed to load: ${loadError}`} />

  return (
    <div className="space-y-4">
      <DayChipNav eventsByDay={eventsByDayCounts} />
      <div className="relative w-full h-[600px] rounded-md overflow-hidden border border-[#1A1A1A]">
        <div ref={containerRef} className="w-full h-full" />
        {visible.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-[#111111]/95 border border-[#1A1A1A] rounded-md px-4 py-3 text-center pointer-events-auto">
              <p className="font-mono text-sm text-[#A3A3A3]">No plan events on this day.</p>
              <p className="text-xs text-[#666666] mt-1">Try another day →</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Implement `MyPlanMapLoader`**

```tsx
// components/MyPlanMapLoader.tsx
'use client'

import dynamic from 'next/dynamic'
import type { DayKey } from '@/lib/time'
import type { Event, PlanItem } from '@/lib/types'

const MyPlanMapDynamic = dynamic(
  () => import('@/components/MyPlanMap').then((m) => m.MyPlanMap),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[400px] bg-[#111111] border border-[#1A1A1A] rounded-md flex items-center justify-center">
        <p className="font-mono text-sm text-[#A3A3A3]">Loading map…</p>
      </div>
    ),
  },
)

interface MyPlanMapLoaderProps {
  planEvents: Array<{ item: PlanItem; event: Event }>
  initialDay: DayKey
}

export function MyPlanMapLoader({ planEvents, initialDay }: MyPlanMapLoaderProps) {
  return <MyPlanMapDynamic planEvents={planEvents} initialDay={initialDay} />
}
```

- [ ] **Step 3: Lint + build (build catches the same Next-16 typing trap that Phase 3 hit)**

```bash
npm run lint && npm run build
```

Expected: clean. If build fails on a TypeScript narrowing issue around `mapInstance`, see commit `759e0b3` from Phase 3 for the fix pattern (drop unused method fields from the narrow local type).

- [ ] **Step 4: Commit**

```bash
git add components/MyPlanMap.tsx components/MyPlanMapLoader.tsx
git commit -m "feat(plan): add MyPlanMap with status-colored pins, routing lines, and travel labels"
```

---

## Task 11: `MyPlanClient` orchestrator

**Files:**
- Create: `/Users/askowronski/Projects/nytw-companion/components/MyPlanClient.tsx`

No unit test — orchestrator over already-tested pieces.

- [ ] **Step 1: Implement**

```tsx
// components/MyPlanClient.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { usePlanStore } from '@/lib/plan-store'
import { detectConflicts } from '@/lib/conflicts'
import { MyPlanEmptyState } from '@/components/MyPlanEmptyState'
import { MyPlanTimeline } from '@/components/MyPlanTimeline'
import { MyPlanMapLoader } from '@/components/MyPlanMapLoader'
import { IcalDownloadButton } from '@/components/IcalDownloadButton'
import type { Event, PlanItem } from '@/lib/types'
import type { DayKey } from '@/lib/time'

type Tab = 'timeline' | 'map'

interface MyPlanClientProps {
  events: Event[]
  initialTab: Tab
  initialDay: DayKey
}

function statusCounts(items: PlanItem[]) {
  return {
    confirmed: items.filter((i) => i.status === 'confirmed').length,
    pending: items.filter((i) => i.status === 'rsvp_pending').length,
    waitlist: items.filter((i) => i.status === 'waitlist').length,
    interested: items.filter((i) => i.status === 'interested').length,
    declined: items.filter((i) => i.status === 'declined').length,
    attended: items.filter((i) => i.status === 'attended').length,
  }
}

export function MyPlanClient({ events, initialTab, initialDay }: MyPlanClientProps) {
  const [mounted, setMounted] = useState(false)
  const items = usePlanStore((s) => s.items)
  const router = useRouter()
  const params = useSearchParams()
  const pathname = usePathname()

  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard SSR hydration guard
  useEffect(() => setMounted(true), [])

  const tab: Tab = params.get('tab') === 'map' ? 'map' : initialTab === 'map' ? 'map' : 'timeline'

  function setTab(next: Tab) {
    const updated = new URLSearchParams(params.toString())
    if (next === 'map') updated.set('tab', 'map')
    else updated.delete('tab')
    const qs = updated.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const eventById = useMemo(() => {
    const m = new Map<string, Event>()
    for (const e of events) m.set(e.id, e)
    return m
  }, [events])

  const planEvents = useMemo(() => {
    return items
      .map((item) => {
        const event = eventById.get(item.event_id)
        return event ? { item, event } : null
      })
      .filter((p): p is { item: PlanItem; event: Event } => p !== null)
  }, [items, eventById])

  const conflicts = useMemo(() => detectConflicts(items, events), [items, events])
  const counts = statusCounts(items)

  if (!mounted) {
    return (
      <div className="bg-[#111111] border border-[#1A1A1A] rounded-md p-6">
        <p className="font-mono text-sm text-[#666666]">Loading…</p>
      </div>
    )
  }

  if (planEvents.length === 0) {
    return <MyPlanEmptyState />
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-mono text-2xl font-bold text-[#FAFAFA]">Your plan</p>
          <p className="text-xs text-[#A3A3A3] font-mono mt-1">
            {planEvents.length} events ·{' '}
            {counts.confirmed} confirmed · {counts.pending} pending ·{' '}
            {counts.waitlist} waitlist · {counts.interested} interested
          </p>
        </div>
        <IcalDownloadButton items={items} events={events} />
      </header>

      <div
        className="inline-flex rounded-md border border-[#2A2A2A] bg-[#111111] p-0.5"
        role="group"
        aria-label="Tab"
      >
        <button
          type="button"
          aria-pressed={tab === 'timeline'}
          onClick={() => setTab('timeline')}
          className={
            `font-mono text-xs px-3 py-1.5 rounded transition-colors ` +
            (tab === 'timeline' ? 'bg-[#FF6B35] text-white' : 'text-[#A3A3A3] hover:text-[#FAFAFA]')
          }
        >
          Timeline
        </button>
        <button
          type="button"
          aria-pressed={tab === 'map'}
          onClick={() => setTab('map')}
          className={
            `font-mono text-xs px-3 py-1.5 rounded transition-colors ` +
            (tab === 'map' ? 'bg-[#FF6B35] text-white' : 'text-[#A3A3A3] hover:text-[#FAFAFA]')
          }
        >
          Map
        </button>
      </div>

      {tab === 'timeline' ? (
        <MyPlanTimeline planEvents={planEvents} conflicts={conflicts} />
      ) : (
        <MyPlanMapLoader planEvents={planEvents} initialDay={initialDay} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Lint + tests + build**

```bash
npm run lint && npm test && npm run build
```

Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add components/MyPlanClient.tsx
git commit -m "feat(plan): add MyPlanClient orchestrator with tab routing + iCal trigger"
```

---

## Task 12: `/my-plan` page

**Files:**
- Create: `/Users/askowronski/Projects/nytw-companion/app/my-plan/page.tsx`

- [ ] **Step 1: Implement**

```tsx
// app/my-plan/page.tsx
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { MyPlanClient } from '@/components/MyPlanClient'
import type { Event } from '@/lib/types'
import type { DayKey } from '@/lib/time'
import { dayKeyForDate, festivalMode, nowInNYC } from '@/lib/time'
import seedEvents from '@/data/seed-events.json' with { type: 'json' }

export const metadata: Metadata = {
  title: "My Plan — NYTW Engineer's Companion",
  description: 'Your hand-picked schedule for Tech Week NYC 2026.',
}

export const revalidate = 3600

const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

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

function resolveDay(raw: string | undefined): DayKey {
  if (raw && (DAY_KEYS as string[]).includes(raw)) return raw as DayKey
  const mode = festivalMode(new Date())
  if (mode === 'pre') return 'mon'
  if (mode === 'post') return 'sun'
  return dayKeyForDate(nowInNYC())
}

interface MyPlanPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function MyPlanPage({ searchParams }: MyPlanPageProps) {
  const events = await fetchEvents()
  const sp = await searchParams
  const initialTab: 'timeline' | 'map' = sp.tab === 'map' ? 'map' : 'timeline'
  const dayParam = typeof sp.day === 'string' ? sp.day : undefined
  const initialDay = resolveDay(dayParam)

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-[#FAFAFA]">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <MyPlanClient events={events} initialTab={initialTab} initialDay={initialDay} />
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Lint + tests + build**

```bash
npm run lint && npm test && npm run build
```

- [ ] **Step 3: Visual smoke (optional, may be skipped if no port available)**

```bash
npm run dev
```

Visit `http://localhost:3000/my-plan` — see empty state (no plan items yet). Add a few events via `/events`, return to `/my-plan` — Timeline tab populated, Map tab works (or `MapTokenFallback` without token). Stop server.

- [ ] **Step 4: Commit**

```bash
git add app/my-plan/page.tsx
git commit -m "feat(plan): add /my-plan page rendering MyPlanClient"
```

---

## Task 13: `MyPlanWidget` hides on `/my-plan`

**Files:**
- Modify: `/Users/askowronski/Projects/nytw-companion/components/MyPlanWidget.tsx`
- Modify: `/Users/askowronski/Projects/nytw-companion/__tests__/components/MyPlanWidget.test.tsx`

**Background:** With `/my-plan` now live, the floating widget should hide while the user is on that page (avoid visual duplication of the plan summary).

- [ ] **Step 1: Add a failing test**

Edit `__tests__/components/MyPlanWidget.test.tsx`. At the very top of the file, add the `usePathname` mock and refactor existing tests to reset it:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MyPlanWidget } from '../../components/MyPlanWidget'
import { usePlanStore } from '../../lib/plan-store'

let currentPath = '/events'
vi.mock('next/navigation', () => ({
  usePathname: () => currentPath,
}))

describe('MyPlanWidget', () => {
  beforeEach(() => {
    usePlanStore.getState().clear()
    currentPath = '/events'
  })

  it('is not rendered when the plan is empty', () => {
    const { container } = render(<MyPlanWidget />)
    expect(container.firstChild).toBeNull()
  })

  it('shows the event count when plan has items', () => {
    usePlanStore.getState().addItem('event-1')
    usePlanStore.getState().addItem('event-2')
    render(<MyPlanWidget />)
    expect(screen.getAllByText(/My Plan \(2\)/).length).toBeGreaterThan(0)
  })

  it('toggles the mini-preview open and closed', () => {
    usePlanStore.getState().addItem('event-1')
    render(<MyPlanWidget />)
    const buttons = screen.getAllByText(/My Plan \(1\)/)
    expect(screen.queryByText(/Open full plan/)).toBeNull()
    fireEvent.click(buttons[0])
    expect(screen.getAllByText(/Open full plan/).length).toBeGreaterThan(0)
  })

  it('is hidden when pathname is /my-plan', () => {
    usePlanStore.getState().addItem('event-1')
    currentPath = '/my-plan'
    const { container } = render(<MyPlanWidget />)
    expect(container.firstChild).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests — expect the new test to fail**

```bash
npm test -- MyPlanWidget
```

Expected: 3 existing tests pass, new "hidden when pathname is /my-plan" fails because the widget doesn't read pathname yet.

- [ ] **Step 3: Edit `components/MyPlanWidget.tsx`**

Add the import and the pathname guard:

```diff
 'use client'

 import { useState, useEffect } from 'react'
 import Link from 'next/link'
+import { usePathname } from 'next/navigation'
 import { usePlanStore } from '@/lib/plan-store'

 export function MyPlanWidget() {
   const [open, setOpen] = useState(false)
   const [mounted, setMounted] = useState(false)
   const { items } = usePlanStore()
+  const pathname = usePathname()

   // eslint-disable-next-line react-hooks/set-state-in-effect -- standard SSR hydration guard; single synchronous call on mount, no cascading risk
   useEffect(() => setMounted(true), [])

-  if (!mounted || items.length === 0) return null
+  if (!mounted || items.length === 0 || pathname === '/my-plan') return null
```

- [ ] **Step 4: Run tests — all four pass**

```bash
npm test -- MyPlanWidget
```

- [ ] **Step 5: Lint**

```bash
npm run lint
```

- [ ] **Step 6: Commit**

```bash
git add components/MyPlanWidget.tsx __tests__/components/MyPlanWidget.test.tsx
git commit -m "feat(MyPlanWidget): hide on /my-plan to avoid duplicate summary"
```

---

## Task 14: Final smoke + acceptance pass

**Files:** none changed. Verification only.

- [ ] **Step 1: Full test suite**

```bash
npm test
```

Expected: all tests green. Phase 4 added these new test files:
- `conflicts.test.ts` (8 tests)
- `ical.test.ts` (9 tests)
- `StatusToggle.test.tsx` (4 tests)
- `MyPlanEmptyState.test.tsx` (3 tests)
- `IcalDownloadButton.test.tsx` (3 tests)
- `MyPlanWidget.test.tsx` (4 tests, was 3 — added the pathname test)

Removed: `StatusPickerInline.test.tsx` (was 4).

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: 0 errors, 0 new warnings.

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: clean production build. If a TypeScript narrowing error appears in `MyPlanMap.tsx`, apply the same fix pattern as Phase 3's `EventMap` (drop unused method fields from narrow local types).

- [ ] **Step 4: Inventory the Phase 4 work**

```bash
git log --oneline 91fdfe1..HEAD
git diff --name-only 91fdfe1..HEAD
```

Confirm commit count (~14-15 expected) and the file list matches the file map at the top of this document.

- [ ] **Step 5: Manual acceptance**

Run `npm run dev` and walk the v1.4 acceptance script from the design doc:

- `/my-plan` with empty plan → `<MyPlanEmptyState/>` shows three CTAs (two real, one "Coming soon").
- Visit `/events`, click "Open RSVP →" on three events. Toast confirms add.
- Return to `/my-plan` via the floating `MyPlanWidget` "Open full plan →" link.
- See the three events in Timeline tab. `MyPlanWidget` is no longer visible.
- For each event, the `StatusToggle` renders six icon+label buttons.
- Mark two adjacent-time events as Confirmed → see the `ConflictWarnings` bracket appear on the left of the two cards.
- Switch to Map tab via the segmented control → URL changes to `?tab=map`.
- Without a `NEXT_PUBLIC_MAPBOX_TOKEN`: see `MapTokenFallback`. With token: see pins + dashed lines + travel labels.
- Switch days via DayChipNav → URL changes to `?day=wed`; map updates.
- Back to Timeline tab. Click "Download .ics" → `nytw-plan.ics` downloads.
- Import the file into Google Calendar → confirmed events appear with ✅ prefix in the title.

- [ ] **Step 6: Final fix commit (if smoke surfaced anything)**

If a small bug was found during smoke, commit the fix as its own commit with a short message describing the symptom. Otherwise skip.

---

## Done criteria (matches design's Definition of Done)

- [ ] `/my-plan` exists; renders `MyPlanEmptyState` for new users.
- [ ] Populated plan renders day-grouped Timeline tab and Map tab.
- [ ] `StatusToggle` is the sole status writer; `NextUpCard` updated; old `StatusPickerInline` + test deleted.
- [ ] `ConflictWarnings` brackets two overlapping confirmed/RSVPed events.
- [ ] `MyPlanMap` shows status-colored pins for plan-only events on the selected day, with straight routing lines + travel-time midpoint labels.
- [ ] `MyPlanWidget` hides on `/my-plan`; "Open full plan →" navigates there from any other page.
- [ ] "Download .ics" generates a valid file that imports cleanly into Google Calendar with status emoji in titles.
- [ ] `lib/conflicts.ts` and `lib/ical.ts` are pure and unit-tested.
- [ ] `npm test` green; `npm run lint` clean; `npm run build` succeeds.

---

## Out-of-scope reminders (do NOT pull in)

- `/api/ical/[token]` live subscribe URL — Phase 5.
- Share read-only link `/my-plan/[shareToken]` — Phase 5.
- Per-event notes textarea — deferred.
- Batch operations — deferred.
- "All statuses" grid tab — deferred.
- Export-as-text / "Email me my plan" — deferred.
- DB sync `syncPlanToDb()` — Phase 5 (needs auth).
- AI Concierge, magic link recovery — Phase 5.
- Mapbox Directions API real routes — over-budget.
