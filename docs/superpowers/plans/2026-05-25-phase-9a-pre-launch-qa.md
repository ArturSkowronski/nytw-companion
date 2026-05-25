# Phase 9a — Pre-launch QA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the code-side pre-launch QA gates — Playwright E2E for three critical journeys, Privacy + Terms pages, social-card metadata smoke tests, Lighthouse config, GitHub Actions CI, a 250-event load fixture (opt-in), and the manual QA + deferred-backlog markdown docs.

**Architecture:** Module-per-surface, same as Phases 7 and 8a. Each task ships independently. Tasks 1–2 add Playwright. Task 3 ships Privacy + Terms (entangled with footer + sitemap). Task 4 locks down social-card metadata. Task 5 ships the markdown docs. Task 6 ships Lighthouse + CI. Task 7 ships the load fixture pipeline. Task 8 is acceptance.

**Tech Stack:** `@playwright/test` (E2E), `@lhci/cli` (Lighthouse), GitHub Actions, Next.js 16 + React 19 + TS strict, existing Vitest setup.

**Reference design:** `docs/superpowers/specs/2026-05-25-phase-9a-pre-launch-qa-design.md`

---

## Conventions

- All new page components are server components (no `'use client'`) unless they need state/effects.
- Brand colors: bg `#0A0A0A`, surface `#111111`, border `#1A1A1A` / `#2A2A2A`, fg `#FAFAFA`, muted `#A3A3A3`, dim `#555555`/`#666666`, accent `#FF6B35`.
- Playwright specs use `getByRole` / `getByLabel` / `getByText` over CSS classes for resilience.
- One commit per task unless explicitly split.

---

## Pre-flight: codebase reality

Verified during plan-writing — implementer does not need to re-verify:

- No Playwright installed anywhere.
- Existing `__tests__/app/sitemap.test.ts` asserts `urls.length === 7` — Task 3 updates this to 9.
- `app/{events,now,my-plan,plan}/page.tsx` each import `seed-events.json` directly and have a private `fetchEvents()` function with a Supabase fallback. Task 7 refactors these to call `selectSeed()`.
- `EventSearch.tsx` placeholder text matches the regex `/search/i` (placeholder is `'Search events… (press "/" to focus)'`).
- `VirtusLabFooter.tsx` already has a `<nav>` block with About + Beyond links — Task 3 appends Privacy + Terms.
- Phase 8a left 248 tests passing; Phase 9a should add roughly 15+ more from new tests.

---

## Task 1: Playwright setup

**Files:**
- Modify: `package.json` (deps + scripts)
- Create: `playwright.config.ts`
- Create: `e2e/.gitkeep`
- Modify: `.gitignore`

No test code in this task; verification gate is `npm install` + that Playwright config loads.

- [ ] **Step 1: Add `@playwright/test` to devDependencies**

Edit `/Users/askowronski/Projects/nytw-companion/package.json`. In `devDependencies` (alphabetical), add:
```jsonc
"@playwright/test": "^1.49.0",
```

- [ ] **Step 2: Add Playwright scripts**

In the `scripts` block of `package.json`, add:
```jsonc
"e2e": "playwright test",
"e2e:ui": "playwright test --ui",
"e2e:install": "playwright install --with-deps chromium",
```

- [ ] **Step 3: Install**

```bash
cd /Users/askowronski/Projects/nytw-companion && npm install
```

If `@playwright/test@^1.49.0` doesn't resolve, fall back to `npm install --save-dev @playwright/test@latest` and update the pin in `package.json` to match the installed major.

- [ ] **Step 4: Install the Chromium browser**

```bash
cd /Users/askowronski/Projects/nytw-companion && npx playwright install chromium
```

(No `--with-deps` locally; that's a Linux/CI-only thing. Subagents on macOS skip the system deps install.)

- [ ] **Step 5: Create `playwright.config.ts` at repo root**

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

- [ ] **Step 6: Create `e2e/` directory with a placeholder**

```bash
cd /Users/askowronski/Projects/nytw-companion && mkdir -p e2e && touch e2e/.gitkeep
```

- [ ] **Step 7: Update `.gitignore`**

Append to `/Users/askowronski/Projects/nytw-companion/.gitignore` (with a blank-line separator if needed):

```
# Playwright
test-results/
playwright-report/
playwright/.cache/
```

- [ ] **Step 8: Verify the config loads**

```bash
cd /Users/askowronski/Projects/nytw-companion && npx playwright test --list 2>&1 | tail -10
```

Expected output: `Total: 0 tests in 0 files` (or similar — empty test set is fine; no errors).

- [ ] **Step 9: Run the existing Vitest suite — verify Playwright didn't break it**

```bash
cd /Users/askowronski/Projects/nytw-companion && npm test 2>&1 | tail -10
```

Expected: all 248 tests still pass. (Playwright tests live in `e2e/` which Vitest doesn't pick up by default.)

If Vitest tries to pick up Playwright specs in `e2e/`, narrow Vitest's include glob to `__tests__/**/*.test.{ts,tsx}` by editing `vitest.config.ts` (if it exists) or `package.json` `"vitest"` block. Don't proceed until vitest ignores `e2e/`.

- [ ] **Step 10: Commit**

```bash
cd /Users/askowronski/Projects/nytw-companion && git add package.json package-lock.json playwright.config.ts e2e/.gitkeep .gitignore && git commit -m "chore(e2e): install Playwright + config + scripts"
```

---

## Task 2: Three E2E specs (browse-and-add, filters, keyboard)

**Files:**
- Create: `e2e/browse-and-add.spec.ts`
- Create: `e2e/filters.spec.ts`
- Create: `e2e/keyboard.spec.ts`

This task creates three independent E2E specs. Each runs against `npm run start` via the webServer block from Task 1. The implementer needs a built app present (Step 1 below ensures it).

- [ ] **Step 1: Build the app**

```bash
cd /Users/askowronski/Projects/nytw-companion && npm run build
```

Expected: clean build (Phase 8a + Phase 7 routes all present). This is required because Playwright will start `npm run start`, which needs `.next/` to exist.

- [ ] **Step 2: Create `e2e/browse-and-add.spec.ts`**

```typescript
import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  // Start with an empty plan so the MyPlanWidget count assertion is stable.
  await page.addInitScript(() => {
    window.localStorage.clear()
  })
})

test('landing → browse → search → modal → add to plan', async ({ page }) => {
  await page.goto('/')

  // Click the primary Browse CTA on the landing hero.
  await page.getByRole('link', { name: /browse 87 events/i }).click()
  await expect(page).toHaveURL(/\/events/)

  // Narrow the list with a search term known to match Editor's Picks seed events.
  await page.getByPlaceholder(/search/i).fill('AI')

  // Click the first visible event card.
  const firstCard = page.getByTestId('event-card').first()
  await expect(firstCard).toBeVisible({ timeout: 5000 })
  await firstCard.click()

  // EventDetailModal opens.
  const modal = page.getByRole('dialog')
  await expect(modal).toBeVisible()

  // Add to plan from inside the modal.
  await modal.getByRole('button', { name: /add to plan/i }).click()

  // Toast confirms.
  await expect(page.getByText(/added to your plan/i).first()).toBeVisible({ timeout: 3000 })

  // Close the modal.
  await page.keyboard.press('Escape')
  await expect(modal).not.toBeVisible()

  // MyPlanWidget shows the count somewhere on the page.
  await expect(page.getByText(/1 event/i).first()).toBeVisible()
})
```

The test references `getByTestId('event-card')`. The current `EventCard.tsx` does not expose that test-id. Add it in Step 3.

- [ ] **Step 3: Add `data-testid="event-card"` to `components/EventCard.tsx`**

Read `/Users/askowronski/Projects/nytw-companion/components/EventCard.tsx`. Find the outermost wrapper element (it's an `<article>` or a `<div>` — the one whose className starts with rounded/border for the card). Add `data-testid="event-card"` to its attributes.

Example: if the file has
```tsx
    <article className="group cursor-pointer ..." ...>
```
change to
```tsx
    <article data-testid="event-card" className="group cursor-pointer ..." ...>
```

If the wrapper is a different element (e.g., a `<div>` with `role="button"`), put the data-testid on whatever the outermost interactive element is.

Run the existing vitest tests for `EventCard` to confirm no regression:
```bash
cd /Users/askowronski/Projects/nytw-companion && npx vitest run __tests__/components/EventCard.test.tsx
```
Expected: all existing EventCard tests pass.

- [ ] **Step 4: Create `e2e/filters.spec.ts`**

```typescript
import { test, expect } from '@playwright/test'

test('filters drawer: toggle Editor\'s Picks → URL + chip + counter', async ({ page }) => {
  await page.goto('/events')

  await page.getByRole('button', { name: /filters/i }).click()

  // Drawer opens (a Sheet — query by its accessible role / title).
  await expect(page.getByRole('dialog', { name: /filters/i }).or(page.getByText('Quick toggles'))).toBeVisible()

  await page.getByLabel(/editor.s picks only/i).check()

  await expect(page).toHaveURL(/editorsPicks=1/)
  await expect(page.getByText(/showing \d+ of \d+ events/i)).toBeVisible()

  // Close drawer
  await page.keyboard.press('Escape')

  // Active-chip remove button — uses the aria-label from ActiveFiltersBar.
  await page.getByRole('button', { name: /remove editor.s picks filter/i }).click()
  await expect(page).not.toHaveURL(/editorsPicks/)
})
```

- [ ] **Step 5: Create `e2e/keyboard.spec.ts`**

```typescript
import { test, expect } from '@playwright/test'

test('? opens HelpModal; Esc closes; m toggles map on /events', async ({ page }) => {
  await page.goto('/events')

  // Wait for hydration so the keydown listeners are mounted.
  await page.waitForLoadState('networkidle')

  await page.keyboard.press('?')
  await expect(page.getByText(/keyboard shortcuts/i)).toBeVisible({ timeout: 3000 })

  await page.keyboard.press('Escape')
  await expect(page.getByText(/keyboard shortcuts/i)).not.toBeVisible()

  await page.keyboard.press('m')
  await expect(page).toHaveURL(/view=map/)

  await page.keyboard.press('m')
  await expect(page).not.toHaveURL(/view=map/)
})
```

- [ ] **Step 6: Run all E2E specs**

```bash
cd /Users/askowronski/Projects/nytw-companion && npm run e2e 2>&1 | tail -30
```

Expected: 3 passing tests. The Playwright webServer block will start `npm run start` automatically.

If a test flakes:
- For `browse-and-add`: the "AI" search may not match an event if the seed shifts. Verify by visiting `/events` manually and searching "AI"; you should see at least one card. Adjust the search term to a seed-stable substring (e.g., a host name like "VirtusLab") if needed.
- For `filters`: the drawer accessible role might be `dialog` or might not. If the test fails to find the drawer, inspect via `npm run e2e:ui` (Playwright's UI mode) and adjust the selector.
- For `keyboard`: the `?` key may not register if the document isn't focused. The `waitForLoadState('networkidle')` should help; if not, click on `body` first to focus.

- [ ] **Step 7: Commit**

```bash
cd /Users/askowronski/Projects/nytw-companion && git add e2e/browse-and-add.spec.ts e2e/filters.spec.ts e2e/keyboard.spec.ts components/EventCard.tsx && git commit -m "test(e2e): add Playwright specs for browse+add, filters drawer, keyboard shortcuts"
```

(The Vitest test for EventCard still passes because the `data-testid` is an additive attribute; it doesn't affect any existing assertion.)

---

## Task 3: Privacy + Terms pages (+ footer wiring + sitemap update)

**Files:**
- Create: `app/(marketing)/privacy/page.tsx`
- Create: `app/(marketing)/terms/page.tsx`
- Create: `__tests__/app/privacy.test.tsx`
- Create: `__tests__/app/terms.test.tsx`
- Modify: `components/VirtusLabFooter.tsx`
- Modify: `__tests__/components/VirtusLabFooter.test.tsx`
- Modify: `app/sitemap.ts`
- Modify: `__tests__/app/sitemap.test.ts`

- [ ] **Step 1: Write failing tests for Privacy and Terms**

Create `__tests__/app/privacy.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PrivacyPage from '../../app/(marketing)/privacy/page'

describe('/privacy', () => {
  it('renders the H1 and lede', () => {
    render(<PrivacyPage />)
    expect(screen.getByRole('heading', { level: 1, name: /^privacy$/i })).toBeInTheDocument()
    expect(screen.getByText(/built to be unintrusive/i)).toBeInTheDocument()
  })

  it('renders all section headings', () => {
    render(<PrivacyPage />)
    expect(screen.getByRole('heading', { level: 2, name: /plan storage/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /ai concierge/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /analytics/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /map tiles/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /geolocation/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /cookies/i })).toBeInTheDocument()
  })

  it('mentions Anthropic, Mapbox, Vercel', () => {
    render(<PrivacyPage />)
    expect(screen.getByText(/anthropic/i)).toBeInTheDocument()
    expect(screen.getByText(/mapbox/i)).toBeInTheDocument()
    expect(screen.getByText(/vercel/i)).toBeInTheDocument()
  })

  it('renders the VirtusLabFooter (not-affiliated text)', () => {
    render(<PrivacyPage />)
    expect(screen.getByText(/not affiliated with a16z or tech week nyc/i)).toBeInTheDocument()
  })
})
```

Create `__tests__/app/terms.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import TermsPage from '../../app/(marketing)/terms/page'

describe('/terms', () => {
  it('renders the H1 and lede', () => {
    render(<TermsPage />)
    expect(screen.getByRole('heading', { level: 1, name: /terms of use/i })).toBeInTheDocument()
    expect(screen.getByText(/use at your own risk/i)).toBeInTheDocument()
  })

  it('renders all section headings', () => {
    render(<TermsPage />)
    expect(screen.getByRole('heading', { level: 2, name: /independence/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /event listings/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /no warranty/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /ai proposals/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /liability/i })).toBeInTheDocument()
  })

  it('says not affiliated with a16z', () => {
    render(<TermsPage />)
    expect(screen.getByText(/not affiliated with a16z, tech week nyc/i)).toBeInTheDocument()
  })

  it('renders the VirtusLabFooter', () => {
    render(<TermsPage />)
    expect(screen.getByText(/not affiliated with a16z or tech week nyc/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests — expect fail**

```bash
cd /Users/askowronski/Projects/nytw-companion && npx vitest run __tests__/app/privacy.test.tsx __tests__/app/terms.test.tsx
```

Expected: both fail — modules don't exist.

- [ ] **Step 3: Create `app/(marketing)/privacy/page.tsx`**

```typescript
import type { Metadata } from 'next'
import { VirtusLabFooter } from '@/components/VirtusLabFooter'

export const metadata: Metadata = {
  title: "Privacy — NYTW Engineer's Companion",
  description:
    'How NYTW Companion handles your data: plan stored in your browser, no first-party tracking, AI calls go to Anthropic.',
  alternates: { canonical: '/privacy' },
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-mono text-xl font-bold">{title}</h2>
      <p className="text-[#A3A3A3] text-base leading-relaxed">{children}</p>
    </section>
  )
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
          When you submit a profile to <code>/plan</code>, the text is sent to Anthropic&apos;s API to generate proposals. We don&apos;t store the text on our servers; we don&apos;t log it. Anthropic&apos;s terms apply to their handling — see{' '}
          <a href="https://www.anthropic.com/legal" target="_blank" rel="noopener noreferrer" className="text-[#FF6B35] hover:underline">
            anthropic.com/legal
          </a>
          . Without an Anthropic API key configured the app serves deterministic mock proposals; nothing leaves your browser.
        </Section>

        <Section title="Analytics">
          We use Vercel Analytics for aggregate pageviews and Web Vitals. No per-user IDs, no cross-site tracking, no PII. You can disable it at the browser level with a content blocker.
        </Section>

        <Section title="Map tiles">
          When the map view is open, your browser fetches tiles from Mapbox. Mapbox sees the URL and your IP. See{' '}
          <a href="https://www.mapbox.com/legal" target="_blank" rel="noopener noreferrer" className="text-[#FF6B35] hover:underline">
            mapbox.com/legal
          </a>
          .
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
```

- [ ] **Step 4: Create `app/(marketing)/terms/page.tsx`**

```typescript
import type { Metadata } from 'next'
import { VirtusLabFooter } from '@/components/VirtusLabFooter'

export const metadata: Metadata = {
  title: "Terms — NYTW Engineer's Companion",
  description:
    'Terms of use for NYTW Companion: independent project by VirtusLab, not affiliated with a16z or Tech Week NYC, no warranty.',
  alternates: { canonical: '/terms' },
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-mono text-xl font-bold">{title}</h2>
      <p className="text-[#A3A3A3] text-base leading-relaxed">{children}</p>
    </section>
  )
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
          Don&apos;t abuse the API endpoints. Rate limits apply. If you find a bug or content issue, see{' '}
          <a href="/about" className="text-[#FF6B35] hover:underline">/about</a> for contact.
        </Section>

        <Section title="Liability">
          To the extent permitted by law, VirtusLab has no liability for any loss arising from your use of the site.
        </Section>
      </section>

      <VirtusLabFooter />
    </main>
  )
}
```

- [ ] **Step 5: Run privacy + terms tests — expect pass**

```bash
cd /Users/askowronski/Projects/nytw-companion && npx vitest run __tests__/app/privacy.test.tsx __tests__/app/terms.test.tsx
```

Expected: PASS — 4 tests each, 8 total.

- [ ] **Step 6: Update `components/VirtusLabFooter.tsx`**

Read the file. Find the `<nav>` block:
```tsx
        <nav className="flex gap-4 text-[#555555] text-xs font-mono">
          <Link href="/about" className="hover:text-[#A3A3A3]">
            About
          </Link>
          <Link href="/beyond" className="hover:text-[#A3A3A3]">
            Beyond
          </Link>
        </nav>
```

Replace with:
```tsx
        <nav className="flex gap-4 text-[#555555] text-xs font-mono">
          <Link href="/about" className="hover:text-[#A3A3A3]">
            About
          </Link>
          <Link href="/beyond" className="hover:text-[#A3A3A3]">
            Beyond
          </Link>
          <Link href="/privacy" className="hover:text-[#A3A3A3]">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-[#A3A3A3]">
            Terms
          </Link>
        </nav>
```

- [ ] **Step 7: Update `__tests__/components/VirtusLabFooter.test.tsx`**

Find the existing "renders About and Beyond internal links" test and extend it to cover Privacy + Terms. Replace the entire test with:

```typescript
  it('renders About, Beyond, Privacy, Terms internal links', () => {
    render(<VirtusLabFooter />)
    expect(screen.getByRole('link', { name: /^about$/i })).toHaveAttribute('href', '/about')
    expect(screen.getByRole('link', { name: /^beyond$/i })).toHaveAttribute('href', '/beyond')
    expect(screen.getByRole('link', { name: /^privacy$/i })).toHaveAttribute('href', '/privacy')
    expect(screen.getByRole('link', { name: /^terms$/i })).toHaveAttribute('href', '/terms')
  })
```

- [ ] **Step 8: Update `app/sitemap.ts`**

Read the existing file. It currently lists 7 routes. Add two new entries inside the returned array — place them alphabetically (so after `/plan` and before — well, just add at the end before the closing `]`):

```typescript
    route('/privacy', 0.3, 'yearly'),
    route('/terms', 0.3, 'yearly'),
```

So the final list inside `sitemap()` looks like:

```typescript
  return [
    route('/', 1.0, 'weekly'),
    route('/events', 1.0, 'daily'),
    route('/now', 0.8, 'daily'),
    route('/my-plan', 0.7, 'weekly'),
    route('/plan', 0.7, 'weekly'),
    route('/beyond', 0.7, 'monthly'),
    route('/about', 0.6, 'monthly'),
    route('/privacy', 0.3, 'yearly'),
    route('/terms', 0.3, 'yearly'),
  ]
```

- [ ] **Step 9: Update `__tests__/app/sitemap.test.ts`**

Find:
```typescript
  it('lists the seven public routes', () => {
    const entries = sitemap()
    const urls = entries.map((e) => new URL(e.url).pathname)
    expect(urls).toEqual(
      expect.arrayContaining(['/', '/events', '/now', '/my-plan', '/plan', '/beyond', '/about'])
    )
    expect(urls.length).toBe(7)
  })
```

Replace with:
```typescript
  it('lists the nine public routes', () => {
    const entries = sitemap()
    const urls = entries.map((e) => new URL(e.url).pathname)
    expect(urls).toEqual(
      expect.arrayContaining(['/', '/events', '/now', '/my-plan', '/plan', '/beyond', '/about', '/privacy', '/terms'])
    )
    expect(urls.length).toBe(9)
  })
```

- [ ] **Step 10: Run all related tests**

```bash
cd /Users/askowronski/Projects/nytw-companion && npx vitest run __tests__/app/privacy.test.tsx __tests__/app/terms.test.tsx __tests__/components/VirtusLabFooter.test.tsx __tests__/app/sitemap.test.ts
```

Expected: all pass (4 + 4 + 3 + 3 = 14 tests).

- [ ] **Step 11: Run the full test suite — no regressions elsewhere**

```bash
cd /Users/askowronski/Projects/nytw-companion && npm test 2>&1 | tail -10
```

Expected: all tests pass (~262: 248 baseline + 4 privacy + 4 terms + the existing footer test now updated counts as 3 not 3, so net +8 tests).

- [ ] **Step 12: Commit**

```bash
cd /Users/askowronski/Projects/nytw-companion && git add 'app/(marketing)/privacy/page.tsx' 'app/(marketing)/terms/page.tsx' __tests__/app/privacy.test.tsx __tests__/app/terms.test.tsx components/VirtusLabFooter.tsx __tests__/components/VirtusLabFooter.test.tsx app/sitemap.ts __tests__/app/sitemap.test.ts && git commit -m "feat(legal): add /privacy + /terms pages; link from footer; add to sitemap"
```

---

## Task 4: Social-card metadata smoke test

**Files:**
- Create: `__tests__/app/social-cards.test.ts`

- [ ] **Step 1: Write the test**

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

- [ ] **Step 2: Run the test — expect pass**

```bash
cd /Users/askowronski/Projects/nytw-companion && npx vitest run __tests__/app/social-cards.test.ts
```

Expected: 20 passing assertions (10 routes × `title+description` + 8 routes × `alternates.canonical` + 1 metadataBase + 1 og-size = 20).

If any route fails the `alternates.canonical` check, that means Phase 7's per-route metadata work missed that page — go fix the metadata on that page rather than weakening the test.

- [ ] **Step 3: Commit**

```bash
cd /Users/askowronski/Projects/nytw-companion && git add __tests__/app/social-cards.test.ts && git commit -m "test(seo): assert metadata shape on all 10 public routes (title/description/canonical/OG size)"
```

---

## Task 5: Manual QA checklist + deferred backlog docs

**Files:**
- Create: `docs/superpowers/launch/pre-launch-checklist.md`
- Create: `docs/superpowers/launch/deferred-backlog.md`

No code; no tests. Verification: both files exist with the exact content below.

- [ ] **Step 1: Create the directory**

```bash
cd /Users/askowronski/Projects/nytw-companion && mkdir -p docs/superpowers/launch
```

- [ ] **Step 2: Create `docs/superpowers/launch/pre-launch-checklist.md`**

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

- [ ] **Step 3: Create `docs/superpowers/launch/deferred-backlog.md`**

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

- [ ] **Step 4: Verify both files exist**

```bash
cd /Users/askowronski/Projects/nytw-companion && ls -la docs/superpowers/launch/
```

Expected: both files present.

- [ ] **Step 5: Commit**

```bash
cd /Users/askowronski/Projects/nytw-companion && git add docs/superpowers/launch/pre-launch-checklist.md docs/superpowers/launch/deferred-backlog.md && git commit -m "docs(launch): add pre-launch manual QA checklist + deferred backlog"
```

---

## Task 6: Lighthouse config + GitHub Actions CI

**Files:**
- Modify: `package.json` (add `@lhci/cli` devDep + `lighthouse` script)
- Create: `lighthouserc.json`
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Add `@lhci/cli` to devDependencies**

In `/Users/askowronski/Projects/nytw-companion/package.json` `devDependencies`, add (alphabetical, near the top under `@playwright/test`):
```jsonc
"@lhci/cli": "^0.14.0",
```

- [ ] **Step 2: Add the `lighthouse` script**

In `scripts`:
```jsonc
"lighthouse": "lhci autorun",
```

- [ ] **Step 3: Install**

```bash
cd /Users/askowronski/Projects/nytw-companion && npm install
```

If `@lhci/cli@^0.14.0` doesn't resolve, fall back to `@latest` and update the pin.

- [ ] **Step 4: Create `lighthouserc.json` at repo root**

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

- [ ] **Step 5: Create `.github/workflows/ci.yml`**

Create the directory if needed:
```bash
cd /Users/askowronski/Projects/nytw-companion && mkdir -p .github/workflows
```

Then create the file with this exact content:

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

- [ ] **Step 6: Local smoke — run Lighthouse**

```bash
cd /Users/askowronski/Projects/nytw-companion && npm run build && npm run lighthouse 2>&1 | tail -30
```

Expected: lhci spawns `npm run start`, audits 5 URLs, prints scores, and either passes assertions or reports which ones failed.

If a category fails the threshold locally (e.g., perf < 0.8 on a slow dev machine), that's expected — local runs are noisier than CI/prod. Don't relax the thresholds; document in the PR description if needed.

If lhci can't spawn the server (port conflict or already-running), kill any other Next process on 3000 and retry.

- [ ] **Step 7: Commit**

```bash
cd /Users/askowronski/Projects/nytw-companion && git add package.json package-lock.json lighthouserc.json .github/workflows/ci.yml && git commit -m "ci: add Lighthouse config + GitHub Actions workflow (lint/test/e2e/lighthouse)"
```

---

## Task 7: Load fixture + selectSeed helper + 4-consumer refactor

**Files:**
- Create: `scripts/generate-load-fixture.mjs`
- Modify: `package.json` (add `fixture:load` script)
- Generated + committed: `data/seed-events-load.json`
- Create: `lib/seed-source.ts`
- Create: `__tests__/lib/seed-source.test.ts`
- Modify: `app/events/page.tsx`
- Modify: `app/now/page.tsx`
- Modify: `app/my-plan/page.tsx`
- Modify: `app/plan/page.tsx`

- [ ] **Step 1: Create `scripts/generate-load-fixture.mjs`**

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

// Mulberry32 deterministic PRNG
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
    // Festival days Mon Jun 1 → Sun Jun 7, 2026
    const day = 1 + Math.floor(r() * 7)
    const hour = 8 + Math.floor(r() * 13) // 08:00..20:00
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

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
```

- [ ] **Step 2: Add the `fixture:load` script to `package.json`**

In `scripts`:
```jsonc
"fixture:load": "node scripts/generate-load-fixture.mjs",
```

- [ ] **Step 3: Run the generator to produce the fixture**

```bash
cd /Users/askowronski/Projects/nytw-companion && npm run fixture:load
```

Expected output: `wrote 250 events to /Users/askowronski/Projects/nytw-companion/data/seed-events-load.json`.

Verify the file:
```bash
cd /Users/askowronski/Projects/nytw-companion && ls -la data/seed-events-load.json && head -3 data/seed-events-load.json
```

Expected: file exists, non-trivial size (~200 KB), opens with `[`.

- [ ] **Step 4: Write the failing test for `lib/seed-source.ts`**

Create `__tests__/lib/seed-source.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const originalEnv = process.env.NEXT_PUBLIC_USE_LOAD_FIXTURE

beforeEach(() => {
  vi.resetModules()
  delete process.env.NEXT_PUBLIC_USE_LOAD_FIXTURE
})

afterEach(() => {
  if (originalEnv === undefined) delete process.env.NEXT_PUBLIC_USE_LOAD_FIXTURE
  else process.env.NEXT_PUBLIC_USE_LOAD_FIXTURE = originalEnv
})

describe('selectSeed', () => {
  it('returns the curated base seed when env var is unset', async () => {
    const { selectSeed } = await import('../../lib/seed-source')
    const events = selectSeed()
    expect(events.length).toBe(87)
  })

  it('returns the load fixture when NEXT_PUBLIC_USE_LOAD_FIXTURE === "1"', async () => {
    process.env.NEXT_PUBLIC_USE_LOAD_FIXTURE = '1'
    const { selectSeed } = await import('../../lib/seed-source')
    const events = selectSeed()
    expect(events.length).toBe(250)
  })

  it('returns the curated base seed when env var is anything other than "1"', async () => {
    process.env.NEXT_PUBLIC_USE_LOAD_FIXTURE = '0'
    const { selectSeed } = await import('../../lib/seed-source')
    const events = selectSeed()
    expect(events.length).toBe(87)
  })
})
```

- [ ] **Step 5: Run test — expect fail**

```bash
cd /Users/askowronski/Projects/nytw-companion && npx vitest run __tests__/lib/seed-source.test.ts
```

Expected: fail — module does not exist.

- [ ] **Step 6: Create `lib/seed-source.ts`**

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

- [ ] **Step 7: Run test — expect pass (3 green)**

```bash
cd /Users/askowronski/Projects/nytw-companion && npx vitest run __tests__/lib/seed-source.test.ts
```

Expected: PASS.

- [ ] **Step 8: Refactor `app/events/page.tsx` to use `selectSeed`**

Read the current file. Find:
```typescript
import seedEvents from '@/data/seed-events.json' with { type: 'json' }
```
Replace with:
```typescript
import { selectSeed } from '@/lib/seed-source'
```

Then find the `fetchEvents` function:
```typescript
async function fetchEvents(): Promise<Event[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return seedEvents as Event[]
  }
```
Replace the inner `return seedEvents as Event[]` with:
```typescript
    return selectSeed()
```

Final inner shape:
```typescript
async function fetchEvents(): Promise<Event[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return selectSeed()
  }
  // ... rest of function unchanged (the Supabase branch)
}
```

- [ ] **Step 9: Apply the same refactor to `app/now/page.tsx`**

Same swap: replace `import seedEvents from '@/data/seed-events.json' with { type: 'json' }` with `import { selectSeed } from '@/lib/seed-source'`. Replace `return seedEvents as Event[]` with `return selectSeed()`.

- [ ] **Step 10: Apply the same refactor to `app/my-plan/page.tsx`**

Same swap.

- [ ] **Step 11: Apply the same refactor to `app/plan/page.tsx`**

Same swap.

- [ ] **Step 12: Run the full Vitest suite**

```bash
cd /Users/askowronski/Projects/nytw-companion && npm test 2>&1 | tail -10
```

Expected: all tests still green. The refactor is transparent to all existing tests because they run with the env var unset (falls back to the 87-event base seed).

- [ ] **Step 13: Build to verify no compile errors**

```bash
cd /Users/askowronski/Projects/nytw-companion && npm run build 2>&1 | tail -15
```

Expected: clean build.

- [ ] **Step 14: Commit**

```bash
cd /Users/askowronski/Projects/nytw-companion && git add scripts/generate-load-fixture.mjs data/seed-events-load.json lib/seed-source.ts __tests__/lib/seed-source.test.ts package.json app/events/page.tsx app/now/page.tsx app/my-plan/page.tsx app/plan/page.tsx && git commit -m "feat(load): add 250-event load fixture + selectSeed helper + refactor 4 consumers"
```

---

## Task 8: Final acceptance

**Files:** none. Verification only.

- [ ] **Step 1: Full Vitest suite**

```bash
cd /Users/askowronski/Projects/nytw-companion && npm test 2>&1 | tail -10
```

Expected: all tests green. Phase 8a left 248; Phase 9a should add approximately:
- Privacy: 4
- Terms: 4
- Social-card metadata: 20 (10 routes × 2 + 2 globals)
- seed-source: 3

Total ≈ 279. Footer test count was 3, stays 3 (one of them now asserts 4 links instead of 2).

- [ ] **Step 2: Lint**

```bash
cd /Users/askowronski/Projects/nytw-companion && npm run lint 2>&1 | tail -10
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 3: Build**

```bash
cd /Users/askowronski/Projects/nytw-companion && npm run build 2>&1 | tail -30
```

Expected: clean build; route table now includes `/privacy` and `/terms` alongside the Phase 8a routes.

- [ ] **Step 4: Playwright E2E run**

```bash
cd /Users/askowronski/Projects/nytw-companion && npm run e2e 2>&1 | tail -20
```

Expected: 3 specs pass.

- [ ] **Step 5: Lighthouse run (informational)**

```bash
cd /Users/askowronski/Projects/nytw-companion && npm run lighthouse 2>&1 | tail -40
```

Expected: lhci spawns `npm run start`, audits 5 routes. Pass/fail depends on local machine; we don't gate Phase 9a acceptance on a green lighthouse run because the meaningful run is against production (Phase 8b).

- [ ] **Step 6: Inventory commits**

```bash
cd /Users/askowronski/Projects/nytw-companion && git log --oneline a682acc..HEAD
```

Expected: 7 feature commits (Tasks 1–7) plus optional fixup commits.

- [ ] **Step 7: Load fixture smoke**

```bash
cd /Users/askowronski/Projects/nytw-companion && NEXT_PUBLIC_USE_LOAD_FIXTURE=1 npm run dev
```

In another terminal or browser tab, visit `http://localhost:3000/events`. You should see 250 events with synthetic titles ending in `[load #N]`. Confirm the page renders smoothly, the filter drawer opens responsively, and the sticky day nav works.

Kill the dev server when satisfied.

- [ ] **Step 8: If anything needed adjustment, commit the fix**

Otherwise skip.

---

## Done criteria

- [ ] Playwright installed; `e2e/` contains three spec files; `npm run e2e` passes all three.
- [ ] `playwright.config.ts` exists with `webServer` block.
- [ ] `/privacy` and `/terms` pages render; linked from VirtusLabFooter; both appear in sitemap; both have `alternates.canonical`.
- [ ] `__tests__/app/social-cards.test.ts` asserts metadata shape on all 10 public routes.
- [ ] `docs/superpowers/launch/pre-launch-checklist.md` exists with all 12 sections.
- [ ] `docs/superpowers/launch/deferred-backlog.md` exists naming magic-link, iCal subscribe, Lighthouse-vs-prod, real-device QA.
- [ ] `lighthouserc.json` + `@lhci/cli` devDep + `npm run lighthouse` script all present.
- [ ] `.github/workflows/ci.yml` exists with lint+test, e2e, lighthouse jobs.
- [ ] `scripts/generate-load-fixture.mjs` produces `data/seed-events-load.json` deterministically; `lib/seed-source.ts` swaps based on `NEXT_PUBLIC_USE_LOAD_FIXTURE`; 4 consumer pages refactored.
- [ ] `npm test` green; `npm run lint` clean; `npm run build` succeeds; `npm run e2e` passes.
- [ ] All prior phase tests still pass.

## Out-of-scope reminders

See `docs/superpowers/launch/deferred-backlog.md`.
