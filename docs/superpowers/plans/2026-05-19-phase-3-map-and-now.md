# Phase 3 — Map view + /now mobile entry — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship v1.3 of NYTW Companion — add a Mapbox-backed map view to `/events`, a `/now` mobile entry point, sitewide hamburger nav, and a pure `lib/geo.ts` helper layer.

**Architecture:** `/events` stays a Server Component fetching events once; a URL-driven `ViewToggle` client island switches between the existing timeline and a new `EventMap` (dynamic-imported mapbox-gl). `/now` is a Server Component shell that hands serialized events to a `NowClient` island doing the 1-minute clock, optional geolocation, and plan-store reads. A new `SiteNav` rendered in `app/layout.tsx` replaces the inline nav. Mapbox is gated by `NEXT_PUBLIC_MAPBOX_TOKEN`; missing/empty token → `MapTokenFallback`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind 4, shadcn/ui (Sheet, Tabs, Button, Badge), Zustand + localStorage (existing `usePlanStore`), `mapbox-gl` ^3.24, `date-fns-tz` ^3.2, Vitest + Testing Library + jsdom.

**Source design:** `docs/superpowers/specs/2026-05-19-phase-3-map-and-now-design.md`

**⚠ Next 16 caveat:** Per `AGENTS.md`, this is NOT the Next.js you know. **Before implementing any task that touches Next APIs** (`next/dynamic`, `useSearchParams`, `useRouter`, `usePathname`, async `searchParams` on Page props, `headers()`, `cookies()`), read the relevant guide in `node_modules/next/dist/docs/`. Notable: in App Router 16, Page `searchParams` is a `Promise` and must be `await`ed. Adapt the code blocks in this plan if the actual API has drifted.

---

## File map

**New files (no edits):**

```
lib/geo.ts
components/MapTokenFallback.tsx
components/EventMap.tsx
components/EventMapPopup.tsx
components/DayChipNav.tsx
components/ViewToggle.tsx
components/StaticMapImage.tsx
components/StatusPickerInline.tsx
components/CountdownCard.tsx
components/NextUpCard.tsx
components/AfterThisCard.tsx
components/SuggestionsCard.tsx
components/RetroCard.tsx
components/NowClient.tsx
components/SiteNav.tsx
app/now/page.tsx

__tests__/lib/geo.test.ts
__tests__/lib/time-festival.test.ts
__tests__/components/ViewToggle.test.tsx
__tests__/components/DayChipNav.test.tsx
__tests__/components/StatusPickerInline.test.tsx
__tests__/components/CountdownCard.test.tsx
__tests__/components/NextUpCard.test.tsx
__tests__/components/SiteNav.test.tsx
```

**Edits:**

```
lib/time.ts                 — add festivalWindow, festivalMode, dayKeyForDate, dateForDayKey,
                              nextEventInPlan, msUntil
app/events/page.tsx         — accept searchParams, conditionally render <EventMap/>, remove inline nav
app/layout.tsx              — render <SiteNav/> above {children}
```

**No edits required to:** `lib/plan-store.ts`, `lib/types.ts`, `lib/events.ts`, `components/EventList.tsx`, `components/EventCard.tsx`, `components/EventDetailModal.tsx`, `data/*`, `supabase/*`, vitest config.

---

## Task ordering rationale

1. **Pure helpers first** (`lib/time.ts` additions, then `lib/geo.ts`) — everything else consumes them, and they're the easiest to TDD.
2. **`SiteNav`** before page rewrites — avoids leaving the app in a broken nav state.
3. **Map building blocks** (`MapTokenFallback`, `DayChipNav`, `ViewToggle`) before `EventMap` — `EventMap` composes them.
4. **`EventMap`** + wire into `/events`.
5. **/now building blocks** (`StatusPickerInline`, `StaticMapImage`, `CountdownCard`, `NextUpCard`, `AfterThisCard`, `SuggestionsCard`, `RetroCard`) before `NowClient`.
6. **`NowClient`** + `/now` page.
7. **Final smoke pass.**

Each task ends with a commit. Tests live next to their target task.

---

## Task 1: `lib/time.ts` — festival mode helpers

**Files:**
- Modify: `lib/time.ts` (append new exports; do not change existing ones)
- Test: `__tests__/lib/time-festival.test.ts`

**Background:** SPEC §0 anchors all times to `America/New_York`. The festival window is Jun 1 00:00 EDT through Jun 7 23:59:59 EDT, 2026. `date-fns-tz` is already in use.

- [ ] **Step 1: Write failing tests**

Create `__tests__/lib/time-festival.test.ts`:

```ts
// __tests__/lib/time-festival.test.ts
import { describe, it, expect } from 'vitest'
import {
  festivalWindow,
  festivalMode,
  dayKeyForDate,
  dateForDayKey,
  nextEventInPlan,
  msUntil,
} from '../../lib/time'
import type { Event, PlanItem } from '../../lib/types'

const baseEvent = (id: string, starts_at: string, ends_at: string): Event => ({
  id, title: id, description: '', host: '', starts_at, ends_at,
  venue_name: null, address: null, lat: null, lng: null, neighborhood: null,
  rsvp_url: '', rsvp_platform: 'other', tags: [], audience_tags: [],
  format: null, capacity: null, is_invite_only: false, has_free_food: false,
  has_free_drinks: false, is_editors_pick: false, editors_pick_blurb: null,
  is_virtuslab_event: false, source: '', source_url: '',
  created_at: '', updated_at: '',
})

const planItem = (event_id: string, status: PlanItem['status'] = 'interested'): PlanItem => ({
  event_id, status, source: 'manual', added_at: '2026-05-01T00:00:00Z',
})

describe('festivalWindow', () => {
  it('returns Jun 1 00:00 EDT to Jun 7 23:59:59.999 EDT', () => {
    const { start, end } = festivalWindow()
    // EDT is UTC-4 in June → midnight Jun 1 EDT = 04:00 UTC
    expect(start.toISOString()).toBe('2026-06-01T04:00:00.000Z')
    expect(end.toISOString()).toBe('2026-06-08T03:59:59.999Z')
  })
})

describe('festivalMode', () => {
  it('returns "pre" for May 20 2026', () => {
    expect(festivalMode(new Date('2026-05-20T12:00:00Z'))).toBe('pre')
  })
  it('returns "in" for June 3 2026 18:00 UTC (14:00 EDT)', () => {
    expect(festivalMode(new Date('2026-06-03T18:00:00Z'))).toBe('in')
  })
  it('returns "post" for June 9 2026', () => {
    expect(festivalMode(new Date('2026-06-09T12:00:00Z'))).toBe('post')
  })
})

describe('dayKeyForDate', () => {
  it('returns "wed" for June 3 2026 14:00 EDT', () => {
    expect(dayKeyForDate(new Date('2026-06-03T18:00:00Z'))).toBe('wed')
  })
  it('returns "mon" for June 1 2026 EDT', () => {
    expect(dayKeyForDate(new Date('2026-06-01T18:00:00Z'))).toBe('mon')
  })
  it('returns "sun" for June 7 2026 EDT', () => {
    expect(dayKeyForDate(new Date('2026-06-07T18:00:00Z'))).toBe('sun')
  })
})

describe('dateForDayKey', () => {
  it('returns 2026-06-03 04:00 UTC (midnight EDT) for "wed"', () => {
    expect(dateForDayKey('wed').toISOString()).toBe('2026-06-03T04:00:00.000Z')
  })
  it('returns 2026-06-01 for "mon"', () => {
    expect(dateForDayKey('mon').toISOString()).toBe('2026-06-01T04:00:00.000Z')
  })
})

describe('nextEventInPlan', () => {
  const now = new Date('2026-06-03T18:00:00Z') // 14:00 EDT Wed
  const events: Event[] = [
    baseEvent('e1', '2026-06-03T19:00:00Z', '2026-06-03T20:00:00Z'), // +1h
    baseEvent('e2', '2026-06-03T22:00:00Z', '2026-06-03T23:00:00Z'), // +4h, outside 2h
    baseEvent('e3', '2026-06-03T18:30:00Z', '2026-06-03T19:00:00Z'), // +30m
  ]
  it('returns soonest event in plan within 2h', () => {
    const items = [planItem('e1'), planItem('e2'), planItem('e3')]
    expect(nextEventInPlan(items, events, now)?.id).toBe('e3')
  })
  it('returns null when no plan items are within 2h', () => {
    const items = [planItem('e2')]
    expect(nextEventInPlan(items, events, now)).toBeNull()
  })
  it('ignores declined items', () => {
    const items = [planItem('e3', 'declined'), planItem('e1')]
    expect(nextEventInPlan(items, events, now)?.id).toBe('e1')
  })
  it('ignores attended items', () => {
    const items = [planItem('e3', 'attended'), planItem('e1')]
    expect(nextEventInPlan(items, events, now)?.id).toBe('e1')
  })
  it('returns null for empty plan', () => {
    expect(nextEventInPlan([], events, now)).toBeNull()
  })
})

describe('msUntil', () => {
  it('returns days/hours/mins to a future target', () => {
    const now = new Date('2026-05-20T12:00:00Z')
    const target = new Date('2026-05-22T15:30:00Z') // +2 days, 3h, 30m
    expect(msUntil(target, now)).toEqual({ days: 2, hours: 3, mins: 30 })
  })
  it('clamps negatives to zero', () => {
    const now = new Date('2026-06-10T00:00:00Z')
    const target = new Date('2026-06-09T00:00:00Z')
    expect(msUntil(target, now)).toEqual({ days: 0, hours: 0, mins: 0 })
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- time-festival
```

Expected: all imports fail to resolve (`festivalWindow`, `festivalMode`, etc. don't exist yet).

- [ ] **Step 3: Implement helpers**

Append to `lib/time.ts` (keep existing exports):

```ts
import type { Event, PlanItem } from './types'

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
export type DayKey = typeof DAY_KEYS[number]

const FESTIVAL_DAY_TO_ISO: Record<DayKey, string> = {
  mon: '2026-06-01T04:00:00.000Z', // EDT is UTC-4 in June
  tue: '2026-06-02T04:00:00.000Z',
  wed: '2026-06-03T04:00:00.000Z',
  thu: '2026-06-04T04:00:00.000Z',
  fri: '2026-06-05T04:00:00.000Z',
  sat: '2026-06-06T04:00:00.000Z',
  sun: '2026-06-07T04:00:00.000Z',
}

export function festivalWindow(): { start: Date; end: Date } {
  return {
    start: new Date('2026-06-01T04:00:00.000Z'),
    end: new Date('2026-06-08T03:59:59.999Z'),
  }
}

export function festivalMode(now: Date): 'pre' | 'in' | 'post' {
  const { start, end } = festivalWindow()
  if (now < start) return 'pre'
  if (now > end) return 'post'
  return 'in'
}

export function dayKeyForDate(d: Date): DayKey {
  // Use NYC zoned date to pick weekday
  const zoned = toZonedTime(d, NYC_TZ)
  return DAY_KEYS[zoned.getDay()]
}

export function dateForDayKey(key: DayKey): Date {
  const iso = FESTIVAL_DAY_TO_ISO[key]
  if (!iso) throw new Error(`Unknown day key: ${key}`)
  return new Date(iso)
}

export function nextEventInPlan(
  items: PlanItem[],
  events: Event[],
  now: Date,
  withinHours = 2
): Event | null {
  const eligible = new Set(
    items
      .filter((i) => i.status !== 'declined' && i.status !== 'attended')
      .map((i) => i.event_id)
  )
  const horizon = now.getTime() + withinHours * 60 * 60 * 1000
  const candidates = events
    .filter((e) => eligible.has(e.id))
    .map((e) => ({ e, t: new Date(e.starts_at).getTime() }))
    .filter(({ t }) => t >= now.getTime() && t <= horizon)
    .sort((a, b) => a.t - b.t)
  return candidates[0]?.e ?? null
}

export function msUntil(
  target: Date,
  now: Date
): { days: number; hours: number; mins: number } {
  const ms = Math.max(0, target.getTime() - now.getTime())
  const days = Math.floor(ms / 86_400_000)
  const hours = Math.floor((ms % 86_400_000) / 3_600_000)
  const mins = Math.floor((ms % 3_600_000) / 60_000)
  return { days, hours, mins }
}
```

Note: The existing `lib/time.ts` already imports `toZonedTime` and declares `NYC_TZ`. Reuse those — do not re-import or re-declare.

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- time-festival
```

Expected: PASS (all 13 tests green).

- [ ] **Step 5: Commit**

```bash
git add lib/time.ts __tests__/lib/time-festival.test.ts
git commit -m "feat(time): add festival mode + day-key helpers"
```

---

## Task 2: `lib/geo.ts` — pure geo helpers

**Files:**
- Create: `lib/geo.ts`
- Test: `__tests__/lib/geo.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/lib/geo.test.ts`:

```ts
// __tests__/lib/geo.test.ts
import { describe, it, expect } from 'vitest'
import {
  haversineKm,
  walkingTimeMin,
  uberTimeMin,
  neighborhoodCentroids,
  staticMapUrl,
} from '../../lib/geo'

describe('haversineKm', () => {
  it('returns 0 for the same point', () => {
    const p = { lat: 40.7589, lng: -73.9851 }
    expect(haversineKm(p, p)).toBeCloseTo(0, 3)
  })
  it('returns ~5km for Flatiron → Williamsburg', () => {
    const flatiron = { lat: 40.7411, lng: -73.9897 }
    const williamsburg = { lat: 40.7081, lng: -73.9571 }
    const d = haversineKm(flatiron, williamsburg)
    expect(d).toBeGreaterThan(4)
    expect(d).toBeLessThan(6)
  })
})

describe('walkingTimeMin', () => {
  it('returns 12 minutes per km, rounded', () => {
    expect(walkingTimeMin(1)).toBe(12)
    expect(walkingTimeMin(2.5)).toBe(30)
  })
})

describe('uberTimeMin', () => {
  it('returns km*4 + 5 minutes, rounded', () => {
    expect(uberTimeMin(1)).toBe(9)
    expect(uberTimeMin(5)).toBe(25)
  })
})

describe('neighborhoodCentroids', () => {
  it('contains Flatiron, Williamsburg, DUMBO, SoHo, Hudson Yards', () => {
    expect(neighborhoodCentroids['Flatiron']).toBeDefined()
    expect(neighborhoodCentroids['Williamsburg']).toBeDefined()
    expect(neighborhoodCentroids['DUMBO']).toBeDefined()
    expect(neighborhoodCentroids['SoHo']).toBeDefined()
    expect(neighborhoodCentroids['Hudson Yards']).toBeDefined()
  })
  it('returns plausible Manhattan coords for Flatiron', () => {
    const { lat, lng } = neighborhoodCentroids['Flatiron']
    expect(lat).toBeGreaterThan(40.7)
    expect(lat).toBeLessThan(40.8)
    expect(lng).toBeGreaterThan(-74.05)
    expect(lng).toBeLessThan(-73.95)
  })
})

describe('staticMapUrl', () => {
  it('produces a Mapbox Static API URL with marker, lat, lng, zoom, dims', () => {
    const url = staticMapUrl({
      lat: 40.7411,
      lng: -73.9897,
      zoom: 14,
      width: 400,
      height: 200,
    })
    expect(url).toContain('api.mapbox.com/styles/v1/mapbox/dark-v11/static')
    expect(url).toContain('pin-s')
    expect(url).toContain('-73.9897,40.7411')
    expect(url).toContain('14')
    expect(url).toContain('400x200')
    expect(url).toContain('access_token=')
  })
  it('returns empty string when token is not configured', () => {
    const orig = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = ''
    expect(staticMapUrl({ lat: 40, lng: -73, zoom: 12, width: 400, height: 200 })).toBe('')
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = orig
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- geo
```

Expected: module not found.

- [ ] **Step 3: Implement `lib/geo.ts`**

```ts
// lib/geo.ts
export type LatLng = { lat: number; lng: number }

const EARTH_KM = 6371

function toRad(deg: number) {
  return (deg * Math.PI) / 180
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_KM * Math.asin(Math.sqrt(s))
}

export function walkingTimeMin(km: number): number {
  return Math.round(km * 12)
}

export function uberTimeMin(km: number): number {
  return Math.round(km * 4 + 5)
}

export const neighborhoodCentroids: Record<string, LatLng> = {
  'Flatiron':       { lat: 40.7411, lng: -73.9897 },
  'SoHo':           { lat: 40.7233, lng: -74.0030 },
  'Williamsburg':   { lat: 40.7081, lng: -73.9571 },
  'DUMBO':          { lat: 40.7033, lng: -73.9881 },
  'Hudson Yards':   { lat: 40.7536, lng: -74.0014 },
  'Chelsea':        { lat: 40.7465, lng: -74.0014 },
  'Tribeca':        { lat: 40.7163, lng: -74.0086 },
  'NoMad':          { lat: 40.7445, lng: -73.9887 },
  'Greenpoint':     { lat: 40.7290, lng: -73.9540 },
  'Bushwick':       { lat: 40.6944, lng: -73.9213 },
  'Long Island City': { lat: 40.7447, lng: -73.9485 },
  'Brooklyn Navy Yard': { lat: 40.7019, lng: -73.9719 },
  'Midtown':        { lat: 40.7549, lng: -73.9840 },
  'Lower East Side': { lat: 40.7150, lng: -73.9843 },
  'East Village':   { lat: 40.7265, lng: -73.9815 },
  'West Village':   { lat: 40.7359, lng: -74.0030 },
  'Financial District': { lat: 40.7074, lng: -74.0113 },
  'Bowery':         { lat: 40.7220, lng: -73.9930 },
  'NoHo':           { lat: 40.7281, lng: -73.9931 },
  'Gowanus':        { lat: 40.6745, lng: -73.9886 },
}

export function staticMapUrl(opts: {
  lat: number
  lng: number
  zoom: number
  width: number
  height: number
  markerColor?: string
}): string {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  if (!token) return ''
  const color = (opts.markerColor ?? 'ff6b35').replace('#', '')
  const pin = `pin-s+${color}(${opts.lng},${opts.lat})`
  return (
    `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/` +
    `${pin}/${opts.lng},${opts.lat},${opts.zoom},0/${opts.width}x${opts.height}@2x` +
    `?access_token=${token}`
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- geo
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/geo.ts __tests__/lib/geo.test.ts
git commit -m "feat(geo): add haversine, travel time, and static map URL helpers"
```

---

## Task 3: `MapTokenFallback` component

**Files:**
- Create: `components/MapTokenFallback.tsx`

(No test — purely presentational; visual smoke later.)

- [ ] **Step 1: Implement**

```tsx
// components/MapTokenFallback.tsx
'use client'

import { Button } from '@/components/ui/button'

interface MapTokenFallbackProps {
  message?: string
  onSwitchToTimeline?: () => void
}

export function MapTokenFallback({
  message,
  onSwitchToTimeline,
}: MapTokenFallbackProps) {
  const display =
    message ??
    'Map disabled — set NEXT_PUBLIC_MAPBOX_TOKEN to enable Mapbox.'
  return (
    <div className="flex flex-col items-center justify-center gap-4 min-h-[400px] bg-[#111111] border border-[#1A1A1A] rounded-md p-6 text-center">
      <p className="font-mono text-sm text-[#A3A3A3] max-w-md">{display}</p>
      {onSwitchToTimeline && (
        <Button
          variant="outline"
          className="border-[#333333] text-[#FAFAFA] hover:bg-[#1A1A1A] font-mono"
          onClick={onSwitchToTimeline}
        >
          Switch to timeline view →
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify it type-checks**

```bash
npm run lint
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/MapTokenFallback.tsx
git commit -m "feat(map): add MapTokenFallback for missing/failed mapbox token"
```

---

## Task 4: `SiteNav` component

**Files:**
- Create: `components/SiteNav.tsx`
- Test: `__tests__/components/SiteNav.test.tsx`

**Background:** Spec line 411 calls for a hamburger menu on `/now`. Decision during brainstorm: sitewide. Desktop = inline links top-right; mobile = hamburger → `Sheet`. Dead routes render inline-disabled. Routes: `/`, `/events`, `/now`, `/my-plan` (dead), `/plan` (dead), `/beyond` (dead), `/about` (dead).

- [ ] **Step 1: Write failing tests**

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

  it('renders live routes as links and dead routes as disabled "Coming soon"', () => {
    render(<SiteNav />)
    expect(screen.getByRole('link', { name: /^Browse/i })).toHaveAttribute('href', '/events')
    expect(screen.getByRole('link', { name: /^Now/i })).toHaveAttribute('href', '/now')
    // Dead routes — no link role, "Coming soon" hint visible
    const myPlan = screen.getAllByText(/My Plan/i)[0]
    expect(myPlan.closest('a')).toBeNull()
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

- [ ] **Step 2: Run tests — expect fail**

```bash
npm test -- SiteNav
```

Expected: module not found.

- [ ] **Step 3: Implement**

```tsx
// components/SiteNav.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'

type NavItem = { label: string; href: string; live: boolean }

const ITEMS: NavItem[] = [
  { label: 'Home',     href: '/',         live: true },
  { label: 'Browse',   href: '/events',   live: true },
  { label: 'Now',      href: '/now',      live: true },
  { label: 'My Plan',  href: '/my-plan',  live: false },
  { label: 'Plan with AI', href: '/plan', live: false },
  { label: 'Beyond',   href: '/beyond',   live: false },
  { label: 'About',    href: '/about',    live: false },
]

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  if (!item.live) {
    return (
      <span
        className="font-mono text-sm text-[#555555] cursor-not-allowed flex flex-col"
        aria-disabled="true"
      >
        {item.label}
        <span className="text-[10px] text-[#333333]">Coming soon</span>
      </span>
    )
  }
  return (
    <Link
      href={item.href}
      className={`font-mono text-sm ${active ? 'text-[#FF6B35]' : 'text-[#A3A3A3] hover:text-[#FAFAFA]'}`}
    >
      {item.label}
    </Link>
  )
}

export function SiteNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <div className="border-b border-[#1A1A1A] bg-[#0A0A0A]">
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-mono font-bold text-[#FAFAFA] text-base">
          NYTW Companion
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex gap-6 items-center">
          {ITEMS.filter((i) => i.href !== '/').map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </nav>

        {/* Mobile hamburger */}
        <div className="md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="outline"
                  className="border-[#333333] text-[#FAFAFA] font-mono"
                  aria-label="Open menu"
                >
                  ☰
                </Button>
              }
            />
            <SheetContent
              side="right"
              className="bg-[#0A0A0A] border-[#1A1A1A] text-[#FAFAFA] w-[280px] p-6"
            >
              <SheetHeader className="mb-6 p-0">
                <SheetTitle className="font-mono text-base text-[#FAFAFA] text-left">
                  Menu
                </SheetTitle>
              </SheetHeader>
              <ul className="flex flex-col gap-4">
                {ITEMS.map((item) => (
                  <li key={item.href} onClick={() => setOpen(false)}>
                    <NavLink item={item} active={isActive(item.href)} />
                  </li>
                ))}
              </ul>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </div>
  )
}
```

Note: The shadcn primitive in this repo uses Base UI's render-prop pattern — `<SheetTrigger render={<Button .../>} />` — not `asChild`. (See `feedback_shadcn_base_ui` memory.)

- [ ] **Step 4: Run tests**

```bash
npm test -- SiteNav
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add components/SiteNav.tsx __tests__/components/SiteNav.test.tsx
git commit -m "feat(nav): add sitewide SiteNav with desktop links and mobile hamburger"
```

---

## Task 5: Wire `SiteNav` into root layout

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/events/page.tsx` (remove the now-duplicated inline header nav)

- [ ] **Step 1: Edit `app/layout.tsx`**

Replace the `<body>` block to render `<SiteNav />` above `{children}`:

```tsx
// app/layout.tsx
import type { Metadata } from 'next'
import { JetBrains_Mono, Inter } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { MyPlanWidget } from '@/components/MyPlanWidget'
import { SiteNav } from '@/components/SiteNav'
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
        <SiteNav />
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

- [ ] **Step 2: Edit `app/events/page.tsx` — remove the inline page header**

Replace the file's JSX body so the page no longer renders its own nav (the title and event count move into a simpler subheader since `SiteNav` already shows the brand). Keep the data-fetching logic untouched:

```tsx
// app/events/page.tsx
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { EventList } from '@/components/EventList'
import type { Event } from '@/lib/types'
import seedEvents from '@/data/seed-events.json' with { type: 'json' }

export const metadata: Metadata = {
  title: "Browse Events — NYTW Engineer's Companion",
  description: '87 hand-curated engineering events for Tech Week NYC 2026. Day-grouped timeline with instant search.',
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

export default async function EventsPage() {
  const events = await fetchEvents()

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-[#FAFAFA]">
      <div className="max-w-5xl mx-auto px-6 py-4 border-b border-[#1A1A1A]">
        <p className="text-[#A3A3A3] text-xs font-mono">
          {events.length} curated events · Tech Week NYC 2026 · June 1–7
        </p>
      </div>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <EventList events={events} />
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Smoke test the dev server**

```bash
npm run dev
```

Manually visit `http://localhost:3000/`, `/events`. SiteNav appears on every page; `/now` link is present but route doesn't exist yet (404 expected for now). Stop dev server.

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

Expected: all existing tests + 2 new SiteNav tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx app/events/page.tsx
git commit -m "feat(nav): wire SiteNav into root layout; drop inline /events header"
```

---

## Task 6: `DayChipNav` component

**Files:**
- Create: `components/DayChipNav.tsx`
- Test: `__tests__/components/DayChipNav.test.tsx`

**Background:** 7 chips for Mon–Sun mapped to June 1–7 2026. Click writes `?day=` via `useRouter().replace(...)`. Zero-event days show a `0` badge but remain clickable (the empty-day overlay handles the empty case).

- [ ] **Step 1: Write failing tests**

```tsx
// __tests__/components/DayChipNav.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DayChipNav } from '../../components/DayChipNav'

const replace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams('view=map&day=wed'),
  usePathname: () => '/events',
}))

describe('DayChipNav', () => {
  beforeEach(() => {
    replace.mockReset()
  })

  it('renders 7 chips Mon–Sun', () => {
    render(<DayChipNav eventsByDay={{}} />)
    for (const label of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument()
    }
  })

  it('marks the active day from ?day= URL param', () => {
    render(<DayChipNav eventsByDay={{}} />)
    const wed = screen.getByRole('button', { name: /Wed/ })
    expect(wed.className).toMatch(/border-\[#FF6B35\]/)
  })

  it('shows a 0-badge on chips with no events', () => {
    render(<DayChipNav eventsByDay={{ mon: 3, tue: 0 }} />)
    const tue = screen.getByRole('button', { name: /Tue/ })
    expect(tue.textContent).toContain('0')
  })

  it('clicking a chip calls router.replace with updated ?day=', () => {
    render(<DayChipNav eventsByDay={{}} />)
    fireEvent.click(screen.getByRole('button', { name: /Fri/ }))
    expect(replace).toHaveBeenCalledWith('/events?view=map&day=fri', { scroll: false })
  })
})
```

- [ ] **Step 2: Run — expect fail**

```bash
npm test -- DayChipNav
```

- [ ] **Step 3: Implement**

```tsx
// components/DayChipNav.tsx
'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import type { DayKey } from '@/lib/time'

const ORDER: { key: DayKey; label: string; date: string }[] = [
  { key: 'mon', label: 'Mon', date: 'Jun 1' },
  { key: 'tue', label: 'Tue', date: 'Jun 2' },
  { key: 'wed', label: 'Wed', date: 'Jun 3' },
  { key: 'thu', label: 'Thu', date: 'Jun 4' },
  { key: 'fri', label: 'Fri', date: 'Jun 5' },
  { key: 'sat', label: 'Sat', date: 'Jun 6' },
  { key: 'sun', label: 'Sun', date: 'Jun 7' },
]

interface DayChipNavProps {
  /** map of day key → event count (used to show 0-badges) */
  eventsByDay: Partial<Record<DayKey, number>>
}

export function DayChipNav({ eventsByDay }: DayChipNavProps) {
  const router = useRouter()
  const params = useSearchParams()
  const pathname = usePathname()
  const active = (params.get('day') as DayKey | null) ?? 'mon'

  function selectDay(key: DayKey) {
    const next = new URLSearchParams(params.toString())
    next.set('day', key)
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {ORDER.map(({ key, label, date }) => {
        const isActive = active === key
        const count = eventsByDay[key] ?? 0
        return (
          <button
            key={key}
            type="button"
            onClick={() => selectDay(key)}
            className={
              `shrink-0 font-mono text-xs px-3 py-1.5 rounded-full whitespace-nowrap border transition-colors ` +
              (isActive
                ? 'border-[#FF6B35] text-[#FF6B35] bg-[#FF6B35]/10'
                : 'border-[#2A2A2A] text-[#A3A3A3] bg-[#111111] hover:border-[#555555]')
            }
          >
            {label} <span className="text-[#555555]">{date}</span>
            <span className="ml-1 text-[#555555]">({count})</span>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm test -- DayChipNav
```

- [ ] **Step 5: Commit**

```bash
git add components/DayChipNav.tsx __tests__/components/DayChipNav.test.tsx
git commit -m "feat(map): add DayChipNav with URL-driven active day"
```

---

## Task 7: `ViewToggle` component

**Files:**
- Create: `components/ViewToggle.tsx`
- Test: `__tests__/components/ViewToggle.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// __tests__/components/ViewToggle.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ViewToggle } from '../../components/ViewToggle'

const replace = vi.fn()
let params = new URLSearchParams()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => params,
  usePathname: () => '/events',
}))

describe('ViewToggle', () => {
  beforeEach(() => {
    replace.mockReset()
    params = new URLSearchParams()
  })

  it('renders Timeline and Map buttons; Timeline active by default', () => {
    render(<ViewToggle />)
    const timeline = screen.getByRole('button', { name: /Timeline/ })
    const map = screen.getByRole('button', { name: /Map/ })
    expect(timeline.getAttribute('aria-pressed')).toBe('true')
    expect(map.getAttribute('aria-pressed')).toBe('false')
  })

  it('marks Map active when ?view=map', () => {
    params = new URLSearchParams('view=map')
    render(<ViewToggle />)
    const map = screen.getByRole('button', { name: /Map/ })
    expect(map.getAttribute('aria-pressed')).toBe('true')
  })

  it('clicking Map calls router.replace with ?view=map, preserving day', () => {
    params = new URLSearchParams('day=wed')
    render(<ViewToggle />)
    fireEvent.click(screen.getByRole('button', { name: /Map/ }))
    expect(replace).toHaveBeenCalledWith('/events?day=wed&view=map', { scroll: false })
  })

  it('clicking Timeline removes ?view= from the URL', () => {
    params = new URLSearchParams('view=map&day=wed')
    render(<ViewToggle />)
    fireEvent.click(screen.getByRole('button', { name: /Timeline/ }))
    expect(replace).toHaveBeenCalledWith('/events?day=wed', { scroll: false })
  })
})
```

- [ ] **Step 2: Run — expect fail**

```bash
npm test -- ViewToggle
```

- [ ] **Step 3: Implement**

```tsx
// components/ViewToggle.tsx
'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'

type View = 'timeline' | 'map'

export function ViewToggle() {
  const router = useRouter()
  const params = useSearchParams()
  const pathname = usePathname()
  const active: View = params.get('view') === 'map' ? 'map' : 'timeline'

  function setView(next: View) {
    const updated = new URLSearchParams(params.toString())
    if (next === 'map') updated.set('view', 'map')
    else updated.delete('view')
    const qs = updated.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return (
    <div
      className="inline-flex rounded-md border border-[#2A2A2A] bg-[#111111] p-0.5"
      role="group"
      aria-label="View"
    >
      <button
        type="button"
        aria-pressed={active === 'timeline'}
        onClick={() => setView('timeline')}
        className={
          `font-mono text-xs px-3 py-1.5 rounded transition-colors ` +
          (active === 'timeline'
            ? 'bg-[#FF6B35] text-white'
            : 'text-[#A3A3A3] hover:text-[#FAFAFA]')
        }
      >
        Timeline
      </button>
      <button
        type="button"
        aria-pressed={active === 'map'}
        onClick={() => setView('map')}
        className={
          `font-mono text-xs px-3 py-1.5 rounded transition-colors ` +
          (active === 'map'
            ? 'bg-[#FF6B35] text-white'
            : 'text-[#A3A3A3] hover:text-[#FAFAFA]')
        }
      >
        Map
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm test -- ViewToggle
```

- [ ] **Step 5: Commit**

```bash
git add components/ViewToggle.tsx __tests__/components/ViewToggle.test.tsx
git commit -m "feat(map): add ViewToggle segmented control writing ?view= to URL"
```

---

## Task 8: `EventMapPopup` component

**Files:**
- Create: `components/EventMapPopup.tsx`

(No unit tests — used inside `mapbox-gl` popup portal which jsdom can't host meaningfully; visual smoke later.)

- [ ] **Step 1: Implement**

```tsx
// components/EventMapPopup.tsx
'use client'

import { haversineKm, walkingTimeMin } from '@/lib/geo'
import { formatEventTime } from '@/lib/events'
import type { Event } from '@/lib/types'

interface EventMapPopupProps {
  event: Event
  sameDayEvents: Event[]
  onOpenDetails: (eventId: string) => void
}

export function EventMapPopup({ event, sameDayEvents, onOpenDetails }: EventMapPopupProps) {
  const nearest = event.lat != null && event.lng != null
    ? sameDayEvents
        .filter((e) => e.id !== event.id && e.lat != null && e.lng != null)
        .map((e) => ({
          e,
          km: haversineKm(
            { lat: event.lat as number, lng: event.lng as number },
            { lat: e.lat as number, lng: e.lng as number },
          ),
        }))
        .sort((a, b) => a.km - b.km)
        .slice(0, 5)
    : []

  return (
    <div className="bg-[#111111] border border-[#1A1A1A] rounded-md p-3 text-[#FAFAFA] font-sans max-w-[280px]">
      <p className="font-mono text-sm font-bold mb-1">{event.title}</p>
      <p className="text-xs text-[#A3A3A3] mb-2">
        {event.host} · {formatEventTime(event.starts_at, event.ends_at)}
      </p>
      {event.neighborhood && (
        <p className="text-xs text-[#666666] mb-3">📍 {event.neighborhood}</p>
      )}
      <button
        type="button"
        onClick={() => onOpenDetails(event.id)}
        className="font-mono text-xs text-[#FF6B35] hover:underline"
      >
        Open details →
      </button>

      {nearest.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[#1A1A1A]">
          <p className="text-[10px] text-[#555555] uppercase tracking-widest mb-1.5">
            5 nearest same day
          </p>
          <ul className="space-y-1">
            {nearest.map(({ e, km }) => (
              <li key={e.id} className="text-xs">
                <button
                  type="button"
                  onClick={() => onOpenDetails(e.id)}
                  className="text-left text-[#A3A3A3] hover:text-[#FAFAFA]"
                >
                  {e.title}{' '}
                  <span className="text-[#555555]">
                    · {walkingTimeMin(km)} min walk
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add components/EventMapPopup.tsx
git commit -m "feat(map): add EventMapPopup with nearest-5-same-day list"
```

---

## Task 9: `EventMap` component

**Files:**
- Create: `components/EventMap.tsx`

**Background:** This is the largest single component. It owns: mapbox-gl initialization, GeoJSON source from the current day's events, popup rendering via React root portal, "Show all / My Plan only" toggle, empty-day overlay. No unit test (WebGL not available in jsdom).

**Pre-step research:** Before writing this, run `ls node_modules/next/dist/docs/` and check the `dynamic` doc — Next 16 may have updated the import signature (`next/dynamic` vs `import.next/dynamic`). The dynamic-import is done *inside* this file via `import('mapbox-gl')`, not via `next/dynamic` (which is for component trees, not libs). Parent `/events/page.tsx` will wrap **this component** in `next/dynamic({ ssr: false })`.

- [ ] **Step 1: Implement `components/EventMap.tsx`**

```tsx
// components/EventMap.tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { dayKeyForDate, type DayKey } from '@/lib/time'
import { MapTokenFallback } from '@/components/MapTokenFallback'
import { DayChipNav } from '@/components/DayChipNav'
import { EventMapPopup } from '@/components/EventMapPopup'
import { EventDetailModal } from '@/components/EventDetailModal'
import { usePlanStore } from '@/lib/plan-store'
import type { Event } from '@/lib/types'

const FORMAT_COLORS: Record<string, string> = {
  rooftop:   '#f59e0b', // amber
  dinner:    '#ef4444', // red
  panel:     '#3b82f6', // blue
  breakfast: '#22c55e', // green
  hackathon: '#a855f7', // purple
  workshop:  '#14b8a6', // teal
}
const DEFAULT_COLOR = '#A3A3A3'

interface EventMapProps {
  events: Event[]
  initialDay: DayKey
}

export function EventMap({ events, initialDay }: EventMapProps) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<unknown>(null) // mapboxgl.Map (typed loosely to avoid SSR-time import)
  const popupRootRef = useRef<Root | null>(null)
  const popupElRef = useRef<HTMLDivElement | null>(null)
  const [day, setDay] = useState<DayKey>(initialDay)
  const [showOnlyMyPlan, setShowOnlyMyPlan] = useState(false)
  const [modalEventId, setModalEventId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const planItemIds = usePlanStore((s) => s.items.map((i) => i.event_id))

  // Group events by day key (NYC time)
  const eventsByDay = useMemo(() => {
    const grouped: Record<DayKey, Event[]> = {
      sun: [], mon: [], tue: [], wed: [], thu: [], fri: [], sat: [],
    }
    for (const e of events) {
      const k = dayKeyForDate(new Date(e.starts_at))
      grouped[k].push(e)
    }
    return grouped
  }, [events])

  const eventsByDayCounts = useMemo(() => {
    return Object.fromEntries(
      Object.entries(eventsByDay).map(([k, v]) => [k, v.length])
    ) as Record<DayKey, number>
  }, [eventsByDay])

  const visibleEvents = useMemo(() => {
    const dayEvents = eventsByDay[day].filter(
      (e) => e.lat != null && e.lng != null
    )
    if (!showOnlyMyPlan) return dayEvents
    const setIds = new Set(planItemIds)
    return dayEvents.filter((e) => setIds.has(e.id))
  }, [eventsByDay, day, showOnlyMyPlan, planItemIds])

  const eventLookup = useMemo(() => {
    const m = new Map<string, Event>()
    for (const e of events) m.set(e.id, e)
    return m
  }, [events])

  const modalEvent = modalEventId ? eventLookup.get(modalEventId) : null

  // Init map once
  useEffect(() => {
    if (!token || !containerRef.current) return
    let cancelled = false
    let mapInstance: { remove?: () => void; on?: (...args: unknown[]) => void } | null = null

    import('mapbox-gl').then(async (mod) => {
      if (cancelled || !containerRef.current) return
      const mapboxgl = mod.default
      // CSS is needed for popups + controls
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
      popupRootRef.current?.unmount()
      popupRootRef.current = null
    }
  }, [token])

  // Update pin source whenever visibleEvents changes
  useEffect(() => {
    const map = mapRef.current as null | {
      isStyleLoaded: () => boolean
      on: (ev: string, cb: () => void) => void
      getSource: (id: string) => null | { setData: (data: unknown) => void }
      addSource: (id: string, src: unknown) => void
      addLayer: (layer: unknown) => void
      getLayer: (id: string) => unknown
      removeLayer: (id: string) => void
      removeSource: (id: string) => void
    }
    if (!map) return

    const featureCollection = {
      type: 'FeatureCollection',
      features: visibleEvents.map((e) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [e.lng as number, e.lat as number] },
        properties: {
          id: e.id,
          color: FORMAT_COLORS[e.format ?? ''] ?? DEFAULT_COLOR,
          isVirtuslab: e.is_virtuslab_event,
          isEditorsPick: e.is_editors_pick,
          title: e.title,
        },
      })),
    }

    const setOrAdd = () => {
      const existing = map.getSource('events')
      if (existing) {
        existing.setData(featureCollection)
      } else {
        map.addSource('events', { type: 'geojson', data: featureCollection, cluster: true, clusterRadius: 40 })
        map.addLayer({
          id: 'event-pins',
          type: 'circle',
          source: 'events',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-radius': ['case', ['==', ['get', 'isVirtuslab'], true], 10, 6],
            'circle-color': ['get', 'color'],
            'circle-stroke-color': '#0A0A0A',
            'circle-stroke-width': 2,
          },
        })
        map.addLayer({
          id: 'event-clusters',
          type: 'circle',
          source: 'events',
          filter: ['has', 'point_count'],
          paint: {
            'circle-radius': 14,
            'circle-color': '#FF6B35',
            'circle-stroke-color': '#0A0A0A',
            'circle-stroke-width': 2,
          },
        })
      }
    }

    if (map.isStyleLoaded()) setOrAdd()
    else map.on('load', setOrAdd)
  }, [visibleEvents])

  // Click handler — open popup
  useEffect(() => {
    const map = mapRef.current as null | {
      on: (ev: string, layer: string, cb: (e: unknown) => void) => void
    }
    if (!map) return
    let popup: { remove: () => void } | null = null

    const handler = async (mapEvent: unknown) => {
      const e = mapEvent as { features?: Array<{ properties: { id: string }; geometry: { coordinates: [number, number] } }> }
      const feature = e.features?.[0]
      if (!feature) return
      const event = eventLookup.get(feature.properties.id)
      if (!event) return

      const mapboxgl = (await import('mapbox-gl')).default
      popup?.remove()

      if (!popupElRef.current) {
        popupElRef.current = document.createElement('div')
      }
      if (!popupRootRef.current) {
        popupRootRef.current = createRoot(popupElRef.current)
      }
      popupRootRef.current.render(
        <EventMapPopup
          event={event}
          sameDayEvents={eventsByDay[dayKeyForDate(new Date(event.starts_at))]}
          onOpenDetails={(id) => {
            setModalEventId(id)
            popup?.remove()
          }}
        />
      )

      popup = new mapboxgl.Popup({ closeButton: true, offset: 12, className: 'nytw-popup' })
        .setLngLat(feature.geometry.coordinates)
        .setDOMContent(popupElRef.current)
        .addTo(mapRef.current as Parameters<typeof mapboxgl.Popup.prototype.addTo>[0])
    }

    map.on('click', 'event-pins', handler)
    return () => {
      popup?.remove()
    }
  }, [eventsByDay, eventLookup])

  if (!token) {
    return <MapTokenFallback />
  }
  if (loadError) {
    return <MapTokenFallback message={`Map failed to load: ${loadError}`} />
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <DayChipNav eventsByDay={eventsByDayCounts} />
        <label className="flex items-center gap-2 text-xs font-mono text-[#A3A3A3]">
          <input
            type="checkbox"
            checked={showOnlyMyPlan}
            onChange={(e) => setShowOnlyMyPlan(e.target.checked)}
            className="accent-[#FF6B35]"
          />
          Show only My Plan
        </label>
      </div>

      <div className="relative w-full h-[600px] rounded-md overflow-hidden border border-[#1A1A1A]">
        <div ref={containerRef} className="w-full h-full" />
        {visibleEvents.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-[#111111]/95 border border-[#1A1A1A] rounded-md px-4 py-3 text-center pointer-events-auto">
              <p className="font-mono text-sm text-[#A3A3A3]">
                {showOnlyMyPlan
                  ? 'No plan events on this day.'
                  : 'No events on this day.'}
              </p>
              <p className="text-xs text-[#666666] mt-1">Try another day →</p>
            </div>
          </div>
        )}
      </div>

      {modalEvent && (
        <EventDetailModal
          event={modalEvent}
          open={modalEvent !== null}
          onClose={() => setModalEventId(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Watch URL → state sync**

The component currently reads `initialDay` once. We also need it to react when `?day=` changes (because `DayChipNav` writes it). Wire that in by reading the URL and updating `day` state in a `useEffect`. Insert this block above the `useMemo(eventsByDay)`:

```tsx
import { useSearchParams } from 'next/navigation'
// inside the component:
const params = useSearchParams()
useEffect(() => {
  const d = params.get('day') as DayKey | null
  if (d && d !== day) setDay(d)
}, [params, day])
```

(Edit the file accordingly.)

- [ ] **Step 3: Run the test suite to be sure nothing broke**

```bash
npm test
```

Expected: existing tests still green; no new tests for this component.

- [ ] **Step 4: Visual smoke (manual)**

```bash
npm run dev
```

With `NEXT_PUBLIC_MAPBOX_TOKEN` set in `.env.local`: visit `/events?view=map&day=wed` after Task 10 wires the page. (For now, skip — we'll smoke at Task 10's end.)

- [ ] **Step 5: Commit**

```bash
git add components/EventMap.tsx
git commit -m "feat(map): add EventMap with dynamic mapbox-gl + popup + plan filter"
```

---

## Task 10: Wire `EventMap` into `/events` page

**Files:**
- Modify: `app/events/page.tsx`

**Background:** Page receives `searchParams` (Promise in Next 16); resolves `view` and `day`. When `view=map`, renders `<EventMap />` (loaded via `next/dynamic` with `ssr: false`); otherwise renders existing `<EventList />`. `<ViewToggle />` always visible at the top.

- [ ] **Step 1: Verify Next 16 `searchParams` API**

```bash
ls node_modules/next/dist/docs/ | grep -i search-params 2>/dev/null
```

Confirm whether `searchParams` is sync or async. In Next 15+/16 it's `Promise<{[key: string]: string | string[] | undefined}>`. The code below assumes async.

- [ ] **Step 2: Edit `app/events/page.tsx`**

```tsx
// app/events/page.tsx
import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/server'
import { EventList } from '@/components/EventList'
import { ViewToggle } from '@/components/ViewToggle'
import type { Event } from '@/lib/types'
import type { DayKey } from '@/lib/time'
import { dayKeyForDate, festivalMode, nowInNYC } from '@/lib/time'
import seedEvents from '@/data/seed-events.json' with { type: 'json' }

const EventMap = dynamic(() => import('@/components/EventMap').then((m) => m.EventMap), {
  ssr: false,
  loading: () => (
    <div className="min-h-[400px] bg-[#111111] border border-[#1A1A1A] rounded-md flex items-center justify-center">
      <p className="font-mono text-sm text-[#A3A3A3]">Loading map…</p>
    </div>
  ),
})

export const metadata: Metadata = {
  title: "Browse Events — NYTW Engineer's Companion",
  description: '87 hand-curated engineering events for Tech Week NYC 2026. Day-grouped timeline with instant search.',
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

interface EventsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function EventsPage({ searchParams }: EventsPageProps) {
  const events = await fetchEvents()
  const sp = await searchParams
  const view = sp.view === 'map' ? 'map' : 'timeline'
  const dayParam = typeof sp.day === 'string' ? sp.day : undefined
  const initialDay = resolveDay(dayParam)

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-[#FAFAFA]">
      <div className="max-w-5xl mx-auto px-6 py-4 border-b border-[#1A1A1A] flex items-center justify-between gap-4 flex-wrap">
        <p className="text-[#A3A3A3] text-xs font-mono">
          {events.length} curated events · Tech Week NYC 2026 · June 1–7
        </p>
        <ViewToggle />
      </div>
      <div className="max-w-5xl mx-auto px-6 py-8">
        {view === 'map' ? (
          <EventMap events={events} initialDay={initialDay} />
        ) : (
          <EventList events={events} />
        )}
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Run lint + tests**

```bash
npm run lint && npm test
```

Expected: green.

- [ ] **Step 4: Visual smoke**

```bash
npm run dev
```

- Visit `/events` (Timeline view loads as before).
- Click "Map" in toggle → URL becomes `/events?view=map`, map renders.
- If `NEXT_PUBLIC_MAPBOX_TOKEN` is empty in `.env.local`: `MapTokenFallback` renders instead.
- Click day chips → URL changes; pins update.
- Click a pin → popup → "Open details" → existing `EventDetailModal` opens.
- Toggle "Show only My Plan" → only plan pins visible.

Stop dev server.

- [ ] **Step 5: Commit**

```bash
git add app/events/page.tsx
git commit -m "feat(events): wire ViewToggle + EventMap into /events page"
```

---

## Task 11: `StaticMapImage` component

**Files:**
- Create: `components/StaticMapImage.tsx`

(No unit test — thin wrapper around `staticMapUrl()` which is tested.)

- [ ] **Step 1: Implement**

```tsx
// components/StaticMapImage.tsx
import { staticMapUrl } from '@/lib/geo'

interface StaticMapImageProps {
  lat: number
  lng: number
  zoom?: number
  width?: number
  height?: number
  alt?: string
  className?: string
}

export function StaticMapImage({
  lat,
  lng,
  zoom = 14,
  width = 400,
  height = 200,
  alt = 'Venue location',
  className = '',
}: StaticMapImageProps) {
  const url = staticMapUrl({ lat, lng, zoom, width, height })
  if (!url) {
    return (
      <div
        className={`bg-[#111111] border border-[#1A1A1A] rounded-md flex items-center justify-center text-[#666666] text-xs font-mono ${className}`}
        style={{ width, height }}
      >
        Map disabled
      </div>
    )
  }
  // Plain <img> — Mapbox Static API is external, no need for Next/Image optimization here.
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={url}
      alt={alt}
      width={width}
      height={height}
      className={`rounded-md border border-[#1A1A1A] ${className}`}
    />
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/StaticMapImage.tsx
git commit -m "feat(map): add StaticMapImage wrapper for Mapbox Static API"
```

---

## Task 12: `StatusPickerInline` component

**Files:**
- Create: `components/StatusPickerInline.tsx`
- Test: `__tests__/components/StatusPickerInline.test.tsx`

**Background:** Six statuses per `PlanStatus`. Renders as a compact segmented row. Writes via `usePlanStore.updateStatus`. Replaced by Phase 4's rich `StatusToggle` later.

- [ ] **Step 1: Write failing tests**

```tsx
// __tests__/components/StatusPickerInline.test.tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StatusPickerInline } from '../../components/StatusPickerInline'
import { usePlanStore } from '../../lib/plan-store'

describe('StatusPickerInline', () => {
  beforeEach(() => {
    usePlanStore.getState().clear()
    usePlanStore.getState().addItem('event-1', 'interested', 'manual')
  })

  it('renders all six statuses', () => {
    render(<StatusPickerInline eventId="event-1" />)
    for (const label of ['Interested', 'RSVPed', 'Confirmed', 'Waitlist', 'Declined', 'Attended']) {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument()
    }
  })

  it('highlights the current status', () => {
    render(<StatusPickerInline eventId="event-1" />)
    const interested = screen.getByRole('button', { name: /Interested/ })
    expect(interested.getAttribute('aria-pressed')).toBe('true')
  })

  it('clicking a status updates the plan store', () => {
    render(<StatusPickerInline eventId="event-1" />)
    fireEvent.click(screen.getByRole('button', { name: /Declined/ }))
    expect(usePlanStore.getState().items[0].status).toBe('declined')
  })

  it('returns null when the event is not in the plan', () => {
    const { container } = render(<StatusPickerInline eventId="missing" />)
    expect(container.firstChild).toBeNull()
  })
})
```

- [ ] **Step 2: Run — expect fail**

```bash
npm test -- StatusPickerInline
```

- [ ] **Step 3: Implement**

```tsx
// components/StatusPickerInline.tsx
'use client'

import { usePlanStore } from '@/lib/plan-store'
import type { PlanStatus } from '@/lib/types'

const STATUSES: { value: PlanStatus; label: string }[] = [
  { value: 'interested',   label: 'Interested' },
  { value: 'rsvp_pending', label: 'RSVPed' },
  { value: 'confirmed',    label: 'Confirmed' },
  { value: 'waitlist',     label: 'Waitlist' },
  { value: 'declined',     label: 'Declined' },
  { value: 'attended',     label: 'Attended' },
]

interface StatusPickerInlineProps {
  eventId: string
}

export function StatusPickerInline({ eventId }: StatusPickerInlineProps) {
  const item = usePlanStore((s) => s.items.find((i) => i.event_id === eventId))
  const updateStatus = usePlanStore((s) => s.updateStatus)

  if (!item) return null

  return (
    <div
      className="inline-flex flex-wrap gap-1 rounded-md border border-[#2A2A2A] bg-[#111111] p-1"
      role="group"
      aria-label="Update status"
    >
      {STATUSES.map(({ value, label }) => {
        const active = item.status === value
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => updateStatus(eventId, value)}
            className={
              `font-mono text-[10px] px-2 py-1 rounded transition-colors ` +
              (active
                ? 'bg-[#FF6B35] text-white'
                : 'text-[#A3A3A3] hover:text-[#FAFAFA]')
            }
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm test -- StatusPickerInline
```

- [ ] **Step 5: Commit**

```bash
git add components/StatusPickerInline.tsx __tests__/components/StatusPickerInline.test.tsx
git commit -m "feat(plan): add StatusPickerInline minimal status writer"
```

---

## Task 13: `CountdownCard` component

**Files:**
- Create: `components/CountdownCard.tsx`
- Test: `__tests__/components/CountdownCard.test.tsx`

**Background:** Pre-festival `/now` state. Shows countdown + "Day 1 preview" of plan events on June 1, falling back to top 3 Editor's Picks if plan empty for that day.

- [ ] **Step 1: Write failing tests**

```tsx
// __tests__/components/CountdownCard.test.tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CountdownCard } from '../../components/CountdownCard'
import { usePlanStore } from '../../lib/plan-store'
import type { Event } from '../../lib/types'

const mkEvent = (id: string, starts_at: string, extras: Partial<Event> = {}): Event => ({
  id, title: id.toUpperCase(), description: '', host: '', starts_at,
  ends_at: starts_at, venue_name: null, address: null, lat: null, lng: null,
  neighborhood: null, rsvp_url: '', rsvp_platform: 'other', tags: [],
  audience_tags: [], format: null, capacity: null, is_invite_only: false,
  has_free_food: false, has_free_drinks: false, is_editors_pick: false,
  editors_pick_blurb: null, is_virtuslab_event: false, source: '',
  source_url: '', created_at: '', updated_at: '',
  ...extras,
})

describe('CountdownCard', () => {
  beforeEach(() => {
    usePlanStore.getState().clear()
  })

  it('shows countdown to June 1 from a pre-festival now', () => {
    const now = new Date('2026-05-20T12:00:00Z') // 12 days out
    render(<CountdownCard now={now} events={[]} />)
    expect(screen.getByText(/Tech Week starts in/i)).toBeInTheDocument()
    expect(screen.getByText(/12 days/i)).toBeInTheDocument()
  })

  it('shows Day 1 plan preview when plan has June 1 events', () => {
    const e = mkEvent('e1', '2026-06-01T18:00:00Z')
    usePlanStore.getState().addItem('e1')
    render(<CountdownCard now={new Date('2026-05-20T12:00:00Z')} events={[e]} />)
    expect(screen.getByText(/E1/)).toBeInTheDocument()
    expect(screen.getByText(/From your plan/i)).toBeInTheDocument()
  })

  it('falls back to Editor’s Picks when no plan items on Day 1', () => {
    const pick = mkEvent('p1', '2026-06-03T18:00:00Z', { is_editors_pick: true })
    render(<CountdownCard now={new Date('2026-05-20T12:00:00Z')} events={[pick]} />)
    expect(screen.getByText(/P1/)).toBeInTheDocument()
    expect(screen.getByText(/Editor’s Picks/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — expect fail**

```bash
npm test -- CountdownCard
```

- [ ] **Step 3: Implement**

```tsx
// components/CountdownCard.tsx
'use client'

import { festivalWindow, msUntil, dayKeyForDate } from '@/lib/time'
import { formatEventTime } from '@/lib/events'
import { usePlanStore } from '@/lib/plan-store'
import type { Event } from '@/lib/types'

interface CountdownCardProps {
  now: Date
  events: Event[]
}

export function CountdownCard({ now, events }: CountdownCardProps) {
  const items = usePlanStore((s) => s.items)
  const { start } = festivalWindow()
  const { days, hours, mins } = msUntil(start, now)

  const day1Events = events.filter((e) => dayKeyForDate(new Date(e.starts_at)) === 'mon')
  const planSet = new Set(items.map((i) => i.event_id))
  const planDay1 = day1Events.filter((e) => planSet.has(e.id))

  const showPlan = planDay1.length > 0
  const preview = showPlan
    ? planDay1.slice(0, 3)
    : events.filter((e) => e.is_editors_pick).slice(0, 3)

  return (
    <div className="bg-[#111111] border border-[#1A1A1A] rounded-md p-6 space-y-5">
      <div>
        <p className="text-xs font-mono text-[#666666] uppercase tracking-widest mb-1">
          Pre-festival
        </p>
        <p className="font-mono text-2xl font-bold text-[#FF6B35]">
          Tech Week starts in {days} days, {hours}h {mins}m
        </p>
        <p className="text-sm text-[#A3A3A3] mt-1">Monday June 1, 2026 · New York City</p>
      </div>

      <div>
        <p className="text-xs font-mono text-[#A3A3A3] uppercase tracking-widest mb-3">
          {showPlan ? 'From your plan · Day 1' : 'Editor’s Picks · Day 1 preview'}
        </p>
        {preview.length === 0 ? (
          <p className="text-sm text-[#666666]">No events queued yet. Browse to start →</p>
        ) : (
          <ul className="space-y-2">
            {preview.map((e) => (
              <li key={e.id} className="text-sm">
                <p className="font-mono text-[#FAFAFA]">{e.title}</p>
                <p className="text-xs text-[#666666]">
                  {e.host} · {formatEventTime(e.starts_at, e.ends_at)}
                  {e.neighborhood ? ` · ${e.neighborhood}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm test -- CountdownCard
```

- [ ] **Step 5: Commit**

```bash
git add components/CountdownCard.tsx __tests__/components/CountdownCard.test.tsx
git commit -m "feat(now): add CountdownCard with Day 1 plan preview fallback"
```

---

## Task 14: `NextUpCard` component

**Files:**
- Create: `components/NextUpCard.tsx`
- Test: `__tests__/components/NextUpCard.test.tsx`

**Background:** During festival. Renders a single "next up in plan within 2h" event with travel time (if geo opted in), "Open in Maps" deep link (platform-aware), inline status picker, and "Skip" (sets `declined`).

- [ ] **Step 1: Write failing tests**

```tsx
// __tests__/components/NextUpCard.test.tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NextUpCard } from '../../components/NextUpCard'
import { usePlanStore } from '../../lib/plan-store'
import type { Event } from '../../lib/types'

const event: Event = {
  id: 'e1',
  title: 'OpenAI Rooftop',
  description: '',
  host: 'OpenAI',
  starts_at: '2026-06-03T22:30:00Z', // 18:30 EDT
  ends_at: '2026-06-04T01:00:00Z',
  venue_name: 'Some Roof',
  address: '123 Main St, Brooklyn, NY',
  lat: 40.7081, lng: -73.9571,
  neighborhood: 'Williamsburg',
  rsvp_url: '', rsvp_platform: 'other',
  tags: [], audience_tags: [], format: 'rooftop', capacity: null,
  is_invite_only: false, has_free_food: false, has_free_drinks: false,
  is_editors_pick: false, editors_pick_blurb: null, is_virtuslab_event: false,
  source: '', source_url: '', created_at: '', updated_at: '',
}

describe('NextUpCard', () => {
  beforeEach(() => {
    usePlanStore.getState().clear()
    usePlanStore.getState().addItem('e1', 'interested', 'manual')
  })

  it('renders title, host, and time-until', () => {
    const now = new Date('2026-06-03T22:00:00Z') // 30 min before
    render(<NextUpCard event={event} now={now} geo={null} />)
    expect(screen.getByText(/OpenAI Rooftop/)).toBeInTheDocument()
    expect(screen.getByText(/OpenAI/)).toBeInTheDocument()
    expect(screen.getByText(/Starts in 30 min/)).toBeInTheDocument()
  })

  it('shows travel time when geo is provided', () => {
    const now = new Date('2026-06-03T22:00:00Z')
    render(<NextUpCard event={event} now={now} geo={{ lat: 40.7411, lng: -73.9897 }} />)
    expect(screen.getByText(/min Uber/i)).toBeInTheDocument()
  })

  it('"Open in Maps" link points to a maps URL containing the address', () => {
    render(<NextUpCard event={event} now={new Date('2026-06-03T22:00:00Z')} geo={null} />)
    const link = screen.getByRole('link', { name: /Open in Maps/i })
    expect(link.getAttribute('href')).toMatch(/123 Main St/)
  })

  it('"Skip this event" sets status to declined', () => {
    render(<NextUpCard event={event} now={new Date('2026-06-03T22:00:00Z')} geo={null} />)
    fireEvent.click(screen.getByRole('button', { name: /Skip this event/i }))
    expect(usePlanStore.getState().items[0].status).toBe('declined')
  })
})
```

- [ ] **Step 2: Run — expect fail**

```bash
npm test -- NextUpCard
```

- [ ] **Step 3: Implement**

```tsx
// components/NextUpCard.tsx
'use client'

import { formatEventTime } from '@/lib/events'
import { haversineKm, uberTimeMin, walkingTimeMin } from '@/lib/geo'
import { msUntil } from '@/lib/time'
import { usePlanStore } from '@/lib/plan-store'
import { Button } from '@/components/ui/button'
import { StatusPickerInline } from '@/components/StatusPickerInline'
import { StaticMapImage } from '@/components/StaticMapImage'
import type { Event } from '@/lib/types'
import type { LatLng } from '@/lib/geo'

interface NextUpCardProps {
  event: Event
  now: Date
  geo: LatLng | null
}

function mapsHref(event: Event): string {
  const query = encodeURIComponent(event.address ?? event.venue_name ?? `${event.lat},${event.lng}`)
  return `https://maps.google.com/?q=${query}`
}

function untilLabel(now: Date, target: Date): string {
  const { days, hours, mins } = msUntil(target, now)
  if (days > 0) return `Starts in ${days}d ${hours}h`
  if (hours > 0) return `Starts in ${hours}h ${mins}m`
  return `Starts in ${mins} min`
}

export function NextUpCard({ event, now, geo }: NextUpCardProps) {
  const updateStatus = usePlanStore((s) => s.updateStatus)

  const km = geo && event.lat != null && event.lng != null
    ? haversineKm(geo, { lat: event.lat, lng: event.lng })
    : null

  function handleSkip() {
    updateStatus(event.id, 'declined')
  }

  return (
    <div className="bg-[#111111] border border-[#1A1A1A] rounded-md p-6 space-y-5">
      <div>
        <p className="text-xs font-mono text-[#666666] uppercase tracking-widest mb-1">
          Next up
        </p>
        <p className="font-mono text-xl font-bold text-[#FAFAFA]">{event.title}</p>
        <p className="text-sm text-[#A3A3A3] mt-1">
          {event.host} · {formatEventTime(event.starts_at, event.ends_at)}
        </p>
        <p className="font-mono text-base text-[#FF6B35] mt-2">
          {untilLabel(now, new Date(event.starts_at))}
        </p>
      </div>

      {event.address && (
        <p className="text-sm text-[#A3A3A3]">📍 {event.address}</p>
      )}

      {km !== null && (
        <p className="text-sm text-[#A3A3A3]">
          ~{uberTimeMin(km)} min Uber · {walkingTimeMin(km)} min walk
        </p>
      )}

      {event.lat != null && event.lng != null && (
        <StaticMapImage lat={event.lat} lng={event.lng} width={600} height={200} />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <a
          href={mapsHref(event)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-md bg-[#FF6B35] hover:bg-[#e85a25] text-white font-mono text-sm px-4 py-2"
        >
          Open in Maps →
        </a>
        <Button
          variant="outline"
          className="border-[#333333] text-[#A3A3A3] hover:bg-[#1A1A1A] font-mono"
          onClick={handleSkip}
        >
          Skip this event
        </Button>
      </div>

      <StatusPickerInline eventId={event.id} />
    </div>
  )
}
```

Note: "Open in Maps" is rendered as a styled `<a>` rather than `<Button asChild/>` to sidestep the `asChild` vs `render={<a/>}` ambiguity. The visual styling matches the primary button via Tailwind classes.

- [ ] **Step 4: Run tests — expect pass**

```bash
npm test -- NextUpCard
```

- [ ] **Step 5: Commit**

```bash
git add components/NextUpCard.tsx __tests__/components/NextUpCard.test.tsx
git commit -m "feat(now): add NextUpCard with travel time + status picker"
```

---

## Task 15: `AfterThisCard` and `SuggestionsCard` components

**Files:**
- Create: `components/AfterThisCard.tsx`
- Create: `components/SuggestionsCard.tsx`

(No unit tests — simple list renderers; covered indirectly by `NowClient` visual smoke.)

- [ ] **Step 1: Implement `AfterThisCard`**

```tsx
// components/AfterThisCard.tsx
'use client'

import { formatEventTime } from '@/lib/events'
import type { Event } from '@/lib/types'

interface AfterThisCardProps {
  event: Event | null
}

export function AfterThisCard({ event }: AfterThisCardProps) {
  if (!event) return null
  return (
    <div className="bg-[#0F0F0F] border border-[#1A1A1A] rounded-md p-4">
      <p className="text-[10px] font-mono text-[#666666] uppercase tracking-widest mb-1">
        After this
      </p>
      <p className="font-mono text-sm text-[#FAFAFA]">{event.title}</p>
      <p className="text-xs text-[#A3A3A3] mt-0.5">
        {event.host} · {formatEventTime(event.starts_at, event.ends_at)}
        {event.neighborhood ? ` · ${event.neighborhood}` : ''}
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Implement `SuggestionsCard`**

```tsx
// components/SuggestionsCard.tsx
'use client'

import { formatEventTime } from '@/lib/events'
import type { Event } from '@/lib/types'

interface SuggestionsCardProps {
  suggestions: Event[]
  fromPlan: boolean
}

export function SuggestionsCard({ suggestions, fromPlan }: SuggestionsCardProps) {
  return (
    <div className="bg-[#111111] border border-[#1A1A1A] rounded-md p-5">
      <p className="text-xs font-mono text-[#666666] uppercase tracking-widest mb-3">
        {fromPlan ? 'Nothing planned next 2h — later today' : 'Plan is light — try one of these'}
      </p>
      {suggestions.length === 0 ? (
        <p className="text-sm text-[#666666]">No suggestions available.</p>
      ) : (
        <ul className="space-y-3">
          {suggestions.map((e) => (
            <li key={e.id}>
              <p className="font-mono text-sm text-[#FAFAFA]">{e.title}</p>
              <p className="text-xs text-[#A3A3A3]">
                {e.host} · {formatEventTime(e.starts_at, e.ends_at)}
                {e.neighborhood ? ` · ${e.neighborhood}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/AfterThisCard.tsx components/SuggestionsCard.tsx
git commit -m "feat(now): add AfterThisCard + SuggestionsCard secondary widgets"
```

---

## Task 16: `RetroCard` component

**Files:**
- Create: `components/RetroCard.tsx`

(No test — simple presentational.)

- [ ] **Step 1: Implement**

```tsx
// components/RetroCard.tsx
'use client'

import { usePlanStore } from '@/lib/plan-store'

export function RetroCard() {
  const items = usePlanStore((s) => s.items)
  const attended = items.filter((i) => i.status === 'attended').length
  const confirmed = items.filter((i) => i.status === 'confirmed').length

  return (
    <div className="bg-[#111111] border border-[#1A1A1A] rounded-md p-6 space-y-4">
      <p className="text-xs font-mono text-[#666666] uppercase tracking-widest">
        Post-festival
      </p>
      <p className="font-mono text-2xl font-bold text-[#FAFAFA]">Tech Week wrapped.</p>
      <p className="text-sm text-[#A3A3A3]">
        You had {items.length} events in your plan
        {attended > 0 ? ` · ${attended} marked attended` : ''}
        {confirmed > 0 ? ` · ${confirmed} confirmed` : ''}.
      </p>
      <p className="text-sm text-[#666666]">
        Your full plan retro view is coming in the next release.
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/RetroCard.tsx
git commit -m "feat(now): add RetroCard for post-festival state"
```

---

## Task 17: `NowClient` orchestrator

**Files:**
- Create: `components/NowClient.tsx`

**Background:** Hosts the 1-minute clock, opt-in geolocation, plan-store hydration gate, and routes to `CountdownCard` / `NextUpCard` / `RetroCard` based on `festivalMode(now)`.

- [ ] **Step 1: Implement**

```tsx
// components/NowClient.tsx
'use client'

import { useEffect, useState } from 'react'
import { festivalMode, nextEventInPlan, nowInNYC } from '@/lib/time'
import { usePlanStore } from '@/lib/plan-store'
import { CountdownCard } from '@/components/CountdownCard'
import { NextUpCard } from '@/components/NextUpCard'
import { AfterThisCard } from '@/components/AfterThisCard'
import { SuggestionsCard } from '@/components/SuggestionsCard'
import { RetroCard } from '@/components/RetroCard'
import { Button } from '@/components/ui/button'
import type { Event } from '@/lib/types'
import type { LatLng } from '@/lib/geo'

interface NowClientProps {
  events: Event[]
}

export function NowClient({ events }: NowClientProps) {
  const [mounted, setMounted] = useState(false)
  const [now, setNow] = useState<Date>(() => nowInNYC())
  const [geo, setGeo] = useState<LatLng | null>(null)
  const [geoError, setGeoError] = useState<string | null>(null)
  const items = usePlanStore((s) => s.items)

  // Hydration gate — same pattern as MyPlanWidget
  useEffect(() => {
    setMounted(true)
  }, [])

  // 1-minute clock
  useEffect(() => {
    const id = setInterval(() => setNow(nowInNYC()), 60_000)
    return () => clearInterval(id)
  }, [])

  function requestGeo() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoError('Geolocation not supported')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGeoError(null)
      },
      (err) => setGeoError(err.message),
      { enableHighAccuracy: false, maximumAge: 5 * 60_000, timeout: 10_000 },
    )
  }

  if (!mounted) {
    return (
      <div className="bg-[#111111] border border-[#1A1A1A] rounded-md p-6">
        <p className="font-mono text-sm text-[#666666]">Loading…</p>
      </div>
    )
  }

  const mode = festivalMode(now)

  if (mode === 'pre') {
    return (
      <div className="space-y-4">
        <CountdownCard now={now} events={events} />
      </div>
    )
  }

  if (mode === 'post') {
    return (
      <div className="space-y-4">
        <RetroCard />
      </div>
    )
  }

  // mode === 'in'
  const upcoming = nextEventInPlan(items, events, now, 2)
  const afterThis = upcoming
    ? nextEventInPlan(items, events, new Date(upcoming.starts_at), 24)
    : null

  // Suggestions = today's plan events later than `now`; fallback to editor's picks
  const todayKey = upcoming
    ? new Date(upcoming.starts_at).toISOString().slice(0, 10)
    : new Date(now).toISOString().slice(0, 10)
  const planSet = new Set(items.filter((i) => i.status !== 'declined').map((i) => i.event_id))
  const laterToday = events
    .filter(
      (e) =>
        new Date(e.starts_at) > now &&
        e.starts_at.startsWith(todayKey) &&
        planSet.has(e.id),
    )
    .slice(0, 3)
  const editorsPicks = events.filter((e) => e.is_editors_pick).slice(0, 3)
  const suggestions = laterToday.length > 0 ? laterToday : editorsPicks
  const suggestionsFromPlan = laterToday.length > 0

  return (
    <div className="space-y-4">
      {upcoming ? (
        <>
          <NextUpCard event={upcoming} now={now} geo={geo} />
          <AfterThisCard event={afterThis} />
        </>
      ) : (
        <SuggestionsCard suggestions={suggestions} fromPlan={suggestionsFromPlan} />
      )}

      {!geo && !geoError && (
        <Button
          variant="outline"
          className="border-[#333333] text-[#A3A3A3] hover:bg-[#1A1A1A] font-mono"
          onClick={requestGeo}
        >
          Enable location for travel times →
        </Button>
      )}
      {geoError && (
        <p className="text-xs text-[#666666] font-mono">
          Location unavailable — addresses shown without travel times.
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/NowClient.tsx
git commit -m "feat(now): add NowClient orchestrator with clock + geo + festival mode routing"
```

---

## Task 18: `/now` page

**Files:**
- Create: `app/now/page.tsx`

- [ ] **Step 1: Implement**

```tsx
// app/now/page.tsx
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { NowClient } from '@/components/NowClient'
import type { Event } from '@/lib/types'
import seedEvents from '@/data/seed-events.json' with { type: 'json' }

export const metadata: Metadata = {
  title: "Now — NYTW Engineer's Companion",
  description: "What's next in your Tech Week plan.",
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

export default async function NowPage() {
  const events = await fetchEvents()

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-[#FAFAFA]">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="font-mono text-lg font-bold text-[#FAFAFA] mb-6">/now</h1>
        <NowClient events={events} />
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Run lint + tests**

```bash
npm run lint && npm test
```

Expected: green.

- [ ] **Step 3: Visual smoke**

```bash
npm run dev
```

- Visit `/now`. Today is pre-festival → `CountdownCard` renders with countdown to June 1 and Day 1 preview from Editor's Picks (or plan if you've added Monday events).
- Click "Enable location for travel times" — browser prompts.
- Resize window to <md → SiteNav becomes hamburger.

Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add app/now/page.tsx
git commit -m "feat(now): add /now page rendering NowClient with festival-mode routing"
```

---

## Task 19: Full smoke + checklist commit

**Files:** none changed; this task verifies the whole phase.

- [ ] **Step 1: Run the entire test suite**

```bash
npm test
```

Expected: every test passes — Phase 1, Phase 2, and the new Phase 3 suites.

- [ ] **Step 2: Lint + typecheck**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: clean build. Address any Next 16 RSC / dynamic warnings inline.

- [ ] **Step 4: Manual acceptance**

Run `npm run dev` and walk the v1.3 acceptance script from SPEC.md:

- Desktop:
  - `/events` opens to timeline. ViewToggle visible.
  - Click "Map" → URL becomes `/events?view=map`. Map loads (or `MapTokenFallback` if no token).
  - Click Wed chip → `?day=wed` in URL; pins update.
  - Click a Williamsburg pin → popup shows 5 nearest same-day events with walk time.
  - Click "Open details" in popup → existing EventDetailModal opens. "Open RSVP →" works.
- Mobile (resize to <768px):
  - SiteNav becomes hamburger; sheet opens.
  - "Now" link works. `/now` shows `CountdownCard`.
- Map without token:
  - In `.env.local`, blank `NEXT_PUBLIC_MAPBOX_TOKEN`. Restart. `/events?view=map` shows `MapTokenFallback`.

- [ ] **Step 5: Final commit (if anything fixed during smoke)**

If smoke found a small bug, commit the fix as its own commit with a message describing the symptom and fix. Otherwise skip this step.

```bash
# Example, only if fix needed:
git add <file>
git commit -m "fix(<scope>): <symptom> — <one-line cause>"
```

---

## Done criteria (matches design's Definition of Done)

- [ ] `/events?view=map&day=wed` renders Mapbox pins for Wednesday events (or `MapTokenFallback` without a token).
- [ ] ViewToggle switches between timeline and map without re-fetching events.
- [ ] Day chip nav writes the URL; deep links are shareable.
- [ ] Pin click → popup → "Open details" opens the existing `EventDetailModal`.
- [ ] "Show only My Plan" filter on the map.
- [ ] `/now` shows `CountdownCard` pre-festival; `NextUpCard` logic is unit-tested.
- [ ] "Open in Maps" produces a working URL.
- [ ] `SiteNav` rendered sitewide; old `/events` inline nav removed.
- [ ] `lib/geo.ts` + `lib/time.ts` additions are pure and tested.
- [ ] `npm test` green; `npm run lint` clean; `npm run build` succeeds.

---

## Out-of-scope reminders (do NOT pull in)

- Real `StatusToggle` UI (Phase 4).
- `/my-plan`, `/plan`, `/beyond`, `/about` page implementations (renders as "Coming soon" in `SiteNav`).
- iCal feed, conflict warnings, `MyPlanMap` (Phase 4).
- AI Concierge, magic link recovery (Phase 5).
- Filter drawer, clickable tag chips (Phase 6).
- PWA service worker, install prompt (Phase 8).
- Playwright e2e (Phase 9).
- `/events` mobile bottom-sheet "now/next hour" (spec line 414) — explicitly deferred.
