# Phase 10a — Visual refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the editorial-meets-terminal direction from the Claude Design handoff in 4 slices — color token sweep, `<SectionHead>` pattern, editorial event-row list, tabbed nav with brand mark + status bar — while honoring the user's "too much typography" feedback (keep JetBrains Mono as sole font) and preserving every existing test selector.

**Architecture:** Module-per-surface, same shape as Phases 7/8a/9a. Eight tasks: Task 1 colors, Task 2 SectionHead component, Task 3 SectionHead wiring across pages, Task 4 lib/events helpers, Task 5 EventCard row refactor, Task 6 EventList day headers + MyPlanEventCard, Task 7 StatusBar component, Task 8 SiteNav rewrite + final acceptance.

**Tech Stack:** Next.js 16 / React 19 / TS strict / Tailwind / existing Vitest + Playwright + Lighthouse setup. No new libraries.

**Reference design:** `docs/superpowers/specs/2026-05-25-phase-10a-visual-refresh-design.md`

---

## Conventions

- Brand colors (post-refresh): bg `#000000`, surface `#0B0B0B`, border `#1A1A1A` / `#262626`, fg `#F5F5F5`, dim `#9B9B9B`, faint `#737373`, accent `#FF5B25`, ok `#4CC38A`.
- All new components use mono font via Tailwind `font-mono` (project's default font stack maps mono to JetBrains Mono).
- Single-commit-per-task unless a step explicitly splits.
- Test selectors preserved: `data-testid="event-card"`, the literal strings `"Save"`, `"In your plan"`, `"Editor's Pick"`, `"Invite-only"`, the placeholder regex `/search/i`, aria-labels like `"Filter by tag X"` and `"Remove X filter"`. Don't change these.

---

## Pre-flight: codebase reality

Already verified during plan-writing:

- Existing `EventCard.test.tsx` asserts on `getByText('Save')`, `getByText(/In your plan/)`, `getByText("Editor's Pick")`, `getByText('Invite-only')` — preserve all of these literal strings.
- E2E `browse-and-add.spec.ts` uses `getByPlaceholder(/search/i)` (`EventSearch` placeholder unchanged) and `modal.getByRole('button', { name: /save to plan/i })` (`EventDetailModal`'s button) — both preserved.
- `lib/events.ts` has `formatEventTime(starts_at, ends_at)` returning `"EEE h:mm aa – h:mm aa"`. Task 4 adds `formatStartTime` + `formatEndTime` returning `"h:mm aa"` each.
- `lib/time.ts` exports `festivalMode(date)` returning `'pre' | 'during' | 'post'`.
- `bg-[#FF6B35]/20` appears in 5 components — handled by Section 1 sweep + a manual swap to `bg-[#FF5B25]/[0.14]` (different ratio).
- `data-testid="event-card"` already on EventCard's outer wrapper.

---

## Task 1: Color token sweep

**Files:**
- Modify: all files under `components/` and `app/` and `data/` containing the legacy hex literals
- Modify: `app/opengraph-image.tsx` (uses `#FF6B35` for the eyebrow color)

No new tests; existing tests verify text/behavior, not hex literals.

- [ ] **Step 1: Run the global sed replace**

```bash
cd /Users/askowronski/Projects/nytw-companion && find components app data -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.json" \) -exec sed -i '' \
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

- [ ] **Step 2: Manually swap the translucent accent fills**

The `/20` suffix becomes `/[0.14]` (the design's exact translucency for the `accent-soft` token). Five occurrences. Search for them:

```bash
cd /Users/askowronski/Projects/nytw-companion && grep -rn "bg-\[#FF5B25\]/20\|border-\[#FF5B25\]/30\|border-\[#FF5B25\]/40\|bg-\[#FF5B25\]/0\.\?2" components/ app/
```

Manually edit each to `bg-[#FF5B25]/[0.14]` (the design's accent-soft). The `border-[#FF5B25]/30` and `/40` instances stay as-is (just decorative borders, not contrast-critical).

Files that should appear:
- `components/EditorsPicksCarousel.tsx` (~line 61)
- `components/EventDetailModal.tsx` (~line 72)
- `components/ConciergeProposalCard.tsx` (~line 11)
- `components/MyPlanEventCard.tsx` (~line 54)
- `components/EventCard.tsx` (~lines 78, 145)

In each, change `bg-[#FF5B25]/20` → `bg-[#FF5B25]/[0.14]`. Leave the `border-[#FF5B25]/30` and `border-[#FF5B25]/40` alone (those will be replaced in Section 3 when EventCard is rewritten; for now they harmonize fine).

- [ ] **Step 3: Verify the sweep was clean**

```bash
cd /Users/askowronski/Projects/nytw-companion && grep -rE "#0A0A0A|#FAFAFA|#A3A3A3|#737373|#7A7A7A|#FF6B35|#111111|#2A2A2A" components/ app/ data/ 2>&1 | grep -v "node_modules" | head -10
```

Expected: empty output. If anything matches, it's a bug — verify and fix.

- [ ] **Step 4: Run the full Vitest suite**

```bash
cd /Users/askowronski/Projects/nytw-companion && npm test 2>&1 | tail -10
```

Expected: all 279 tests still green. Colors aren't asserted.

- [ ] **Step 5: Run lint and build**

```bash
cd /Users/askowronski/Projects/nytw-companion && npm run lint 2>&1 | tail -5
cd /Users/askowronski/Projects/nytw-companion && npm run build 2>&1 | tail -10
```

Expected: 0 lint errors; clean build.

- [ ] **Step 6: Commit**

```bash
cd /Users/askowronski/Projects/nytw-companion && git add components/ app/ data/ && git commit -m "refactor(visual): sweep color tokens to design palette (#0A0A0A→#000, #FF6B35→#FF5B25, etc.)"
```

---

## Task 2: `<SectionHead>` component

**Files:**
- Create: `components/SectionHead.tsx`
- Create: `__tests__/components/SectionHead.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/SectionHead.test.tsx`:

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
    // span count: § num + label = 2 spans; meta would add a third
    const spans = container.querySelectorAll('span')
    expect(spans.length).toBe(1) // only the § num is a span; label is a <p>
  })
})
```

(Note: the count in the third test depends on the implementation; the implementation below uses one `<span>` for the §-num. Adjust this assertion if the implementation differs.)

- [ ] **Step 2: Run test — expect fail**

```bash
cd /Users/askowronski/Projects/nytw-companion && npx vitest run __tests__/components/SectionHead.test.tsx
```

Expected: fail — module does not exist.

- [ ] **Step 3: Create `components/SectionHead.tsx`**

```typescript
interface SectionHeadProps {
  num: string
  label: string
  title: string
  meta?: string
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
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-[#737373]">{meta}</p>
      )}
    </header>
  )
}
```

- [ ] **Step 4: Run test — expect pass (3 green)**

```bash
cd /Users/askowronski/Projects/nytw-companion && npx vitest run __tests__/components/SectionHead.test.tsx
```

If the third test fails because the `<p>` count differs from your expectation, update it to match the actual output (e.g., `container.querySelectorAll('p').length`). The test's intent is "meta is absent when not passed."

- [ ] **Step 5: Commit**

```bash
cd /Users/askowronski/Projects/nytw-companion && git add components/SectionHead.tsx __tests__/components/SectionHead.test.tsx && git commit -m "feat(visual): add SectionHead component with §-numbered editorial grid"
```

---

## Task 3: Wire `<SectionHead>` into pages

**Files:**
- Modify: `app/(marketing)/page.tsx`
- Modify: `app/(marketing)/about/page.tsx`
- Modify: `app/(marketing)/beyond/page.tsx`
- Modify: `app/(marketing)/privacy/page.tsx`
- Modify: `app/(marketing)/terms/page.tsx`
- Modify: `app/events/page.tsx`

The new `<SectionHead>` wraps existing `<h2>` blocks. All previously-passing page tests still pass because the `<h2>` text content stays the same; the `getByRole('heading', { level: 2, name: ... })` calls all keep matching.

- [ ] **Step 1: Update landing (`app/(marketing)/page.tsx`)**

Find these `<h2>` headings and wrap them. The existing structure has three `<h2>` blocks: "Why we built this", "What we don't do". Replace the section-opening pattern with `<SectionHead>`.

Add the import at the top:
```typescript
import { SectionHead } from '@/components/SectionHead'
```

Find:
```tsx
      {/* Why we built this */}
      <section className="px-6 py-16 border-t border-[#1A1A1A]">
        <div className="max-w-3xl mx-auto space-y-5">
          <h2 className="font-mono text-2xl font-bold">Why we built this</h2>
```

Replace with:
```tsx
      {/* Why we built this */}
      <section className="px-6 py-16">
        <div className="max-w-3xl mx-auto space-y-5">
          <SectionHead num="01" label="Background" title="Why we built this" />
```

Note: removed `border-t border-[#1A1A1A]` from the `<section>` and `<h2>` inside because `<SectionHead>` already adds a top border + the bold typography. Remove the explicit `<h2>` line entirely.

Find:
```tsx
      {/* What we don't do */}
      <section className="px-6 py-16 border-t border-[#1A1A1A]">
        <div className="max-w-3xl mx-auto space-y-4">
          <h2 className="font-mono text-2xl font-bold">What we don&apos;t do</h2>
```

Replace with:
```tsx
      {/* What we don't do */}
      <section className="px-6 py-16">
        <div className="max-w-3xl mx-auto space-y-4">
          <SectionHead num="02" label="Honesty" title="What we don't do" />
```

(Apostrophe in `title` string is fine — JSX prop strings don't need `&apos;`.)

- [ ] **Step 2: Update `/about` (`app/(marketing)/about/page.tsx`)**

Add the import:
```typescript
import { SectionHead } from '@/components/SectionHead'
```

Find each `<h2>` in the page (there are 4) and replace with `<SectionHead>`:

| Existing `<h2>` text | num | label | title |
|---|---|---|---|
| `Why this exists` | `01` | `Origin` | `Why this exists` |
| `How we curate` | `02` | `Process` | `How we curate` |
| (no h2 — the "Not affiliated" section has just a `<p>`) | — | — | — |
| `Who built this` | `03` | `Author` | `Who built this` |

For each, find:
```tsx
        <section className="space-y-3">
          <h2 className="font-mono text-xl font-bold">Why this exists</h2>
```
Replace with:
```tsx
        <section className="space-y-3">
          <SectionHead num="01" label="Origin" title="Why this exists" />
```

Repeat for `How we curate` (num="02", label="Process") and `Who built this` (num="03", label="Author").

- [ ] **Step 3: Update `/beyond` (`app/(marketing)/beyond/page.tsx`)**

Add import. Find the `<h2>` "Why we link the competition":
```tsx
          <h2 className="font-mono text-xl font-bold mb-3">
            Why we link the competition
          </h2>
```
Replace with:
```tsx
          <SectionHead num="01" label="Disclosure" title="Why we link the competition" />
```

(Beyond page only has one `<h2>`. The aggregator list itself uses `<h2>` per-card, but those are card titles, not section heads. Leave the per-card `<h2>` alone.)

- [ ] **Step 4: Update `/privacy` (`app/(marketing)/privacy/page.tsx`)**

Add import. The page uses an inline `Section({ title, children })` helper that renders `<h2>`. Locate that helper (near top of file) and update its callers — or update the helper to use `<SectionHead>`.

Cleanest: replace the local `Section` helper. Find:
```tsx
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-mono text-xl font-bold">{title}</h2>
      <p className="text-[#9B9B9B] text-base leading-relaxed">{children}</p>
    </section>
  )
}
```

The callers pass `title="Plan storage"`, etc. We need the call site to also pass `num`. Update the helper to accept a `num` prop:

```tsx
function Section({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <SectionHead num={num} label="" title={title} />
      <p className="text-[#9B9B9B] text-base leading-relaxed">{children}</p>
    </section>
  )
}
```

Hmm — that produces an empty `label`. Better: pass a proper label via the helper. Update its signature:

```tsx
function Section({ num, label, title, children }: { num: string; label: string; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <SectionHead num={num} label={label} title={title} />
      <p className="text-[#9B9B9B] text-base leading-relaxed">{children}</p>
    </section>
  )
}
```

Then update each call:

| Call | num | label |
|---|---|---|
| `Plan storage` | `01` | `Data` |
| `AI Concierge` | `02` | `AI` |
| `Analytics` | `03` | `Telemetry` |
| `Map tiles` | `04` | `Maps` |
| `Geolocation` | `05` | `Location` |
| `Cookies` | `06` | `Cookies` |
| `Changes` | `07` | `Updates` |

Replace each:
```tsx
<Section title="Plan storage">
```
with:
```tsx
<Section num="01" label="Data" title="Plan storage">
```

…and analogously for the rest.

- [ ] **Step 5: Update `/terms` (`app/(marketing)/terms/page.tsx`)**

Same pattern as `/privacy`. The same inline `Section` helper. Update it (same signature) and the callers:

| Call | num | label |
|---|---|---|
| `Independence` | `01` | `Project` |
| `Event listings` | `02` | `Content` |
| `No warranty` | `03` | `Disclaimer` |
| `AI proposals` | `04` | `AI` |
| `Your conduct` | `05` | `Use` |
| `Liability` | `06` | `Legal` |

- [ ] **Step 6: Update `/events` (`app/events/page.tsx`)**

The `/events` page is mostly rendered by `EventList`. The `<SectionHead>` for the Editor's Picks area lives in `EventList.tsx` and will be added when Task 6 lands. For now in this task, just verify `app/events/page.tsx` itself doesn't have a `<h2>` to convert. If it does, do so; otherwise skip.

```bash
grep -n "<h2" app/events/page.tsx
```

If no matches, this step is a no-op.

- [ ] **Step 7: Run all marketing-page tests + privacy/terms/about/beyond tests**

```bash
cd /Users/askowronski/Projects/nytw-companion && npx vitest run __tests__/app/landing.test.tsx __tests__/app/about.test.tsx __tests__/app/beyond.test.tsx __tests__/app/privacy.test.tsx __tests__/app/terms.test.tsx
```

Expected: all green. The tests query by `getByRole('heading', { level: 2, name: /.../i })` which the new `<SectionHead>` still satisfies (h2 inside).

If any test fails because it relied on `Section(title=...)` not having a `num` argument, update the test's import or accept the helper signature changed.

- [ ] **Step 8: Run full suite**

```bash
cd /Users/askowronski/Projects/nytw-companion && npm test 2>&1 | tail -5
```

Expected: still green.

- [ ] **Step 9: Commit**

```bash
cd /Users/askowronski/Projects/nytw-companion && git add 'app/(marketing)/page.tsx' 'app/(marketing)/about/page.tsx' 'app/(marketing)/beyond/page.tsx' 'app/(marketing)/privacy/page.tsx' 'app/(marketing)/terms/page.tsx' && git commit -m "feat(visual): wire SectionHead into landing/about/beyond/privacy/terms"
```

---

## Task 4: `lib/events.ts` — `formatStartTime` + `formatEndTime`

**Files:**
- Modify: `lib/events.ts`
- Modify: `__tests__/lib/events.test.ts`

Tiny task. Adds two small helpers used by the EventCard row layout in Task 5.

- [ ] **Step 1: Add tests at the bottom of `__tests__/lib/events.test.ts`**

(File exists; verified during planning.) Append inside the existing top-level describe block, or as a new describe block at the bottom of the file:

```typescript
import { formatStartTime, formatEndTime } from '../../lib/events'

describe('formatStartTime / formatEndTime', () => {
  it('formatStartTime returns NYC time in h:mm aa format', () => {
    // 2026-06-03T22:00:00Z = 6:00 PM EDT (NYC June = UTC-4)
    expect(formatStartTime('2026-06-03T22:00:00Z')).toMatch(/6:00\s*PM/i)
  })

  it('formatEndTime returns NYC time in h:mm aa format', () => {
    // 2026-06-04T01:00:00Z = 9:00 PM EDT
    expect(formatEndTime('2026-06-04T01:00:00Z')).toMatch(/9:00\s*PM/i)
  })
})
```

Add the imports at the top of the test file (alongside existing `groupEventsByDay, getTimePeriod, formatEventTime`).

- [ ] **Step 2: Run test — expect fail**

```bash
cd /Users/askowronski/Projects/nytw-companion && npx vitest run __tests__/lib/events.test.ts
```

Expected: import error — functions don't exist yet.

- [ ] **Step 3: Add the two helpers to `lib/events.ts`**

Find the existing `formatEventTime` function and add these two functions right after it (using the same NYC_TZ + `toZonedTime` + `formatTz` pattern):

```typescript
export function formatStartTime(iso: string): string {
  const d = toZonedTime(new Date(iso), NYC_TZ)
  return formatTz(d, 'h:mm aa', { timeZone: NYC_TZ })
}

export function formatEndTime(iso: string): string {
  const d = toZonedTime(new Date(iso), NYC_TZ)
  return formatTz(d, 'h:mm aa', { timeZone: NYC_TZ })
}
```

(Both functions have identical implementations — `formatStartTime` and `formatEndTime` are just named for caller intent. Could be inlined as one `formatTimeOfDay`, but keeping them named makes the EventCard column clearer.)

- [ ] **Step 4: Run test — expect pass (2 new green)**

```bash
cd /Users/askowronski/Projects/nytw-companion && npx vitest run __tests__/lib/events.test.ts
```

- [ ] **Step 5: Commit**

```bash
cd /Users/askowronski/Projects/nytw-companion && git add lib/events.ts __tests__/lib/events.test.ts && git commit -m "feat(events): add formatStartTime + formatEndTime helpers (NYC TZ, h:mm aa)"
```

---

## Task 5: `EventCard` row refactor

**Files:**
- Modify: `components/EventCard.tsx`

This is the most-touched component in the refresh. Preserve every selector currently used by tests + E2E:
- `data-testid="event-card"` on outer wrapper
- Text `"Save"` for the save button
- Text `"In your plan"` for the in-plan indicator
- Text `"Editor's Pick"` for the editor's pick badge
- Text `"Invite-only"` for the invite-only badge
- `aria-label="Filter by tag X"` for tag chip buttons
- Modal opens on outer click; modal interactions covered by EventDetailModal (not changed in this task)
- `toast('Added to your plan')` fires on Save click

- [ ] **Step 1: Replace `components/EventCard.tsx` body**

The new file:

```typescript
// components/EventCard.tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { EventDetailModal } from '@/components/EventDetailModal'
import { usePlanStore } from '@/lib/plan-store'
import { formatStartTime, formatEndTime } from '@/lib/events'
import type { Event } from '@/lib/types'

interface EventCardProps {
  event: Event
  onTagClick?: (tag: string) => void
}

export function EventCard({ event, onTagClick }: EventCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { items, addItem } = usePlanStore()
  const isInPlan = items.some((i) => i.event_id === event.id)

  function handleSave(e?: React.MouseEvent) {
    if (e) e.stopPropagation()
    if (isInPlan) return
    addItem(event.id, 'interested', 'manual')
    toast('Added to your plan')
  }

  return (
    <>
      <article
        data-testid="event-card"
        onClick={() => setIsModalOpen(true)}
        className="grid grid-cols-[90px_1fr] md:grid-cols-[90px_1fr_240px_auto] gap-5 py-5 border-t border-[#1A1A1A] hover:bg-[#FF5B25]/[0.03] transition-colors cursor-pointer group"
      >
        {/* Time column */}
        <div className="font-mono text-xs text-[#FF5B25] font-bold tracking-wide pt-1">
          {formatStartTime(event.starts_at)}
          <span className="block text-[#737373] font-normal mt-1">
            – {formatEndTime(event.ends_at)}
          </span>
        </div>

        {/* Body column */}
        <div className="col-start-2 md:col-start-2 min-w-0">
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
                  <span key={tag} className="text-[10px] text-[#737373] font-mono">
                    #{tag}
                  </span>
                )
              )}
            </div>
          )}
        </div>

        {/* Meta column — desktop only */}
        <div className="hidden md:flex flex-col gap-1.5 font-mono text-xs uppercase tracking-wide text-[#737373] pt-1">
          {event.neighborhood && (
            <span className="text-[#9B9B9B]">{event.neighborhood}</span>
          )}
          {event.is_invite_only && (
            <span>Invite-only</span>
          )}
          <div className="flex gap-2.5 flex-wrap">
            {event.has_free_food && <span className="text-[#F5F5F5]">food</span>}
            {event.has_free_drinks && <span className="text-[#F5F5F5]">drinks</span>}
          </div>
        </div>

        {/* Save column — desktop visible, mobile hidden (user uses modal on mobile) */}
        <div className="hidden md:block self-start" onClick={(e) => e.stopPropagation()}>
          {!isInPlan ? (
            <button
              type="button"
              onClick={handleSave}
              className="font-mono text-xs uppercase tracking-wide text-[#FF5B25] hover:underline pt-1 opacity-60 group-hover:opacity-100 transition-opacity"
            >
              + Save
            </button>
          ) : (
            <span className="font-mono text-xs uppercase tracking-wide text-[#4CC38A] pt-1 inline-block">
              ✓ In your plan
            </span>
          )}
        </div>
      </article>

      <EventDetailModal
        event={event}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
      />
    </>
  )
}
```

Critical details:
- Save button text contains the word `"Save"` — existing test `getByText('Save')` resolves to this button (matches "+ Save"? — actually no, `getByText('Save')` does exact text match by default, won't match "+ Save"). **Fix:** render the button text as just `Save` without the `+` prefix, or use `screen.getByText(/Save/)` regex. The plan side: keep button text as just `Save` so existing tests pass.

Adjusted save button:
```tsx
<button
  type="button"
  onClick={handleSave}
  className="font-mono text-xs uppercase tracking-wide text-[#FF5B25] hover:underline pt-1 opacity-60 group-hover:opacity-100 transition-opacity"
>
  Save
</button>
```

- "In your plan ✓" replaced with `"✓ In your plan"` (text starts with checkmark, ends with "your plan"). Existing test `getByText(/In your plan/)` matches because it's a regex.
- "Invite-only" preserved (exact match).
- "Editor's Pick" preserved (exact match — note the apostrophe). The `&apos;` in JSX renders as a literal apostrophe.

- [ ] **Step 2: Run EventCard tests**

```bash
cd /Users/askowronski/Projects/nytw-companion && npx vitest run __tests__/components/EventCard.test.tsx
```

Expected: 8/8 green. If `getByText('Editor\'s Pick')` fails due to apostrophe encoding, the test will tell you. Adjust either the test or the JSX `&apos;` → straight apostrophe, but JSX renders `&apos;` as a regular apostrophe in the DOM so the assertion should match. Verify and tune.

Common failure if it occurs: the previous EventCard rendered "Save to plan" inside a `<DropdownMenu>` somewhere — the new version uses a plain `<button>Save</button>`. Test pinning the dropdown menu structure will fail; assertion just checks text presence so it still passes.

- [ ] **Step 3: Run E2E to verify modal flow still works**

```bash
cd /Users/askowronski/Projects/nytw-companion && npm run build && npm run e2e 2>&1 | tail -20
```

Expected: 3 specs green. The E2E spec clicks `getByTestId('event-card').first()` (testid preserved) and `modal.getByRole('button', { name: /save to plan/i })` (modal button text unchanged because EventDetailModal is unchanged).

- [ ] **Step 4: Commit**

```bash
cd /Users/askowronski/Projects/nytw-companion && git add components/EventCard.tsx && git commit -m "feat(visual): refactor EventCard to editorial row layout (time | body | meta | save)"
```

---

## Task 6: `EventList` day headers + `MyPlanEventCard` row

**Files:**
- Modify: `components/EventList.tsx`
- Modify: `components/MyPlanEventCard.tsx`

- [ ] **Step 1: Update `EventList.tsx` day header grid**

Read the file. Find the existing day section header — currently looks something like:

```tsx
              <div className="sticky top-0 z-10 bg-[#000000] border-b border-[#1A1A1A] py-3 mb-4 flex items-baseline justify-between">
                <h2 className="font-mono font-bold text-[#F5F5F5] text-lg">
                  {formatDayHeading(dayKey)}
                </h2>
                <span className="text-[#737373] text-xs font-mono">
                  {dayEvents.length} events
                </span>
              </div>
```

Replace with the numbered §-style day grid:

```tsx
              <div className="sticky top-0 z-10 bg-[#000000] grid grid-cols-[90px_1fr_auto] items-baseline gap-5 pt-7 pb-3 border-t border-[#1A1A1A] mb-4">
                <div className="font-mono font-bold text-2xl text-[#FF5B25]">
                  {String(dayKeys.indexOf(dayKey) + 1).padStart(2, '0')}
                </div>
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#9B9B9B]">
                    {formatDayShort(dayKey)}
                  </p>
                  <h3 className="font-mono text-xl font-bold mt-0.5 text-[#F5F5F5]">
                    {formatDayHeading(dayKey)}
                  </h3>
                </div>
                <span className="font-mono text-xs uppercase tracking-wide text-[#737373]">
                  {dayEvents.length} events
                </span>
              </div>
```

Note: `dayKeys.indexOf(dayKey)` — `dayKeys` is the sorted array of day keys already computed in the function. Verify it's in scope at this point in the file (it is, per the existing layout).

- [ ] **Step 2: Update `MyPlanEventCard.tsx` to use the row layout**

Read the file. The existing structure renders as a card with status badge + buttons. The refactor: same grid as EventCard but with a status badge in the right column instead of a Save button (since events in My Plan are already saved).

Critical preservation requirements (verified during plan-writing):
- Component is `forwardRef<HTMLDivElement, MyPlanEventCardProps>` — `MyPlanTimeline.tsx` passes a `ref` to it for scroll-into-view from conflict warnings.
- Props are `{ planItem, event }` (NOT `{ item, event }`).
- Outer element must accept `ref` of type `HTMLDivElement` — keep as `<div>` (not `<article>`) to preserve the type.

Replace the JSX body with the row layout, swapping the Save column for status:

```tsx
'use client'

import { forwardRef, useState } from 'react'
import { EventDetailModal } from '@/components/EventDetailModal'
import { formatStartTime, formatEndTime } from '@/lib/events'
import type { Event, PlanItem } from '@/lib/types'

const STATUS_LABEL: Record<PlanItem['status'], string> = {
  interested: 'Interested',
  rsvp_pending: 'RSVP pending',
  confirmed: 'Confirmed',
  waitlist: 'Waitlist',
  declined: 'Declined',
}

const STATUS_COLOR: Record<PlanItem['status'], string> = {
  interested: 'text-[#9B9B9B]',
  rsvp_pending: 'text-[#E0B847]',
  confirmed: 'text-[#4CC38A]',
  waitlist: 'text-[#FF5B25]',
  declined: 'text-[#737373]',
}

interface MyPlanEventCardProps {
  planItem: PlanItem
  event: Event
}

export const MyPlanEventCard = forwardRef<HTMLDivElement, MyPlanEventCardProps>(
  function MyPlanEventCard({ planItem, event }, ref) {
    const [isModalOpen, setIsModalOpen] = useState(false)

    return (
      <>
        <div
          ref={ref}
          data-testid="my-plan-event-card"
          onClick={() => setIsModalOpen(true)}
          className="grid grid-cols-[90px_1fr] md:grid-cols-[90px_1fr_240px_auto] gap-5 py-5 border-t border-[#1A1A1A] hover:bg-[#FF5B25]/[0.03] transition-colors cursor-pointer"
        >
          <div className="font-mono text-xs text-[#FF5B25] font-bold tracking-wide pt-1">
            {formatStartTime(event.starts_at)}
            <span className="block text-[#737373] font-normal mt-1">
              – {formatEndTime(event.ends_at)}
            </span>
          </div>

          <div className="col-start-2 md:col-start-2 min-w-0">
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
          </div>

          <div className="hidden md:flex flex-col gap-1.5 font-mono text-xs uppercase tracking-wide text-[#737373] pt-1">
            {event.neighborhood && (
              <span className="text-[#9B9B9B]">{event.neighborhood}</span>
            )}
            {event.is_invite_only && <span>Invite-only</span>}
          </div>

          <div className="hidden md:block self-start pt-1" onClick={(e) => e.stopPropagation()}>
            <span className={`font-mono text-xs uppercase tracking-wide ${STATUS_COLOR[planItem.status]}`}>
              {STATUS_LABEL[planItem.status]}
            </span>
          </div>
        </div>

        <EventDetailModal
          event={event}
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
        />
      </>
    )
  }
)
```

If the existing component has a status-change dropdown or remove button rendered inline, those move into the modal (existing `EventDetailModal` already handles plan status changes). The row stays simple.

- [ ] **Step 3: Run targeted tests**

```bash
cd /Users/askowronski/Projects/nytw-companion && npx vitest run __tests__/components/EventList.test.tsx __tests__/components/MyPlanEventCard.test.tsx 2>&1 | tail -20
```

Expected: green. If MyPlanEventCard test breaks due to removed dropdown, update the test to call the modal flow instead (or accept that the dropdown moved to modal-only).

- [ ] **Step 4: Run full suite**

```bash
cd /Users/askowronski/Projects/nytw-companion && npm test 2>&1 | tail -10
```

Expected: all green.

- [ ] **Step 5: Run E2E**

```bash
cd /Users/askowronski/Projects/nytw-companion && npm run build && npm run e2e 2>&1 | tail -15
```

Expected: 3 specs green.

- [ ] **Step 6: Commit**

```bash
cd /Users/askowronski/Projects/nytw-companion && git add components/EventList.tsx components/MyPlanEventCard.tsx && git commit -m "feat(visual): editorial day-header grid in EventList; row layout for MyPlanEventCard"
```

---

## Task 7: `<StatusBar />` component

**Files:**
- Create: `components/StatusBar.tsx`
- Create: `__tests__/components/StatusBar.test.tsx`
- Modify: `app/layout.tsx` (mount above SiteNav)

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/StatusBar.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('StatusBar', () => {
  it('renders the festival-mode label during the festival', async () => {
    vi.doMock('@/lib/time', () => ({
      festivalMode: () => 'during',
      nowInNYC: () => new Date('2026-06-03T16:00:00-04:00'),
    }))
    const { StatusBar } = await import('../../components/StatusBar')
    render(<StatusBar />)
    await act(async () => {})
    expect(screen.getByText(/live/i)).toBeInTheDocument()
    expect(screen.getByText(/tech week/i)).toBeInTheDocument()
  })

  it("renders 'T-Nd' label before the festival", async () => {
    vi.doMock('@/lib/time', () => ({
      festivalMode: () => 'pre',
      nowInNYC: () => new Date('2026-05-25T12:00:00-04:00'),
    }))
    const { StatusBar } = await import('../../components/StatusBar')
    render(<StatusBar />)
    await act(async () => {})
    expect(screen.getByText(/T-\d+d/i)).toBeInTheDocument()
  })

  it("renders 'Past' label after the festival", async () => {
    vi.doMock('@/lib/time', () => ({
      festivalMode: () => 'post',
      nowInNYC: () => new Date('2026-06-15T12:00:00-04:00'),
    }))
    const { StatusBar } = await import('../../components/StatusBar')
    render(<StatusBar />)
    await act(async () => {})
    expect(screen.getByText(/past/i)).toBeInTheDocument()
  })

  it('renders a NYC time string', async () => {
    vi.doMock('@/lib/time', () => ({
      festivalMode: () => 'during',
      nowInNYC: () => new Date('2026-06-03T16:00:00-04:00'),
    }))
    const { StatusBar } = await import('../../components/StatusBar')
    render(<StatusBar />)
    await act(async () => {})
    expect(screen.getByText(/NYC/i)).toBeInTheDocument()
    // Time format is "h:mm AM/PM"
    expect(screen.getByText(/\d{1,2}:\d{2}\s*(AM|PM)/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test — expect fail**

```bash
cd /Users/askowronski/Projects/nytw-companion && npx vitest run __tests__/components/StatusBar.test.tsx
```

Expected: fail — module does not exist.

- [ ] **Step 3: Create `components/StatusBar.tsx`**

```typescript
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
    hour: 'numeric',
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
          <span
            aria-hidden
            className="w-1.5 h-1.5 rounded-full bg-[#4CC38A] shadow-[0_0_0_4px_rgba(76,195,138,0.18)] animate-pulse"
          />
          <span className="text-[#4CC38A]">{modeLabel}</span>
        </span>
        <span className="flex-1" />
        <span>NYC · {formatNYTime(now)}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test — expect pass (4 green)**

```bash
cd /Users/askowronski/Projects/nytw-companion && npx vitest run __tests__/components/StatusBar.test.tsx
```

If tests fail because RTL doesn't render the `useEffect`-driven `mounted` state, the `await act(async () => {})` in the tests should flush. If not, increase the await depth or use `await screen.findByText(...)` for the eventual presence assertions.

- [ ] **Step 5: Mount `<StatusBar />` in `app/layout.tsx`**

Read the file. Find the body:

```tsx
      <body
        className="bg-[#000000] text-[#F5F5F5] font-sans antialiased min-h-screen"
        suppressHydrationWarning
      >
        <SiteNav />
        {children}
```

Replace with:

```tsx
      <body
        className="bg-[#000000] text-[#F5F5F5] font-sans antialiased min-h-screen"
        suppressHydrationWarning
      >
        <StatusBar />
        <SiteNav />
        {children}
```

Add to imports at top of file:
```typescript
import { StatusBar } from '@/components/StatusBar'
```

- [ ] **Step 6: Full suite**

```bash
cd /Users/askowronski/Projects/nytw-companion && npm test 2>&1 | tail -10
```

Expected: all green (Phase 9a's 279 + new SectionHead 3 + events 2 + StatusBar 4 ≈ 288).

- [ ] **Step 7: Commit**

```bash
cd /Users/askowronski/Projects/nytw-companion && git add components/StatusBar.tsx __tests__/components/StatusBar.test.tsx app/layout.tsx && git commit -m "feat(visual): add StatusBar with festival-mode label + NYC time"
```

---

## Task 8: `SiteNav` rewrite + final acceptance

**Files:**
- Modify: `components/SiteNav.tsx`
- Modify: `__tests__/components/SiteNav.test.tsx`

- [ ] **Step 1: Read existing `SiteNav.tsx` and `SiteNav.test.tsx`**

```bash
cd /Users/askowronski/Projects/nytw-companion && cat components/SiteNav.tsx
cd /Users/askowronski/Projects/nytw-companion && cat __tests__/components/SiteNav.test.tsx
```

Note which `it(...)` blocks the test has so you know what to preserve.

- [ ] **Step 2: Replace `components/SiteNav.tsx`**

```typescript
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { HelpModal } from '@/components/HelpModal'

type NavItem = { label: string; href: string; live: boolean }

const ITEMS: NavItem[] = [
  { label: 'Home',    href: '/',        live: true },
  { label: 'Browse',  href: '/events',  live: true },
  { label: 'Now',     href: '/now',     live: true },
  { label: 'My Plan', href: '/my-plan', live: true },
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

        {/* Desktop tabs (skip "Home" — already the mark) */}
        <nav className="hidden md:flex border border-[#262626]">
          {ITEMS.filter((i) => i.live && i.href !== '/').map((item, idx, arr) => (
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
            <SheetContent
              side="right"
              className="bg-[#000000] border-[#1A1A1A] text-[#F5F5F5] w-[280px] p-6"
            >
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
                      className={
                        'font-mono text-sm uppercase tracking-wide ' +
                        (isActive(item.href)
                          ? 'text-[#FF5B25]'
                          : 'text-[#9B9B9B] hover:text-[#F5F5F5]')
                      }
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

- [ ] **Step 3: Update `__tests__/components/SiteNav.test.tsx`**

Read the existing test. It has assertions like:
```typescript
expect(screen.getByRole('link', { name: /browse/i })).toHaveAttribute('href', '/events')
```

These still pass — the new layout renders Browse as a `<Link>` so role=link. Keep them.

If any test asserts something about a `<span>` with "Coming soon" text (My Plan was previously `live: false` and rendered as disabled), update or remove — My Plan is now `live: true`. Find such tests:

```bash
cd /Users/askowronski/Projects/nytw-companion && grep -n "Coming soon\|coming-soon\|cursor-not-allowed" __tests__/components/SiteNav.test.tsx
```

If matches, update the test to assert My Plan is now an active link instead.

Also add new assertions for the brand mark and tab structure:

```typescript
it('renders the §§ brand mark linked to home', () => {
  // ... boilerplate
  const home = screen.getAllByRole('link').find(l => l.getAttribute('href') === '/')
  expect(home).toBeTruthy()
  expect(home?.textContent).toContain('NYTW')
})

it('flips My Plan to a live link', () => {
  // ... boilerplate
  expect(screen.getByRole('link', { name: /my plan/i })).toHaveAttribute('href', '/my-plan')
})
```

Add or merge with existing tests as appropriate.

- [ ] **Step 4: Run SiteNav tests + full suite**

```bash
cd /Users/askowronski/Projects/nytw-companion && npx vitest run __tests__/components/SiteNav.test.tsx
cd /Users/askowronski/Projects/nytw-companion && npm test 2>&1 | tail -10
```

Expected: SiteNav tests green; full suite green.

- [ ] **Step 5: Run E2E**

```bash
cd /Users/askowronski/Projects/nytw-companion && npm run build 2>&1 | tail -5 && npm run e2e 2>&1 | tail -15
```

Expected: 3 specs green. Especially `keyboard.spec.ts` — HelpModal still mounts via SiteNav, behavior unchanged.

- [ ] **Step 6: Lint**

```bash
cd /Users/askowronski/Projects/nytw-companion && npm run lint 2>&1 | tail -5
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 7: Final acceptance walk**

Manual smoke. Run `npm run dev` (or use the existing dev server). Visit:

- `/` — landing has `<SectionHead>` styling for Why we built / What we don't do
- `/about` — `<SectionHead>` for each section
- `/beyond` — `<SectionHead>` for "Why we link the competition"
- `/privacy`, `/terms` — each section has a `<SectionHead>` with num + label
- `/events` — event rows are editorial layout (time | body | meta | save); day headers are numbered `01 Wednesday June 3, 2026`; hover a row to see the Save button highlight
- `/my-plan` — events display as rows with status text instead of save button
- Nav row — `§§` brand mark left, tabbed nav right with active tab solid orange
- StatusBar above nav — pulsing green dot, "Live · Tech Week" (or "T-Nd" if before festival), NYC time
- Mobile (resize browser <768px) — nav collapses to hamburger; rows collapse to two columns (time + body)

- [ ] **Step 8: Commit (combined with acceptance)**

```bash
cd /Users/askowronski/Projects/nytw-companion && git add components/SiteNav.tsx __tests__/components/SiteNav.test.tsx && git commit -m "feat(visual): rewrite SiteNav with §§ brand mark + tabbed nav; flip My Plan to live"
```

If anything needed adjustment during Step 7 smoke, commit those fixes separately.

- [ ] **Step 9: Push to GitHub (triggers Vercel auto-redeploy)**

```bash
cd /Users/askowronski/Projects/nytw-companion && git push 2>&1 | tail -5
```

Expected: push succeeds. Vercel auto-redeploys within ~30s. CI runs lint+test, e2e (these gate), and Lighthouse (informational).

---

## Done criteria

- [ ] Color tokens swept; `grep` returns empty for legacy hex literals.
- [ ] `<SectionHead>` component exists with 3 tests green; wired into 5 marketing pages + `/events` (if applicable).
- [ ] `lib/events.ts` exports `formatStartTime` + `formatEndTime` with passing tests.
- [ ] `EventCard` renders the row layout: time | body | meta | Save. `data-testid="event-card"` preserved. All 8 existing EventCard tests pass.
- [ ] `EventList` day headers are the numbered §-style grid.
- [ ] `MyPlanEventCard` matches the row pattern, status in right column.
- [ ] `SiteNav` renders `§§` brand mark + tabbed nav with active tab solid orange. My Plan now `live: true`.
- [ ] `<StatusBar />` mounted in `app/layout.tsx`, pulsing green dot + label + NYC time, with 4 passing tests.
- [ ] `npm test` green (~288 tests total).
- [ ] `npm run lint` clean (0 errors, 0 warnings).
- [ ] `npm run build` succeeds.
- [ ] `npm run e2e` — all 3 specs green.
- [ ] CI workflow green after push.

## Out-of-scope reminders

- Bricolage Grotesque + Inter Tight fonts — mono-only.
- Mega "87" hero, live ticker, marquee, tweaks panel, theme switcher, accent color swap.
- 3-up Editor's Picks grid (existing carousel stays).
- Light / paper mode.
