# Phase 6 — Filters (lean MVP) — Design

**Date:** 2026-05-24
**Status:** Approved
**Scope reference:** `SPEC.md` lines 535–563 (Phase 6 — Filters), with explicit scope reduction agreed during brainstorming.

---

## Summary

Add a hidden-by-default, URL-shareable filter layer to `/events`. A power user opens a side drawer, narrows the 87 curated events by tag and a handful of toggles, and can share the resulting URL. A casual user who never opens the drawer has the identical Phase 1–5 experience.

This is the **lean MVP** cut of SPEC Phase 6:

- **In scope:** tag multi-select, three toggles (`Editor's Picks only`, `Free food/drinks`, `Hide invite-only`), clickable tag chips in `EventCard`, URL state, active-filters bar, filter-aware counter and empty state, both timeline and map view.
- **Out of scope (deferred):** audience chips, neighborhood chips, format chips, time-of-day slider, day chips (already covered by existing `DayChipNav`), filters on `/my-plan`.

The Concierge, Editor's Picks carousel, sticky day headers, `MyPlanWidget`, and `/my-plan` are explicitly **not** affected.

---

## Architecture

```
/events page (server component)
    │ reads from searchParams (server-side):  day, view
    │ passes events + initialDay to client tree
    ▼
EventList (client component) ───────────────► EventMapLoader (client component)
    │ reads filters via useFilters() (URL-backed)
    │ local state: search query, drawer open/closed
    │
    │ pipeline:
    │   events
    │     → applyFilters(events, filters)     [lib/filters.ts, pure]
    │     → fuse.search(query)                [filters first, search second]
    │     → groupEventsByDay()                [pre-existing]
    │
    │ renders:
    │   • FiltersTrigger        (toolbar button + active-count badge)
    │   • ActiveFiltersBar      (chip rack under toolbar, conditional)
    │   • EventFilters in Sheet (drawer body)
    │   • counter "Showing X of Y events"
    │   • filter-aware empty state
    ▼
EventCard
    • tag chips become <button>; click → addTag + openDrawer + scroll-to-top
```

### Key boundaries

- `lib/filters.ts` — pure: `applyFilters`, `parseFilters`, `serializeFilters`, `tagFrequency`. Fully unit-testable, zero React.
- `lib/use-filters.ts` — thin React hook over `useSearchParams` / `useRouter` / `usePathname`. Returns `{filters, setFilter, toggleTag, reset, activeCount}`. The single place URL writes happen.
- `components/filters/*` — presentational. Each component owns one concern (trigger, bar, drawer body, tag chip group).
- Drawer-open state lives in `EventList` local state (not URL): opening/closing isn't a shareable artifact.

### Why URL-as-state (not Zustand)

SPEC line 551 calls out shareable links explicitly. Using `useSearchParams` makes share-by-paste work natively, gives back/forward semantics for free, and lets clickable tag chips in `EventCard` cleanly deep-link by writing to the URL. A Zustand store would duplicate state and invite drift bugs. The `useFilters` hook is the only abstraction we introduce on top of `useSearchParams`.

---

## Files

### New

- `lib/filters.ts` — pure filter logic + URL serialization
- `lib/use-filters.ts` — React hook over Next router
- `components/filters/EventFilters.tsx` — drawer body
- `components/filters/FiltersTrigger.tsx` — toolbar button with active-count badge
- `components/filters/ActiveFiltersBar.tsx` — inline chip rack
- `components/filters/TagFilterChips.tsx` — multi-select tag chips with "Show all" expander

### Modified

- `components/EventList.tsx` — read filters via `useFilters()`, apply pipeline, render `FiltersTrigger` + `ActiveFiltersBar`, mount `Sheet` drawer, render counter + filter-aware empty state, expose `handleTagClick` to `EventCard`
- `components/EventCard.tsx` — tags become `<button>`; new optional `onTagClick?: (tag: string) => void` prop. When prop absent (e.g. inside Concierge proposals), tags remain visually present but non-interactive.
- `components/EventMapLoader.tsx` — accept already-filtered `events` (filtering moves up to `EventList`'s pipeline, then is passed down)
- `app/events/page.tsx` — no change to server-side reads; filter params are consumed client-side only

### Test files

**New (~36 net tests):**

- `__tests__/lib/filters.test.ts` (~14)
- `__tests__/lib/use-filters.test.tsx` (~5)
- `__tests__/components/EventFilters.test.tsx` (~5)
- `__tests__/components/FiltersTrigger.test.tsx` (~3)
- `__tests__/components/ActiveFiltersBar.test.tsx` (~4)
- `__tests__/components/TagFilterChips.test.tsx` (~2)
- `__tests__/components/EventList.test.tsx` (~2, may be new file)

**Updated:**

- `__tests__/components/EventCard.test.tsx` — +1 test for tag-click prop

Existing: 151. Projected after Phase 6: ~187.

---

## URL schema

All params optional. All on `/events`. Pre-existing params (`day`, `view`) unchanged.

| Param | Type | Example | Notes |
|---|---|---|---|
| `tags` | comma-separated | `?tags=ai-infra,devtools` | Lowercased, trimmed, deduped during parse |
| `editorsPicks` | literal `1` | `?editorsPicks=1` | Any other value (incl. `0`, `true`) parses as `false` |
| `freeFood` | literal `1` | `?freeFood=1` | Matches `has_free_food OR has_free_drinks` |
| `hideInviteOnly` | literal `1` | `?hideInviteOnly=1` | Drops events where `is_invite_only === true` |

### Serializer conventions

- Absent param = filter off. Never write `editorsPicks=0`.
- Empty tag set = `tags` param omitted entirely.
- Tags sorted alphabetically inside the param for stable URLs.
- Param order in the final query string is alphabetic.
- `serializeFilters(parseFilters(x))` is idempotent for any `x` (covered by round-trip test).

### Parser robustness

`parseFilters` never throws. Invalid input collapses to "filter off."

| Input | Output |
|---|---|
| `?tags=` | `tags: []` |
| `?tags=,,,foo,` | `tags: ['foo']` |
| `?tags=Foo,FOO,foo` | `tags: ['foo']` |
| `?editorsPicks=0` | `editorsPicks: false` |
| `?editorsPicks=true` | `editorsPicks: false` |
| `?unknownParam=foo` | ignored |

---

## Data flow

### Filter pipeline (in EventList)

```ts
const filters = useFilters()
const filtered = applyFilters(events, filters)
const filteredIds = new Set(filtered.map(e => e.id))
const searched = query
  ? fuse.search(query).map(r => r.item).filter(e => filteredIds.has(e.id))
  : filtered
const grouped = groupEventsByDay(searched)
```

`searched` (filter + search combined) is what we render in the timeline and what we pass to `EventMapLoader`. `EditorsPicksCarousel` continues to receive `events.filter(e => e.is_editors_pick)` — unfiltered — per SPEC line 559.

### `applyFilters` semantics

```ts
function applyFilters(events: Event[], f: Filters): Event[] {
  return events.filter(e => {
    if (f.editorsPicks && !e.is_editors_pick) return false
    if (f.freeFood && !(e.has_free_food || e.has_free_drinks)) return false
    if (f.hideInviteOnly && e.is_invite_only) return false
    if (f.tags.length > 0 && !f.tags.some(t => e.tags.includes(t))) return false
    return true
  })
}
```

**Tag semantics: OR.** Selecting `ai-infra` + `devtools` shows events with either tag. AND would yield near-zero results given the curated set size.

**Toggle semantics: AND across categories.** All active toggles must hold.

### Tag-click flow

```
User clicks <tag> in EventCard
   → EventList.handleTagClick(tag)
      → useFilters.toggleTag(tag)         [router.replace with new searchParams]
      → setDrawerOpen(true)               [local state]
      → window.scrollTo({top:0, smooth})
   → URL updates → useSearchParams re-renders → pipeline reruns → drawer shows tag checked
```

`router.replace` (not `push`) — chip clicks don't pollute the back stack. URL writes wrapped in `startTransition` so React doesn't show a loading boundary per click.

### Counter & empty-state copy

- `filtered.length === events.length` → existing copy: `87 curated events · Tech Week NYC 2026 · June 1–7`
- `filtered.length < events.length` → `Showing X of Y events`
- `searched.length === 0 && filters.activeCount > 0 && !query` → `No matches — try removing filters, or check Beyond →` (Beyond link rendered inert until Phase 7 ships `/beyond`)
- `searched.length === 0 && query` → `No matches for "query" under current filters.`

---

## Error handling & edge cases

**Empty event set (Supabase down → 0 events):** existing empty state ("No events loaded yet…") wins; filter UI is not rendered.

**Empty tag palette (data has no tags):** drawer renders `No tags available in current data` in the tag section; toggles still work.

**Tag palette truncation:** top 20 tags by frequency visible; "Show all" expander reveals the rest. Hidden when ≤ 20 distinct tags. Long tag labels (>30 chars) truncate in the chip with full text in the `title` attribute.

**Map under filters:** zero pins is the existing `EventMap` empty case (or default NYC zoom). No new code.

**Unknown tag in URL** (e.g. data renamed or removed a tag): kept in `filters.tags` silently. `applyFilters` returns 0 matches; user sees the filter-aware empty state and can clear from `ActiveFiltersBar`. Forward-compatible with data changes.

**Hydration:** `useSearchParams` is a client hook. The initial SSR render shows the unfiltered list; client immediately re-renders with filters applied. Deep-linked filter URLs flicker briefly on first paint. Acceptable trade-off for an MVP-optional power-user feature; can be promoted to server-aware filtering by widening `app/events/page.tsx`'s `searchParams` reads in a future phase.

**Suspense:** Next 16 production builds require `useSearchParams` consumers to live under `<Suspense>`. The filter-aware portion of `EventList` is wrapped with `<Suspense fallback={null}>`.

**Non-interference (per SPEC):**
- `/plan` (Concierge): does not read filter URL params. Untouched.
- `EditorsPicksCarousel`: receives unfiltered Editor's Picks.
- `MyPlanWidget`: reads from `usePlanStore`, not events.
- `/my-plan`: explicitly out of scope.
- Sticky day headers in timeline: render off `grouped` (post-filter); empty days don't render headers. This is correct — a day with 0 matching events shouldn't show a header.

---

## Testing strategy

**Pure functions (`lib/filters.ts`) — ~14 tests:** parser robustness table, serializer canonicalization, round-trip property, `applyFilters` per toggle, tag OR semantics, combined AND across categories, `tagFrequency` count + tie-breaking.

**Hook (`lib/use-filters.ts`) — ~5 tests:** mock `next/navigation`, verify reads URL, `toggleTag` add/remove, `setFilter` writes URL, `reset` preserves `day`/`view`/`q`, `activeCount` math.

**Components — ~17 tests:**

- `FiltersTrigger`: badge math, no badge when inactive, click handler
- `ActiveFiltersBar`: empty when no filters, chip per active filter, `×` removes, "Clear all" resets
- `EventFilters`: all controls render, toggle a chip / switch updates URL, "Reset all", empty tag palette fallback
- `TagFilterChips`: ≤20 hides expander, >20 reveals on click
- `EventCard`: tag click invokes `onTagClick` prop
- `EventList`: counter copy, filter-aware empty-state copy

**Component test approach:** follow existing patterns in `__tests__/components/` — render with `@testing-library/react`, mock `usePlanStore` and `next/navigation` where needed, no Playwright.

---

## Acceptance criteria

- [ ] Filters button visible in `/events` toolbar; badge reflects active filter count
- [ ] Click opens right-side sheet (bottom sheet on mobile) containing: `Editor's Picks only` toggle, `Free food/drinks` toggle, `Hide invite-only` toggle, multi-select tag chips with "Show all" expander, `Reset all` button
- [ ] All filter state lives in URL params (`tags`, `editorsPicks`, `freeFood`, `hideInviteOnly`)
- [ ] Active filters render as removable chips in `ActiveFiltersBar` under the toolbar; per-chip `×` and "Clear all" work
- [ ] Counter renders `Showing X of Y events` when filters narrow the set
- [ ] Filter pipeline applies to both timeline view and map pins
- [ ] Filter-aware empty-state copy renders when the result set is empty under active filters
- [ ] Tag chips inside `EventCard` are clickable; click adds tag to filters AND opens the drawer with that tag pre-selected AND scrolls to top
- [ ] `/my-plan`, `/plan` (Concierge), `EditorsPicksCarousel`, `MyPlanWidget` unaffected
- [ ] Fuse search composes with filters: filters narrow first, then search runs over the filtered set
- [ ] Shareable URL: pasting `/events?tags=ai-infra&editorsPicks=1` reproduces state on fresh load
- [ ] `npm test` green; `npm run lint` clean; `npm run build` succeeds

---

## Out of scope

Deferred to a possible Phase 6.5 or absorbed by Phase 7 if priorities shift:

- Audience / neighborhood / format chips
- Time-of-day slider
- Applying filters to `/my-plan` (SPEC line 561 explicitly says no)
- Filter param consumption on the server (would eliminate the deep-link flicker)
