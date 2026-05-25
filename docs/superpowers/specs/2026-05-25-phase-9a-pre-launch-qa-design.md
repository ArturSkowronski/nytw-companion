# Phase 9a — Pre-launch QA (Design)

**Status:** Draft for review
**Date:** 2026-05-25
**Author:** brainstorming session (collaborator: Artur Skowroński)
**Predecessor:** Phase 8a — PWA + deploy prep (shipped 2026-05-25)
**Successor:** Phase 8b — Vercel deployment + live monitoring (separate effort, user-driven)

---

## North Star

Build the pre-launch quality gates we can run from code: Playwright E2E for the three highest-value user journeys, Privacy + Terms pages in the project's voice, social-card metadata smoke tests, a Lighthouse config + GitHub Actions CI pipeline, a load fixture for under-pressure design review, and a real-device manual QA checklist. Document the SPEC Phase 9 items we explicitly cannot ship in current architecture (magic-link, iCal subscribe).

## Scope

Seven slices, each self-contained:

1. **Playwright setup** — install `@playwright/test`, config, scripts, `.gitignore`.
2. **Three E2E specs** — browse-and-add, filters, keyboard.
3. **Privacy + Terms pages** — drafted in project voice; nav wiring, sitemap, footer link group.
4. **Social-card meta-tag smoke tests** — assert every page exports `metadata` with required fields; locks down OG image shape.
5. **Manual QA checklist** — `docs/superpowers/launch/pre-launch-checklist.md`.
6. **Lighthouse + CI** — `lighthouserc.json`, `npm run lighthouse`, `.github/workflows/ci.yml` running lint/test/e2e/lighthouse on push and PR.
7. **Load fixture + deferred backlog doc** — opt-in 250-event fixture for design review under load; backlog doc names magic-link, iCal subscribe, prod-Lighthouse, real-device QA as explicit follow-ups.

**Explicitly out of scope** (deferred or moot):

- Magic-link email + SPF/DKIM (feature doesn't exist yet; deferred to a future phase post-Phase 8b).
- iCal subscribe via `webcal://` URL (needs `/api/ical/[token]` route + identity from magic-link).
- Lighthouse score gates against a real production URL (needs deployed URL; runs locally for now).
- Real-device manual QA execution (user runs the checklist; we ship the checklist).
- Real-time mobile gesture validation (manual; documented in checklist).
- A11y deep audit beyond Lighthouse's score (deferred).

---

## Pre-flight: codebase reality

- No Playwright installed; no `e2e/` dir; no `playwright.config.*`.
- No `/api/ical/[token]` route. Only `/api/concierge` and `/api/health`.
- No magic-link or auth-recovery code.
- `/my-plan` ical flow is download-only via `IcalDownloadButton`.
- Every page that ships in Phases 1–8a already exports `export const metadata: Metadata = { ... }`. Phase 7 added `alternates.canonical` to most routes.
- `app/opengraph-image.tsx` exists from Phase 7 (1200×630, brand palette).
- `data/seed-events.json` has 87 entries; `lib/types.ts` declares the `Event` shape.
- No `.github/workflows/` directory in the repo.
- The seed-fallback mode (no Supabase, no Anthropic, no Mapbox) gives E2E deterministic data without external deps.

---

## Section 1 — Playwright setup

### Dependency

```jsonc
// package.json
"devDependencies": {
  "@playwright/test": "^1.49.0"
}
```

### `playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    actionTimeout: 5000,
    navigationTimeout: 15000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
```

### `package.json` scripts

```jsonc
"scripts": {
  "e2e": "playwright test",
  "e2e:ui": "playwright test --ui",
  "e2e:install": "playwright install --with-deps chromium"
}
```

### `.gitignore` additions

```
# Playwright
test-results/
playwright-report/
playwright/.cache/
```

### Build/serve

Playwright launches `npm run start` against port 3000. The user (or CI) runs `npm run build` first. We do NOT bundle `build` into the `e2e` script because (a) `npm run build` is slow and (b) someone hand-testing wants to skip the build when iterating.

---

## Section 2 — E2E specs

### `e2e/browse-and-add.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  // Start with an empty plan
  await page.addInitScript(() => {
    window.localStorage.clear()
  })
})

test('landing → browse → search → modal → add to plan', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('link', { name: /browse 87 events/i }).click()
  await expect(page).toHaveURL(/\/events/)

  // Search narrows the list
  await page.getByPlaceholder(/search/i).fill('AI')
  // First visible EventCard after search
  const firstCard = page.locator('article, [data-testid="event-card"]').first()
  await expect(firstCard).toBeVisible()
  await firstCard.click()

  // EventDetailModal opens
  const modal = page.getByRole('dialog')
  await expect(modal).toBeVisible()

  // Click the Add to plan button inside the modal
  await modal.getByRole('button', { name: /add to plan/i }).click()

  // Toast appears
  await expect(page.getByText(/added to your plan/i)).toBeVisible({ timeout: 3000 })

  // Close the modal
  await page.keyboard.press('Escape')
  await expect(modal).not.toBeVisible()

  // MyPlanWidget shows the count
  await expect(page.getByText(/1 event in your plan/i)).toBeVisible()
})
```

(If `EventCard` doesn't expose `role="button"` or a stable selector, add `data-testid="event-card"` in the implementation phase. If the search field placeholder text differs, match the actual placeholder.)

### `e2e/filters.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test('filters drawer: toggle Editor\'s Picks → URL + chip', async ({ page }) => {
  await page.goto('/events')

  await page.getByRole('button', { name: /filters/i }).click()

  const drawer = page.getByRole('dialog').or(page.locator('[data-slot="sheet-content"]'))
  await expect(drawer).toBeVisible()

  await drawer.getByLabel(/editor.s picks only/i).check()

  await expect(page).toHaveURL(/editorsPicks=1/)

  // Active chip with × button labeled accordingly
  await expect(page.getByText(/showing \d+ of \d+ events/i)).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(drawer).not.toBeVisible()

  // Clear the chip
  await page.getByRole('button', { name: /remove editor.s picks filter/i }).click()
  await expect(page).not.toHaveURL(/editorsPicks/)
})
```

### `e2e/keyboard.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test('? opens HelpModal; Esc closes; m toggles map on /events', async ({ page }) => {
  await page.goto('/events')

  // Press '?' (Shift+/)
  await page.keyboard.press('?')
  await expect(page.getByText(/keyboard shortcuts/i)).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.getByText(/keyboard shortcuts/i)).not.toBeVisible()

  // Press 'm' to toggle to map
  await page.keyboard.press('m')
  await expect(page).toHaveURL(/view=map/)

  // Press 'm' again to toggle back
  await page.keyboard.press('m')
  await expect(page).not.toHaveURL(/view=map/)
})
```

### Resilience

- Selectors prefer `getByRole`, `getByLabel`, `getByText` over CSS classes.
- Every wait is an assertion (`toBeVisible`, `toHaveURL`); no `waitForTimeout`.
- Each spec independent. `localStorage.clear()` in `beforeEach` where state matters.

---

## Section 3 — Privacy + Terms pages

### `app/(marketing)/privacy/page.tsx`

```typescript
import type { Metadata } from 'next'
import { VirtusLabFooter } from '@/components/VirtusLabFooter'

export const metadata: Metadata = {
  title: "Privacy — NYTW Engineer's Companion",
  description: 'How NYTW Companion handles your data: plan stored in your browser, no first-party tracking, AI calls go to Anthropic.',
  alternates: { canonical: '/privacy' },
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#0A0A0A] text-[#FAFAFA]">
      <section className="max-w-3xl mx-auto px-6 py-12 space-y-10">
        <h1 className="font-mono text-3xl md:text-4xl font-bold">Privacy</h1>
        <p className="text-[#A3A3A3] text-base leading-relaxed">
          NYTW Companion is built to be unintrusive. Here&apos;s exactly what happens with your data.
        </p>

        <Section title="Plan storage">
          Your plan lives in your browser&apos;s localStorage. We don&apos;t send it anywhere. Clearing site data deletes it.
        </Section>

        <Section title="AI Concierge">
          When you submit a profile to <code>/plan</code>, the text is sent to Anthropic&apos;s API to generate proposals. We don&apos;t store the text on our servers; we don&apos;t log it. Anthropic&apos;s terms apply to their handling — see <a href="https://www.anthropic.com/legal" target="_blank" rel="noopener noreferrer" className="text-[#FF6B35] hover:underline">anthropic.com/legal</a>. Without an Anthropic API key configured the app serves deterministic mock proposals; nothing leaves your browser.
        </Section>

        <Section title="Analytics">
          We use Vercel Analytics for aggregate pageviews and Web Vitals. No per-user IDs, no cross-site tracking, no PII. You can disable it at the browser level with a content blocker.
        </Section>

        <Section title="Map tiles">
          When the map view is open, your browser fetches tiles from Mapbox. Mapbox sees the URL and your IP. See <a href="https://www.mapbox.com/legal" target="_blank" rel="noopener noreferrer" className="text-[#FF6B35] hover:underline">mapbox.com/legal</a>.
        </Section>

        <Section title="Geolocation">
          <code>/now</code> offers a &ldquo;Get travel times&rdquo; button. If you tap it, your browser asks for permission. The position is used only on your device — we don&apos;t transmit it. We cache it for 5 minutes then forget.
        </Section>

        <Section title="Cookies">
          None set by us. Vercel may set deployment-related cookies; Vercel Analytics does not use cookies.
        </Section>

        <Section title="Changes">
          We may update this page. Material changes go in the GitHub history.
        </Section>
      </section>

      <VirtusLabFooter />
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-mono text-xl font-bold">{title}</h2>
      <p className="text-[#A3A3A3] text-base leading-relaxed">{children}</p>
    </section>
  )
}
```

### `app/(marketing)/terms/page.tsx`

```typescript
import type { Metadata } from 'next'
import { VirtusLabFooter } from '@/components/VirtusLabFooter'

export const metadata: Metadata = {
  title: "Terms — NYTW Engineer's Companion",
  description: 'Terms of use for NYTW Companion: independent project by VirtusLab, not affiliated with a16z or Tech Week NYC, no warranty.',
  alternates: { canonical: '/terms' },
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#0A0A0A] text-[#FAFAFA]">
      <section className="max-w-3xl mx-auto px-6 py-12 space-y-10">
        <h1 className="font-mono text-3xl md:text-4xl font-bold">Terms of use</h1>
        <p className="text-[#A3A3A3] text-base leading-relaxed">
          Short version: use at your own risk. We&apos;re not Tech Week.
        </p>

        <Section title="Independence">
          NYTW Engineer&apos;s Companion is an independent project by VirtusLab. Not affiliated with a16z, Tech Week NYC, or any host listed.
        </Section>

        <Section title="Event listings">
          Events shown are publicly listed elsewhere — we link them. Inclusion is not endorsement. Hosts, dates, venues can change without our knowledge; verify on the host&apos;s official page before showing up.
        </Section>

        <Section title="No warranty">
          The site is provided &ldquo;as is&rdquo;. We don&apos;t guarantee accuracy, completeness, or uptime. We may add, remove, or change events at any time.
        </Section>

        <Section title="AI proposals">
          The AI Concierge proposes ideas. They&apos;re suggestions, not advice. We don&apos;t guarantee fit, quality, or availability of suggested events.
        </Section>

        <Section title="Your conduct">
          Don&apos;t abuse the API endpoints. Rate limits apply. If you find a bug or content issue, see <a href="/about" className="text-[#FF6B35] hover:underline">/about</a> for contact.
        </Section>

        <Section title="Liability">
          To the extent permitted by law, VirtusLab has no liability for any loss arising from your use of the site.
        </Section>
      </section>

      <VirtusLabFooter />
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-mono text-xl font-bold">{title}</h2>
      <p className="text-[#A3A3A3] text-base leading-relaxed">{children}</p>
    </section>
  )
}
```

### Wiring

- `components/VirtusLabFooter.tsx` — add Privacy + Terms links to the existing nav group. New shape:
  ```
  About · Beyond · Privacy · Terms
  ```
- `app/sitemap.ts` — add `/privacy` and `/terms` entries. Priority 0.3, changefreq `yearly`.

### Tests

- `__tests__/app/privacy.test.tsx` — assert H1, each section heading, Anthropic + Mapbox + Vercel mentions, VirtusLabFooter visible.
- `__tests__/app/terms.test.tsx` — assert H1, "Not affiliated with a16z" + "use at your own risk" + VirtusLabFooter.
- Update `__tests__/components/VirtusLabFooter.test.tsx` — assert Privacy + Terms links present with correct hrefs.
- Update `__tests__/app/sitemap.test.ts` — expect 9 routes instead of 7.

---

## Section 4 — Social-card meta-tag smoke tests

### `__tests__/app/social-cards.test.ts`

```typescript
import { describe, it, expect } from 'vitest'

const ROUTES_WITH_METADATA = [
  { name: 'landing', mod: '@/app/(marketing)/page' },
  { name: 'about',   mod: '@/app/(marketing)/about/page' },
  { name: 'beyond',  mod: '@/app/(marketing)/beyond/page' },
  { name: 'privacy', mod: '@/app/(marketing)/privacy/page' },
  { name: 'terms',   mod: '@/app/(marketing)/terms/page' },
  { name: 'events',  mod: '@/app/events/page' },
  { name: 'now',     mod: '@/app/now/page' },
  { name: 'my-plan', mod: '@/app/my-plan/page' },
  { name: 'plan',    mod: '@/app/plan/page' },
  { name: 'offline', mod: '@/app/offline/page' },
] as const

describe('social card metadata', () => {
  for (const { name, mod } of ROUTES_WITH_METADATA) {
    it(`${name} exports metadata with title + description`, async () => {
      const page = await import(mod)
      expect(page.metadata).toBeDefined()
      const title = page.metadata.title
      expect(typeof title === 'string' || typeof title === 'object').toBe(true)
      expect(page.metadata.description).toBeTypeOf('string')
      expect(String(page.metadata.description).length).toBeGreaterThan(20)
    })

    if (name !== 'offline' && name !== 'landing') {
      it(`${name} has alternates.canonical`, async () => {
        const page = await import(mod)
        expect(page.metadata.alternates?.canonical).toBeTypeOf('string')
      })
    }
  }

  it('root layout sets metadataBase', async () => {
    const layout = await import('@/app/layout')
    expect(layout.metadata?.metadataBase).toBeInstanceOf(URL)
  })

  it('opengraph-image module exports size 1200×630 and image/png', async () => {
    const og = await import('@/app/opengraph-image')
    expect(og.size).toEqual({ width: 1200, height: 630 })
    expect(og.contentType).toBe('image/png')
  })
})
```

### Wins

Catches: lost `title`/`description`, missing `alternates.canonical`, dropped `metadataBase`, wrong OG dimensions. Doesn't catch: opengraph.xyz / Twitter card validator approval (needs deployed URL — manual checklist).

---

## Section 5 — Manual QA checklist

### File

`docs/superpowers/launch/pre-launch-checklist.md` — content below, committed verbatim.

```markdown
# Pre-launch checklist

Use this immediately before flipping production traffic on. Tick each box
or note what failed. The checklist deliberately covers things automated
tests can't: real devices, real calendars, real social validators, real
keyboards.

## 1. Devices (you on hardware)
- [ ] iPhone Safari (latest): visit /, click Browse, search "AI", open
      modal, add to plan. Plan widget shows count.
- [ ] iPhone Safari: install as PWA from Share menu. Launches to /now in
      standalone. Status bar dark, no browser chrome.
- [ ] Android Chrome: same flow as iPhone Safari.
- [ ] Android Chrome: install prompt appears. After install, opens /now.
- [ ] Desktop Chrome, Firefox, Safari: spot-check /events, /plan, /my-plan
      render without console errors.

## 2. Offline
- [ ] DevTools → Network → Offline. Reload /events: cache hit, page renders.
- [ ] Offline, navigate to a route you haven't visited: /offline appears.
- [ ] Offline, reload /my-plan: page renders from localStorage.
- [ ] Restore network, soft-reload: pages serve fresh.

## 3. Empty state / fallback
- [ ] Visit with localStorage cleared, /my-plan shows empty state.
- [ ] If Supabase env vars are unset, app falls back to seed JSON; verify
      events still appear.
- [ ] If ANTHROPIC_API_KEY unset, /plan returns deterministic mock
      proposals (not a 500).

## 4. Rate limits
- [ ] Submit /plan profile 6 times in quick succession from the same IP.
      6th call returns HTTP 429.

## 5. Load (200+ events)
- [ ] Run `NEXT_PUBLIC_USE_LOAD_FIXTURE=1 npm run dev`. Visit /events:
      sticky day nav scrolls smoothly; no layout jank; filter drawer opens
      in <200ms.
- [ ] Map view with load fixture renders without browser hang.

## 6. iCal flow
- [ ] /my-plan → Download .ics. Open the file in Apple Calendar: events
      import with correct UTC start/end and titles.
- [ ] Same file imports cleanly into Google Calendar (drag-drop or
      "Import" in settings).
- [ ] Same file imports cleanly into Outlook Online.
- [ ] (Subscription via webcal:// URL — deferred; see backlog.)

## 7. Social cards
- [ ] Paste production URL into https://www.opengraph.xyz/ — preview shows
      the brand-colored OG image with correct title.
- [ ] Twitter/X card validator: same.
- [ ] LinkedIn post inspector: same.

## 8. Mobile gestures
- [ ] /events: swipe vertically scrolls. Tap-and-hold on EventCard does
      nothing destructive (no accidental select).
- [ ] /events?view=map: pinch-zoom works; double-tap zooms; map drag is
      smooth.
- [ ] Day-chip horizontal scroll on mobile is touch-friendly.
- [ ] Pull-to-refresh on /now: doesn't break the realtime clock.

## 9. Magic link / recovery
  Deferred — feature does not exist yet. See backlog.

## 10. SEO + accessibility
- [ ] Run `npm run lighthouse <production-url>` (requires Phase 8b deploy
      to be live). Confirm thresholds:
        - Performance ≥ 90 desktop, ≥ 80 mobile
        - Accessibility ≥ 95
        - SEO 100
        - PWA: installable
- [ ] Manual a11y spot: tab through /events with keyboard only. Every
      interactive element focusable, focus ring visible.
- [ ] Screen reader smoke (VoiceOver / NVDA): event card announces title,
      time, host.

## 11. Healthcheck
- [ ] curl https://<production>/api/health — 200 OK, body shape matches
      docs, version matches deployed git SHA.

## 12. Final
- [ ] Privacy / Terms / About / Beyond all reachable from footer.
- [ ] Manifest icons load when DevTools → Application → Manifest opened.
- [ ] Service worker registered + active in DevTools → Application.

---

When every box is checked: announce. When something fails: log the issue,
decide whether it blocks launch.
```

### Acceptance

The file exists at `docs/superpowers/launch/pre-launch-checklist.md` with the content above. No code, no tests. The checklist is a launch-day artifact; running it is the user's job.

---

## Section 6 — Lighthouse + CI

### Dependency

```jsonc
// package.json
"devDependencies": {
  "@lhci/cli": "^0.14.0"
}
```

### `lighthouserc.json`

```json
{
  "ci": {
    "collect": {
      "url": [
        "http://localhost:3000/",
        "http://localhost:3000/events",
        "http://localhost:3000/now",
        "http://localhost:3000/plan",
        "http://localhost:3000/my-plan"
      ],
      "startServerCommand": "npm run start",
      "startServerReadyPattern": "Ready in",
      "numberOfRuns": 1
    },
    "assert": {
      "preset": "lighthouse:no-pwa",
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.8 }],
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "categories:best-practices": ["warn", { "minScore": 0.9 }],
        "categories:seo": ["error", { "minScore": 1.0 }],
        "installable-manifest": "warn"
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

### `package.json` script

```jsonc
"lighthouse": "lhci autorun"
```

### `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint-and-test:
    name: Lint + unit tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm test

  e2e:
    name: E2E (Playwright)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - name: Cache Playwright browsers
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-${{ hashFiles('package-lock.json') }}
      - run: npx playwright install --with-deps chromium
      - run: npm run build
      - run: npm run e2e
      - name: Upload Playwright report on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7

  lighthouse:
    name: Lighthouse audit
    runs-on: ubuntu-latest
    needs: e2e
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run build
      - run: npm run lighthouse
        env:
          LHCI_BUILD_CONTEXT__CURRENT_HASH: ${{ github.sha }}
```

### Rationale

- `lint-and-test` and `e2e` run in parallel (independent).
- `lighthouse` depends on `e2e` — no point running Lighthouse if E2E broke.
- Playwright browser cache keyed on lock file hash; rebuild only when deps change.
- No matrix builds, no security scans, no preview-URL hooks in this commit (out of scope; user opens those when needed via GitHub Settings → Branches and Vercel webhook).

---

## Section 7 — Load fixture + deferred backlog

### 7.1 Load fixture

**Files:**
- `scripts/generate-load-fixture.mjs` — Node script.
- `data/seed-events-load.json` — generated, committed (~250 events).
- `lib/seed-source.ts` — shared helper that returns the active seed.
- `package.json` script: `"fixture:load": "node scripts/generate-load-fixture.mjs"`.

**Generator** (deterministic via fixed PRNG seed):

```javascript
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const SRC = resolve(ROOT, 'data/seed-events.json')
const OUT = resolve(ROOT, 'data/seed-events-load.json')

const TARGET_COUNT = 250
const SEED = 20260525

function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6D2B79F5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

async function main() {
  const seed = JSON.parse(await readFile(SRC, 'utf8'))
  const r = rng(SEED)
  const out = []
  for (let i = 0; i < TARGET_COUNT; i++) {
    const src = seed[i % seed.length]
    const day = 1 + Math.floor(r() * 7)
    const hour = 8 + Math.floor(r() * 13)
    const start = new Date(Date.UTC(2026, 5, day, hour, 0, 0))
    const end = new Date(start.getTime() + (1 + Math.floor(r() * 3)) * 3600_000)
    out.push({
      ...src,
      id: `load-${i.toString().padStart(4, '0')}`,
      title: `${src.title} [load #${i + 1}]`,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
    })
  }
  await writeFile(OUT, JSON.stringify(out, null, 2))
  console.log(`wrote ${out.length} events to ${OUT}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
```

**Shared helper** `lib/seed-source.ts`:

```typescript
import baseSeed from '@/data/seed-events.json' with { type: 'json' }
import loadSeed from '@/data/seed-events-load.json' with { type: 'json' }
import type { Event } from '@/lib/types'

export function selectSeed(): Event[] {
  if (process.env.NEXT_PUBLIC_USE_LOAD_FIXTURE === '1') {
    return loadSeed as Event[]
  }
  return baseSeed as Event[]
}
```

**Consumer wiring:** in `app/events/page.tsx`, `app/now/page.tsx`, `app/my-plan/page.tsx`, `app/plan/page.tsx` — each currently imports `data/seed-events.json` directly inside a `fetchEvents`-style helper. Replace those direct imports with `selectSeed()`. Minor mechanical refactor.

**Tests:** none for the fixture. `__tests__/lib/seed-source.test.ts` covers `selectSeed()`:
- With env unset → returns base seed (length 87).
- With env `=1` → returns load seed (length 250).
- With env `=0` → returns base seed.

### 7.2 Deferred-backlog doc

**File:** `docs/superpowers/launch/deferred-backlog.md` — content below, committed verbatim.

```markdown
# Deferred from Phase 9 — pre-launch QA

These SPEC Phase 9 items aren't shippable in the current architecture.
Documented here so they don't get lost.

## 1. Magic-link email recovery + SPF/DKIM deliverability

**Why deferred:** the magic-link feature itself was never implemented.
SPEC's earlier phases proposed Supabase Auth magic links for plan recovery
across devices, but it was cut to keep MVP lean. Plan storage is currently
local-only.

**When to pick up:**
- Cross-device plan sync becomes a real ask from users.
- We're already wiring a production Supabase (Phase 8b).

**Acceptance:**
- POST /api/recovery sends a magic link via Supabase Auth.
- Email arrives with valid SPF + DKIM (check via mail-tester.com).
- Clicking link signs the user in and merges localStorage plan into DB.

## 2. iCal subscribe via webcal:// URL

**Why deferred:** only the download flow exists today. Subscribe requires
a hosted endpoint that returns the user's current plan as ICS — needs
user identity, which needs magic-link (above).

**When to pick up:** after magic-link ships.

**Acceptance:**
- GET /api/ical/[token] returns the plan as text/calendar.
- webcal:// URL imports cleanly in Apple Calendar, Google Calendar,
  Outlook Online; subsequent plan edits propagate within the
  calendar's refresh window.

## 3. Lighthouse against production URL (score gates)

**Why deferred:** real numbers need a deployed URL. Local `npm run start`
under-represents Vercel's edge optimizations.

**When to pick up:** Phase 8b — immediately after first production deploy.

**Acceptance:**
- `npm run lighthouse -- --collect.url=<production-url>` passes the
  thresholds in `lighthouserc.json` (perf 0.8, a11y 0.95, SEO 1.0).
- Add the result link to the launch checklist.

## 4. Real-device manual QA

**Why deferred:** can't automate; needs human + hardware. Checklist lives
at `docs/superpowers/launch/pre-launch-checklist.md`.

**When to pick up:** before flipping production traffic on.
```

---

## Architecture overview

```
e2e/                                NEW
├── browse-and-add.spec.ts
├── filters.spec.ts
└── keyboard.spec.ts

playwright.config.ts                NEW
lighthouserc.json                   NEW

.github/workflows/ci.yml            NEW

app/(marketing)/
├── privacy/page.tsx                NEW
└── terms/page.tsx                  NEW

app/sitemap.ts                      MODIFIED (+ /privacy, /terms entries)

components/
└── VirtusLabFooter.tsx             MODIFIED (+ Privacy, Terms links)

lib/
└── seed-source.ts                  NEW

data/
└── seed-events-load.json           NEW (generated, committed)

scripts/
└── generate-load-fixture.mjs       NEW

docs/superpowers/launch/            NEW DIR
├── pre-launch-checklist.md         NEW
└── deferred-backlog.md             NEW

__tests__/app/
├── social-cards.test.ts            NEW
├── privacy.test.tsx                NEW
├── terms.test.tsx                  NEW
└── sitemap.test.ts                 MODIFIED (expect 9 routes)

__tests__/components/
└── VirtusLabFooter.test.tsx        MODIFIED (assert Privacy + Terms)

__tests__/lib/
└── seed-source.test.ts             NEW

app/events/page.tsx                 MODIFIED (use selectSeed)
app/now/page.tsx                    MODIFIED (use selectSeed)
app/my-plan/page.tsx                MODIFIED (use selectSeed)
app/plan/page.tsx                   MODIFIED (use selectSeed)

package.json                        + @playwright/test, @lhci/cli (devDeps)
                                    + scripts: e2e, e2e:ui, e2e:install, lighthouse, fixture:load

.gitignore                          + test-results/, playwright-report/, playwright/.cache/

README.md                           MODIFIED (+ E2E section, + Lighthouse section)
```

## Risks & mitigations

- **Risk:** E2E selectors brittle if implementation changes (e.g., `getByPlaceholder(/search/i)` depends on the placeholder text). **Mitigation:** prefer `getByRole` over text where possible; if a test starts flaking, add a `data-testid` to the implementation rather than weakening the test.
- **Risk:** Playwright spec finds the modal but the seed event being clicked changes between runs. **Mitigation:** searching for "AI" filters down to a stable subset; pick the first card. If the seed shifts in a way that breaks this, update the spec — that's the right cost.
- **Risk:** `npm run build` is slow; CI lighthouse runs it twice (once in e2e, once in lighthouse job). **Mitigation:** acceptable for now; can share a build artifact between jobs in a future CI refactor.
- **Risk:** `installable-manifest` Lighthouse rule flickers because lhci runs against HTTP localhost (no HTTPS, no PWA install). **Mitigation:** rule set to `warn`, not `error`. Real check is manual on production.
- **Risk:** Lhci uploads reports to `temporary-public-storage` — anonymized but technically public for 7 days. **Mitigation:** accepted; the reports contain no secrets. User can switch to `filesystem` storage later.
- **Risk:** `selectSeed()` is read at module load — switching the env var requires a restart, not a hot reload. **Mitigation:** documented in the load fixture's README block; not a runtime concern.

## Acceptance criteria

- [ ] Playwright installed; `e2e/` directory contains three spec files; `npm run e2e` runs them headlessly and reports pass/fail.
- [ ] `playwright.config.ts` exists with `webServer` block that starts `npm run start`.
- [ ] `/privacy` and `/terms` routes render; both linked from VirtusLabFooter; both appear in sitemap; both have `alternates.canonical` and full metadata.
- [ ] `__tests__/app/social-cards.test.ts` asserts metadata shape on all 10 public routes.
- [ ] `docs/superpowers/launch/pre-launch-checklist.md` exists with all 12 sections.
- [ ] `lighthouserc.json` + `@lhci/cli` devDep + `npm run lighthouse` script all in place.
- [ ] `.github/workflows/ci.yml` exists; runs lint+test, e2e, lighthouse on push/PR to main.
- [ ] `scripts/generate-load-fixture.mjs` produces `data/seed-events-load.json` deterministically; `lib/seed-source.ts` swaps based on `NEXT_PUBLIC_USE_LOAD_FIXTURE`.
- [ ] `docs/superpowers/launch/deferred-backlog.md` exists naming magic-link, iCal subscribe, Lighthouse-against-prod, real-device QA as follow-ups.
- [ ] `npm test` green; `npm run lint` clean; `npm run build` succeeds; `npm run e2e` green; `npm run lighthouse` runs to completion locally.
- [ ] No regression in any prior phase's tests.

## Out-of-scope reminders (in `docs/superpowers/launch/deferred-backlog.md`)

- Magic-link email + SPF/DKIM.
- iCal subscribe via `webcal://` URL.
- Lighthouse score gates against production URL.
- Real-device manual QA execution.
- Multi-browser E2E (Firefox/Webkit).
- Branch protection rules in GitHub Settings.
- Vercel preview-URL CI integration.
