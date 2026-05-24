# Phase 7 — /beyond + Landing polish + About + SEO + Polish (Design)

**Status:** Draft for review
**Date:** 2026-05-25
**Author:** brainstorming session (collaborator: Artur Skowroński)
**Predecessor phase:** Phase 6 — Filters (shipped 2026-05-25)
**Successor phase:** Phase 8 — Offline PWA + deployment

---

## North Star (one-line)

Make the app feel like a finished, honest v1: a real `/beyond` page that admits we don't cover everything, a landing that shows curated picks with full blurbs and transparent VirtusLab disclosure, a real `/about` page, basic SEO, and the production polish (toasts, error boundaries, loading skeletons, keyboard help) that separates a side-project from a release.

## Scope

Five surfaces, each self-contained:

1. **`/beyond`** — page listing alternative aggregators with honest copy, wired into existing empty-state CTAs.
2. **Landing redesign** — replace placeholder skeleton with the real Editor's Picks carousel showing full blurbs (incl. VirtusLab disclosure); add "Why we built this" and "What we don't do" honesty sections; ship a reusable `<VirtusLabFooter>`.
3. **`/about`** — new route with draft content seeded from SPEC.md signals.
4. **SEO** — per-route metadata, sitemap, robots, runtime-generated OG image.
5. **Polish** — sonner toasts, route-level error boundaries, loading skeletons, `?` help modal, four keyboard shortcuts.

**Explicitly out of scope** (deferred to a later phase or never):

- Light/dark mode toggle (entire codebase uses hardcoded hex; refactor too large for this slice).
- PWA / service worker / offline (Phase 8).
- Production domain / deployment automation (Phase 8).
- Real bio copy and photo for Artur (placeholders ship; you fill after merge).
- Real LinkedIn URL (placeholder ships; you fill after merge).
- Any per-route dynamic OG image (one static OG covers the whole site).

---

## Section 1 — `/beyond`

### Data

Create `data/external-sources.json` with the 9 entries from SPEC.md §Phase 7 verbatim. Schema:

```json
[
  {
    "slug": "yorkseed",
    "name": "Yorkseed",
    "url": "https://nytw.yorkseed.co",
    "tagline": "1,800+ events. Broader scope.",
    "bestFor": "I want to see EVERYTHING."
  },
  { "...": "and 8 more, in the exact order listed in SPEC.md §Phase 7" }
]
```

The nine sources: Yorkseed, Andrew Yeung Tech Week, GarysGuide, Vibecal, Carly AI, Build Week NYC, Partiful #NYTechWeek, Tech Week Official, Luma /nytw.

### Page

`app/(marketing)/beyond/page.tsx` — server component, static (no `revalidate`).

```
[Header]
  H1: "Other places to find Tech Week NYC events"
  Lede: "We curate 87 engineering-relevant events from 1,000+. We skip a lot.
         Here's where to find the rest."

[Grid of 9 source cards — 1col mobile, 2col desktop]
  Each card:
    - Source name (mono, bold)
    - Tagline (gray, one line)
    - "Best for: …" (orange #FF6B35 accent label + value)
    - "Visit →" button (target=_blank, rel="noopener noreferrer")

[Footer block]
  H2: "Why we link the competition"
  Body (verbatim from SPEC.md §Phase 7):
    "Tech Week is too big for one tool. We're the curated engineering layer;
     these cover what we don't."

<VirtusLabFooter />
```

### Wiring (empty-state CTAs)

Replace existing placeholder copy with real `<Link href="/beyond">` destinations:

1. `components/EventList.tsx` — filter-aware empty state currently says "browse other aggregators →". Becomes a link to `/beyond`.
2. `components/EventList.tsx` — search-empty state (same text in a sibling branch). Same link.
3. `components/ConciergeProposals.tsx` (or wherever the AI's "no good matches" copy lives) — add a final-line link: *"Your profile is specific — see /beyond for broader sources →"*.

### Nav

`components/SiteNav.tsx` — flip the `Beyond` item to `live: true`.

### Tests

- `__tests__/app/beyond.test.tsx` — render page; assert page renders all 9 source names from `external-sources.json`; assert every external `<a>` has `target="_blank"` and `rel` includes `noopener`.
- `__tests__/components/SiteNav.test.tsx` (existing) — extend or add a case asserting `Beyond` is now a live link, not a disabled span.

---

## Section 2 — Landing redesign

### Page structure

`app/(marketing)/page.tsx`, server component, `revalidate = 3600`. New top-to-bottom shape:

```
[Hero — keep current, tiny tweak]
  Eyebrow: "Tech Week NYC · June 1–7, 2026"
  H1: "NYTW Engineer's Companion"
  Lede: "1,047 events. 168 hours. Plan the week you actually want."   ← 1,000+ → 1,047
  Two CTAs (unchanged): "Browse 87 events →" + "Plan my week with AI →"
  Subtle third link: "or see /beyond if you want it all →"            ← NEW

[3-step flow strip — NEW]
  Three columns (stack on mobile):
    ①  Browse or AI-plan
    ②  Add to My Plan
    ③  Sync to your calendar
  Mono labels, single-line description per step, no images.

[Editor's Picks teaser — REPLACE placeholder skeleton]
  Renders <EditorsPicksCarousel picks={picks} variant="full" />
  with picks = events.filter(is_editors_pick).
  Each card MUST show the editors_pick_blurb (full text, not just title).
  Position 1: VirtusLab event (already has disclosure blurb in seed).

[Why we built this — NEW]
  H2: "Why we built this"
  Two short paragraphs drafted from SPEC.md's tone:
    Para 1: 1,000+ events, no honest engineering filter, this is one.
    Para 2: Curation > filters. We picked for engineers who ship.
  Signed: "— Artur Skowroński, VirtusLab"

[What we don't do — NEW]
  H2: "What we don't do"
  Three bullets, verbatim from SPEC.md §Phase 7:
    • "We don't RSVP for you. You click through to Luma/Partiful, then
       mark status here."
    • "We don't have every event — we have 87 we'd recommend to an
       engineer friend."
    • "We don't track you. Plan stored in your browser. Email link only
       if you want recovery."

<VirtusLabFooter />
```

### Editor's Picks carousel — `variant` prop

Existing `components/EditorsPicksCarousel.tsx` is reused on `/events`. There it shows a compact form. On landing it must show full blurbs.

Add a discriminator: `variant?: 'compact' | 'full'` (default `'compact'` for backward compat). When `'full'`, each card additionally renders `editors_pick_blurb` in a dedicated paragraph beneath the title/host line. Existing call site on `/events` is untouched.

### `<VirtusLabFooter>`

New shared component `components/VirtusLabFooter.tsx`:

```
[Left]  Made by VirtusLab (link to virtuslab.com, _blank, noopener)
[Right] Not affiliated with a16z or Tech Week NYC
[Below, smaller, gray] About · Beyond · GitHub (if repo URL known; else omit)
```

Replaces today's inline footer in `app/(marketing)/page.tsx`. Reused on `/about`.

### Tests

- `__tests__/app/landing.test.tsx` — assert the 5 Editor's Picks render with full blurbs visible (use seed-events.json); assert VirtusLab disclosure text appears; assert "What we don't do" three bullets present; assert "or see /beyond" subtle link is rendered.
- `__tests__/components/EditorsPicksCarousel.test.tsx` — add a `variant="full"` test asserting blurb text renders; keep existing tests green (default `'compact'` unchanged).
- `__tests__/components/VirtusLabFooter.test.tsx` — render asserts "Made by VirtusLab" + "Not affiliated" both present, VirtusLab link has `target="_blank"`.

---

## Section 3 — `/about`

### Page

`app/(marketing)/about/page.tsx`, server component, static.

```
[Header]
  H1: "About NYTW Companion"

[Why this exists]
  H2: "Why this exists"
  Body (drafted from SPEC.md North Star, ~80 words):
    Roughly: Tech Week NYC runs ~1,000 events in a week. No existing
    aggregator filters for engineers who ship. NYTW Companion is one
    engineer's opinionated cut — 87 events, day-grouped, with honest
    blurbs on the Editor's Picks. We link to alternatives we don't
    cover.

[How we curate]
  H2: "How we curate"
  Bullets:
    • We read every event description, not just the title.
    • We pick for engineers who ship — devtools, AI infra, platform
      engineering, security, open source.
    • We disclose when VirtusLab hosts an event (see Editor's Picks).
    • We link to alternatives we don't cover (see /beyond).

[Not affiliated]
  Single sentence: "NYTW Engineer's Companion is an independent project
  by VirtusLab. Not affiliated with a16z, Tech Week NYC, or any host
  listed."

[About the author]
  H2: "Who built this"
  Layout: left column initials avatar (or <Image> if /artur.jpg exists),
          right column:
    Name: Artur Skowroński
    Role line: Engineer at VirtusLab
    Bio: {/* TODO: replace with real bio — see TODO in source */}
         Placeholder: one sentence about engineering background.
    Links: LinkedIn (placeholder URL, marked with TODO comment)

<VirtusLabFooter />
```

The bio paragraph and LinkedIn URL ship as obvious placeholders with `{/* TODO: ... */}` source comments so they're easy to grep for and replace post-merge. The photo file `public/artur.jpg` is NOT committed; the component falls back to a circular initials badge ("AS") rendered with the brand orange — no broken-image icon.

### Nav

`components/SiteNav.tsx` — flip the `About` item to `live: true`.

### Tests

- `__tests__/app/about.test.tsx` — assert the four section headings render; assert "Not affiliated" sentence present; assert initials fallback renders ("AS").

---

## Section 4 — SEO

### `lib/site-url.ts`

```ts
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
```

Single source of truth used by sitemap, robots, OG image, and per-route metadata.

### Per-route metadata audit

Add or normalize `export const metadata` for every page route. Each gets:

- `title` (route-specific, format: `<short> — NYTW Engineer's Companion`)
- `description` (one sentence, route-specific)
- `openGraph: { url: \`${SITE_URL}${route}\`, type: 'website' }`
- `alternates: { canonical: route }`

Routes to touch:

| Route       | Status                                  |
|-------------|-----------------------------------------|
| `/`         | Has metadata — verify shape             |
| `/events`   | Has metadata — verify shape             |
| `/now`      | Add                                     |
| `/my-plan`  | Add                                     |
| `/plan`     | Add                                     |
| `/beyond`   | Add (in Section 1, this section verifies coverage) |
| `/about`    | Add (in Section 3, this section verifies coverage) |

Set `metadataBase: new URL(SITE_URL)` once in root `app/layout.tsx` so `alternates.canonical` resolves correctly.

### OG image — `app/opengraph-image.tsx`

Next.js convention file. Runtime-generated via `ImageResponse` from `next/og`. 1200×630.

```
Background: #0A0A0A
Top label:  TECH WEEK NYC · JUNE 1–7, 2026   (mono, #FF6B35, ~28px)
Headline:   NYTW Engineer's Companion       (mono, #FAFAFA, bold, ~96px)
Subhead:    87 engineering-relevant events. (mono, #A3A3A3, ~36px)
            Plan the week you actually want.
Bottom right: virtuslab.com                 (mono, #555555, ~24px)
```

Uses system mono font (no `next/font/google` fetch — works in offline builds). Twitter card auto-derives.

### Sitemap — `app/sitemap.ts`

Static array of public routes:

```
/, /events, /now, /my-plan, /plan, /beyond, /about
```

Each with `lastModified: new Date()`, `changeFrequency: 'weekly'`, `priority` (`/` and `/events` = 1.0; others = 0.7). Excludes `/api/*`. Uses `SITE_URL` as base.

### Robots — `app/robots.ts`

```
User-agent: *
Allow: /
Disallow: /api/
Sitemap: ${SITE_URL}/sitemap.xml
```

### Tests

- `__tests__/app/sitemap.test.ts` — call the default export; assert all 7 routes present; assert URLs are absolute (start with SITE_URL).
- `__tests__/app/robots.test.ts` — call default export; assert `disallow` includes `/api/`; assert `sitemap` URL matches `SITE_URL`.
- `__tests__/app/opengraph-image.test.ts` — call the default export; assert it returns an `ImageResponse` instance (don't pixel-diff the PNG).
- `__tests__/lib/site-url.test.ts` — assert trailing slash stripped; assert env-var override works.
- No new test for per-route metadata (visual inspection during smoke covers it; would be brittle to snapshot every page's `<head>`).

---

## Section 5 — Polish

### 5.1 Sonner toasts

- `sonner` is **already installed** (`package.json` ships `sonner@^2.0.7` and a wrapped `components/ui/sonner.tsx` that handles theme + custom icons). No new dependency.
- Mount `<Toaster position="bottom-right" richColors />` once in `app/layout.tsx`, importing the wrapped Toaster from `@/components/ui/sonner`. (The wrapper reads theme via `next-themes`, which is also already installed; absent a `ThemeProvider` it defaults to `system` — fine for dark-only.)
- Call sites:
  - `EventCard` / `EventDetailModal` `Add to plan` → `toast.success('Added to your plan')`
  - `IcalDownloadButton` copy button → `toast.success('iCal link copied')`
  - `ConciergeClient` Add-all-to-plan → `toast.success('${n} events added to your plan')`
  - `ConciergeForm` submit failure → `toast.error("Couldn't reach the AI. Try again?")`

### 5.2 Error boundaries

- `app/error.tsx` — global fallback. Friendly mono message ("Something broke."), the underlying message in muted gray, **Try again** button (calls `reset` prop), link back to `/`.
- Per-route variants that just re-export the global with a route-specific heading:
  - `app/events/error.tsx` — "Couldn't load events."
  - `app/plan/error.tsx` — "AI concierge unavailable."
  - `app/my-plan/error.tsx` — "Couldn't load your plan."
  - `app/now/error.tsx` — "Couldn't load /now."
- Skip `app/global-error.tsx` for now.

### 5.3 Loading skeletons (`loading.tsx`)

- `app/events/loading.tsx` — sticky day-nav placeholder + 6 card placeholders (uses existing `animate-pulse` boxes from the landing placeholder).
- `app/my-plan/loading.tsx` — single line "Loading your plan…" (mono, gray); plan is client-rendered from localStorage so this is brief.
- `app/plan/loading.tsx` — same minimal approach.
- `app/now/loading.tsx` — single countdown card skeleton (one tall pulsing box).

### 5.4 `?` help modal

- `components/HelpModal.tsx` — uses the existing `Dialog` primitive at `components/ui/dialog.tsx` (centered modal — the right UX for a discoverable shortcut sheet; `Sheet` is the side drawer used elsewhere for navigation and filters).
- Mount inside `SiteNav` so it's globally available without polluting `app/layout.tsx`.
- Opens on `?` keypress (when not typing in an input).
- Contents:
  ```
  Keyboard shortcuts

  ?      Show this help
  /      Focus search (Browse page)
  m      Toggle map / timeline (Browse page)
  Esc    Close drawer / modal
  ```

### 5.5 Shortcut wiring

The modal documents shortcuts — they have to work:

- `?` → open HelpModal (global listener in `SiteNav`).
- `/` → focus the search input on `/events`. Listen in `EventSearch`; preventDefault; ignore when target is a typing element.
- `m` → toggle `?view=` between `timeline` and `map` on `/events`. Listen in `ViewToggle`.
- `Esc` → closes any open `Sheet` / `Dialog`. Already handled by Base UI primitives — verify on smoke, no new code.

### 5.6 Typing-target helper

New `lib/keyboard.ts`:

```ts
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return target.isContentEditable
}
```

Used by every keypress listener above.

### Tests

- `__tests__/lib/keyboard.test.ts` — covers input/textarea/select/contentEditable true; div/button false; null false.
- `__tests__/components/HelpModal.test.tsx` — fires `?` keydown on document; assert dialog opens; fire `Escape`; assert dialog closes.
- `__tests__/components/HelpModal.test.tsx` — fires `?` keydown when target is `<input>`; assert dialog does NOT open.
- `__tests__/app/error.test.tsx` — render error boundary with a `Error('boom')` and a stub `reset`; assert message + button render; click button calls `reset`.
- `__tests__/app/loading.test.tsx` (events loading only — minimal) — assert it renders without crashing.
- Smoke test for toasts: render a button that calls `toast.success('hi')` inside a wrapper with `<Toaster />`; assert text appears.

---

## Architecture overview (cross-cutting)

```
app/
├── layout.tsx                       (+ metadataBase, + <Toaster />)
├── error.tsx                        NEW
├── opengraph-image.tsx              NEW
├── sitemap.ts                       NEW
├── robots.ts                        NEW
├── (marketing)/
│   ├── page.tsx                     REWRITE (landing redesign)
│   ├── beyond/page.tsx              NEW
│   └── about/page.tsx               NEW
├── events/
│   ├── error.tsx                    NEW
│   └── loading.tsx                  NEW
├── plan/
│   ├── error.tsx                    NEW
│   ├── loading.tsx                  NEW
│   └── page.tsx                     (+ metadata)
├── my-plan/
│   ├── error.tsx                    NEW
│   ├── loading.tsx                  NEW
│   └── page.tsx                     (+ metadata)
└── now/
    ├── error.tsx                    NEW
    ├── loading.tsx                  NEW
    └── page.tsx                     (+ metadata)

components/
├── SiteNav.tsx                      (+ HelpModal mount; flip Beyond+About live)
├── EditorsPicksCarousel.tsx         (+ variant prop)
├── VirtusLabFooter.tsx              NEW
├── HelpModal.tsx                    NEW
├── EventCard.tsx                    (+ toast)
├── EventDetailModal.tsx             (+ toast)
├── IcalDownloadButton.tsx           (+ toast)
├── ConciergeClient.tsx              (+ toast)
├── ConciergeForm.tsx                (+ toast.error)
├── ConciergeProposals.tsx           (+ /beyond link)
├── EventList.tsx                    (+ /beyond link in empty states)
├── EventSearch.tsx                  (+ "/" shortcut)
└── ViewToggle.tsx                   (+ "m" shortcut)

lib/
├── site-url.ts                      NEW
└── keyboard.ts                      NEW

data/
└── external-sources.json            NEW
```

## Risks & mitigations

- **Risk:** ~~Sonner React-19 compatibility~~ — N/A; sonner is already installed and the wrapped Toaster lives at `components/ui/sonner.tsx`.
- **Risk:** `next/og` `ImageResponse` requires a font; system mono varies by OS. **Mitigation:** use `system-ui, monospace` font stack and accept platform variance for a brand image; alternative is to commit a single woff2 (~30KB) and reference it from the OG handler.
- **Risk:** `metadataBase` set globally could affect tests that didn't expect it. **Mitigation:** keep `SITE_URL` defaulting to localhost so test renders stay stable.
- **Risk:** Landing tests assert text from `seed-events.json` blurbs — brittle if the seed changes. **Mitigation:** assert presence of a substring known to be stable (the VirtusLab disclosure has a stable opening phrase "Disclosure: VirtusLab").
- **Risk:** "?" key conflicts with browser shortcuts on some keyboards. **Mitigation:** preventDefault only when our handler activates; pass-through when typing.

## Acceptance criteria

- [ ] `/beyond` route renders the 9 sources from `external-sources.json`; all external links open in new tab with `rel="noopener noreferrer"`; "Why we link the competition" paragraph present.
- [ ] `SiteNav` shows `Beyond` and `About` as live links (not "Coming soon").
- [ ] `/events` filter-zero empty state, search-zero empty state, and AI concierge "specific profile" message all link to `/beyond`.
- [ ] Landing renders Editor's Picks carousel with full blurbs visible; VirtusLab event renders with disclosure text; "Why we built this" + "What we don't do" sections present.
- [ ] `<VirtusLabFooter>` appears on `/`, `/about`, `/beyond`.
- [ ] `/about` renders 4 sections + initials-avatar fallback + `{/* TODO: real bio */}` source comment + `{/* TODO: real LinkedIn URL */}` source comment.
- [ ] `metadataBase` set in root layout; `/now`, `/my-plan`, `/plan`, `/beyond`, `/about` each export `metadata`.
- [ ] `/sitemap.xml` lists 7 public routes; `/robots.txt` allows `/`, disallows `/api/`, references sitemap.
- [ ] `/opengraph-image` returns an `ImageResponse` (verified in unit test).
- [ ] Sonner `<Toaster />` mounted globally; Add-to-plan, Copy-iCal-link, AI-add-all, AI-error each fire a toast.
- [ ] `app/error.tsx` + 4 per-route `error.tsx` files exist and render fallback UI.
- [ ] `app/events/loading.tsx` renders skeleton; minimal `loading.tsx` exists for `/my-plan`, `/plan`, `/now`.
- [ ] `?` opens HelpModal globally; `/` focuses search on `/events`; `m` toggles view on `/events`; all keypress handlers respect `isTypingTarget`.
- [ ] `npm test` green; `npm run lint` clean (0 errors, 0 warnings); `npm run build` succeeds.
- [ ] `/my-plan` (Phase 4), `/plan` (Phase 5a), `/events` filters (Phase 6) — none regress.

## Out-of-scope reminders

- Light/dark mode (deferred).
- PWA + offline + deployment (Phase 8).
- Real bio copy / real LinkedIn URL / real Artur photo (post-merge edits).
- Per-route dynamic OG images (one static OG).
- New keyboard shortcuts beyond the four listed.
- Refactoring hex colors into design tokens.
