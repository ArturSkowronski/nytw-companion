# Share My Plan — Design

**Date:** 2026-05-26
**Phase:** Feature add (post-launch)
**Status:** Draft, awaiting user review

---

## Goal

Let a user share their `My Plan` with one person via a copyable link (DM-friendly, iMessage/Slack/WhatsApp). Recipient opens the link, sees the sender's plan as a read-only timeline + map, and can click "+ Add to my plan" per event to copy individual events into their own (localStorage) plan.

Driving use case (user's words): *"spotykam kogoś, sharuję eventy"* — coordinating which events two people will both attend.

Acceptance test:

> User has 5 events in their plan, opens `/my-plan`, clicks "Share my plan". Dialog opens with a URL ending in `#…`. They tap "Share" (mobile) or "Copy link" (desktop) → recipient pastes URL in incognito → sees "Plan — 5 events" with day-grouped timeline. Recipient clicks "+ Add to my plan" on 2 events → opens `/my-plan` → those 2 events appear with status `interested` and source `share`.

---

## Decisions captured during brainstorm

| Topic | Decision |
| --- | --- |
| Scope | **In:** share My Plan only, URL-hash storage (no backend), recipient sees read-only timeline + map + per-event "Add to my plan". **Out (deferred):** dynamic OG images, server-stored short links, editable/live plans, analytics, QR code, sharing filtered lists or Editor's Picks. |
| Storage | URL hash fragment with base64url-encoded payload. No DB, no API route. Hash never reaches the server, so SSR can't leak it and we have zero plan-content logs. |
| Payload format | `n=<name>\|i=<id>,<id>,...` then base64url-encoded into hash. `n` is optional; if missing, header reads "Shared NYTW plan". |
| Max events per share | 25. Beyond that the URL becomes awkward to paste in DM clients; share UI surfaces a "you have 27, link will include the first 25" note rather than refusing. |
| Sender entry point | New `SharePlanButton` in `/my-plan` page header. Disabled (with tooltip "Add events to share") when plan is empty. |
| Sender share mechanics | Web Share API on supporting browsers (opens native iOS/Android share sheet) → fallback to clipboard copy + toast. Dialog always shows the URL in a read-only input as the universal fallback. |
| Recipient route | `app/plan/share/page.tsx` — client component reading `window.location.hash`. SSR renders a generic skeleton; hydration decodes hash and resolves IDs. |
| Recipient data source | Same `all-events.json` the rest of the app uses (`lib/events-api.ts`). No fetch — the events catalogue ships with the bundle, so the page works offline once loaded. |
| Recipient "Add to plan" | Reuses `usePlanStore.addItem(id, 'interested', 'share')`. Adds a new source value `'share'` to the existing source-tracking enum. |
| Unknown event IDs | Silently dropped from the render set. If `dropped > 0`, recipient sees a small footer note: "N events from this plan are no longer available." Never an error. |
| URL surface | `https://nytw.dev/plan/share#<base64url>`. Hash, not query — keeps it off our server, off our analytics, off referer headers. |
| Privacy | Zero server involvement. No tracking on the share page beyond what the rest of the site does. Optional sender name in the link is opt-in via a single text input in the dialog. |
| Testing | Vitest for encoder/decoder + edge cases; Playwright e2e for the round-trip flow described in the acceptance test. |

---

## Architecture

```
app/
  my-plan/page.tsx               (existing — host for SharePlanButton)
  plan/
    share/
      page.tsx                   NEW — public read-only viewer
components/
  MyPlanClient.tsx               MOD — render <SharePlanButton/>
  SharePlanButton.tsx            NEW — dialog with copy / Web Share
  SharedPlanView.tsx             NEW — recipient-side read-only list
                                       (composes existing MyPlanTimeline
                                        layout but with a different card)
  SharedPlanEventCard.tsx        NEW — read-only card + "Add to my plan"
lib/
  share-encoding.ts              NEW — encodePlan / decodePlan, pure
  plan-store.ts                  MOD — accept source: 'share'
```

### Data flow — sender

```
user on /my-plan
   │
   ├─ usePlanStore.items  ──►  SharePlanButton
   │                              │
   │                              │  click → open dialog
   │                              ▼
   │                          encodePlan({ name?, ids })
   │                              │
   │                              ▼
   │                       https://nytw.dev/plan/share#<base64url>
   │                              │
   │                              ├─ navigator.share() (if available)
   │                              └─ navigator.clipboard.writeText() + toast
```

### Data flow — recipient

```
GET /plan/share        (SSR returns skeleton, no hash on server)
   │
   ▼
hydrate → read window.location.hash
   │
   ▼
decodePlan(hash) → { name?, ids: string[] }
   │
   ▼
resolveEvents(ids, allEvents) → { events: Event[], dropped: number }
   │
   ▼
SharedPlanView
   │
   ├─ header: "<name>'s NYTW plan — N events"  (or "Shared NYTW plan")
   ├─ day-grouped timeline (same visual rhythm as MyPlanTimeline)
   ├─ SharedPlanEventCard per event
   │     ├─ shows time / host / venue
   │     ├─ "+ Add to my plan"  →  usePlanStore.addItem(id, 'interested', 'share')
   │     └─ once added: "✓ In your plan"
   └─ footer: "(N events from this plan are no longer available)" — only if dropped > 0
```

---

## Encoding

### Wire format

Plain text, pipe-delimited:

```
i=partiful-abc,partiful-def,partiful-ghi
n=Marcin|i=partiful-abc,partiful-def
```

Then base64url-encoded (`+→-`, `/→_`, drop `=` padding) and placed in the URL hash.

```ts
encodePlan({ ids, name }): string  // returns "#…" body, no leading #
decodePlan(hash: string): { ids: string[]; name?: string }  // tolerant: returns {ids: []} on garbage
```

### Decisions

- **Why pipe + key=value, not JSON?** Stays human-debuggable; shorter than JSON (no quotes/braces); resistant to base64-padding weirdness.
- **Why base64url, not raw?** URL-safe across iMessage/Slack/Discord (they aggressively munge `,` and `|`); pads cleanly into a single token preview in chat UIs.
- **Why hash, not query?** Hash never hits server logs, never appears in referers, never gets cached by CDNs, never gets indexed.
- **Future-proofing:** new keys can be added (`s=…` for status hints, etc.) without breaking older clients — unknown keys are ignored on decode.

### Size budget

- One ID ≈ 28 chars (`partiful-uamjvd3xrengjfwddiuf`)
- 25 IDs + commas ≈ 730 chars plaintext → ~975 chars base64url
- Plus `https://nytw.dev/plan/share#` (28 chars) → ~1003 chars URL
- All major chat clients tolerate >2000-char links. 25 is a comfortable cap.

---

## Components

### `SharePlanButton.tsx`

- Disabled when `usePlanStore.items.length === 0` (tooltip: "Add events to share").
- Click → opens a small dialog (existing shadcn `Dialog`):
  - Optional name input ("Your name — optional, shown in the link").
  - Read-only input with the full share URL (selected on focus).
  - Primary action: "Share" (Web Share API where available) → fallback "Copy link" → toast.
  - Secondary: "Close".
- Emits no analytics.

### `app/plan/share/page.tsx`

- `'use client'` — hash isn't available during SSR.
- Renders `<SharedPlanView />` once hash is decoded.
- Pre-decode state: minimal skeleton (avoid empty-state flash).
- Metadata: static title "Shared NYTW plan · NYTW Engineer's Companion" + default OG (existing).

### `SharedPlanView.tsx`

- Pure read-only — no `usePlanStore` writes here, only `SharedPlanEventCard` writes.
- Day-grouped timeline mirroring `MyPlanTimeline` layout (reuse helpers from `lib/events.ts` for grouping).
- Header shows sender name if present.
- "Open all RSVPs" link opens every event's RSVP URL in new tabs (small affordance, optional).

### `SharedPlanEventCard.tsx`

- Smaller than `MyPlanEventCard`: no status toggle, no conflict warnings.
- Shows: time, title, host, venue/neighborhood, "Editor's Pick" badge if applicable.
- Right side:
  - If event already in recipient's plan → "✓ In your plan" (static).
  - Else → button "+ Add to my plan" → `usePlanStore.addItem(id, 'interested', 'share')` + toast.

---

## Edge cases

| Case | Behaviour |
| --- | --- |
| Empty plan in `/my-plan` | Share button disabled, tooltip. |
| > 25 events | Dialog warning: "Link will include the first 25 (sorted by start time)." Encode caps to 25. |
| Hash is garbage / missing | Recipient page shows a friendly empty state with a link to `/events`. No error. |
| Some IDs no longer in catalogue | Dropped silently; footer note shows count. |
| Recipient already has the event | Card shows "✓ In your plan" instead of the add button. |
| Web Share API not available | Skip native share; show only Copy. Detect via `typeof navigator.share === 'function'`. |
| Clipboard API blocked | URL input is selectable as last-resort manual copy; toast text adjusts. |
| Recipient adds, then revisits same link | Idempotent — `addItem` of an existing event is a no-op. |
| Sender appends `?utm=…` or anything | We only read hash; queries are ignored. |

---

## Out of scope (deferred)

- Dynamic per-share OG images (`/api/og?ids=…`) — high-value for socials, separate spec.
- Server-stored short links (Supabase row + `/p/abc12`) — only worth it once we want analytics or live updates.
- Editable shared plans / "live" links — design assumes share is a snapshot.
- QR code in the dialog — adds dep, niche on the "DM a friend" use case.
- Recipient bulk "Save all N events to my plan" button — explicit per-event was the user's pick.
- Sharing filtered lists, Editor's Picks, search results.

---

## Testing

### Unit (vitest)

`__tests__/lib/share-encoding.test.ts`
- `encodePlan` + `decodePlan` round-trip with name.
- Round-trip without name.
- `decodePlan` of empty / `'#'` / random base64 / non-base64 → `{ ids: [] }`.
- Forward-compatible decode: payload with extra unknown keys parses ids correctly.
- Cap at 25: encoding 30 ids → encoded result decodes to 25.
- base64url safety: encoded output contains no `+`, `/`, `=`.

`__tests__/components/SharePlanButton.test.tsx`
- Disabled when plan empty.
- Renders URL containing `#`.
- Click "Copy link" with mocked clipboard → toast appears.

`__tests__/components/SharedPlanEventCard.test.tsx`
- Renders "+ Add to my plan" when event not in plan.
- Clicking the button calls `addItem` with `source: 'share'`.
- Renders "✓ In your plan" when event already in plan.

### E2E (Playwright)

`e2e/share-plan.spec.ts` — full round-trip:

1. Visit `/events`, add 2 events to the plan via existing flow.
2. Navigate to `/my-plan`, click "Share my plan".
3. Read URL from the share dialog's input.
4. Open a fresh page (`browser.newContext()` — empty localStorage) and visit that URL.
5. Assert: header reads "Shared NYTW plan — 2 events" (no sender name typed).
6. Assert: 2 event cards visible, each with "+ Add to my plan".
7. Click "Add" on the first card → toast → "✓ In your plan" replaces the button.
8. Navigate to `/my-plan` in that context → assert that one event is now in the plan.

---

## Migration / compatibility

- `usePlanStore` source enum extends with `'share'`. Existing items in localStorage keep their previous source; the type change is additive.
- No data migrations required.
- No backward-incompatible URL/route changes.
