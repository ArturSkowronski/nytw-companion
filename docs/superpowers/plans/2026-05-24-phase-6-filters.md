# Phase 6 — Filters (lean MVP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a URL-shareable filter layer to `/events` — tag chips and three toggles (Editor's Picks only, Free food/drinks, Hide invite-only) — opened via a drawer from the toolbar. Tag chips inside `EventCard` become click-to-filter buttons.

**Architecture:** Filters live entirely in URL search params (`?tags=`, `?editorsPicks=`, `?freeFood=`, `?hideInviteOnly=`). A pure `lib/filters.ts` module owns parse / serialize / apply. A `useFilters()` hook wraps Next's `useSearchParams` + `useRouter`. `EventList` runs the pipeline `events → applyFilters → fuse.search → groupByDay`, renders a `FiltersTrigger` + `ActiveFiltersBar`, mounts the drawer, and passes the filtered set to both the timeline render and to `EventMapLoader`. `/my-plan`, `/plan` (Concierge), `EditorsPicksCarousel`, and `MyPlanWidget` are untouched.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind, shadcn `Sheet` (Base UI render prop — `render={<Component />}`, not `asChild`), Fuse.js (already in use), Vitest + Testing Library.

**Reference design:** `docs/superpowers/specs/2026-05-24-phase-6-filters-design.md`

---

## Conventions

- Read patterns from `components/ViewToggle.tsx` for URL-as-state writes (`router.replace`, `URLSearchParams`, `{ scroll: false }`).
- All filter components are `'use client'`.
- All URL writes wrapped in `React.startTransition` to avoid loading boundaries on chip toggles.
- All boolean URL params: only the literal value `1` parses as true; anything else (incl. `0`, `true`, absent) is false. Absent in URL = filter off.
- Tag tokens: lowercased + trimmed during parse, sorted alphabetically during serialize, deduped.
- Per `feedback_shadcn_base_ui.md` — shadcn primitives in this repo use Base UI's render-prop pattern. Use `render={<Component />}` rather than `asChild` if reusing primitives.

---

## Task 1: `lib/filters.ts` — pure filter logic (TDD)

**Files:**
- Create: `lib/filters.ts`
- Test: `__tests__/lib/filters.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/filters.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  parseFilters,
  serializeFilters,
  applyFilters,
  tagFrequency,
  type Filters,
} from '../../lib/filters'
import type { Event } from '../../lib/types'

function mkEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'e1',
    title: 't',
    description: 'd',
    host: 'h',
    starts_at: '2026-06-03T22:00:00Z',
    ends_at: '2026-06-04T01:00:00Z',
    venue_name: null,
    address: null,
    lat: null,
    lng: null,
    neighborhood: null,
    rsvp_url: 'https://lu.ma/x',
    rsvp_platform: 'luma',
    tags: [],
    audience_tags: [],
    format: null,
    capacity: null,
    is_invite_only: false,
    has_free_food: false,
    has_free_drinks: false,
    is_editors_pick: false,
    editors_pick_blurb: null,
    is_virtuslab_event: false,
    source: 's',
    source_url: 's',
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

describe('parseFilters', () => {
  it('returns defaults for empty params', () => {
    const f = parseFilters(new URLSearchParams(''))
    expect(f).toEqual({ tags: [], editorsPicks: false, freeFood: false, hideInviteOnly: false })
  })

  it('parses comma-separated tags', () => {
    expect(parseFilters(new URLSearchParams('tags=ai-infra,devtools')).tags)
      .toEqual(['ai-infra', 'devtools'])
  })

  it('treats empty tags param as no tags', () => {
    expect(parseFilters(new URLSearchParams('tags=')).tags).toEqual([])
  })

  it('drops empty tokens, lowercases, and dedupes tags', () => {
    expect(parseFilters(new URLSearchParams('tags=,,,Foo,FOO,foo,')).tags)
      .toEqual(['foo'])
  })

  it('parses literal 1 as true for editorsPicks', () => {
    expect(parseFilters(new URLSearchParams('editorsPicks=1')).editorsPicks).toBe(true)
  })

  it('treats 0/true/missing as false for bool params', () => {
    expect(parseFilters(new URLSearchParams('editorsPicks=0')).editorsPicks).toBe(false)
    expect(parseFilters(new URLSearchParams('editorsPicks=true')).editorsPicks).toBe(false)
    expect(parseFilters(new URLSearchParams('')).editorsPicks).toBe(false)
  })

  it('ignores unknown params', () => {
    const f = parseFilters(new URLSearchParams('tags=ai-infra&unknownParam=foo'))
    expect(f.tags).toEqual(['ai-infra'])
  })
})

describe('serializeFilters', () => {
  it('returns empty string for defaults', () => {
    expect(serializeFilters({ tags: [], editorsPicks: false, freeFood: false, hideInviteOnly: false }))
      .toBe('')
  })

  it('serializes booleans as 1', () => {
    expect(serializeFilters({ tags: [], editorsPicks: true, freeFood: false, hideInviteOnly: false }))
      .toBe('editorsPicks=1')
  })

  it('sorts tag tokens alphabetically', () => {
    expect(serializeFilters({ tags: ['devtools', 'ai-infra'], editorsPicks: false, freeFood: false, hideInviteOnly: false }))
      .toBe('tags=ai-infra%2Cdevtools')
  })

  it('round-trips parse → serialize for canonical input', () => {
    const input = 'editorsPicks=1&tags=ai-infra%2Cdevtools'
    const parsed = parseFilters(new URLSearchParams(input))
    expect(serializeFilters(parsed)).toBe(input)
  })
})

describe('applyFilters', () => {
  const evs: Event[] = [
    mkEvent({ id: 'a', is_editors_pick: true,  tags: ['ai-infra'] }),
    mkEvent({ id: 'b', has_free_food: true,    tags: ['devtools'] }),
    mkEvent({ id: 'c', has_free_drinks: true,  tags: ['ai-infra', 'devtools'] }),
    mkEvent({ id: 'd', is_invite_only: true,   tags: ['founders'] }),
    mkEvent({ id: 'e' }),
  ]

  it('identity when no filters', () => {
    const f: Filters = { tags: [], editorsPicks: false, freeFood: false, hideInviteOnly: false }
    expect(applyFilters(evs, f).map(e => e.id)).toEqual(['a','b','c','d','e'])
  })

  it('editorsPicks keeps only is_editors_pick', () => {
    expect(applyFilters(evs, { tags: [], editorsPicks: true, freeFood: false, hideInviteOnly: false })
      .map(e => e.id)).toEqual(['a'])
  })

  it('freeFood matches has_free_food OR has_free_drinks', () => {
    expect(applyFilters(evs, { tags: [], editorsPicks: false, freeFood: true, hideInviteOnly: false })
      .map(e => e.id)).toEqual(['b','c'])
  })

  it('hideInviteOnly drops invite-only events', () => {
    expect(applyFilters(evs, { tags: [], editorsPicks: false, freeFood: false, hideInviteOnly: true })
      .map(e => e.id)).toEqual(['a','b','c','e'])
  })

  it('tag filter is OR across selected tags', () => {
    expect(applyFilters(evs, { tags: ['ai-infra', 'founders'], editorsPicks: false, freeFood: false, hideInviteOnly: false })
      .map(e => e.id)).toEqual(['a','c','d'])
  })

  it('combines categories with AND', () => {
    expect(applyFilters(evs, { tags: ['ai-infra'], editorsPicks: true, freeFood: false, hideInviteOnly: false })
      .map(e => e.id)).toEqual(['a'])
  })
})

describe('tagFrequency', () => {
  it('counts and sorts desc, ties broken alphabetically', () => {
    const evs = [
      mkEvent({ id: '1', tags: ['ai-infra', 'devtools'] }),
      mkEvent({ id: '2', tags: ['ai-infra'] }),
      mkEvent({ id: '3', tags: ['founders'] }),
    ]
    expect(tagFrequency(evs)).toEqual([
      { tag: 'ai-infra', count: 2 },
      { tag: 'devtools', count: 1 },
      { tag: 'founders', count: 1 },
    ])
  })

  it('returns empty for empty input', () => {
    expect(tagFrequency([])).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests — expect fail**

```bash
npx vitest run __tests__/lib/filters.test.ts
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `lib/filters.ts`**

Create `lib/filters.ts`:

```typescript
import type { Event } from './types'

export interface Filters {
  tags: string[]
  editorsPicks: boolean
  freeFood: boolean
  hideInviteOnly: boolean
}

const BOOL_KEYS = ['editorsPicks', 'freeFood', 'hideInviteOnly'] as const

export function parseFilters(params: URLSearchParams): Filters {
  const raw = params.get('tags') ?? ''
  const tags = Array.from(
    new Set(
      raw
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
    )
  )
  return {
    tags,
    editorsPicks: params.get('editorsPicks') === '1',
    freeFood: params.get('freeFood') === '1',
    hideInviteOnly: params.get('hideInviteOnly') === '1',
  }
}

export function serializeFilters(f: Filters): string {
  const out = new URLSearchParams()
  for (const key of BOOL_KEYS) {
    if (f[key]) out.set(key, '1')
  }
  if (f.tags.length > 0) {
    const sorted = [...f.tags].sort()
    out.set('tags', sorted.join(','))
  }
  // Sort keys alphabetically for stable URLs
  const sortedEntries = Array.from(out.entries()).sort(([a], [b]) => a.localeCompare(b))
  const result = new URLSearchParams()
  for (const [k, v] of sortedEntries) result.set(k, v)
  return result.toString()
}

export function applyFilters(events: Event[], f: Filters): Event[] {
  return events.filter((e) => {
    if (f.editorsPicks && !e.is_editors_pick) return false
    if (f.freeFood && !(e.has_free_food || e.has_free_drinks)) return false
    if (f.hideInviteOnly && e.is_invite_only) return false
    if (f.tags.length > 0 && !f.tags.some((t) => e.tags.includes(t))) return false
    return true
  })
}

export function tagFrequency(events: Event[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const e of events) {
    for (const t of e.tags) {
      counts.set(t, (counts.get(t) ?? 0) + 1)
    }
  }
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => (b.count - a.count) || a.tag.localeCompare(b.tag))
}

export function activeFilterCount(f: Filters): number {
  let n = 0
  if (f.editorsPicks) n++
  if (f.freeFood) n++
  if (f.hideInviteOnly) n++
  n += f.tags.length
  return n
}
```

- [ ] **Step 4: Run tests — expect pass (all green)**

```bash
npx vitest run __tests__/lib/filters.test.ts
```

Expected: PASS (all tests green).

- [ ] **Step 5: Commit**

```bash
git add lib/filters.ts __tests__/lib/filters.test.ts
git commit -m "$(cat <<'EOF'
feat(filters): add pure filter logic with parse/serialize/apply
EOF
)"
```

---

## Task 2: `lib/use-filters.ts` — React hook over Next router (TDD)

**Files:**
- Create: `lib/use-filters.ts`
- Test: `__tests__/lib/use-filters.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/use-filters.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFilters } from '../../lib/use-filters'

const replaceMock = vi.fn()
let currentParams = new URLSearchParams('')
const pathnameMock = '/events'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => currentParams,
  usePathname: () => pathnameMock,
}))

beforeEach(() => {
  replaceMock.mockClear()
  currentParams = new URLSearchParams('')
})

describe('useFilters', () => {
  it('returns defaults when URL is empty', () => {
    const { result } = renderHook(() => useFilters())
    expect(result.current.filters).toEqual({
      tags: [], editorsPicks: false, freeFood: false, hideInviteOnly: false,
    })
    expect(result.current.activeCount).toBe(0)
  })

  it('parses filters from URL', () => {
    currentParams = new URLSearchParams('tags=ai-infra&editorsPicks=1')
    const { result } = renderHook(() => useFilters())
    expect(result.current.filters.tags).toEqual(['ai-infra'])
    expect(result.current.filters.editorsPicks).toBe(true)
    expect(result.current.activeCount).toBe(2)
  })

  it('toggleTag adds tag when absent', () => {
    const { result } = renderHook(() => useFilters())
    act(() => { result.current.toggleTag('ai-infra') })
    expect(replaceMock).toHaveBeenCalledWith('/events?tags=ai-infra', { scroll: false })
  })

  it('toggleTag removes tag when present', () => {
    currentParams = new URLSearchParams('tags=ai-infra,devtools')
    const { result } = renderHook(() => useFilters())
    act(() => { result.current.toggleTag('ai-infra') })
    expect(replaceMock).toHaveBeenCalledWith('/events?tags=devtools', { scroll: false })
  })

  it('setFilter writes boolean to URL', () => {
    const { result } = renderHook(() => useFilters())
    act(() => { result.current.setFilter('editorsPicks', true) })
    expect(replaceMock).toHaveBeenCalledWith('/events?editorsPicks=1', { scroll: false })
  })

  it('reset clears filter params but preserves day/view/q', () => {
    currentParams = new URLSearchParams('tags=ai-infra&editorsPicks=1&day=wed&view=map&q=hack')
    const { result } = renderHook(() => useFilters())
    act(() => { result.current.reset() })
    expect(replaceMock).toHaveBeenCalledWith('/events?day=wed&q=hack&view=map', { scroll: false })
  })
})
```

- [ ] **Step 2: Run tests — expect fail**

```bash
npx vitest run __tests__/lib/use-filters.test.tsx
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `lib/use-filters.ts`**

Create `lib/use-filters.ts`:

```typescript
'use client'

import { startTransition, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import {
  parseFilters,
  serializeFilters,
  activeFilterCount,
  type Filters,
} from './filters'

const FILTER_PARAM_KEYS = ['tags', 'editorsPicks', 'freeFood', 'hideInviteOnly'] as const

type BoolKey = 'editorsPicks' | 'freeFood' | 'hideInviteOnly'

function buildUrl(pathname: string, params: URLSearchParams): string {
  const sortedEntries = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b))
  const sorted = new URLSearchParams()
  for (const [k, v] of sortedEntries) sorted.set(k, v)
  const qs = sorted.toString()
  return qs ? `${pathname}?${qs}` : pathname
}

function writeFilters(
  base: URLSearchParams,
  next: Filters
): URLSearchParams {
  const out = new URLSearchParams(base.toString())
  for (const key of FILTER_PARAM_KEYS) out.delete(key)
  const filterQs = serializeFilters(next)
  if (filterQs) {
    for (const [k, v] of new URLSearchParams(filterQs).entries()) out.set(k, v)
  }
  return out
}

export function useFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  const filters = useMemo(
    () => parseFilters(new URLSearchParams(searchParams.toString())),
    [searchParams]
  )

  const commit = useCallback(
    (next: Filters) => {
      const merged = writeFilters(new URLSearchParams(searchParams.toString()), next)
      const url = buildUrl(pathname, merged)
      startTransition(() => {
        router.replace(url, { scroll: false })
      })
    },
    [router, pathname, searchParams]
  )

  const toggleTag = useCallback(
    (tag: string) => {
      const t = tag.trim().toLowerCase()
      if (!t) return
      const present = filters.tags.includes(t)
      const tags = present ? filters.tags.filter((x) => x !== t) : [...filters.tags, t]
      commit({ ...filters, tags })
    },
    [filters, commit]
  )

  const setFilter = useCallback(
    (key: BoolKey, value: boolean) => {
      commit({ ...filters, [key]: value })
    },
    [filters, commit]
  )

  const reset = useCallback(() => {
    commit({ tags: [], editorsPicks: false, freeFood: false, hideInviteOnly: false })
  }, [commit])

  const activeCount = activeFilterCount(filters)

  return { filters, toggleTag, setFilter, reset, activeCount }
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run __tests__/lib/use-filters.test.tsx
```

Expected: PASS (6 tests green).

- [ ] **Step 5: Commit**

```bash
git add lib/use-filters.ts __tests__/lib/use-filters.test.tsx
git commit -m "$(cat <<'EOF'
feat(filters): add useFilters hook over Next router with toggleTag/setFilter/reset
EOF
)"
```

---

## Task 3: `components/filters/FiltersTrigger.tsx` (TDD)

**Files:**
- Create: `components/filters/FiltersTrigger.tsx`
- Test: `__tests__/components/FiltersTrigger.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/components/FiltersTrigger.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FiltersTrigger } from '../../components/filters/FiltersTrigger'

describe('FiltersTrigger', () => {
  it('renders Filters label with no badge when activeCount is 0', () => {
    render(<FiltersTrigger activeCount={0} onClick={() => {}} />)
    expect(screen.getByText('Filters')).toBeInTheDocument()
    expect(screen.queryByTestId('filters-badge')).toBeNull()
  })

  it('renders badge with active count when > 0', () => {
    render(<FiltersTrigger activeCount={3} onClick={() => {}} />)
    expect(screen.getByTestId('filters-badge')).toHaveTextContent('3')
  })

  it('invokes onClick when pressed', () => {
    const onClick = vi.fn()
    render(<FiltersTrigger activeCount={0} onClick={onClick} />)
    fireEvent.click(screen.getByRole('button', { name: /filters/i }))
    expect(onClick).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run tests — expect fail**

```bash
npx vitest run __tests__/components/FiltersTrigger.test.tsx
```

Expected: FAIL — component does not exist.

- [ ] **Step 3: Implement `components/filters/FiltersTrigger.tsx`**

```typescript
'use client'

interface FiltersTriggerProps {
  activeCount: number
  onClick: () => void
}

export function FiltersTrigger({ activeCount, onClick }: FiltersTriggerProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={activeCount > 0 ? `Filters (${activeCount} active)` : 'Filters'}
      className="inline-flex items-center gap-2 rounded-md border border-[#2A2A2A] bg-[#111111] px-3 py-1.5 font-mono text-xs text-[#A3A3A3] hover:text-[#FAFAFA] hover:border-[#333333] transition-colors"
    >
      <span>Filters</span>
      {activeCount > 0 && (
        <span
          data-testid="filters-badge"
          className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-[#FF6B35] text-white text-[10px] px-1.5"
        >
          {activeCount}
        </span>
      )}
    </button>
  )
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run __tests__/components/FiltersTrigger.test.tsx
```

Expected: PASS (3 tests green).

- [ ] **Step 5: Commit**

```bash
git add components/filters/FiltersTrigger.tsx __tests__/components/FiltersTrigger.test.tsx
git commit -m "$(cat <<'EOF'
feat(filters): add FiltersTrigger button with active-count badge
EOF
)"
```

---

## Task 4: `components/filters/ActiveFiltersBar.tsx` (TDD)

**Files:**
- Create: `components/filters/ActiveFiltersBar.tsx`
- Test: `__tests__/components/ActiveFiltersBar.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/components/ActiveFiltersBar.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ActiveFiltersBar } from '../../components/filters/ActiveFiltersBar'
import type { Filters } from '../../lib/filters'

const EMPTY: Filters = { tags: [], editorsPicks: false, freeFood: false, hideInviteOnly: false }

describe('ActiveFiltersBar', () => {
  it('renders nothing when no filters active', () => {
    const { container } = render(
      <ActiveFiltersBar filters={EMPTY} onToggleTag={() => {}} onSetFilter={() => {}} onReset={() => {}} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders a chip per active filter', () => {
    render(
      <ActiveFiltersBar
        filters={{ ...EMPTY, tags: ['ai-infra', 'devtools'], editorsPicks: true }}
        onToggleTag={() => {}}
        onSetFilter={() => {}}
        onReset={() => {}}
      />
    )
    expect(screen.getByText('ai-infra')).toBeInTheDocument()
    expect(screen.getByText('devtools')).toBeInTheDocument()
    expect(screen.getByText(/editor.s picks/i)).toBeInTheDocument()
  })

  it('clicking a tag chip × invokes onToggleTag with that tag', () => {
    const onToggleTag = vi.fn()
    render(
      <ActiveFiltersBar
        filters={{ ...EMPTY, tags: ['ai-infra'] }}
        onToggleTag={onToggleTag}
        onSetFilter={() => {}}
        onReset={() => {}}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /remove ai-infra filter/i }))
    expect(onToggleTag).toHaveBeenCalledWith('ai-infra')
  })

  it('Clear all invokes onReset', () => {
    const onReset = vi.fn()
    render(
      <ActiveFiltersBar
        filters={{ ...EMPTY, editorsPicks: true }}
        onToggleTag={() => {}}
        onSetFilter={() => {}}
        onReset={onReset}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /clear all/i }))
    expect(onReset).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run tests — expect fail**

```bash
npx vitest run __tests__/components/ActiveFiltersBar.test.tsx
```

Expected: FAIL — component does not exist.

- [ ] **Step 3: Implement `components/filters/ActiveFiltersBar.tsx`**

```typescript
'use client'

import type { Filters } from '@/lib/filters'

interface ActiveFiltersBarProps {
  filters: Filters
  onToggleTag: (tag: string) => void
  onSetFilter: (key: 'editorsPicks' | 'freeFood' | 'hideInviteOnly', value: boolean) => void
  onReset: () => void
}

const TOGGLE_LABELS: Record<'editorsPicks' | 'freeFood' | 'hideInviteOnly', string> = {
  editorsPicks: "Editor's Picks",
  freeFood: 'Free food/drinks',
  hideInviteOnly: 'Hide invite-only',
}

function Chip({ label, ariaLabel, onClear }: { label: string; ariaLabel: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#2A2A2A] bg-[#111111] px-2.5 py-1 font-mono text-[11px] text-[#A3A3A3]">
      {label}
      <button
        type="button"
        onClick={onClear}
        aria-label={ariaLabel}
        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[#666666] hover:text-[#FAFAFA] hover:bg-[#2A2A2A]"
      >
        ×
      </button>
    </span>
  )
}

export function ActiveFiltersBar({ filters, onToggleTag, onSetFilter, onReset }: ActiveFiltersBarProps) {
  const active =
    filters.tags.length > 0 ||
    filters.editorsPicks ||
    filters.freeFood ||
    filters.hideInviteOnly

  if (!active) return null

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {filters.tags.map((tag) => (
        <Chip
          key={`tag-${tag}`}
          label={tag}
          ariaLabel={`Remove ${tag} filter`}
          onClear={() => onToggleTag(tag)}
        />
      ))}
      {filters.editorsPicks && (
        <Chip
          label={TOGGLE_LABELS.editorsPicks}
          ariaLabel="Remove Editor's Picks filter"
          onClear={() => onSetFilter('editorsPicks', false)}
        />
      )}
      {filters.freeFood && (
        <Chip
          label={TOGGLE_LABELS.freeFood}
          ariaLabel="Remove Free food/drinks filter"
          onClear={() => onSetFilter('freeFood', false)}
        />
      )}
      {filters.hideInviteOnly && (
        <Chip
          label={TOGGLE_LABELS.hideInviteOnly}
          ariaLabel="Remove Hide invite-only filter"
          onClear={() => onSetFilter('hideInviteOnly', false)}
        />
      )}
      <button
        type="button"
        onClick={onReset}
        className="ml-1 font-mono text-[11px] text-[#FF6B35] hover:underline"
      >
        Clear all
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run __tests__/components/ActiveFiltersBar.test.tsx
```

Expected: PASS (4 tests green).

- [ ] **Step 5: Commit**

```bash
git add components/filters/ActiveFiltersBar.tsx __tests__/components/ActiveFiltersBar.test.tsx
git commit -m "$(cat <<'EOF'
feat(filters): add ActiveFiltersBar with per-chip remove and Clear all
EOF
)"
```

---

## Task 5: `components/filters/TagFilterChips.tsx` (TDD)

**Files:**
- Create: `components/filters/TagFilterChips.tsx`
- Test: `__tests__/components/TagFilterChips.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/components/TagFilterChips.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TagFilterChips } from '../../components/filters/TagFilterChips'

const top21 = Array.from({ length: 21 }, (_, i) => ({ tag: `tag-${i}`, count: 21 - i }))
const top5 = top21.slice(0, 5)

describe('TagFilterChips', () => {
  it('renders all tags when ≤ 20, no Show all button', () => {
    render(<TagFilterChips tags={top5} selected={[]} onToggle={() => {}} />)
    expect(screen.getByText('tag-0')).toBeInTheDocument()
    expect(screen.getByText('tag-4')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /show all/i })).toBeNull()
  })

  it('renders top 20 and a Show all button when > 20; clicking reveals all', () => {
    render(<TagFilterChips tags={top21} selected={[]} onToggle={() => {}} />)
    expect(screen.getByText('tag-0')).toBeInTheDocument()
    expect(screen.queryByText('tag-20')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /show all/i }))
    expect(screen.getByText('tag-20')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests — expect fail**

```bash
npx vitest run __tests__/components/TagFilterChips.test.tsx
```

Expected: FAIL — component does not exist.

- [ ] **Step 3: Implement `components/filters/TagFilterChips.tsx`**

```typescript
'use client'

import { useState } from 'react'

interface TagFilterChipsProps {
  tags: { tag: string; count: number }[]
  selected: string[]
  onToggle: (tag: string) => void
}

const VISIBLE_LIMIT = 20

export function TagFilterChips({ tags, selected, onToggle }: TagFilterChipsProps) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? tags : tags.slice(0, VISIBLE_LIMIT)
  const hiddenCount = tags.length - VISIBLE_LIMIT

  if (tags.length === 0) {
    return (
      <p className="font-mono text-xs text-[#555555]">No tags available in current data</p>
    )
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map(({ tag, count }) => {
        const isSelected = selected.includes(tag)
        return (
          <button
            key={tag}
            type="button"
            onClick={() => onToggle(tag)}
            aria-pressed={isSelected}
            title={`${tag} (${count})`}
            className={
              `font-mono text-[11px] px-2 py-1 rounded border transition-colors ` +
              (isSelected
                ? 'bg-[#FF6B35] text-white border-[#FF6B35]'
                : 'bg-[#111111] text-[#A3A3A3] border-[#2A2A2A] hover:border-[#FF6B35] hover:text-[#FAFAFA]')
            }
          >
            <span className="truncate inline-block max-w-[160px] align-bottom">{tag}</span>
            <span className="ml-1 text-[#555555]">{count}</span>
          </button>
        )
      })}
      {!showAll && hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="font-mono text-[11px] px-2 py-1 text-[#FF6B35] hover:underline"
        >
          Show all (+{hiddenCount})
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run __tests__/components/TagFilterChips.test.tsx
```

Expected: PASS (2 tests green).

- [ ] **Step 5: Commit**

```bash
git add components/filters/TagFilterChips.tsx __tests__/components/TagFilterChips.test.tsx
git commit -m "$(cat <<'EOF'
feat(filters): add TagFilterChips with Show-all expander past 20 tags
EOF
)"
```

---

## Task 6: `components/filters/EventFilters.tsx` — drawer body (TDD)

**Files:**
- Create: `components/filters/EventFilters.tsx`
- Test: `__tests__/components/EventFilters.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/components/EventFilters.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EventFilters } from '../../components/filters/EventFilters'
import type { Filters } from '../../lib/filters'

const EMPTY: Filters = { tags: [], editorsPicks: false, freeFood: false, hideInviteOnly: false }

const tagPalette = [
  { tag: 'ai-infra', count: 5 },
  { tag: 'devtools', count: 3 },
]

describe('EventFilters', () => {
  it('renders all three toggles and the tag chips', () => {
    render(
      <EventFilters
        filters={EMPTY}
        tagPalette={tagPalette}
        onToggleTag={() => {}}
        onSetFilter={() => {}}
        onReset={() => {}}
      />
    )
    expect(screen.getByLabelText(/editor.s picks/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/free food/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/hide invite-only/i)).toBeInTheDocument()
    expect(screen.getByText('ai-infra')).toBeInTheDocument()
    expect(screen.getByText('devtools')).toBeInTheDocument()
  })

  it('clicking a tag chip invokes onToggleTag', () => {
    const onToggleTag = vi.fn()
    render(
      <EventFilters
        filters={EMPTY}
        tagPalette={tagPalette}
        onToggleTag={onToggleTag}
        onSetFilter={() => {}}
        onReset={() => {}}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /^ai-infra/i }))
    expect(onToggleTag).toHaveBeenCalledWith('ai-infra')
  })

  it("toggling Editor's Picks invokes onSetFilter", () => {
    const onSetFilter = vi.fn()
    render(
      <EventFilters
        filters={EMPTY}
        tagPalette={tagPalette}
        onToggleTag={() => {}}
        onSetFilter={onSetFilter}
        onReset={() => {}}
      />
    )
    fireEvent.click(screen.getByLabelText(/editor.s picks/i))
    expect(onSetFilter).toHaveBeenCalledWith('editorsPicks', true)
  })

  it('Reset all invokes onReset', () => {
    const onReset = vi.fn()
    render(
      <EventFilters
        filters={{ ...EMPTY, editorsPicks: true }}
        tagPalette={tagPalette}
        onToggleTag={() => {}}
        onSetFilter={() => {}}
        onReset={onReset}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /reset all/i }))
    expect(onReset).toHaveBeenCalledOnce()
  })

  it('shows empty-palette fallback when no tags', () => {
    render(
      <EventFilters
        filters={EMPTY}
        tagPalette={[]}
        onToggleTag={() => {}}
        onSetFilter={() => {}}
        onReset={() => {}}
      />
    )
    expect(screen.getByText(/no tags available/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests — expect fail**

```bash
npx vitest run __tests__/components/EventFilters.test.tsx
```

Expected: FAIL — component does not exist.

- [ ] **Step 3: Implement `components/filters/EventFilters.tsx`**

```typescript
'use client'

import { TagFilterChips } from './TagFilterChips'
import type { Filters } from '@/lib/filters'

interface EventFiltersProps {
  filters: Filters
  tagPalette: { tag: string; count: number }[]
  onToggleTag: (tag: string) => void
  onSetFilter: (key: 'editorsPicks' | 'freeFood' | 'hideInviteOnly', value: boolean) => void
  onReset: () => void
}

function ToggleRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label htmlFor={id} className="flex items-center justify-between py-2 cursor-pointer">
      <span className="font-mono text-sm text-[#FAFAFA]">{label}</span>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-[#FF6B35] cursor-pointer"
      />
    </label>
  )
}

export function EventFilters({
  filters,
  tagPalette,
  onToggleTag,
  onSetFilter,
  onReset,
}: EventFiltersProps) {
  return (
    <div className="flex flex-col gap-6">
      <section>
        <h3 className="font-mono text-xs uppercase tracking-widest text-[#666666] mb-2">
          Quick toggles
        </h3>
        <ToggleRow
          id="filter-editors-picks"
          label="Editor's Picks only"
          checked={filters.editorsPicks}
          onChange={(v) => onSetFilter('editorsPicks', v)}
        />
        <ToggleRow
          id="filter-free-food"
          label="Free food/drinks"
          checked={filters.freeFood}
          onChange={(v) => onSetFilter('freeFood', v)}
        />
        <ToggleRow
          id="filter-hide-invite-only"
          label="Hide invite-only"
          checked={filters.hideInviteOnly}
          onChange={(v) => onSetFilter('hideInviteOnly', v)}
        />
      </section>

      <section>
        <h3 className="font-mono text-xs uppercase tracking-widest text-[#666666] mb-2">
          Tags
        </h3>
        <TagFilterChips
          tags={tagPalette}
          selected={filters.tags}
          onToggle={onToggleTag}
        />
      </section>

      <button
        type="button"
        onClick={onReset}
        className="self-start font-mono text-xs text-[#A3A3A3] hover:text-[#FF6B35] underline underline-offset-4"
      >
        Reset all
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run __tests__/components/EventFilters.test.tsx
```

Expected: PASS (5 tests green).

- [ ] **Step 5: Commit**

```bash
git add components/filters/EventFilters.tsx __tests__/components/EventFilters.test.tsx
git commit -m "$(cat <<'EOF'
feat(filters): add EventFilters drawer body with toggles + tag chips
EOF
)"
```

---

## Task 7: Make `EventCard` tag chips clickable

**Files:**
- Modify: `components/EventCard.tsx` (lines 130–142)
- Modify: `__tests__/components/EventCard.test.tsx`

- [ ] **Step 1: Write the failing test addition**

Add this test to the existing `__tests__/components/EventCard.test.tsx` (add at end of the file, inside the existing `describe` block):

```typescript
  it('invokes onTagClick when a tag chip is clicked', () => {
    const onTagClick = vi.fn()
    render(<EventCard event={mockEvent} onTagClick={onTagClick} />)
    fireEvent.click(screen.getByRole('button', { name: /filter by tag ai-infra/i }))
    expect(onTagClick).toHaveBeenCalledWith('ai-infra')
  })
```

Ensure `vi` is imported at the top of the file (add to existing `vitest` import if missing):

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
```

- [ ] **Step 2: Run test — expect fail**

```bash
npx vitest run __tests__/components/EventCard.test.tsx
```

Expected: FAIL — tag is currently a `<span>`, no `role="button"`.

- [ ] **Step 3: Modify `components/EventCard.tsx`**

Update the `EventCardProps` interface and the Tags block.

Find:

```typescript
interface EventCardProps {
  event: Event
}

export function EventCard({ event }: EventCardProps) {
```

Replace with:

```typescript
interface EventCardProps {
  event: Event
  onTagClick?: (tag: string) => void
}

export function EventCard({ event, onTagClick }: EventCardProps) {
```

Find the Tags block (lines 130–142):

```tsx
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
```

Replace with:

```tsx
        {/* Tags */}
        {event.tags.length > 0 && (
          <div
            className="flex flex-wrap gap-1 mb-3"
            onClick={(e) => e.stopPropagation()}
          >
            {event.tags.slice(0, 4).map((tag) =>
              onTagClick ? (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onTagClick(tag)}
                  aria-label={`Filter by tag ${tag}`}
                  className="text-[10px] text-[#666666] bg-[#1A1A1A] hover:bg-[#FF6B35]/20 hover:text-[#FF6B35] px-1.5 py-0.5 rounded font-mono transition-colors"
                >
                  {tag}
                </button>
              ) : (
                <span
                  key={tag}
                  className="text-[10px] text-[#666666] bg-[#1A1A1A] px-1.5 py-0.5 rounded font-mono"
                >
                  {tag}
                </span>
              )
            )}
          </div>
        )}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run __tests__/components/EventCard.test.tsx
```

Expected: PASS (all existing tests + the new one).

- [ ] **Step 5: Commit**

```bash
git add components/EventCard.tsx __tests__/components/EventCard.test.tsx
git commit -m "$(cat <<'EOF'
feat(EventCard): make tag chips clickable when onTagClick prop is provided
EOF
)"
```

---

## Task 8: Wire filters into `EventList` and update map flow

**Files:**
- Modify: `components/EventList.tsx`
- Modify: `app/events/page.tsx` (move `EventMapLoader` call out of server component to feed it filtered events)

This is the biggest change. Approach: filter pipeline runs inside `EventList`. Since `EventMapLoader` currently lives in `app/events/page.tsx` (server) and we need it to consume filtered events (which are client-side), we move the map-vs-timeline branch inside a new shared client wrapper, OR simpler: feed both views from `EventList` by extracting a small `EventsClient` component that owns the filter pipeline and renders either timeline or map based on the `view` prop.

We'll do the simpler form: introduce `EventList` as the timeline view (keep its name; minimal disruption to existing tests) and have `app/events/page.tsx` continue to choose timeline vs map at the top level — but pass the filter pipeline result to the map by computing it inside a tiny wrapper.

Actually the cleanest local change is: hoist the filter pipeline into a new `components/EventsClient.tsx` that owns `useFilters`, runs the pipeline, then renders either `EventList`-styled timeline content or `EventMapLoader`. To keep risk low and preserve existing `EventList` tests, we'll do this:

- Keep `EventList.tsx` rendering the timeline.
- Add `useFilters()` + pipeline inside `EventList` for the timeline case.
- For the map case in `app/events/page.tsx`, render a new tiny client component `EventsMapClient` that reads filters and wraps `EventMapLoader`.

This keeps both paths idempotent and tested.

- [ ] **Step 1: Modify `components/EventList.tsx`**

Add imports at the top (after existing imports):

```typescript
import { Suspense, useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { FiltersTrigger } from '@/components/filters/FiltersTrigger'
import { ActiveFiltersBar } from '@/components/filters/ActiveFiltersBar'
import { EventFilters } from '@/components/filters/EventFilters'
import { useFilters } from '@/lib/use-filters'
import { applyFilters, tagFrequency } from '@/lib/filters'
```

(Note: `useState` may already be imported — merge with existing.)

Wrap the body of `EventList` so that the filter logic lives under a Suspense boundary. Replace the `export function EventList` block with this two-component pattern:

Find:

```typescript
export function EventList({ events }: EventListProps) {
  const [query, setQuery] = useState('')
  const dayRefs = useRef<Record<string, HTMLElement | null>>({})
```

Replace with:

```typescript
export function EventList(props: EventListProps) {
  return (
    <Suspense fallback={null}>
      <EventListInner {...props} />
    </Suspense>
  )
}

function EventListInner({ events }: EventListProps) {
  const [query, setQuery] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const dayRefs = useRef<Record<string, HTMLElement | null>>({})
  const { filters, toggleTag, setFilter, reset, activeCount } = useFilters()
```

Then replace the `filteredEvents` block:

Find:

```typescript
  const filteredEvents = useMemo(() => {
    if (!query.trim()) return events
    return fuse.search(query).map((r) => r.item)
  }, [query, fuse, events])
```

Replace with:

```typescript
  const filtered = useMemo(() => applyFilters(events, filters), [events, filters])

  const filteredEvents = useMemo(() => {
    if (!query.trim()) return filtered
    const ids = new Set(filtered.map((e) => e.id))
    return fuse.search(query).map((r) => r.item).filter((e) => ids.has(e.id))
  }, [query, fuse, filtered])

  const tagPalette = useMemo(() => tagFrequency(events), [events])

  function handleTagClick(tag: string) {
    toggleTag(tag)
    setDrawerOpen(true)
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }
```

Find the toolbar area inside the right column — the section header just above the Search block:

```typescript
      <div className="flex-1 min-w-0">
        {/* Search */}
        <div className="mb-6">
          <EventSearch onSearch={setQuery} />
        </div>
```

Replace with:

```typescript
      <div className="flex-1 min-w-0">
        {/* Filter toolbar */}
        <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
          <FiltersTrigger activeCount={activeCount} onClick={() => setDrawerOpen(true)} />
          {filteredEvents.length !== events.length && (
            <p className="font-mono text-xs text-[#A3A3A3]">
              Showing {filteredEvents.length} of {events.length} events
            </p>
          )}
        </div>

        <ActiveFiltersBar
          filters={filters}
          onToggleTag={toggleTag}
          onSetFilter={setFilter}
          onReset={reset}
        />

        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent side="right" className="w-[360px] sm:w-[420px] p-6 overflow-y-auto">
            <SheetHeader className="mb-6 p-0">
              <SheetTitle className="font-mono text-base text-[#FAFAFA] text-left">
                Filters
              </SheetTitle>
            </SheetHeader>
            <EventFilters
              filters={filters}
              tagPalette={tagPalette}
              onToggleTag={toggleTag}
              onSetFilter={setFilter}
              onReset={reset}
            />
          </SheetContent>
        </Sheet>

        {/* Search */}
        <div className="mb-6">
          <EventSearch onSearch={setQuery} />
        </div>
```

Find the search empty state:

```typescript
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
```

Replace with:

```typescript
        {/* Filter-aware empty state */}
        {filteredEvents.length === 0 && (query || activeCount > 0) && (
          <div className="text-center py-16 text-[#A3A3A3]">
            {query ? (
              <p className="font-mono text-base mb-2">
                No matches for &ldquo;{query}&rdquo;{activeCount > 0 ? ' under current filters' : ''}.
              </p>
            ) : (
              <p className="font-mono text-base mb-2">No matches under current filters.</p>
            )}
            <p className="text-sm">
              Try {activeCount > 0 ? 'removing filters' : 'broader terms'}, or browse other aggregators →
            </p>
          </div>
        )}
```

Find the EventCard render inside the timeline:

```typescript
                    {byPeriod[period].map((event) => (
                      <EventCard key={event.id} event={event} />
                    ))}
```

Replace with:

```typescript
                    {byPeriod[period].map((event) => (
                      <EventCard key={event.id} event={event} onTagClick={handleTagClick} />
                    ))}
```

- [ ] **Step 2: Create `components/EventsMapClient.tsx` for the map view filter pipeline**

Create the file:

```typescript
'use client'

import { Suspense, useMemo } from 'react'
import { EventMapLoader } from '@/components/EventMapLoader'
import { applyFilters } from '@/lib/filters'
import { useFilters } from '@/lib/use-filters'
import type { DayKey } from '@/lib/time'
import type { Event } from '@/lib/types'

interface EventsMapClientProps {
  events: Event[]
  initialDay: DayKey
}

export function EventsMapClient(props: EventsMapClientProps) {
  return (
    <Suspense fallback={<EventMapLoader events={props.events} initialDay={props.initialDay} />}>
      <EventsMapClientInner {...props} />
    </Suspense>
  )
}

function EventsMapClientInner({ events, initialDay }: EventsMapClientProps) {
  const { filters } = useFilters()
  const filtered = useMemo(() => applyFilters(events, filters), [events, filters])
  return <EventMapLoader events={filtered} initialDay={initialDay} />
}
```

- [ ] **Step 3: Modify `app/events/page.tsx` to use `EventsMapClient`**

Find:

```typescript
import { EventMapLoader } from '@/components/EventMapLoader'
```

Replace with:

```typescript
import { EventsMapClient } from '@/components/EventsMapClient'
```

Find:

```typescript
        {view === 'map' ? (
          <EventMapLoader events={events} initialDay={initialDay} />
        ) : (
          <EventList events={events} />
        )}
```

Replace with:

```typescript
        {view === 'map' ? (
          <EventsMapClient events={events} initialDay={initialDay} />
        ) : (
          <EventList events={events} />
        )}
```

- [ ] **Step 4: Run the full test suite**

```bash
npm test
```

Expected: all previously-passing tests still pass; new tests from Tasks 1–7 remain green.

- [ ] **Step 5: Lint**

```bash
npm run lint
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add components/EventList.tsx components/EventsMapClient.tsx app/events/page.tsx
git commit -m "$(cat <<'EOF'
feat(filters): wire filters into EventList + map view via EventsMapClient
EOF
)"
```

---

## Task 9: Final smoke + acceptance

**Files:** none changed. Verification only.

- [ ] **Step 1: Full test suite**

```bash
npm test
```

Expected: every test passes. Phase 6 net new: ~36 tests (split as 14 + 6 + 3 + 4 + 2 + 5 + 1 + tests added by Task 8 if any). Phase 5a left ~151 → total ≈ 187.

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: 0 errors.

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: clean build, `/events` and `/api/concierge` still in route table, no new build-time failures.

(Note: build may fail in offline sandbox due to `next/font/google` reaching Google Fonts; that is environmental and unrelated to Phase 6.)

- [ ] **Step 4: Inventory commits**

```bash
git log --oneline 9453a88..HEAD
```

Expected: 8 feature commits (Tasks 1–8).

- [ ] **Step 5: Manual acceptance walk**

Run `npm run dev` (or reuse running server). Visit `/events`:

- Toolbar shows `Filters` button (no badge).
- Click `Filters` → drawer slides in from the right with Quick toggles + Tags section.
- Toggle `Editor's Picks only` → drawer stays open, URL updates to `?editorsPicks=1`, list narrows, counter shows `Showing N of 87 events`, `ActiveFiltersBar` shows chip `Editor's Picks ×`, badge on `Filters` shows `1`.
- Click `×` on the chip → filter clears, URL clean, counter hides.
- Toggle `Free food/drinks` → list narrows, chip appears.
- Open drawer → click a tag chip (e.g. `ai-infra`) → URL adds `tags=ai-infra`, list narrows further (AND between toggles, OR within tags).
- Click `Reset all` in drawer → all filters cleared, URL clean.
- Close drawer.
- Find any event card with tags → click a tag chip in the card → drawer opens with that tag pre-selected, list filters, page scrolls to top.
- Switch to map view (`?view=map`) → map renders with the same filtered set. Toggle a filter (you'll need to switch back to timeline since the map view doesn't render the toolbar in this scope — confirmed behavior: filter UI lives on the timeline view; map respects the URL state set elsewhere).
- Paste a URL like `/events?tags=ai-infra,devtools&editorsPicks=1` into a fresh tab → state reproduces.
- Visit `/my-plan` → unaffected (no filter UI, no counter).
- Visit `/plan` (Concierge) → unaffected.

- [ ] **Step 6: Final fix commit if smoke surfaced anything**

If something needed adjustment, commit the fix. Otherwise skip.

---

## Done criteria (matches design's Acceptance criteria)

- [ ] Filters button visible in `/events` toolbar; badge reflects active filter count
- [ ] Drawer contains Editor's Picks toggle, Free food/drinks toggle, Hide invite-only toggle, tag multi-select chips with "Show all" expander, Reset all button
- [ ] All filter state lives in URL params (`tags`, `editorsPicks`, `freeFood`, `hideInviteOnly`)
- [ ] Active filters render as removable chips in `ActiveFiltersBar`; per-chip `×` and "Clear all" work
- [ ] Counter renders `Showing X of Y events` when filters narrow the set
- [ ] Filter pipeline applies to both timeline view and map pins (via `EventsMapClient`)
- [ ] Filter-aware empty-state copy renders when result set is empty under active filters
- [ ] Tag chips inside `EventCard` are clickable; click adds tag to filters AND opens drawer pre-selected AND scrolls to top
- [ ] `/my-plan`, `/plan` (Concierge), `EditorsPicksCarousel`, `MyPlanWidget` unaffected
- [ ] Fuse search composes with filters (filters first, then search)
- [ ] Shareable URL reproduces state on fresh load
- [ ] `npm test` green; `npm run lint` clean; `npm run build` succeeds (modulo offline-sandbox font fetch)

---

## Out-of-scope reminders

- Audience / neighborhood / format chips — deferred
- Time-of-day slider — deferred
- Filters on `/my-plan` — explicitly out per SPEC line 561
- Server-side filter consumption (would remove the deep-link first-paint flicker) — deferred
