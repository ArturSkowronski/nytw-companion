# Phase 4 — Dedicated /my-plan, status tracking, iCal, conflicts — Design

**Date:** 2026-05-19
**Phase:** 4 (v1.4)
**Source spec:** `SPEC.md` §5 Phase 4
**Status:** Draft, awaiting user review

---

## Goal

Make NYTW Companion a real planner. After Phase 4, the user has a dedicated `/my-plan` page that shows their plan as a day-grouped timeline, on a map, with per-event status updates, conflict highlighting between overlapping confirmed events, and a one-click `.ics` download for any calendar app.

v1.4 acceptance test (from SPEC.md, trimmed to in-scope items):

> User has 8 events in their plan, opens `/my-plan`, sees timeline grouped by day with 5 confirmed + 3 interested. Clicks "Map" tab → sees Wednesday's 3 events with lines between them and travel times. Marks two events Confirmed; a subtle bracket appears between the two overlapping confirmed events. Clicks "Download .ics" → file downloads; imports into Google Calendar → 5 confirmed events appear with ✅ prefix.

---

## Decisions captured during brainstorm

| Topic | Decision |
| --- | --- |
| Scope | Core MVP planner. **In:** /my-plan + Timeline + Map tabs, rich `StatusToggle`, `ConflictWarnings`, client-side iCal download, empty state, MyPlanWidget→/my-plan link. **Out (deferred):** batch ops, "All statuses" tab, export-as-text/email, per-event notes textarea, share read-only link. |
| iCal | Client-side `.ics` download using the `ics` npm package. No server route, no DB, no token. User re-downloads when plan changes. (Live subscribe URL deferred to Phase 5.) |
| `StatusToggle` vs `StatusPickerInline` | Replace. `StatusPickerInline` is deleted; `StatusToggle` is the single status writer used in `NextUpCard` and the new `/my-plan` cards. |
| Conflict definition | Two plan items with status `confirmed` OR `rsvp_pending` whose `[starts_at, ends_at]` intervals overlap by any amount. |
| Routing lines on map | Straight haversine line between consecutive same-day events (chronological by `starts_at`); travel-time label (`uberTimeMin / walkingTimeMin` from `lib/geo`) at midpoint. No external routing API. |
| `MyPlanWidget` role | Kept globally visible; "Open full plan →" links to `/my-plan`. Hidden when the user is on `/my-plan` itself. |
| Tab URL state | `?tab=timeline\|map`. Default `timeline`. Same pattern as `?view=map` from Phase 3. |
| Tests | Same posture as Phase 3 — vitest unit tests for pure logic and small components; manual smoke for map + iCal download flow. |

---

## Architecture

One new route, one shared logic layer, two new components per surface, one global wiring tweak.

```
app/
  my-plan/page.tsx             (new)      — Server Component, fetchEvents → <MyPlanClient/>
  layout.tsx                   (edit)     — pass current pathname to MyPlanWidget OR widget reads it itself

components/
  MyPlanClient.tsx             (new)      — client island; tab routing; reads usePlanStore; owns iCal trigger
  MyPlanTimeline.tsx           (new)      — day-grouped plan list with ConflictWarnings
  MyPlanMap.tsx                (new)      — Mapbox map, status-colored pins, day selector, routing lines
  MyPlanEventCard.tsx          (new)      — rich card used in MyPlanTimeline: meta + StatusToggle + remove
  StatusToggle.tsx             (new)      — replaces StatusPickerInline; six-status picker with icons
  ConflictWarnings.tsx         (new)      — bracket overlay shown around overlapping confirmed events
  MyPlanEmptyState.tsx         (new)      — three CTAs when items.length === 0
  IcalDownloadButton.tsx       (new)      — invokes lib/ical.ts then triggers Blob download

  MyPlanWidget.tsx             (edit)     — "Open full plan →" links to /my-plan; hide when pathname === '/my-plan'
  NextUpCard.tsx               (edit)     — swap StatusPickerInline for StatusToggle
  StatusPickerInline.tsx       (delete)
  __tests__/components/StatusPickerInline.test.tsx (delete)

lib/
  ical.ts                      (new)      — pure plan→ICS builder using the `ics` package
  conflicts.ts                 (new)      — pure detectConflicts(items, events) → ConflictPair[]
  plan-store.ts                (no edit)
```

**Key boundaries**

- `lib/conflicts.ts` and `lib/ical.ts` are pure (no React, no Mapbox, no DOM); both fully unit-testable.
- `/my-plan` mirrors the Phase 3 `/events` pattern: Server Component fetches events once, hands them serialized to a client island. No new API routes.
- iCal generation happens entirely client-side. The `<IcalDownloadButton/>` component handles the Blob creation and `<a download>` click — no Server Action, no server route.
- `MyPlanWidget` becomes pathname-aware: it hides itself when the user is on `/my-plan`. Implementation lives inside the widget (reads `usePathname()`), no layout edit needed.

**State ownership**

- URL params (`tab`, `day`) → tab state, map day selection.
- `usePlanStore` → plan items (unchanged).
- `MyPlanClient` local state → selected event for in-page detail, conflict pair highlight on click.

---

## Components

### `/my-plan/page.tsx` (Server Component)

Same shape as `/events`: async `fetchEvents()` with seed-JSON fallback, awaits `searchParams`, computes initial tab and day, renders `<MyPlanClient events={events} initialTab={initialTab} initialDay={initialDay}/>`. No inline header beyond a small "Your plan" subtitle since `SiteNav` already shows the brand.

### `MyPlanClient` (~150 LOC)

Props: `{ events: Event[]; initialTab: 'timeline'|'map'; initialDay: DayKey }`.

- Reads `tab` from `useSearchParams()`; falls back to `initialTab`. Shadcn `<Tabs>` for the toggle.
- Hydration gate (`mounted` state) before reading `usePlanStore`, same pattern as `MyPlanWidget` and `NowClient`.
- Joins `usePlanStore.items` with `events` into `planEvents: Array<{ item: PlanItem; event: Event }>`.
- Header: "Your plan", item count, status mini-summary ("3 confirmed · 2 pending · 1 waitlist · 2 interested"), `<IcalDownloadButton/>`.
- Renders:
  - Empty state if `planEvents.length === 0` → `<MyPlanEmptyState/>`.
  - Otherwise `<Tabs>` with two panels: `<MyPlanTimeline/>` and `<MyPlanMap/>`.

### `MyPlanTimeline` (~120 LOC)

Props: `{ planEvents; conflicts }`.

- Day-grouped sections (reuses `groupEventsByDay` from `lib/events`).
- For each day:
  - Sticky day header (same style as `/events`).
  - For each event: `<MyPlanEventCard/>`.
  - If `conflicts` has pairs in this day: `<ConflictWarnings pairs={pairsForDay}/>` overlay positions a left-side bracket linking the two cards plus a small "Conflict — 2 confirmed events same time" label.

### `MyPlanEventCard` (~100 LOC)

Props: `{ planItem: PlanItem; event: Event; onRemove: (id) => void }`.

- Borrows visual structure from the Phase 2 `EventCard` but:
  - Status badges/icons at top (driven by `planItem.status`).
  - `<StatusToggle eventId={event.id}/>` inline.
  - "Open RSVP →" button (mirrors `EventCard`).
  - "Remove from plan" link (small, corner).
- No body click to modal — `/my-plan` cards are the focus surface; we don't open `EventDetailModal` here (avoids scope drift; user can click "Open RSVP" or back to /events).

### `MyPlanMap` (~250 LOC)

Built on the same pattern as `EventMap` from Phase 3 (dynamic mapbox-gl import, `MapTokenFallback` when token missing, `DayChipNav` for day selection).

Differences vs `EventMap`:
- **Plan-only pins.** Source contains only the plan's events with lat/lng, filtered to the selected day.
- **Color by status, not format.** `confirmed`/`rsvp_pending` = full color; `interested` = greyed; `declined` = crossed (small `×` overlay); `attended` = dimmed green; `waitlist` = amber outline.
- **Routing lines.** A separate `line` layer connects consecutive same-day events chronologically. Lines styled with dashed `#FF6B35` 50%-opacity stroke. Midpoint label = small text marker with `~32 min Uber · 1h 15min walk` from `lib/geo`.
- **Pin click** opens an inline popup (`EventMapPopup` reused) with a status indicator; no "5 nearest" list (already in plan view).

### `StatusToggle` (replaces `StatusPickerInline`)

Props: `{ eventId: string }`.

- Returns `null` if event not in plan (same guard).
- Six segmented buttons, each with status icon + label:
  - Interested 👀
  - RSVPed ⏳
  - Confirmed ✅
  - Waitlist 📋
  - Declined ❌
  - Attended ✔
- Active button: `#FF6B35` background + bold.
- Inactive: `#A3A3A3` hover `#FAFAFA`.
- Writes via `usePlanStore.updateStatus(eventId, value)`.

Wider than `StatusPickerInline` (label always visible), wraps to two rows on mobile. `NextUpCard` swaps its import.

### `ConflictWarnings`

Props: `{ pairs: ConflictPair[]; cardRefs: Map<string, HTMLElement | null> }`.

- For each pair, renders an absolutely-positioned bracket along the left edge between the two card refs (positions computed via `getBoundingClientRect`, refreshed on resize via `ResizeObserver`).
- Small label box anchored to bracket top: "Conflict — both confirmed".
- Click on bracket → emits `onSelectPair(pair)` which scrolls the second card into view and highlights both.

### `MyPlanEmptyState`

Two live CTA cards plus one "Coming soon":
- **Browse events →** links to `/events`.
- **Check Editor's Picks →** also links to `/events` (the picks carousel is the first thing on that page; no separate anchor needed in v1.4).
- **Plan with AI →** rendered as inline-disabled with "Coming soon" hint, matching the `SiteNav` treatment for `/plan`.

Friendly illustration is just a stylized "□→□→□" diagram.

### `IcalDownloadButton`

Props: `{ planEvents: Array<{ item; event }> }`.

- One button, "Download .ics".
- On click: builds ICS via `lib/ical.ts: buildIcs(planEvents)` which returns a `string`. Wraps in `Blob({ type: 'text/calendar' })`, generates an `objectURL`, triggers a hidden anchor with `download="nytw-plan.ics"`, revokes the URL.
- Only emits events whose status is `rsvp_pending`, `confirmed`, or `waitlist`. Skips `interested`/`declined`/`attended`.
- Empty button label changes when no exportable items: "Nothing to export yet" (disabled).

### `MyPlanWidget` (edit)

- Adds `usePathname()`. When `pathname === '/my-plan'`, returns `null` early.
- "Open full plan →" link now goes to `/my-plan` (currently a placeholder).

---

## Data flow

### `/my-plan?tab=map&day=wed`

```
Server (my-plan/page.tsx)
  └─ fetchEvents() → events: Event[]
       ↓
<MyPlanClient events initialTab initialDay>
  ├─ usePlanStore() → items (gated on mounted)
  ├─ planEvents = items.map(i => ({ item: i, event: lookup[i.event_id] })).filter(...)
  ├─ conflicts = detectConflicts(items, events)
  ├─ tab from ?tab= (default initialTab)
  ├─ <IcalDownloadButton planEvents/>
  └─ <Tabs>
       tab=timeline → <MyPlanTimeline planEvents conflicts/>
       tab=map      → <MyPlanMap planEvents initialDay/>
```

### Pure-function additions

```ts
// lib/conflicts.ts
type ConflictPair = { a: PlanItem; b: PlanItem }
detectConflicts(items: PlanItem[], events: Event[]): ConflictPair[]
  // Only items with status 'confirmed' or 'rsvp_pending'.
  // O(n log n): sort by starts_at, sweep for overlap with previous.
  // Returns all overlapping pairs (a.starts_at <= b.starts_at).

// lib/ical.ts
buildIcs(planEvents: Array<{ item: PlanItem; event: Event }>): string
  // Uses `ics` npm package createEvents().
  // Filters to status in {'rsvp_pending', 'confirmed', 'waitlist'}.
  // Each VEVENT:
  //   summary: `${statusPrefix} ${event.title}`  // ✅/⏳/📋
  //   description: `Host: ${host}\nRSVP: ${rsvp_url}`
  //   location: address ?? venue_name ?? ''
  //   start/end: ISO timestamps
  //   url: rsvp_url
  //   uid: event.id + '@nytw-companion'
  // Returns ICS string. Throws on builder error (caller catches).
```

### Persisted state

No new DB schema. No new env vars. `usePlanStore` schema unchanged. The seed-JSON event fallback (from Phase 2) is reused as-is.

---

## Error handling & edge cases

- **Empty plan:** `<MyPlanEmptyState/>` instead of tabs. No iCal button visible.
- **Plan has events but none with map locations:** Map tab shows existing `EventMap`-style empty overlay; Timeline tab unaffected.
- **iCal build error** (e.g., one event has invalid date strings): catch the `ics` package error, render a toast "Couldn't build calendar — please reload" and log the underlying error. No partial download.
- **No exportable items** (every item is `interested` or `declined`/`attended`): button reads "Nothing to export yet" and is disabled.
- **Conflict overlay race:** `ConflictWarnings` uses `ResizeObserver` plus `requestAnimationFrame` to redraw on window resize and after tab switches. If a ref is null (card unmounted mid-resize), the bracket for that pair is skipped that frame.
- **Hydration:** Same `mounted` gate pattern (`useEffect(() => setMounted(true), [])`) before reading plan-store. Avoids SSR/CSR mismatch.
- **Mapbox token missing:** `MyPlanMap` returns `MapTokenFallback` (same as `EventMap`). Timeline tab works regardless.
- **Stale event reference:** A plan item whose `event_id` no longer exists in the events list (e.g., curation removed it) is dropped from `planEvents` with a one-line console warning. Defensive — currently not possible since seed is static.

---

## Testing

Same posture as Phase 3: unit tests for pure logic and small components; manual visual smoke for map + iCal download.

```
__tests__/lib/
  conflicts.test.ts            (new)
  ical.test.ts                 (new)

__tests__/components/
  StatusToggle.test.tsx        (new)        — replaces StatusPickerInline.test.tsx (deleted)
  MyPlanEmptyState.test.tsx    (new)
  IcalDownloadButton.test.tsx  (new)
  MyPlanWidget.test.tsx        (edit)       — add: hidden when pathname === '/my-plan'

__tests__/components/StatusPickerInline.test.tsx (delete)
```

**Coverage highlights**

- `conflicts.test.ts`:
  - returns empty for empty input
  - returns empty when only `interested` items overlap
  - flags two overlapping `confirmed` items
  - flags one `confirmed` + one `rsvp_pending`
  - does NOT flag back-to-back events that touch but don't overlap (`a.ends_at === b.starts_at`)
  - returns multiple pairs for three mutually overlapping events (3 pairs)
- `ical.test.ts`:
  - filters out `interested`/`declined`/`attended`
  - emits status emoji prefix in SUMMARY (`✅ `, `⏳ `, `📋 `)
  - VEVENT contains UID, DTSTART, DTEND, LOCATION, URL, DESCRIPTION
  - Returns valid ICS that starts with `BEGIN:VCALENDAR`
  - Throws/returns error for invalid input (e.g., end before start)
- `StatusToggle.test.tsx` — mirrors the old StatusPickerInline tests; six buttons render, click updates store, returns null if event not in plan, active button has correct aria-pressed.
- `MyPlanEmptyState.test.tsx` — three CTA cards render; "Browse events →" and "Editor's Picks →" link to `/events`; "Plan with AI →" renders as disabled with "Coming soon".
- `IcalDownloadButton.test.tsx` — disabled state when no exportable items; click triggers Blob download (mock `URL.createObjectURL` / `URL.revokeObjectURL`).
- `MyPlanWidget.test.tsx` — adds two cases: widget returns null when pathname is `/my-plan`; "Open full plan →" link points to `/my-plan`.

**Not tested** — `MyPlanClient`, `MyPlanTimeline`, `MyPlanMap`, `MyPlanEventCard`, `ConflictWarnings` (composed UI; visual smoke).

**Mocking** — `vi.mock('next/navigation')` for the widget test; `vi.mock('@/lib/plan-store')` not needed (store reset between tests in `beforeEach`).

**Pre-merge check**
- `npm test` green.
- `npm run lint` clean.
- `npm run build` succeeds (catches any Next 16 server/client boundary issue early; cf. the EventMap typing fix at the end of Phase 3).
- Manual smoke: `/my-plan` with empty plan → empty state. Add 8 events. Open Timeline → see them. Mark two as Confirmed on adjacent times → conflict bracket appears. Switch to Map → see pins + lines + travel labels. Click "Download .ics" → file downloads. Import into Google Calendar → events appear with status emoji prefix.

---

## Out of scope (explicit non-goals)

- Live iCal subscribe URL (`/api/ical/[token]`) — Phase 5 with auth.
- Share read-only link (`/my-plan/[shareToken]`) — Phase 5.
- Per-event notes textarea — deferred.
- Batch operations (multi-select + bulk status change) — deferred.
- "All statuses" grid tab — deferred (Timeline + Map cover the use case).
- Export-as-text / "Email me my plan" — deferred.
- DB sync of plan items (`syncPlanToDb()` server action) — Phase 5 (needs auth).
- AI Concierge integration — Phase 5.
- Magic link recovery prompt — Phase 5.
- Mapbox Directions API real-route polylines — over-budget for v1.4.

---

## Risks

- **Conflict bracket overlay positioning** is the trickiest piece. Cards can resize on viewport change, content reflow, or status change. Mitigation: `ResizeObserver` + redraw on `tab` change + accept best-effort (skip pair if ref is null this frame). If it gets unwieldy, fall back to a non-overlay treatment: a small "↕ Conflict" badge inside each card pointing to the other.
- **iCal status emoji in SUMMARY** — some calendar clients (older Outlook) render Unicode poorly. Mitigation: emoji is the *prefix*, the title still reads clearly without it.
- **MapPlan routing line label clutter** at high zoom levels. Mitigation: hide labels below zoom 13.
- **Status icon noise** — six emoji in a row can feel busy. Mitigation: icons are subtle, color carries the active state, text label is the readable signal.

---

## Definition of done

- `/my-plan` exists; empty state renders for new users; populated plan renders day-grouped Timeline tab and Map tab.
- `StatusToggle` everywhere replaces `StatusPickerInline`; `NextUpCard` updated, old component + test deleted.
- `ConflictWarnings` brackets two overlapping confirmed/RSVPed events; ignores other status combinations.
- `MyPlanMap` shows status-colored pins for plan-only events on selected day, with straight routing lines + travel-time midpoint labels.
- `MyPlanWidget` is hidden on `/my-plan`; "Open full plan →" navigates there from any other page.
- "Download .ics" button generates a valid file that imports cleanly into Google Calendar with status emoji in titles.
- `lib/conflicts.ts` and `lib/ical.ts` are pure and unit-tested.
- `npm test` green; `npm run lint` clean; `npm run build` succeeds.
