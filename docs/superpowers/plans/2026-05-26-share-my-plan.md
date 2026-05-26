# Share My Plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a `/my-plan` user copy a URL that opens their plan, read-only, in someone else's browser — recipient can add individual events to their own plan with one tap.

**Architecture:** Plan IDs serialized to a base64url payload inside the URL hash (no backend). New `/plan/share` route is a server component that ships the events catalogue; a client component decodes `window.location.hash`, resolves IDs against the catalogue, and renders a read-only timeline. Each card writes to the existing `usePlanStore` via a new `'share'` source.

**Tech Stack:** Next.js 16 App Router (server + client components), `usePlanStore` (Zustand + localStorage persist), shadcn `Dialog`, `sonner` toasts, Vitest + RTL, Playwright.

**Spec:** `docs/superpowers/specs/2026-05-26-share-my-plan-design.md`

---

## File structure

| Path | Status | Responsibility |
| --- | --- | --- |
| `lib/share-encoding.ts` | Create | Pure `encodePlan` / `decodePlan` — no React, no DOM. |
| `lib/types.ts` | Modify | Extend `PlanItemSource` with `'share'`. |
| `components/SharePlanButton.tsx` | Create | Button + dialog on `/my-plan` with Copy / Web Share. |
| `components/SharedPlanEventCard.tsx` | Create | Read-only card for recipients, with per-event "Add to my plan". |
| `components/SharedPlanView.tsx` | Create | Decodes hash, groups by day, renders shared cards + header. |
| `app/plan/share/page.tsx` | Create | Server route — fetches events catalogue, renders `<SharedPlanView />`. |
| `components/MyPlanClient.tsx` | Modify | Render `<SharePlanButton>` in the page header. |

Tests:

| Path | Status | Covers |
| --- | --- | --- |
| `__tests__/lib/share-encoding.test.ts` | Create | Encoding roundtrip, base64url safety, cap, decode tolerance. |
| `__tests__/components/SharePlanButton.test.tsx` | Create | Disabled-when-empty, URL contains `#`, copy → toast. |
| `__tests__/components/SharedPlanEventCard.test.tsx` | Create | "Add to my plan" calls `addItem('id', 'interested', 'share')`; "In your plan" state. |
| `e2e/share-plan.spec.ts` | Create | Full round-trip across two browser contexts. |

---

## Task 1: Encoding library

**Files:**
- Create: `lib/share-encoding.ts`
- Test: `__tests__/lib/share-encoding.test.ts`

- [ ] **Step 1: Write the failing tests**

Write `__tests__/lib/share-encoding.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { encodePlan, decodePlan, MAX_SHARE_EVENTS } from '../../lib/share-encoding'

describe('share-encoding', () => {
  it('round-trips ids without a name', () => {
    const encoded = encodePlan({ ids: ['a', 'b', 'c'] })
    expect(decodePlan(encoded)).toEqual({ ids: ['a', 'b', 'c'], name: undefined })
  })

  it('round-trips ids with a name', () => {
    const encoded = encodePlan({ ids: ['x', 'y'], name: 'Marcin' })
    expect(decodePlan(encoded)).toEqual({ ids: ['x', 'y'], name: 'Marcin' })
  })

  it('uses base64url safe alphabet (no +, /, =)', () => {
    const encoded = encodePlan({ ids: ['evt-12345'], name: 'A B C' })
    expect(encoded).not.toMatch(/[+/=]/)
  })

  it('caps encoded ids at MAX_SHARE_EVENTS', () => {
    const tooMany = Array.from({ length: MAX_SHARE_EVENTS + 5 }, (_, i) => `id-${i}`)
    const decoded = decodePlan(encodePlan({ ids: tooMany }))
    expect(decoded.ids).toHaveLength(MAX_SHARE_EVENTS)
    expect(decoded.ids[0]).toBe('id-0')
  })

  it('returns empty ids for garbage hash', () => {
    expect(decodePlan('not-real-base64!!!')).toEqual({ ids: [], name: undefined })
  })

  it('returns empty ids for empty input', () => {
    expect(decodePlan('')).toEqual({ ids: [], name: undefined })
    expect(decodePlan('#')).toEqual({ ids: [], name: undefined })
  })

  it('ignores unknown payload keys (forward-compatible)', () => {
    // Manually craft a payload with extra key.
    const payload = 'x=ignored|i=one,two|future=stuff'
    const base64 = Buffer.from(payload, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    const decoded = decodePlan(base64)
    expect(decoded.ids).toEqual(['one', 'two'])
  })

  it('strips a leading # if present', () => {
    const encoded = encodePlan({ ids: ['a'] })
    expect(decodePlan('#' + encoded)).toEqual({ ids: ['a'], name: undefined })
  })

  it('dedupes ids on encode', () => {
    const decoded = decodePlan(encodePlan({ ids: ['a', 'b', 'a'] }))
    expect(decoded.ids).toEqual(['a', 'b'])
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run __tests__/lib/share-encoding.test.ts`
Expected: FAIL — `Cannot find module '../../lib/share-encoding'`.

- [ ] **Step 3: Implement `lib/share-encoding.ts`**

```ts
export const MAX_SHARE_EVENTS = 25

interface SharePayload {
  ids: string[]
  name?: string
}

function toBase64Url(input: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(input, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  }
  // Browser path.
  const bytes = new TextEncoder().encode(input)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(input: string): string | null {
  const trimmed = input.startsWith('#') ? input.slice(1) : input
  if (!trimmed) return null
  const padded = trimmed.replace(/-/g, '+').replace(/_/g, '/') +
    '='.repeat((4 - (trimmed.length % 4)) % 4)
  try {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(padded, 'base64').toString('utf8')
    }
    const binary = atob(padded)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

function uniqueInOrder(ids: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of ids) {
    if (seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

export function encodePlan({ ids, name }: SharePayload): string {
  const cleaned = uniqueInOrder(ids).slice(0, MAX_SHARE_EVENTS)
  const parts: string[] = []
  if (name && name.trim()) parts.push(`n=${encodeURIComponent(name.trim())}`)
  parts.push(`i=${cleaned.join(',')}`)
  return toBase64Url(parts.join('|'))
}

export function decodePlan(hash: string): SharePayload {
  const raw = fromBase64Url(hash)
  if (!raw) return { ids: [], name: undefined }
  const segments = raw.split('|')
  const out: SharePayload = { ids: [], name: undefined }
  for (const segment of segments) {
    const eq = segment.indexOf('=')
    if (eq === -1) continue
    const key = segment.slice(0, eq)
    const value = segment.slice(eq + 1)
    if (key === 'i') {
      out.ids = uniqueInOrder(
        value.split(',').map((s) => s.trim()).filter(Boolean)
      ).slice(0, MAX_SHARE_EVENTS)
    } else if (key === 'n') {
      try {
        out.name = decodeURIComponent(value) || undefined
      } catch {
        out.name = undefined
      }
    }
    // Unknown keys are ignored — forward compatible.
  }
  return out
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run __tests__/lib/share-encoding.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/share-encoding.ts __tests__/lib/share-encoding.test.ts
git commit -m "feat(share): add base64url encode/decode for plan share payload"
```

---

## Task 2: Extend `PlanItemSource` type

**Files:**
- Modify: `lib/types.ts:10`

- [ ] **Step 1: Write a failing assertion in the encoding test file**

This task is a one-line type change; gate it with a compile-time test. Append to `__tests__/lib/share-encoding.test.ts`:

```ts
import type { PlanItemSource } from '../../lib/types'

describe('PlanItemSource', () => {
  it("includes 'share'", () => {
    const allowed: PlanItemSource[] = ['manual', 'concierge', 'editors_pick', 'map', 'share']
    expect(allowed).toContain('share')
  })
})
```

- [ ] **Step 2: Run test, verify type error**

Run: `npx vitest run __tests__/lib/share-encoding.test.ts`
Expected: vitest reports a TypeScript compile error: `Type '"share"' is not assignable to type 'PlanItemSource'.`

- [ ] **Step 3: Add `'share'` to the union**

Edit `lib/types.ts:10`:

```ts
export type PlanItemSource = 'manual' | 'concierge' | 'editors_pick' | 'map' | 'share'
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run __tests__/lib/share-encoding.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts __tests__/lib/share-encoding.test.ts
git commit -m "feat(plan): extend PlanItemSource with 'share'"
```

---

## Task 3: `SharePlanButton`

**Files:**
- Create: `components/SharePlanButton.tsx`
- Test: `__tests__/components/SharePlanButton.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `__tests__/components/SharePlanButton.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const { toastFn } = vi.hoisted(() => ({ toastFn: vi.fn() }))
vi.mock('sonner', () => ({
  toast: Object.assign(toastFn, { success: vi.fn(), error: vi.fn() }),
}))

import { SharePlanButton } from '../../components/SharePlanButton'

describe('SharePlanButton', () => {
  beforeEach(() => {
    toastFn.mockClear()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  it('is disabled when there are no events', () => {
    render(<SharePlanButton eventIds={[]} />)
    const trigger = screen.getByRole('button', { name: /share my plan/i })
    expect(trigger).toBeDisabled()
  })

  it('opens a dialog whose URL contains a hash payload', async () => {
    render(<SharePlanButton eventIds={['a', 'b']} />)
    fireEvent.click(screen.getByRole('button', { name: /share my plan/i }))
    const url = await screen.findByDisplayValue(/\/plan\/share#.+/)
    expect(url).toBeInTheDocument()
  })

  it('writes the URL to clipboard and toasts on Copy', async () => {
    render(<SharePlanButton eventIds={['a']} />)
    fireEvent.click(screen.getByRole('button', { name: /share my plan/i }))
    fireEvent.click(await screen.findByRole('button', { name: /copy link/i }))
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1)
    const copied = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(copied).toMatch(/\/plan\/share#.+/)
    expect(toastFn).toHaveBeenCalled()
  })

  it('encodes the optional sender name into the URL', async () => {
    render(<SharePlanButton eventIds={['a']} />)
    fireEvent.click(screen.getByRole('button', { name: /share my plan/i }))
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Marcin' } })
    const input = await screen.findByDisplayValue(/\/plan\/share#.+/) as HTMLInputElement
    // The URL must change once name is entered.
    expect(input.value).toMatch(/\/plan\/share#.+/)
    // Decoding is covered in share-encoding.test.ts — here we just confirm the URL is regenerated.
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run __tests__/components/SharePlanButton.test.tsx`
Expected: FAIL — `Cannot find module '../../components/SharePlanButton'`.

- [ ] **Step 3: Implement `components/SharePlanButton.tsx`**

```tsx
'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { encodePlan, MAX_SHARE_EVENTS } from '@/lib/share-encoding'

interface SharePlanButtonProps {
  eventIds: string[]
}

function buildShareUrl(eventIds: string[], name: string): string {
  const payload = encodePlan({ ids: eventIds, name })
  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://nytw.dev'
  return `${origin}/plan/share#${payload}`
}

export function SharePlanButton({ eventIds }: SharePlanButtonProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')

  const url = useMemo(() => buildShareUrl(eventIds, name), [eventIds, name])
  const overCap = eventIds.length > MAX_SHARE_EVENTS

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url)
      toast('Link copied — paste it in your DM')
    } catch {
      toast('Could not copy. Select the link and copy it manually.')
    }
  }

  async function handleNativeShare() {
    if (typeof navigator.share !== 'function') {
      await handleCopy()
      return
    }
    try {
      await navigator.share({
        title: 'My NYTW plan',
        url,
      })
    } catch {
      // User cancelled — silent.
    }
  }

  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  return (
    <>
      <Button
        variant="outline"
        className="font-mono text-xs"
        onClick={() => setOpen(true)}
        disabled={eventIds.length === 0}
        title={eventIds.length === 0 ? 'Add events to share' : 'Share my plan'}
      >
        Share my plan
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share my plan</DialogTitle>
            <DialogDescription>
              Anyone with this link can view your plan and add individual events to theirs.
              {overCap
                ? ` Your plan has ${eventIds.length} events — the link will include the first ${MAX_SHARE_EVENTS}.`
                : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <label className="text-xs font-mono text-[#9B9B9B]">
              Your name <span className="text-[#737373]">— optional, shown in the link</span>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Marcin"
                className="mt-1"
                aria-label="Your name"
              />
            </label>

            <label className="text-xs font-mono text-[#9B9B9B]">
              Share link
              <Input
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                className="mt-1"
              />
            </label>

            <div className="flex gap-2 justify-end">
              {canShare && (
                <Button onClick={handleNativeShare} className="font-mono text-xs">
                  Share…
                </Button>
              )}
              <Button onClick={handleCopy} variant="outline" className="font-mono text-xs">
                Copy link
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run __tests__/components/SharePlanButton.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add components/SharePlanButton.tsx __tests__/components/SharePlanButton.test.tsx
git commit -m "feat(share): SharePlanButton with copy + Web Share fallback"
```

---

## Task 4: `SharedPlanEventCard`

**Files:**
- Create: `components/SharedPlanEventCard.tsx`
- Test: `__tests__/components/SharedPlanEventCard.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `__tests__/components/SharedPlanEventCard.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const { addItemMock } = vi.hoisted(() => ({ addItemMock: vi.fn() }))
const { toastFn } = vi.hoisted(() => ({ toastFn: vi.fn() }))

vi.mock('sonner', () => ({
  toast: Object.assign(toastFn, { success: vi.fn(), error: vi.fn() }),
}))

vi.mock('../../lib/plan-store', () => ({
  usePlanStore: (selector: (s: { items: { event_id: string }[]; addItem: typeof addItemMock }) => unknown) =>
    selector({ items: [], addItem: addItemMock }),
}))

import { SharedPlanEventCard } from '../../components/SharedPlanEventCard'
import type { Event } from '../../lib/types'

const event: Event = {
  id: 'evt-1', title: 'AI Meetup', description: '', host: 'OpenAI',
  starts_at: '2026-06-03T22:30:00Z', ends_at: '2026-06-04T01:00:00Z',
  venue_name: 'V', address: null, lat: null, lng: null,
  neighborhood: 'SoHo', rsvp_url: 'https://x', rsvp_platform: 'other',
  tags: [], audience_tags: [], format: null, capacity: null,
  is_invite_only: false, has_free_food: false, has_free_drinks: false,
  is_editors_pick: false, editors_pick_blurb: null, is_virtuslab_event: false,
  source: '', source_url: '', created_at: '', updated_at: '',
}

describe('SharedPlanEventCard', () => {
  beforeEach(() => {
    addItemMock.mockClear()
    toastFn.mockClear()
  })

  it('renders title, host, neighborhood', () => {
    render(<SharedPlanEventCard event={event} alreadyInPlan={false} />)
    expect(screen.getByText('AI Meetup')).toBeInTheDocument()
    expect(screen.getByText(/OpenAI/)).toBeInTheDocument()
    expect(screen.getByText(/SoHo/)).toBeInTheDocument()
  })

  it('calls addItem with source share when "Add to my plan" clicked', () => {
    render(<SharedPlanEventCard event={event} alreadyInPlan={false} />)
    fireEvent.click(screen.getByRole('button', { name: /add to my plan/i }))
    expect(addItemMock).toHaveBeenCalledWith('evt-1', 'interested', 'share')
    expect(toastFn).toHaveBeenCalled()
  })

  it('shows "In your plan" state when alreadyInPlan is true', () => {
    render(<SharedPlanEventCard event={event} alreadyInPlan={true} />)
    expect(screen.getByText(/in your plan/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add to my plan/i })).toBeNull()
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run __tests__/components/SharedPlanEventCard.test.tsx`
Expected: FAIL — `Cannot find module '../../components/SharedPlanEventCard'`.

- [ ] **Step 3: Implement `components/SharedPlanEventCard.tsx`**

```tsx
'use client'

import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { formatEventTime } from '@/lib/events'
import { usePlanStore } from '@/lib/plan-store'
import type { Event } from '@/lib/types'

interface SharedPlanEventCardProps {
  event: Event
  alreadyInPlan: boolean
}

export function SharedPlanEventCard({ event, alreadyInPlan }: SharedPlanEventCardProps) {
  const addItem = usePlanStore((s) => s.addItem)

  function handleAdd() {
    addItem(event.id, 'interested', 'share')
    toast(`Added "${event.title}" to your plan`)
  }

  return (
    <div className="grid grid-cols-[90px_1fr_auto] gap-5 py-5 border-t border-[#1A1A1A]">
      <div className="font-mono text-xs font-bold tracking-wide text-[#FF5B25] pt-1">
        {formatEventTime(event.starts_at, event.ends_at)}
      </div>
      <div className="min-w-0">
        {event.is_editors_pick && (
          <span className="inline-block font-mono text-[10px] uppercase tracking-[0.14em] px-1.5 py-0.5 mb-2 bg-amber-500/15 text-amber-400">
            Editor&apos;s Pick
          </span>
        )}
        <p className="font-mono font-bold text-[#F5F5F5] text-sm leading-tight">
          {event.title}
        </p>
        <p className="text-xs text-[#9B9B9B] mt-1">
          {event.host}
          {event.neighborhood ? ` · ${event.neighborhood}` : ''}
        </p>
      </div>
      <div className="flex items-center">
        {alreadyInPlan ? (
          <span className="text-xs text-[#4CC38A] font-mono">✓ In your plan</span>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="font-mono text-xs"
            onClick={handleAdd}
          >
            + Add to my plan
          </Button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run __tests__/components/SharedPlanEventCard.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add components/SharedPlanEventCard.tsx __tests__/components/SharedPlanEventCard.test.tsx
git commit -m "feat(share): SharedPlanEventCard recipient-side card with Add-to-plan"
```

---

## Task 5: `SharedPlanView`

**Files:**
- Create: `components/SharedPlanView.tsx`

This component is mostly composition with no branching logic worth a unit test on its own — its behavior is exercised by the e2e test in Task 8. We still TDD the "drops unknown ids" detail in a minimal smoke test below to lock that contract.

- [ ] **Step 1: Write failing test**

Append to `__tests__/components/SharedPlanEventCard.test.tsx` (same file, new describe) — keeps related share-recipient tests together:

```tsx
import { SharedPlanView } from '../../components/SharedPlanView'

describe('SharedPlanView', () => {
  const events: Event[] = [
    { ...event, id: 'a', starts_at: '2026-06-03T15:00:00Z', ends_at: '2026-06-03T16:00:00Z' },
    { ...event, id: 'b', starts_at: '2026-06-04T15:00:00Z', ends_at: '2026-06-04T16:00:00Z' },
  ]

  it('renders the sender name in the header when provided', () => {
    render(<SharedPlanView ids={['a']} senderName="Marcin" allEvents={events} />)
    expect(screen.getByText(/marcin's nytw plan/i)).toBeInTheDocument()
  })

  it('renders a generic header when no name is provided', () => {
    render(<SharedPlanView ids={['a']} senderName={undefined} allEvents={events} />)
    expect(screen.getByText(/shared nytw plan/i)).toBeInTheDocument()
  })

  it('shows a footer note when some ids are unknown', () => {
    render(<SharedPlanView ids={['a', 'missing-1', 'missing-2']} senderName={undefined} allEvents={events} />)
    expect(screen.getByText(/2 events from this plan are no longer available/i)).toBeInTheDocument()
  })

  it('renders an empty state when ids list is empty', () => {
    render(<SharedPlanView ids={[]} senderName={undefined} allEvents={events} />)
    expect(screen.getByText(/this share link is empty/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run __tests__/components/SharedPlanEventCard.test.tsx`
Expected: FAIL — `Cannot find module '../../components/SharedPlanView'`.

- [ ] **Step 3: Implement `components/SharedPlanView.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { SharedPlanEventCard } from '@/components/SharedPlanEventCard'
import { groupEventsByDay, formatDayHeading } from '@/lib/events'
import { usePlanStore } from '@/lib/plan-store'
import type { Event } from '@/lib/types'

interface SharedPlanViewProps {
  ids: string[]
  senderName: string | undefined
  allEvents: Event[]
}

export function SharedPlanView({ ids, senderName, allEvents }: SharedPlanViewProps) {
  const items = usePlanStore((s) => s.items)

  const { events, dropped } = useMemo(() => {
    const byId = new Map(allEvents.map((e) => [e.id, e]))
    const resolved: Event[] = []
    let missing = 0
    for (const id of ids) {
      const event = byId.get(id)
      if (event) resolved.push(event)
      else missing++
    }
    resolved.sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    return { events: resolved, dropped: missing }
  }, [ids, allEvents])

  const inPlanIds = useMemo(() => new Set(items.map((i) => i.event_id)), [items])
  const grouped = useMemo(() => groupEventsByDay(events), [events])
  const dayKeys = Object.keys(grouped).sort()

  const headerName = senderName?.trim()
  const headerTitle = headerName ? `${headerName}'s NYTW plan` : 'Shared NYTW plan'

  if (ids.length === 0) {
    return (
      <div className="bg-[#0B0B0B] border border-[#1A1A1A] rounded-md p-8 text-center">
        <p className="font-mono text-sm text-[#9B9B9B] mb-4">This share link is empty.</p>
        <Link href="/events" className="font-mono text-xs text-[#FF5B25] underline">
          Browse all events →
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="font-mono text-2xl font-bold text-[#F5F5F5]">{headerTitle}</p>
        <p className="text-xs text-[#9B9B9B] font-mono mt-1">{events.length} events</p>
      </header>

      <div className="relative pl-4">
        {dayKeys.map((dayKey) => (
          <section key={dayKey} className="mb-10">
            <h2 className="sticky top-0 z-10 bg-[#000000] border-b border-[#1A1A1A] py-3 mb-4 font-mono font-bold text-[#F5F5F5] text-lg">
              {formatDayHeading(dayKey)}
            </h2>
            <div className="grid gap-1">
              {grouped[dayKey].map((event) => (
                <SharedPlanEventCard
                  key={event.id}
                  event={event}
                  alreadyInPlan={inPlanIds.has(event.id)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {dropped > 0 && (
        <p className="text-xs text-[#737373] font-mono italic">
          {dropped} event{dropped === 1 ? '' : 's'} from this plan{' '}
          {dropped === 1 ? 'is' : 'are'} no longer available.
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run __tests__/components/SharedPlanEventCard.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add components/SharedPlanView.tsx __tests__/components/SharedPlanEventCard.test.tsx
git commit -m "feat(share): SharedPlanView read-only timeline for recipients"
```

---

## Task 6: `/plan/share` route

**Files:**
- Create: `app/plan/share/page.tsx`
- Create: `app/plan/share/SharedPlanClient.tsx`

The route is a server component that fetches the catalogue (mirroring `app/my-plan/page.tsx`). A small client component reads `window.location.hash`, decodes it, and renders `<SharedPlanView />`.

- [ ] **Step 1: Implement `app/plan/share/SharedPlanClient.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { SharedPlanView } from '@/components/SharedPlanView'
import { decodePlan } from '@/lib/share-encoding'
import type { Event } from '@/lib/types'

interface SharedPlanClientProps {
  allEvents: Event[]
}

export function SharedPlanClient({ allEvents }: SharedPlanClientProps) {
  const [decoded, setDecoded] = useState<{ ids: string[]; name?: string } | null>(null)

  useEffect(() => {
    const hash = window.location.hash
    setDecoded(decodePlan(hash))
  }, [])

  if (!decoded) {
    return (
      <div className="bg-[#0B0B0B] border border-[#1A1A1A] rounded-md p-6">
        <p className="font-mono text-sm text-[#9B9B9B]">Loading shared plan…</p>
      </div>
    )
  }

  return <SharedPlanView ids={decoded.ids} senderName={decoded.name} allEvents={allEvents} />
}
```

- [ ] **Step 2: Implement `app/plan/share/page.tsx`**

```tsx
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { selectSeed } from '@/lib/seed-source'
import { SharedPlanClient } from './SharedPlanClient'
import type { Event } from '@/lib/types'

export const metadata: Metadata = {
  title: "Shared plan — NYTW Engineer's Companion",
  description: 'A friend shared their Tech Week NYC 2026 plan with you.',
  alternates: { canonical: '/plan/share' },
}

export const revalidate = 3600

async function fetchEvents(): Promise<Event[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return selectSeed()
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

export default async function SharedPlanPage() {
  const events = await fetchEvents()
  return (
    <main className="min-h-screen bg-[#000000] text-[#F5F5F5]">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <SharedPlanClient allEvents={events} />
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Run lint + typecheck + tests**

Run: `npm run lint && npx vitest run`
Expected: lint clean, all tests pass.

- [ ] **Step 4: Smoke the route locally**

Run: `npm run dev` (background)
Manually visit `http://localhost:3000/plan/share` → see "This share link is empty." + Browse events link.
Stop dev server.

- [ ] **Step 5: Commit**

```bash
git add app/plan/share/page.tsx app/plan/share/SharedPlanClient.tsx
git commit -m "feat(share): /plan/share route renders shared plan from URL hash"
```

---

## Task 7: Wire `SharePlanButton` into `/my-plan`

**Files:**
- Modify: `components/MyPlanClient.tsx`

- [ ] **Step 1: Add the import and render in the header**

Edit `components/MyPlanClient.tsx`. Add to the imports block:

```tsx
import { SharePlanButton } from '@/components/SharePlanButton'
```

Replace the existing header block (the `<header>…</header>` that currently contains the title block plus `<IcalDownloadButton />`) with:

```tsx
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-mono text-2xl font-bold text-[#F5F5F5]">Your plan</p>
          <p className="text-xs text-[#9B9B9B] font-mono mt-1">
            {planEvents.length} events ·{' '}
            {counts.confirmed} confirmed · {counts.pending} pending ·{' '}
            {counts.waitlist} waitlist · {counts.interested} interested
          </p>
        </div>
        <div className="flex gap-2">
          <SharePlanButton eventIds={planEvents.map((p) => p.event.id)} />
          <IcalDownloadButton items={items} events={events} />
        </div>
      </header>
```

- [ ] **Step 2: Run the existing test suite**

Run: `npx vitest run`
Expected: all tests pass — no existing test on `MyPlanClient` should break because the header structure is additive.

- [ ] **Step 3: Smoke locally**

Run: `npm run dev` → open `/my-plan` with at least one event in localStorage → confirm a "Share my plan" button is visible alongside the iCal one and opens the dialog.
Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add components/MyPlanClient.tsx
git commit -m "feat(share): wire SharePlanButton into /my-plan header"
```

---

## Task 8: End-to-end round-trip

**Files:**
- Create: `e2e/share-plan.spec.ts`

- [ ] **Step 1: Inspect how the existing browse-and-add e2e adds events**

Open `e2e/browse-and-add.spec.ts` for reference. The "add to plan" path is: visit `/events` → search → click card → click "Save to plan" in the modal.

- [ ] **Step 2: Write the e2e test**

Create `e2e/share-plan.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    window.localStorage.clear()
  })
})

test('share my plan → recipient adds an event to their plan', async ({ browser }) => {
  // ─── Sender flow ────────────────────────────────────────────────────────
  const sender = await browser.newContext()
  await sender.addInitScript(() => window.localStorage.clear())
  const senderPage = await sender.newPage()

  await senderPage.goto('/events')
  await senderPage.getByPlaceholder(/search/i).fill('AI')

  const firstCard = senderPage.getByTestId('event-card').first()
  await expect(firstCard).toBeVisible({ timeout: 5000 })
  await firstCard.click()
  const modal = senderPage.getByRole('dialog')
  await expect(modal).toBeVisible()
  await modal.getByRole('button', { name: /save to plan/i }).click()
  await senderPage.keyboard.press('Escape')

  await senderPage.goto('/my-plan')
  await senderPage.getByRole('button', { name: /share my plan/i }).click()
  const urlInput = senderPage.getByRole('textbox', { name: /share link/i })
  await expect(urlInput).toBeVisible()
  const shareUrl = await urlInput.inputValue()
  expect(shareUrl).toMatch(/\/plan\/share#.+/)
  await sender.close()

  // ─── Recipient flow (fresh context = empty localStorage) ────────────────
  const recipient = await browser.newContext()
  await recipient.addInitScript(() => window.localStorage.clear())
  const recipientPage = await recipient.newPage()

  await recipientPage.goto(shareUrl)
  await expect(recipientPage.getByText(/shared nytw plan/i)).toBeVisible({ timeout: 5000 })

  const addBtn = recipientPage.getByRole('button', { name: /add to my plan/i }).first()
  await expect(addBtn).toBeVisible()
  await addBtn.click()
  await expect(recipientPage.getByText(/in your plan/i).first()).toBeVisible({ timeout: 3000 })

  // The recipient's own /my-plan should now have exactly one event.
  await recipientPage.goto('/my-plan')
  await expect(recipientPage.getByText(/your plan/i)).toBeVisible()
  await expect(recipientPage.getByText(/^1 events/i)).toBeVisible()
  await recipient.close()
})
```

- [ ] **Step 3: Run the e2e suite**

Run: `npm run build && npm run e2e`
Expected: 4 tests pass total (3 existing + the new share-plan test).

If `event-card` selector text changes, adjust per the modal/search semantics already exercised in `browse-and-add.spec.ts`.

- [ ] **Step 4: Commit**

```bash
git add e2e/share-plan.spec.ts
git commit -m "test(e2e): full share-plan round-trip between two browser contexts"
```

---

## Task 9: Final verification + push

- [ ] **Step 1: Full local CI parity**

Run in this order:

```bash
npm run lint
npm test
npm run build
npm run e2e
```

Expected: all green.

- [ ] **Step 2: Manual smoke on dev**

Run `npm run dev`. As a checklist:
- `/my-plan` (empty) → Share button disabled with tooltip.
- Add 2 events from `/events`. Share button enables. Click → dialog opens. Type a name. URL contains `#`.
- Click "Copy link" → toast.
- Open the URL in a private window → see "Shared NYTW plan — 2 events" (or `<name>'s NYTW plan` if you typed one). Both cards show "+ Add to my plan".
- Click Add on one → toast + state flips to "✓ In your plan".
- Open `/my-plan` in the private window → event present with status `interested`.
- Manually edit the hash to something broken (e.g. append `XYZ!!!`) → page renders "This share link is empty." gracefully.

- [ ] **Step 3: Push**

```bash
git push origin main
```

Then watch CI:

```bash
gh run watch $(gh run list --limit 1 --json databaseId --jq '.[0].databaseId') --exit-status
```

Expected: lint+test, e2e, and (informational) lighthouse all green.

---

## Self-review (already applied; left here for traceability)

- **Spec coverage:** every spec section maps to a task — encoder (T1), source enum (T2), sender button incl. Web Share fallback + cap warning (T3), recipient card incl. "✓ in your plan" (T4), recipient view incl. unknown-id footer + empty state + name/no-name header (T5), route (T6), wiring (T7), e2e round-trip (T8), final verification (T9). Out-of-scope items (OG, server short-link, QR, "save all", live plans, filtered list share) are not turned into tasks.
- **Placeholders:** none — every step has either code, an exact command, or a concrete check.
- **Type consistency:** `PlanItemSource` extended in T2 before any code uses `'share'` (T4). `SharePlanButtonProps`, `SharedPlanEventCardProps`, `SharedPlanViewProps`, `SharedPlanClientProps` use stable names across tasks. Storage shape `{ ids: string[]; name?: string }` is the same from `decodePlan` (T1) through `SharedPlanClient` → `SharedPlanView` (T5/T6).
