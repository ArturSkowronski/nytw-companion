# Phase 3 — Map + /now mobile entry — Design

**Date:** 2026-05-19
**Phase:** 3 (v1.3)
**Source spec:** `SPEC.md` §5 Phase 3
**Status:** Draft, awaiting user review

---

## Goal

Deliver the v1.3 milestone: a Mapbox-backed map view for `/events` plus a `/now` mobile entry point. After this phase, browse is publishable.

Acceptance test (from SPEC.md):

- Desktop: user opens `/events?view=map&day=wed`, sees Wednesday pins, clicks a pin in Williamsburg, sees five nearest same-day events with travel time, clicks "Open RSVP" → toast "Added to plan" → MyPlanWidget increments.
- Mobile: user opens `/now`, sees "Next up: OpenAI Rooftop in 47 min, Williamsburg, 35 min Uber" → taps "Open in Maps" → native maps app opens.

Today is two weeks before the festival, so `/now` must also do something useful pre-festival.

---

## Decisions captured during brainstorm

| Topic | Decision |
| --- | --- |
| Mapbox token | Build with graceful fallback when `NEXT_PUBLIC_MAPBOX_TOKEN` missing. Mirrors Phase 2's seed-JSON fallback. |
| Scope | Full Phase 3 in one PR: EventMap + ViewToggle + URL state + `/now` + `lib/geo.ts` + sitewide hamburger nav. |
| `/now` off-window | Pre-festival countdown + Day 1 preview; post-festival "wrapped" card. |
| `/now` actions | Functional: real "Open in Maps" deep links, minimal inline status picker writing to plan-store, "Skip" sets `declined`. PWA install banner deferred to Phase 8. |
| URL params | `/events?view=map&day=wed` exactly per spec (day key: `mon`–`sun`). |
| Empty map day | Map stays mounted, empty source, overlay card "No events on Wed June 3. Try another day →". |
| Tests | Unit-test `lib/geo.ts` and `/now` logic; skip Mapbox UI in jsdom; Playwright stays in Phase 9. |
| Site nav | Sitewide hamburger via `SiteNav` rendered in `app/layout.tsx`; replaces the inline nav currently in `app/events/page.tsx`. Dead routes (`/my-plan`, `/plan`, `/beyond`, `/about`) render inline-disabled with "Coming soon". |

---

## Architecture

Two new routes, one shared util layer, sitewide nav swap.

```
app/
  events/page.tsx              (edit)     — Server Component; adds <ViewToggle> + conditional <EventMap>
  now/page.tsx                 (new)      — Server Component shell, fetches events, passes to <NowClient>
  layout.tsx                   (edit)     — render <SiteNav/>; remove inline nav from events/page.tsx

components/
  EventMap.tsx                 (new)      — client, mapbox-gl, day chip nav, pin clusters, popups
  EventMapPopup.tsx            (new)      — popup body; "Open details" reuses existing EventDetailModal
  ViewToggle.tsx               (new)      — client, segmented Timeline | Map; syncs ?view=
  DayChipNav.tsx               (new)      — client, 7 chips Mon–Sun; syncs ?day=
  StaticMapImage.tsx           (new)      — server-safe; wraps Mapbox Static API URL
  MapTokenFallback.tsx         (new)      — token-missing or load-failure fallback
  NowClient.tsx                (new)      — client island for /now: clock, geo, plan-store read
  NextUpCard.tsx               (new)      — central /now widget
  CountdownCard.tsx            (new)      — pre-festival /now mode
  RetroCard.tsx                (new)      — post-festival /now mode
  AfterThisCard.tsx            (new)      — secondary "next after current" widget
  SuggestionsCard.tsx          (new)      — fallback when nothing in next 2h
  StatusPickerInline.tsx       (new)      — minimal six-status writer; NOT the rich Phase 4 toggle
  SiteNav.tsx                  (new)      — desktop top-right nav + mobile hamburger Sheet

lib/
  geo.ts                       (new)      — pure helpers; no React, no Mapbox imports
  time.ts                      (edit)     — add festivalWindow, festivalMode, dayKeyForDate, dateForDayKey,
                                            nextEventInPlan, msUntil
```

**Key boundaries**

- Events are fetched **once** per route on the server; client islands receive serialized props.
- `mapbox-gl` is imported via `next/dynamic` — timeline-only visits don't pay the bundle cost.
- `lib/geo.ts` is pure → fully unit-testable.
- `SiteNav` is the only nav surface; pages no longer render their own.

**State ownership**

- URL params (`view`, `day`) → source of truth for `/events` view + day.
- `usePlanStore` (Zustand + localStorage) → unchanged plan source of truth.
- `NowClient` local state → real-time clock tick, geolocation cache (5 min), selected suggestion.

---

## Components

### `EventMap.tsx` (client, ~250 LOC)

Props: `{ events: Event[]; initialDay: DayKey; planItemIds: string[] }`.

- Initialize `mapbox-gl` once on mount; reuse instance across day changes by swapping the GeoJSON source.
- Pins: GeoJSON source + `circle` layer styled by `format`:
  - `rooftop` amber, `dinner` red, `panel` blue, `breakfast` green, `hackathon` purple, `workshop` teal.
- VirtusLab event: separate symbol layer, gold, larger, with text label.
- Editor's Picks: star overlay symbol.
- Clusters when >5 pins in viewport (`cluster: true` on the source).
- Click pin → opens `EventMapPopup` anchored to the pin.
- "Show all / Show only My Plan" toggle: layer-level filter expression keyed off `planItemIds`.
- Empty day: keep map mounted, swap to empty `FeatureCollection`, overlay centered card.

### `EventMapPopup.tsx` (client)

Mini event card inside `mapboxgl.Popup` portal. Fields: title, host, time, neighborhood. "Open details" emits callback → opens existing `EventDetailModal`. "5 nearest same day" rendered from memoized haversine sort.

### `ViewToggle.tsx` (client)

shadcn segmented control. Reads/writes `?view=`. Preserves `?day=` when switching.

### `DayChipNav.tsx` (client)

7 chips Mon–Sun → June 1–7 2026. Active chip highlighted from URL. Days with zero events show a dimmed `0` badge. Click writes `?day=`.

### `StaticMapImage.tsx` (server-safe)

`<Image>` whose `src` is from `lib/geo.ts staticMapUrl()`. Used by `EventDetailModal` (small touch-up to use this) and `NextUpCard` mini-map. Battery-friendly — no WebGL.

### `MapTokenFallback.tsx`

Renders when `process.env.NEXT_PUBLIC_MAPBOX_TOKEN` is missing/empty OR mapbox-gl fails to load. Dark-card styling matching Phase 2. Includes "Switch to timeline view →" button.

### `NowClient.tsx` (client, ~200 LOC)

Props: `{ events: Event[] }`.

State:

- `now` — ticks every 60 s via `setInterval`.
- `geo` — opt-in; `navigator.geolocation`; cached 5 min.
- `planItems` — from `usePlanStore`; rendered behind `mounted` gate to avoid hydration mismatch (same pattern as `MyPlanWidget`).

Branches on `festivalMode(now)`:

- `pre` → `<CountdownCard />` + Day 1 preview from plan (or top 3 Editor's Picks if plan empty).
- `in` → `<NextUpCard />` (next plan event in 2 h) or `<SuggestionsCard />` fallback; plus `<AfterThisCard />`.
- `post` → `<RetroCard />`.

### `NextUpCard.tsx` (client)

Title, host, address, time (e.g., "Wed 6:00 PM"), "Starts in 47 min" (recomputed from `now`).

- If `geo` granted: travel time via `haversineKm` + `walkingTimeMin`/`uberTimeMin`.
- Buttons: "Open in Maps" (platform-aware deep link), `<StatusPickerInline />`, "Skip this event" (sets `declined`).
- Mini map: `<StaticMapImage />`.

### `CountdownCard.tsx`

"Tech Week starts in N days, H hours." Shows Monday June 1 preview from plan, or top 3 Editor's Picks if plan empty.

### `RetroCard.tsx`

"Tech Week wrapped." Links to `/my-plan` retro (dead until Phase 4 → renders as `coming soon` button).

### `StatusPickerInline.tsx` (client)

Minimal segmented picker → `usePlanStore.updateStatus(eventId, newStatus)`. Six statuses per `PlanStatus` type. Replaced in Phase 4 by the full `StatusToggle`.

### `SiteNav.tsx` (client)

- Desktop (`md+`): top-right text nav (matches current `/events` look).
- Mobile (`<md`): hamburger icon → shadcn `Sheet` slide-in.
- Links: `/`, `/events`, `/now`, `/my-plan`, `/plan`, `/beyond`, `/about`.
- Dead routes render as inline-disabled with "Coming soon".
- Active route highlighted via `usePathname()`.
- Rendered in `app/layout.tsx`.

---

## Data flow

### `/events?view=map&day=wed`

```
Server (events/page.tsx)
  └─ fetchEvents() → seed JSON or Supabase
       └─ events: Event[] (serialized, ISO timestamps)

Client tree
  ├─ <ViewToggle/>  ← reads ?view via useSearchParams, writes via router.replace
  ├─ view=timeline → <EventList events/>  (existing Phase 2)
  └─ view=map      → <EventMap events initialDay planItemIds/>
                       ├─ <DayChipNav/>   ← reads/writes ?day
                       ├─ mapbox source (GeoJSON, filtered by day)
                       ├─ click pin → setSelectedPin → <EventMapPopup/>
                       │                                └─ "Open details" → setModalEventId
                       └─ <EventDetailModal eventId/>   (reused from Phase 2)
```

- URL is the only cross-component state for view/day. No client context provider.
- `planItemIds` recomputed from a `usePlanStore` selector; map filter expression re-evaluates.
- Day filter is client-side — events already in props, no re-fetch.

### `/now`

```
Server (now/page.tsx)
  └─ fetchEvents() → events: Event[]

<NowClient events={events}>
  ├─ useEffect: setInterval(60_000) → setNow(nowInNYC())
  ├─ useEffect: geo opt-in only on user click
  ├─ usePlanStore() → planItems (gated on mounted)
  ├─ mode = festivalMode(now):
  │    pre   → <CountdownCard nextDayEvents/>
  │    in    → <NextUpCard event={nextEventInPlan(...)} geo/> + <AfterThisCard/> + <SuggestionsCard/>
  │    post  → <RetroCard/>
  └─ all buttons functional today; no PWA install prompt this phase
```

### Pure-function additions

```ts
// lib/geo.ts
type LatLng = { lat: number; lng: number }
haversineKm(a: LatLng, b: LatLng): number
walkingTimeMin(km: number): number            // km * 12
uberTimeMin(km: number): number               // km * 4 + 5
neighborhoodCentroids: Record<string, LatLng> // ~20 NYC neighborhoods
staticMapUrl(opts: {
  lat: number; lng: number; zoom: number;
  width: number; height: number; markerColor?: string;
}): string

// lib/time.ts (additions)
festivalWindow(): { start: Date; end: Date }    // June 1 00:00 – June 7 23:59 EST
festivalMode(now: Date): 'pre' | 'in' | 'post'
dayKeyForDate(d: Date): 'mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun'
dateForDayKey(key: string): Date                // 'wed' → 2026-06-03 EST midnight
nextEventInPlan(
  items: PlanItem[], events: Event[], now: Date, withinHours?: number
): Event | null
msUntil(target: Date, now: Date): { days: number; hours: number; mins: number }
```

### Persisted state

No new env vars beyond `NEXT_PUBLIC_MAPBOX_TOKEN` (already in `.env.local.example`). No DB schema change. `usePlanStore` unchanged.

---

## Error handling & edge cases

### Map

- **No token:** `EventMap` and `StaticMapImage` short-circuit to `<MapTokenFallback />` before any mapbox-gl import.
- **mapbox-gl load failure** (dynamic import rejects): render `<MapTokenFallback message="Map failed to load" />`. No retry loop.
- **Event missing lat/lng:** filtered out of GeoJSON. Counter: "3 events without map locations — see timeline view."
- **Empty day:** map stays mounted, empty source, overlay card.
- **Zero events total:** Phase 2 empty state shown; ViewToggle still renders; Map view shows empty NYC map.

### `/now`

- **Geo denied / unavailable:** silently hide travel-time row. One-time hint "Enable location to see travel times →" with re-prompt button.
- **Geo error post-grant:** treat as denied; reuse last cached position 5 min.
- **No event in plan within 2 h (in-festival):** show `<SuggestionsCard />` with 3 suggestions from plan, fallback to Editor's Picks.
- **Pre-festival:** `<CountdownCard />`.
- **Post-festival:** `<RetroCard />` linking `/my-plan` retro (currently coming-soon).
- **Plan-store hydration:** gate on `mounted`, render skeleton until then.
- **Clock tick:** `setInterval` cleared in `useEffect` return.

### SiteNav

- Dead routes: inline-disabled, "Coming soon" hint. No 404s, no stub routes.

### URL state

- Invalid or missing `?view=` → `timeline`.
- Invalid or missing `?day=` → festival-mode default: `pre`→`mon` (Day 1), `in`→today's key, `post`→`sun` (Day 7). Resolved server-side from `searchParams.day` so the first render already has the correct chip active.
- Back/forward "Just Works" via URL.

### Deep links

- `maps:?address=...` / `geo:` on desktop fall back to `https://maps.google.com/?q=...`. Single "Open in Maps" button picks the right scheme via `navigator.userAgent`.

---

## Testing

**Posture:** unit-test pure logic and small components; skip Mapbox UI in jsdom; Playwright stays in Phase 9.

```
__tests__/lib/
  geo.test.ts                  (new)
  time-festival.test.ts        (new)   — adds; keep time.test.ts intact

__tests__/components/
  NextUpCard.test.tsx          (new)
  CountdownCard.test.tsx       (new)
  StatusPickerInline.test.tsx  (new)
  SiteNav.test.tsx             (new)
  ViewToggle.test.tsx          (new)
  DayChipNav.test.tsx          (new)
```

**Coverage highlights**

- `geo.test.ts` — known-pair haversine distances (Flatiron↔Williamsburg ≈ 5 km, ±0.2 tolerance); walking/uber round-trips; centroid lookup; `staticMapUrl` produces a well-formed URL with marker, lat, lng, zoom.
- `time-festival.test.ts` — `festivalMode` returns `pre` for 2026-05-20, `in` for 2026-06-03 14:00 EST, `post` for 2026-06-09; `dayKeyForDate(2026-06-03 EST) === 'wed'`; `dateForDayKey('wed').toISOString()` matches EST midnight; `nextEventInPlan` returns the soonest non-declined plan item in `[now, now+2h]`, returns `null` otherwise, ignores `declined`/`attended`.
- `NextUpCard.test.tsx` — mocked `now` and one plan event 30 min away → renders title, host, "Starts in 30 min", "Open in Maps" href fallback URL; no upcoming → renders fallback section.
- `CountdownCard.test.tsx` — `now=2026-05-20 EST` → "Tech Week starts in 12 days"; empty plan → Editor's Picks shown; plan with June 1 events → those shown.
- `StatusPickerInline.test.tsx` — clicking each status calls `usePlanStore.updateStatus` with that status.
- `SiteNav.test.tsx` — dead routes render as disabled with "Coming soon"; active route highlighted via mocked `usePathname`.
- `ViewToggle.test.tsx` — clicking "Map" calls `router.replace('/events?view=map&day=...')`, preserving `day`; defaults to `timeline` when no `view`.
- `DayChipNav.test.tsx` — 7 chips; active from URL; zero-event chip shows `0` badge; click writes `?day=`.

**Not tested** — `EventMap.tsx` (mapbox-gl needs WebGL), `EventMapPopup.tsx`, `StaticMapImage.tsx`, `MapTokenFallback.tsx`. Visual QA only.

**Mocking** — `vi.useFakeTimers()` for clock tests; `vi.mock('next/navigation')` for `useSearchParams`/`useRouter`/`usePathname`; `usePlanStore` reset between tests via the existing helper in `__tests__/lib/plan-store.test.ts`.

**Pre-merge check**

- `npm test` green.
- Manual smoke with `NEXT_PUBLIC_MAPBOX_TOKEN` set (map renders) and unset (`MapTokenFallback` renders).
- `/now` at today's date renders `CountdownCard` with a sensible countdown.

---

## Out of scope (explicit non-goals)

- Real `StatusToggle` rich UI (Phase 4).
- `/my-plan` dedicated route, map tab, iCal, conflicts (Phase 4).
- AI Concierge, magic link recovery (Phase 5).
- Filters drawer, clickable tag chips (Phase 6).
- `/beyond` page (Phase 7).
- PWA install banner, service worker, offline caching (Phase 8).
- Playwright e2e (Phase 9).
- `/events` mobile "now/next hour" bottom sheet (mentioned in spec line 414) — deferred; not in answered scope.

---

## Risks

- **Mapbox bundle size** (~400 kB gzipped). Mitigated by `next/dynamic` so it's only loaded when `view=map`.
- **`next/dynamic` + Next 16 App Router** has had API churn. Action: consult `node_modules/next/dist/docs/` before implementing (per AGENTS.md). If `dynamic({ ssr: false })` semantics changed, fall back to a `useEffect`-based lazy import.
- **Geolocation UX** — easy to over-prompt. Stick to "user clicks 'Enable location'" pattern; no auto-prompt on page load.
- **Hydration mismatch** on `/now` — followed `MyPlanWidget` precedent (gate on `mounted`).
- **Pre-festival is the only path testable today**, so `in`-festival rendering is verified by unit tests + a `?simulate=` query-param escape hatch is tempting but explicitly out of scope per the answered question — we accept this.

---

## Definition of done

- `/events?view=map&day=wed` renders pins for Wednesday events (or `MapTokenFallback` without a token).
- ViewToggle switches between timeline and map without re-fetching events.
- Day chip nav writes URL, shareable.
- Click pin → popup → "Open details" opens existing `EventDetailModal`.
- `MyPlanWidget` toggle on map shows only plan events.
- `/now` shows `CountdownCard` today; `<NextUpCard />` logic verified by unit tests against mocked clock.
- "Open in Maps" produces a working deep link on mobile, Google Maps URL on desktop.
- Sitewide `SiteNav` rendered; old inline nav removed from `app/events/page.tsx`.
- `lib/geo.ts` + `time.ts` additions are pure and tested.
- `npm test` green; no new TypeScript errors; manual smoke passes for both token-present and token-missing.
