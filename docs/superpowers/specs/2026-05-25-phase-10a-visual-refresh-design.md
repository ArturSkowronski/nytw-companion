# Phase 10a — Visual refresh (Design)

**Status:** Draft for review
**Date:** 2026-05-25
**Author:** brainstorming session (collaborator: Artur Skowroński)
**Source design:** Claude Design handoff bundle `new-york-tech-week-companion` (Bricolage Grotesque + Inter Tight + JetBrains Mono editorial-meets-terminal direction)
**Predecessor:** Phase 9a — pre-launch QA (shipped, CI fully green 2026-05-25)
**Successor:** Phase 8b — Vercel deploy (in progress; this refresh ships into the same repo, Vercel auto-redeploys)

---

## North Star

Adopt the editorial-meets-terminal direction from the Claude Design handoff while honoring the user's chat-transcript feedback ("too much typography") — keep JetBrains Mono as the sole font (no Bricolage Grotesque, no Inter Tight). Bring over the design's color tokens, the numbered §-section heads pattern, the editorial event-row layout, and the tabbed nav with custom mark. Preserve every existing test and the three Playwright E2E flows.

## Scope

Four slices, each commits independently:

1. **Color token sweep** — bump every hex literal to the design's palette (`#0A0A0A`→`#000`, `#FF6B35`→`#FF5B25`, `#A3A3A3`→`#9B9B9B`, etc.). Sync up with our Phase 9a a11y bumps.
2. **`<SectionHead>` pattern** — new reusable component with `§ NN` numbered grid; wire into landing, /about, /beyond, /privacy, /terms, /events.
3. **Editorial event row list** — refactor `EventCard` from card to row (time | body | meta | add-button); day headers get the numbered §-style grid. Touches `EventList`, `MyPlanEventCard`.
4. **Tabbed nav with custom mark** — rewrite `SiteNav` with `§§` brand mark + tabbed nav; add new `<StatusBar />` component above with live festival mode + time.

**Out of scope** (explicit):

- Bricolage Grotesque + Inter Tight fonts (user said "too much typography")
- Mega "87" hero
- Live ticker / marquee
- Theme switcher (ink/paper)
- Accent color swap (orange/cyan/lime/pink/red)
- Tweaks panel
- 3-up Editor's Picks grid (existing carousel stays)
- Light mode

---

## Pre-flight: codebase reality

- Phase 9a fully green CI: lint+test, E2E (3 specs), Lighthouse (informational).
- Phase 9a a11y bump: `#555555`/`#666666` → `#737373`/`#7A7A7A` for AA contrast. Will be re-collapsed to `#9B9B9B` in this refresh (5.7:1 ratio on `#000` — still passes AA).
- `lib/time.ts` already exports `festivalMode(date)` returning `'pre' | 'during' | 'post'` — re-used by new StatusBar.
- `EventCard` has `data-testid="event-card"` (added in Phase 9a Task 2) — preserved.
- `SiteNav` already has Beyond + About flipped to `live: true`. My Plan is still `live: false`; this refresh flips it.
- No existing test asserts on hex values directly — color sweep is safe.

---

## Section 1 — Color token sweep

### Hex-to-hex mapping

| Role | Before | After | Notes |
|---|---|---|---|
| Background | `#0A0A0A` | `#000000` | Pure black |
| Surface | `#111111` | `#0B0B0B` | Card/drawer bg |
| Border (primary) | `#1A1A1A` | `#1A1A1A` | Unchanged |
| Border (secondary) | `#2A2A2A` | `#262626` | Slightly tighter |
| Border (tertiary) | `#333333` | `#333333` | Unchanged |
| Text (primary) | `#FAFAFA` | `#F5F5F5` | Slight off-white |
| Text (dim) | `#A3A3A3` | `#9B9B9B` | 5.7:1 on `#000` (passes AA) |
| Text (muted) | `#737373` (Phase 9a) | `#9B9B9B` | Sync — all "muted" text collapses to one token |
| Text (muted-alt) | `#7A7A7A` (Phase 9a) | `#9B9B9B` | Same — sync |
| Text (faint) | `#555555` `#666666` (legacy) | `#737373` | KEEP `#737373` for any pre-existing faint text. Do NOT use design's `#5A5A5A` (2.7:1 — fails AA). The design uses `#5A5A5A` for purely-decorative annotations (mono separators); we don't have those. |
| Accent | `#FF6B35` | `#FF5B25` | Slightly darker orange. White-on-`#FF5B25` is contrast 3.3:1 — same AA-edge as the previous `#FF6B35`. Documented in Phase 9a as known brand trade-off. |
| Accent (soft fill) | `bg-[#FF6B35]/20` | `bg-[#FF5B25]/[0.14]` | Translucent fill used for "Editor's Pick" tag |
| Amber (Editor's Picks carousel) | `amber-500/10` etc. | UNCHANGED | Tailwind utility, not a hex |
| OK (success indicator) | n/a | `#4CC38A` | NEW — for StatusBar live dot |

### Mechanism

```bash
find components app data -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.json" \) -exec sed -i '' \
  -e 's/#0A0A0A/#000000/g' \
  -e 's/#FAFAFA/#F5F5F5/g' \
  -e 's/#A3A3A3/#9B9B9B/g' \
  -e 's/#737373/#9B9B9B/g' \
  -e 's/#7A7A7A/#9B9B9B/g' \
  -e 's/#FF6B35/#FF5B25/g' \
  -e 's/#111111/#0B0B0B/g' \
  -e 's/#2A2A2A/#262626/g' \
  {} +
```

`bg-[#FF6B35]/20` → manual edit to `bg-[#FF5B25]/[0.14]` per pattern (4 occurrences).

### Tests touched

None (no test asserts on hex literals; verified by `grep -rE "#[0-9A-Fa-f]{6}" __tests__/`).

### Acceptance

- `grep -r "#0A0A0A\|#FAFAFA\|#FF6B35\|#A3A3A3\|#111111" components/ app/` returns empty.
- `npm test` green.
- `npm run lint` clean (eslint doesn't care about hex changes).
- `npm run build` succeeds.

---

## Section 2 — `<SectionHead>` component

### Component

**File:** `components/SectionHead.tsx`

```typescript
interface SectionHeadProps {
  num: string          // "01", "02", … (caller passes zero-padded)
  label: string        // section type ("Editor's Picks")
  title: string        // headline
  meta?: string        // optional right-side mono metadata
}

export function SectionHead({ num, label, title, meta }: SectionHeadProps) {
  return (
    <header className="grid grid-cols-1 md:grid-cols-[90px_1fr_auto] items-end gap-3 md:gap-6 pt-5 pb-6 border-t border-[#1A1A1A] mt-16">
      <span className="font-mono text-xs tracking-[0.16em] text-[#FF5B25]">§ {num}</span>
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#9B9B9B] mb-1">{label}</p>
        <h2 className="font-mono text-2xl md:text-3xl font-bold tracking-tight text-[#F5F5F5]">
          {title}
        </h2>
      </div>
      {meta && (
        <span className="font-mono text-xs uppercase tracking-[0.12em] text-[#737373]">{meta}</span>
      )}
    </header>
  )
}
```

### Surfaces it lands on

- **`/` landing** — wrap existing `<h2>` blocks. Mapping:
  - "Why we built this" → `<SectionHead num="01" label="Background" title="Why we built this" />`
  - "What we don't do" → `<SectionHead num="02" label="Honesty" title="What we don't do" />`
  - 3-step flow → `<SectionHead num="03" label="How it works" title="Three steps to your week" />`
  - Editor's Picks carousel → wrap with `<SectionHead num="04" label="Curated" title="Editor's Picks" meta={`${picks.length} picks · curated by VirtusLab`} />`
- **`/about`** — 4 numbered heads matching existing sections
- **`/beyond`** — 1 head for the aggregators list, 1 for "Why we link the competition"
- **`/privacy`** — 7 numbered heads (one per existing section)
- **`/terms`** — 6 numbered heads
- **`/events`** — keep existing layout but add a `<SectionHead num="01" label="Curated" title="Editor's Picks" />` above the carousel area when no search/filter is active

### Test

`__tests__/components/SectionHead.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SectionHead } from '../../components/SectionHead'

describe('SectionHead', () => {
  it('renders num, label, and title', () => {
    render(<SectionHead num="01" label="Honesty" title="What we don't do" />)
    expect(screen.getByText('§ 01')).toBeInTheDocument()
    expect(screen.getByText('Honesty')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /what we don.?t do/i })).toBeInTheDocument()
  })

  it('renders meta when provided', () => {
    render(<SectionHead num="04" label="Curated" title="Editor's Picks" meta="5 picks" />)
    expect(screen.getByText('5 picks')).toBeInTheDocument()
  })

  it('omits meta when not provided', () => {
    const { container } = render(<SectionHead num="01" label="x" title="y" />)
    expect(container.querySelectorAll('span').length).toBe(2) // § and label, no meta
  })
})
```

### Existing tests touched

None broken. Pages that change still expose the same `<h2>` text content; existing privacy/terms/about/landing/beyond tests query by accessible name, so they pass through the wrapper.

---

## Section 3 — Editorial event row list

### `EventCard.tsx` refactor

Grid layout: `90px (time) | 1fr (body) | 240px (meta) | auto (add)`. Hover reveals the Add button. Card → row.

```tsx
'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { usePlanStore } from '@/lib/plan-store'
import { formatEventTime } from '@/lib/events'
import { toast } from 'sonner'
import { EventDetailModal } from '@/components/EventDetailModal'
import type { Event } from '@/lib/types'

interface EventCardProps {
  event: Event
  onTagClick?: (tag: string) => void
}

export function EventCard({ event, onTagClick }: EventCardProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const { items, addItem } = usePlanStore()
  const isInPlan = items.some((i) => i.event_id === event.id)

  function handleAdd(e?: React.MouseEvent) {
    if (e) e.stopPropagation()
    if (isInPlan) return
    addItem(event.id, 'interested', 'manual')
    toast('Added to your plan')
  }

  return (
    <>
      <article
        data-testid="event-card"
        onClick={() => setModalOpen(true)}
        className="grid grid-cols-[90px_1fr] md:grid-cols-[90px_1fr_240px_auto] gap-5 py-5 border-t border-[#1A1A1A] hover:bg-[#FF5B25]/[0.03] transition-colors group cursor-pointer"
      >
        {/* Time — uses formatEventTime parts (NYC TZ, "h:mm aa" format) */}
        <div className="font-mono text-xs text-[#FF5B25] font-bold tracking-wide pt-1 row-span-2 md:row-span-1">
          {formatStartTime(event.starts_at)}
          <span className="hidden md:block text-[#737373] font-normal mt-1">
            – {formatEndTime(event.ends_at)}
          </span>
        </div>

        {/* Body */}
        <div className="col-start-2 md:col-start-2">
          {event.is_editors_pick && (
            <span className="inline-block font-mono text-[10px] uppercase tracking-[0.14em] bg-[#FF5B25]/[0.14] text-[#FF5B25] px-1.5 py-0.5 mb-2">
              Editor&apos;s Pick
            </span>
          )}
          <h4 className="font-mono font-bold text-base leading-snug mb-1 text-[#F5F5F5]">
            {event.title}
          </h4>
          <p className="font-mono text-xs uppercase tracking-wide text-[#9B9B9B] mb-2">
            {event.host}
          </p>
          <p className="text-sm text-[#9B9B9B] leading-relaxed max-w-[62ch] line-clamp-2">
            {event.description}
          </p>
          {event.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2" onClick={(e) => e.stopPropagation()}>
              {event.tags.slice(0, 4).map((tag) =>
                onTagClick ? (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => onTagClick(tag)}
                    aria-label={`Filter by tag ${tag}`}
                    className="text-[10px] text-[#737373] hover:text-[#FF5B25] font-mono"
                  >
                    #{tag}
                  </button>
                ) : (
                  <span key={tag} className="text-[10px] text-[#737373] font-mono">#{tag}</span>
                )
              )}
            </div>
          )}
        </div>

        {/* Meta (desktop only) */}
        <div className="hidden md:flex flex-col gap-1.5 font-mono text-xs uppercase tracking-wide text-[#737373] pt-1">
          {event.neighborhood && <span className="text-[#9B9B9B]">{event.neighborhood}</span>}
          <div className="flex gap-2.5 flex-wrap">
            {event.has_free_food && <span className="text-[#F5F5F5]">food</span>}
            {event.has_free_drinks && <span className="text-[#F5F5F5]">drinks</span>}
            {event.is_invite_only && <span>invite</span>}
          </div>
        </div>

        {/* Add button (desktop only, opacity on hover) */}
        <div className="hidden md:block self-start" onClick={(e) => e.stopPropagation()}>
          {!isInPlan ? (
            <button
              type="button"
              onClick={handleAdd}
              className="font-mono text-xs uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-opacity text-[#FF5B25] hover:underline pt-1"
            >
              + Add
            </button>
          ) : (
            <span className="font-mono text-xs uppercase tracking-wide text-[#4CC38A] pt-1 inline-block">
              ✓ In plan
            </span>
          )}
        </div>
      </article>

      {modalOpen && (
        <EventDetailModal event={event} open={modalOpen} onOpenChange={setModalOpen} />
      )}
    </>
  )
}

```

### `lib/events.ts` additions

Split the existing `formatEventTime` so the row layout can render start + end separately:

```typescript
// lib/events.ts — alongside the existing formatEventTime
export function formatStartTime(iso: string): string {
  const d = toZonedTime(new Date(iso), NYC_TZ)
  return formatTz(d, 'h:mm aa', { timeZone: NYC_TZ })
}

export function formatEndTime(iso: string): string {
  const d = toZonedTime(new Date(iso), NYC_TZ)
  return formatTz(d, 'h:mm aa', { timeZone: NYC_TZ })
}
```

Add a small test in `__tests__/lib/events.test.ts` (if it exists; create if not):
- `formatStartTime('2026-06-03T22:00:00Z')` returns `'6:00 PM'` (NYC = UTC-4 in June)
- `formatEndTime('2026-06-04T01:00:00Z')` returns `'9:00 PM'`

`formatEventTime` stays exported — `EditorsPicksCarousel` and the modal still call it for the day-prefixed combined string.

### Day header pattern (in `EventList.tsx`)

Replace the current sticky day heading with the numbered §-style grid.

```tsx
const dayIndex = (key: string): string => String(dayKeys.indexOf(key) + 1).padStart(2, '0')

// inside the day section render:
<div className="grid grid-cols-[90px_1fr_auto] items-baseline gap-5 pt-7 pb-3 border-t border-[#1A1A1A]">
  <div className="font-mono font-bold text-2xl text-[#FF5B25]">{dayIndex(dayKey)}</div>
  <div>
    <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#9B9B9B]">
      {formatDayShort(dayKey)}
    </p>
    <h3 className="font-mono text-xl font-bold mt-0.5 text-[#F5F5F5]">{formatDayHeading(dayKey)}</h3>
  </div>
  <span className="font-mono text-xs uppercase tracking-wide text-[#737373]">
    {grouped[dayKey].length} events
  </span>
</div>
```

The sticky positioning stays (`sticky top-0`).

### `MyPlanEventCard.tsx`

Same row layout. The Add button in the right column becomes a status badge (`confirmed`, `interested`, `waitlist`) with color coding.

### `EventDetailModal.tsx`

No structural change — Section 1's color sweep updates the modal automatically. Still a centered Base UI Dialog.

### Tests touched

- `__tests__/components/EventCard.test.tsx` (8 tests): assertions on title + RSVP behavior + tag click + onClick-opens-modal stay valid. The structure change is internal; data-testid stays. Where a test asserts on a specific element type (e.g., `getByRole('article')`), it still works because we render an `<article>`.
- `__tests__/components/MyPlanEventCard.test.tsx`: similar — text-content assertions stable.
- E2E `e2e/browse-and-add.spec.ts`: uses `getByTestId('event-card').first()` → still works. Uses `page.getByText(/added to your plan/i)` → toast text unchanged. Uses `page.getByText(/1 event/i)` → MyPlanWidget unchanged.

### Acceptance

- All vitest tests green
- E2E `browse-and-add.spec.ts` green
- Visual smoke: visit `/events`, see editorial row layout; hover a row, see Add button reveal; click a row, see modal open.

---

## Section 4 — Tabbed nav + custom mark + `<StatusBar />`

### `SiteNav.tsx` rewrite

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { HelpModal } from '@/components/HelpModal'

type NavItem = { label: string; href: string; live: boolean }

const ITEMS: NavItem[] = [
  { label: 'Browse',  href: '/events',  live: true },
  { label: 'Now',     href: '/now',     live: true },
  { label: 'My Plan', href: '/my-plan', live: true },   // flip from false
  { label: 'Plan',    href: '/plan',    live: true },
  { label: 'Beyond',  href: '/beyond',  live: true },
  { label: 'About',   href: '/about',   live: true },
]

export function SiteNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <div className="border-b border-[#1A1A1A] bg-[#000000]">
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Brand mark */}
        <Link href="/" className="flex items-center gap-3.5">
          <span className="relative grid place-items-center w-9 h-9 border border-[#FF5B25] text-[#FF5B25] font-mono font-bold text-sm">
            §§
            <span className="absolute inset-[3px] border border-[#FF5B25]/[0.35] pointer-events-none" />
          </span>
          <span className="font-mono text-sm font-bold uppercase tracking-[0.08em] text-[#F5F5F5]">
            NYTW <span className="text-[#737373] font-normal">Companion</span>
          </span>
        </Link>

        {/* Desktop tabs */}
        <nav className="hidden md:flex border border-[#262626]">
          {ITEMS.filter((i) => i.live).map((item, idx, arr) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                'font-mono text-xs uppercase tracking-[0.1em] px-4 py-2.5 transition-colors ' +
                (idx < arr.length - 1 ? 'border-r border-[#262626] ' : '') +
                (isActive(item.href)
                  ? 'bg-[#FF5B25] text-black'
                  : 'text-[#9B9B9B] hover:text-[#F5F5F5]')
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Mobile hamburger */}
        <div className="md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="outline"
                  className="border-[#262626] text-[#F5F5F5] font-mono uppercase tracking-wide"
                  aria-label="Open menu"
                >
                  ☰
                </Button>
              }
            />
            <SheetContent side="right" className="bg-[#000000] border-[#1A1A1A] text-[#F5F5F5] w-[280px] p-6">
              <SheetHeader className="mb-6 p-0">
                <SheetTitle className="font-mono text-base text-[#F5F5F5] text-left uppercase tracking-wide">
                  Menu
                </SheetTitle>
              </SheetHeader>
              <ul className="flex flex-col gap-4">
                {ITEMS.filter((i) => i.live).map((item) => (
                  <li key={item.href} onClick={() => setOpen(false)}>
                    <Link
                      href={item.href}
                      className={`font-mono text-sm uppercase tracking-wide ${
                        isActive(item.href) ? 'text-[#FF5B25]' : 'text-[#9B9B9B] hover:text-[#F5F5F5]'
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      <HelpModal />
    </div>
  )
}
```

### `<StatusBar />` (NEW)

**File:** `components/StatusBar.tsx`

```tsx
'use client'

import { useEffect, useState } from 'react'
import { festivalMode, nowInNYC } from '@/lib/time'

const FESTIVAL_START = new Date('2026-06-01T00:00:00-04:00')

function daysUntil(now: Date): number {
  const diff = FESTIVAL_START.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

function formatNYTime(d: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/New_York',
  }).format(d)
}

export function StatusBar() {
  const [mounted, setMounted] = useState(false)
  const [now, setNow] = useState(() => nowInNYC())

  useEffect(() => {
    setMounted(true)
    const id = setInterval(() => setNow(nowInNYC()), 60_000)
    return () => clearInterval(id)
  }, [])

  if (!mounted) return null

  const mode = festivalMode(now)
  let modeLabel: string
  if (mode === 'during') modeLabel = 'Live · Tech Week'
  else if (mode === 'pre') modeLabel = `T-${daysUntil(now)}d`
  else modeLabel = 'Past'

  return (
    <div className="border-b border-[#1A1A1A] bg-black/70 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-6 py-2.5 flex items-center gap-5 font-mono text-[11px] uppercase tracking-[0.14em] text-[#737373]">
        <span className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#4CC38A] shadow-[0_0_0_4px_rgba(76,195,138,0.18)] animate-pulse" />
          <span className="text-[#4CC38A]">{modeLabel}</span>
        </span>
        <span className="flex-1" />
        <span>NYC · {formatNYTime(now)}</span>
      </div>
    </div>
  )
}
```

### Layout mount

`app/layout.tsx` — add `<StatusBar />` above `<SiteNav />`:

```tsx
<body ...>
  <StatusBar />
  <SiteNav />
  ...
</body>
```

### Tests

**Update** `__tests__/components/SiteNav.test.tsx`:
- Existing tests query by link text ("Browse", "Now", "My Plan", etc.) — still pass through tab structure.
- One assertion that the brand mark renders (text `NYTW`).
- One that My Plan now appears as a live link (was disabled before).

**New** `__tests__/components/StatusBar.test.tsx`:
- Mock `lib/time.ts` `festivalMode` to return `'pre'` → assert `T-Nd` label appears.
- Same with `'during'` → `Live · Tech Week`.
- Same with `'post'` → `Past`.
- Renders NYC time string.
- Renders the green dot (assert by class `bg-[#4CC38A]` or by aria-label if added).

**E2E impact**: `keyboard.spec.ts` opens HelpModal (rendered by SiteNav). HelpModal moves remain inside SiteNav — no behavioral change. E2E passes.

### Acceptance

- `npm test` green (SiteNav + StatusBar tests pass)
- `npm run lint` clean
- `npm run build` succeeds with new `/components/StatusBar.tsx` mounted globally
- E2E green
- Manual: SiteNav shows `§§` mark + tabs; active tab is solid orange; StatusBar shows pulsing green dot + festival mode + time

---

## Architecture overview

```
components/
├── SectionHead.tsx             NEW (Section 2)
├── StatusBar.tsx               NEW (Section 4)
├── SiteNav.tsx                 REWRITE (Section 4)
├── EventCard.tsx               REWRITE (Section 3 — row layout)
├── EventList.tsx               MODIFIED (Section 3 — numbered day headers)
├── MyPlanEventCard.tsx         REWRITE (Section 3 — same row pattern)
└── (other components)          color tokens only (Section 1)

app/layout.tsx                  + <StatusBar />

app/(marketing)/
├── page.tsx                    + <SectionHead> wrappers (Section 2)
├── about/page.tsx              + <SectionHead> wrappers
├── beyond/page.tsx             + <SectionHead> wrappers
├── privacy/page.tsx            + <SectionHead> wrappers
└── terms/page.tsx              + <SectionHead> wrappers

app/events/page.tsx             color tokens only
app/now/page.tsx                color tokens only
app/my-plan/page.tsx            color tokens only
app/plan/page.tsx               color tokens only
app/offline/page.tsx            color tokens only
app/opengraph-image.tsx         color tokens only (#FF6B35 → #FF5B25 etc.)

lib/events.ts                   + formatStartTime / formatEndTime helpers (Section 3)

__tests__/components/
├── SectionHead.test.tsx        NEW
├── StatusBar.test.tsx          NEW
├── SiteNav.test.tsx            UPDATED
├── EventCard.test.tsx          AUDIT (likely no change; selectors stable)
└── MyPlanEventCard.test.tsx    AUDIT (likely no change)
```

---

## Risks & mitigations

- **Risk:** Color sweep `sed` accidentally touches a test snapshot or a hex literal in unrelated code (e.g., a comment). **Mitigation:** review `git diff` before commit; only `*.tsx` `*.ts` `*.json` are touched; tests have no hex assertions.
- **Risk:** EventCard refactor breaks an existing test by changing internal DOM structure. **Mitigation:** before commit, run `__tests__/components/EventCard.test.tsx` and fix any assertion that pins old structure. Selectors prefer text + role + testid (resilient).
- **Risk:** `EventDetailModal` color tokens leak into Base UI Dialog styles. **Mitigation:** verify Dialog primitive's wrapper colors are also swept (`#1A1A1A` borders, etc.).
- **Risk:** New `<StatusBar />` causes SSR mismatch (uses `Date.now()`). **Mitigation:** `mounted` guard returns null on first render; same pattern as existing `NowClient.tsx`.
- **Risk:** My Plan flipping to `live: true` exposes a route that lacks proper plan data when localStorage is empty. **Mitigation:** `/my-plan` already has empty-state handling (`MyPlanEmptyState.tsx` from earlier phases).

## Acceptance criteria

- [ ] All hex literals swept per Section 1 table. `grep` confirms.
- [ ] `<SectionHead>` component exists with 3 tests green; wired into all 5 marketing pages + /events.
- [ ] `EventCard` renders the row layout: time | body | meta | add-button. Hover reveals Add button on desktop. `data-testid="event-card"` preserved.
- [ ] `EventList` day headers use the numbered §-style grid.
- [ ] `MyPlanEventCard` matches the row pattern, with status badge in place of add-button.
- [ ] `SiteNav` renders `§§` brand mark + tabbed nav; active tab solid orange.
- [ ] `<StatusBar />` mounted in `app/layout.tsx`; pulsing green dot; festival-mode label; live time.
- [ ] My Plan is `live: true` in nav.
- [ ] `npm test` green (Phase 9a's 279 + new SectionHead 3 + StatusBar ~3 = ~285).
- [ ] `npm run lint` clean, 0 errors, 0 warnings.
- [ ] `npm run build` succeeds.
- [ ] `npm run e2e` — all 3 specs green.
- [ ] Manual smoke (you on production URL after deploy): editorial layout visible; tabs work; StatusBar updates every minute.

## Out-of-scope reminders

- Bricolage Grotesque, Inter Tight fonts — JetBrains Mono stays sole font (user feedback).
- Mega "87" hero, live ticker, animated marquee, tweaks panel, theme switcher.
- 3-up Editor's Picks grid (existing carousel stays).
- Accent color swap UI.
- Light mode / paper theme.
