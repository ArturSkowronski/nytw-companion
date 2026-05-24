# Phase 7 — /beyond + Landing + About + SEO + Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land v1.7 — a real `/beyond` page, the landing redesigned with curated picks and honesty sections, a real `/about`, full SEO infrastructure, and production polish (error boundaries, loading states, `?` help modal + one new keyboard shortcut, one new toast).

**Architecture:** Module-per-surface. Each task is a self-contained slice that commits independently. Tasks 1–4 are page-level changes; Task 5a–5c are SEO infra; Task 6–8 are polish; Task 9 is one missing toast; Task 10 is acceptance.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, Tailwind, Vitest + Testing Library, shadcn primitives over Base UI (per `feedback_shadcn_base_ui.md` — use `render={<Component />}`, not `asChild`), sonner (already mounted), `next/og` `ImageResponse`.

**Reference design:** `docs/superpowers/specs/2026-05-25-phase-7-beyond-and-polish-design.md`

---

## Conventions

- All new components are `'use client'` only if they need state/effects. Server components by default.
- Brand colors are hex literals: bg `#0A0A0A`, surface `#111111`, border `#1A1A1A` / `#2A2A2A`, fg `#FAFAFA`, muted `#A3A3A3`, dim `#555555`/`#666666`, accent `#FF6B35`.
- External links: `target="_blank" rel="noopener noreferrer"`.
- TDD per task: write failing test → run → implement → run → commit. One commit per task unless the task explicitly splits.
- Shortcuts already in place that we don't touch: `/` to focus search (in `EventSearch`).

---

## Pre-flight: codebase reality (already true)

Discoveries from spec reconciliation — these are starting conditions, not work items:

- `<Toaster />` is mounted in `app/layout.tsx`.
- `EventCard`, `EventDetailModal`, `ConciergeClient`, `EditorsPicksCarousel` already call `toast(...)`.
- `EditorsPicksCarousel` already renders the full `editors_pick_blurb` panel — no variant prop needed.
- `EventSearch` already implements the `/` keyboard shortcut.
- `ConciergeProposals` empty state already links to `/beyond` (so it just needs `/beyond` to exist).
- `SiteNav` already lists `Beyond` and `About` as disabled "Coming soon" placeholders; we flip `live: true` once each route exists.

---

## Task 1: `/beyond` page + data + empty-state link + nav flip

**Files:**
- Create: `data/external-sources.json`
- Create: `app/(marketing)/beyond/page.tsx`
- Create: `__tests__/app/beyond.test.tsx`
- Modify: `components/SiteNav.tsx` (flip `Beyond` live)
- Modify: `components/EventList.tsx` (`browse other aggregators →` becomes a real link)

- [ ] **Step 1: Create `data/external-sources.json`**

```json
[
  {
    "slug": "yorkseed",
    "name": "Yorkseed",
    "url": "https://nytw.yorkseed.co",
    "tagline": "1,800+ events. Broader scope.",
    "bestFor": "I want to see EVERYTHING."
  },
  {
    "slug": "andrew-yeung",
    "name": "Andrew Yeung Tech Week",
    "url": "https://luma.com/AndrewTechWeek",
    "tagline": "Mega-events from a known NYC operator.",
    "bestFor": "Founder-heavy networking."
  },
  {
    "slug": "garysguide",
    "name": "GarysGuide",
    "url": "https://garysguide.com/lists/h48w42m/NY-Tech-Week",
    "tagline": "15+ year NYC tech newsletter.",
    "bestFor": "Longer-term scene context."
  },
  {
    "slug": "vibecal",
    "name": "Vibecal",
    "url": "https://vibecal.com/nytw",
    "tagline": "Tag-based filtering by niche (#ai #founders).",
    "bestFor": "I know exactly what I want."
  },
  {
    "slug": "carly-ai",
    "name": "Carly AI",
    "url": "https://usecarly.com/nyc-tech-week-schedule",
    "tagline": "Full iCal subscribe of ALL 1,000+ events.",
    "bestFor": "Just sync everything to my calendar."
  },
  {
    "slug": "build-week-nyc",
    "name": "Build Week NYC",
    "url": "https://techweeknyc.com",
    "tagline": "Civic tech and public sector focus.",
    "bestFor": "Govtech / civic tech audiences."
  },
  {
    "slug": "partiful",
    "name": "Partiful #NYTechWeek",
    "url": "https://partiful.com/u/7DFu4rITofNzKIjA7hCx",
    "tagline": "Native Partiful hub.",
    "bestFor": "Discovering afterparties and rooftops."
  },
  {
    "slug": "tech-week-official",
    "name": "Tech Week Official",
    "url": "https://tech-week.com/calendar/nyc",
    "tagline": "The source of truth from a16z.",
    "bestFor": "Official listings, weak filters."
  },
  {
    "slug": "luma-nytw",
    "name": "Luma /nytw",
    "url": "https://lu.ma/nytw",
    "tagline": "Luma's own NYTW calendar with map view.",
    "bestFor": "Luma-native events with geo browse."
  }
]
```

- [ ] **Step 2: Write the failing test**

Create `__tests__/app/beyond.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import BeyondPage from '../../app/(marketing)/beyond/page'
import sources from '../../data/external-sources.json'

describe('/beyond', () => {
  it('renders the page header and lede', () => {
    render(<BeyondPage />)
    expect(screen.getByRole('heading', { level: 1, name: /other places/i })).toBeInTheDocument()
    expect(screen.getByText(/we curate 87 engineering-relevant events/i)).toBeInTheDocument()
  })

  it('renders every source name from external-sources.json', () => {
    render(<BeyondPage />)
    for (const s of sources) {
      expect(screen.getByText(s.name)).toBeInTheDocument()
    }
  })

  it('renders Why we link the competition footer paragraph', () => {
    render(<BeyondPage />)
    expect(screen.getByRole('heading', { level: 2, name: /why we link the competition/i })).toBeInTheDocument()
    expect(screen.getByText(/curated engineering layer/i)).toBeInTheDocument()
  })

  it('every external link opens in a new tab with rel="noopener noreferrer"', () => {
    const { container } = render(<BeyondPage />)
    const links = container.querySelectorAll('a[href^="http"]')
    expect(links.length).toBeGreaterThanOrEqual(sources.length)
    links.forEach((a) => {
      expect(a.getAttribute('target')).toBe('_blank')
      expect(a.getAttribute('rel') ?? '').toMatch(/noopener/)
      expect(a.getAttribute('rel') ?? '').toMatch(/noreferrer/)
    })
  })
})
```

- [ ] **Step 3: Run test — expect fail**

```bash
npx vitest run __tests__/app/beyond.test.tsx
```

Expected: FAIL — `BeyondPage` does not exist.

- [ ] **Step 4: Create `app/(marketing)/beyond/page.tsx`**

```typescript
import type { Metadata } from 'next'
import { VirtusLabFooter } from '@/components/VirtusLabFooter'
import sources from '@/data/external-sources.json'

export const metadata: Metadata = {
  title: "Beyond — NYTW Engineer's Companion",
  description:
    'Honest list of other Tech Week NYC aggregators — Yorkseed, GarysGuide, Vibecal, Carly AI, and more. We cover the engineering layer; these cover the rest.',
}

export default function BeyondPage() {
  return (
    <main className="min-h-screen bg-[#0A0A0A] text-[#FAFAFA]">
      <section className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="font-mono text-3xl md:text-4xl font-bold mb-4">
          Other places to find Tech Week NYC events
        </h1>
        <p className="text-[#A3A3A3] text-base md:text-lg leading-relaxed max-w-3xl">
          We curate 87 engineering-relevant events from 1,000+. We skip a lot.
          Here&apos;s where to find the rest.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-10">
          {sources.map((s) => (
            <article
              key={s.slug}
              className="rounded-lg border border-[#1A1A1A] bg-[#111111] p-5 flex flex-col gap-3"
            >
              <h2 className="font-mono text-lg font-bold text-[#FAFAFA]">{s.name}</h2>
              <p className="text-[#A3A3A3] text-sm leading-relaxed">{s.tagline}</p>
              <p className="font-mono text-xs">
                <span className="text-[#FF6B35]">Best for:</span>{' '}
                <span className="text-[#A3A3A3]">{s.bestFor}</span>
              </p>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="self-start mt-1 font-mono text-xs text-[#FAFAFA] border border-[#2A2A2A] rounded px-3 py-1.5 hover:bg-[#1A1A1A] hover:border-[#FF6B35] hover:text-[#FF6B35] transition-colors"
              >
                Visit →
              </a>
            </article>
          ))}
        </div>

        <section className="mt-16 max-w-3xl">
          <h2 className="font-mono text-xl font-bold mb-3">
            Why we link the competition
          </h2>
          <p className="text-[#A3A3A3] text-base leading-relaxed">
            Tech Week is too big for one tool. We&apos;re the curated engineering
            layer; these cover what we don&apos;t.
          </p>
        </section>
      </section>

      <VirtusLabFooter />
    </main>
  )
}
```

(Note: this file imports `@/components/VirtusLabFooter`, which we build in Task 2. Tests for Task 1 will fail until Task 2 lands. We accept that inter-task dependency; Tasks 1 and 2 land in sequence — do Task 2 right after if running serially, or run them together in the same review wave if running parallel.)

To keep Task 1 independently testable, **stub** `VirtusLabFooter` inline for now:

Create `components/VirtusLabFooter.tsx` as a stub (Task 2 fills it in properly):

```typescript
export function VirtusLabFooter() {
  return (
    <footer className="border-t border-[#1A1A1A] px-6 py-10">
      <p className="text-[#A3A3A3] text-sm text-center font-mono">VirtusLab</p>
    </footer>
  )
}
```

- [ ] **Step 5: Flip `Beyond` to live in `components/SiteNav.tsx`**

Find:
```typescript
  { label: 'Beyond',       href: '/beyond',  live: false },
```
Replace with:
```typescript
  { label: 'Beyond',       href: '/beyond',  live: true },
```

- [ ] **Step 6: Wire the EventList empty-state link**

In `components/EventList.tsx`, find:
```typescript
            <p className="text-sm">
              Try {activeCount > 0 ? 'removing filters' : 'broader terms'}, or browse other aggregators →
            </p>
```

Replace with:
```typescript
            <p className="text-sm">
              Try {activeCount > 0 ? 'removing filters' : 'broader terms'}, or{' '}
              <a href="/beyond" className="text-[#FF6B35] hover:underline">
                browse other aggregators →
              </a>
            </p>
```

- [ ] **Step 7: Run tests — expect pass**

```bash
npx vitest run __tests__/app/beyond.test.tsx
```

Expected: PASS (4 tests green).

Also run the existing SiteNav test (if any) to make sure flipping `Beyond` to live didn't break a "coming soon" assertion:
```bash
npx vitest run __tests__/components/SiteNav 2>/dev/null || true
```

- [ ] **Step 8: Commit**

```bash
git add data/external-sources.json app/\(marketing\)/beyond/page.tsx __tests__/app/beyond.test.tsx components/VirtusLabFooter.tsx components/SiteNav.tsx components/EventList.tsx
git commit -m "feat(beyond): add /beyond page with 9 alternative aggregators + nav flip + EventList empty-state link"
```

---

## Task 2: `VirtusLabFooter` (real implementation)

**Files:**
- Modify: `components/VirtusLabFooter.tsx` (replace stub from Task 1)
- Create: `__tests__/components/VirtusLabFooter.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/VirtusLabFooter.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VirtusLabFooter } from '../../components/VirtusLabFooter'

describe('VirtusLabFooter', () => {
  it('renders "Made by VirtusLab" with an external link', () => {
    render(<VirtusLabFooter />)
    const link = screen.getByRole('link', { name: /virtuslab/i })
    expect(link).toHaveAttribute('href', 'https://virtuslab.com')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.getAttribute('rel') ?? '').toMatch(/noopener/)
  })

  it('renders the not-affiliated disclaimer', () => {
    render(<VirtusLabFooter />)
    expect(screen.getByText(/not affiliated with a16z or tech week nyc/i)).toBeInTheDocument()
  })

  it('renders About and Beyond internal links', () => {
    render(<VirtusLabFooter />)
    expect(screen.getByRole('link', { name: /about/i })).toHaveAttribute('href', '/about')
    expect(screen.getByRole('link', { name: /beyond/i })).toHaveAttribute('href', '/beyond')
  })
})
```

- [ ] **Step 2: Run test — expect fail**

```bash
npx vitest run __tests__/components/VirtusLabFooter.test.tsx
```

Expected: FAIL — the stub doesn't render those elements yet.

- [ ] **Step 3: Replace `components/VirtusLabFooter.tsx` with the real implementation**

```typescript
import Link from 'next/link'

export function VirtusLabFooter() {
  return (
    <footer className="border-t border-[#1A1A1A] px-6 py-10 mt-16">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-[#A3A3A3] text-sm font-mono">
          Made by{' '}
          <a
            href="https://virtuslab.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#FF6B35] hover:underline"
          >
            VirtusLab
          </a>
        </p>
        <p className="text-[#A3A3A3] text-sm font-mono">
          Not affiliated with a16z or Tech Week NYC
        </p>
        <nav className="flex gap-4 text-[#555555] text-xs font-mono">
          <Link href="/about" className="hover:text-[#A3A3A3]">
            About
          </Link>
          <Link href="/beyond" className="hover:text-[#A3A3A3]">
            Beyond
          </Link>
        </nav>
      </div>
    </footer>
  )
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run __tests__/components/VirtusLabFooter.test.tsx
```

Expected: PASS (3 tests green).

- [ ] **Step 5: Commit**

```bash
git add components/VirtusLabFooter.tsx __tests__/components/VirtusLabFooter.test.tsx
git commit -m "feat(footer): add shared VirtusLabFooter with disclosure + internal links"
```

---

## Task 3: Landing redesign

**Files:**
- Modify: `app/(marketing)/page.tsx` (full rewrite)
- Create: `__tests__/app/landing.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/app/landing.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import HomePage from '../../app/(marketing)/page'

// Mock plan store so EditorsPicksCarousel can render
vi.mock('../../lib/plan-store', async () => {
  const actual = await vi.importActual<typeof import('../../lib/plan-store')>('../../lib/plan-store')
  return {
    ...actual,
    usePlanStore: () => ({ items: [], addItem: () => {} }),
  }
})

import { vi } from 'vitest'

describe('Landing page', () => {
  it('renders the hero with the 1,047 events headline', () => {
    render(<HomePage />)
    expect(screen.getByText(/1,047 events\. 168 hours/i)).toBeInTheDocument()
  })

  it('renders the subtle Beyond link in the hero', () => {
    render(<HomePage />)
    const link = screen.getByRole('link', { name: /see \/beyond if you want it all/i })
    expect(link).toHaveAttribute('href', '/beyond')
  })

  it('renders the 3-step flow strip', () => {
    render(<HomePage />)
    expect(screen.getByText(/Browse or AI-plan/i)).toBeInTheDocument()
    expect(screen.getByText(/Add to My Plan/i)).toBeInTheDocument()
    expect(screen.getByText(/Sync to your calendar/i)).toBeInTheDocument()
  })

  it('renders Editor\'s Picks carousel with the VirtusLab disclosure blurb', () => {
    render(<HomePage />)
    // Stable substring of the seed VL pick blurb
    expect(screen.getByText(/disclosure: virtuslab/i)).toBeInTheDocument()
  })

  it('renders "Why we built this" section with author signature', () => {
    render(<HomePage />)
    expect(screen.getByRole('heading', { level: 2, name: /why we built this/i })).toBeInTheDocument()
    expect(screen.getByText(/artur skowro/i)).toBeInTheDocument()
  })

  it('renders "What we don\'t do" with three bullets', () => {
    render(<HomePage />)
    expect(screen.getByRole('heading', { level: 2, name: /what we don.?t do/i })).toBeInTheDocument()
    expect(screen.getByText(/we don.?t rsvp for you/i)).toBeInTheDocument()
    expect(screen.getByText(/87 we.?d recommend to an engineer friend/i)).toBeInTheDocument()
    expect(screen.getByText(/we don.?t track you/i)).toBeInTheDocument()
  })

  it('renders the VirtusLabFooter (not affiliated text)', () => {
    render(<HomePage />)
    expect(screen.getByText(/not affiliated with a16z or tech week nyc/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test — expect fail**

```bash
npx vitest run __tests__/app/landing.test.tsx
```

Expected: FAIL — current landing has the old skeleton + tiny footer.

- [ ] **Step 3: Replace `app/(marketing)/page.tsx`**

```typescript
import type { Metadata } from 'next'
import Link from 'next/link'
import { EditorsPicksCarousel } from '@/components/EditorsPicksCarousel'
import { VirtusLabFooter } from '@/components/VirtusLabFooter'
import seedEvents from '@/data/seed-events.json' with { type: 'json' }
import type { Event } from '@/lib/types'

export const metadata: Metadata = {
  title: "NYTW Engineer's Companion — Tech Week NYC 2026",
  description:
    '87 hand-curated engineering events from AI infra, devtools, platform engineering, and more. Add to your plan in one click.',
}

export const revalidate = 3600

export default function HomePage() {
  const picks = (seedEvents as Event[]).filter((e) => e.is_editors_pick)

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-[#FAFAFA]">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center min-h-[80vh] px-6 text-center gap-8 pt-10">
        <div className="space-y-4 max-w-2xl">
          <p className="text-[#FF6B35] font-mono text-sm tracking-widest uppercase">
            Tech Week NYC · June 1–7, 2026
          </p>
          <h1 className="font-mono text-5xl md:text-7xl font-bold tracking-tight leading-none">
            NYTW Engineer&apos;s<br />Companion
          </h1>
          <p className="text-[#A3A3A3] text-lg md:text-xl leading-relaxed">
            1,047 events. 168 hours. Plan the week you actually want.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/events"
            className="px-8 py-4 bg-[#FF6B35] text-white font-mono font-bold text-lg rounded-md hover:bg-[#e85a25] transition-colors inline-flex items-center justify-center"
          >
            Browse 87 events →
          </Link>
          <Link
            href="/plan"
            className="px-8 py-4 border border-[#A3A3A3] text-[#FAFAFA] font-mono font-bold text-lg rounded-md hover:border-[#FAFAFA] hover:bg-[#111111] transition-colors inline-flex items-center justify-center"
          >
            Plan my week with AI →
          </Link>
        </div>

        <p className="text-[#555555] text-sm font-mono">
          or{' '}
          <Link href="/beyond" className="hover:text-[#A3A3A3] underline underline-offset-4">
            see /beyond if you want it all →
          </Link>
        </p>
      </section>

      {/* 3-step flow strip */}
      <section className="px-6 py-16 border-t border-[#1A1A1A]">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { n: '①', label: 'Browse or AI-plan', body: '87 curated events, day-grouped, or describe yourself and let the AI propose a week.' },
            { n: '②', label: 'Add to My Plan', body: 'One-click add. Status tracking, conflict warnings, all stored in your browser.' },
            { n: '③', label: 'Sync to your calendar', body: 'Download .ics, drop it into Google Calendar / Outlook / Apple Calendar.' },
          ].map((step) => (
            <div key={step.n} className="space-y-2">
              <p className="text-[#FF6B35] font-mono text-2xl">{step.n}</p>
              <p className="font-mono font-bold text-[#FAFAFA] text-base">{step.label}</p>
              <p className="text-[#A3A3A3] text-sm leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Editor's Picks */}
      {picks.length > 0 && (
        <section className="px-6 py-16 border-t border-[#1A1A1A]">
          <div className="max-w-5xl mx-auto">
            <EditorsPicksCarousel picks={picks} />
          </div>
        </section>
      )}

      {/* Why we built this */}
      <section className="px-6 py-16 border-t border-[#1A1A1A]">
        <div className="max-w-3xl mx-auto space-y-5">
          <h2 className="font-mono text-2xl font-bold">Why we built this</h2>
          <p className="text-[#A3A3A3] text-base leading-relaxed">
            Tech Week NYC runs over a thousand events in a single week. No existing
            aggregator filters for engineers who actually ship code — they all surface
            the same founder dinners, networking mixers, and demo nights. We wanted
            something we&apos;d send to a colleague.
          </p>
          <p className="text-[#A3A3A3] text-base leading-relaxed">
            So this is one engineer&apos;s opinionated cut: 87 events across AI infra,
            devtools, platform engineering, security, and open source. Day-grouped,
            mapped, with honest blurbs on the Editor&apos;s Picks. Curation over filtering.
          </p>
          <p className="text-[#666666] text-sm font-mono pt-2">
            — Artur Skowroński, VirtusLab
          </p>
        </div>
      </section>

      {/* What we don't do */}
      <section className="px-6 py-16 border-t border-[#1A1A1A]">
        <div className="max-w-3xl mx-auto space-y-4">
          <h2 className="font-mono text-2xl font-bold">What we don&apos;t do</h2>
          <ul className="space-y-3 text-[#A3A3A3] text-base leading-relaxed">
            <li className="flex gap-3">
              <span className="text-[#FF6B35] font-mono shrink-0">•</span>
              <span>We don&apos;t RSVP for you. You click through to Luma/Partiful, then mark status here.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#FF6B35] font-mono shrink-0">•</span>
              <span>We don&apos;t have every event — we have 87 we&apos;d recommend to an engineer friend.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#FF6B35] font-mono shrink-0">•</span>
              <span>We don&apos;t track you. Plan stored in your browser. Email link only if you want recovery.</span>
            </li>
          </ul>
        </div>
      </section>

      <VirtusLabFooter />
    </main>
  )
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run __tests__/app/landing.test.tsx
```

Expected: PASS (7 tests green).

- [ ] **Step 5: Commit**

```bash
git add app/\(marketing\)/page.tsx __tests__/app/landing.test.tsx
git commit -m "feat(landing): redesign with 3-step flow, Editor's Picks, Why we built this, What we don't do"
```

---

## Task 4: `/about` page + nav flip

**Files:**
- Create: `app/(marketing)/about/page.tsx`
- Create: `__tests__/app/about.test.tsx`
- Modify: `components/SiteNav.tsx` (flip `About` live)

- [ ] **Step 1: Write the failing test**

Create `__tests__/app/about.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import AboutPage from '../../app/(marketing)/about/page'

describe('/about', () => {
  it('renders all four section headings', () => {
    render(<AboutPage />)
    expect(screen.getByRole('heading', { level: 1, name: /about nytw companion/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /why this exists/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /how we curate/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /who built this/i })).toBeInTheDocument()
  })

  it('renders the not-affiliated disclaimer', () => {
    render(<AboutPage />)
    expect(screen.getByText(/independent project by virtuslab. not affiliated with a16z/i)).toBeInTheDocument()
  })

  it('renders the AS initials avatar fallback', () => {
    render(<AboutPage />)
    expect(screen.getByLabelText(/artur skowro/i)).toHaveTextContent('AS')
  })

  it('renders the placeholder LinkedIn link', () => {
    render(<AboutPage />)
    const link = screen.getByRole('link', { name: /linkedin/i })
    expect(link).toHaveAttribute('href') // any href is acceptable; placeholder fine
  })
})
```

- [ ] **Step 2: Run test — expect fail**

```bash
npx vitest run __tests__/app/about.test.tsx
```

Expected: FAIL — `AboutPage` does not exist.

- [ ] **Step 3: Create `app/(marketing)/about/page.tsx`**

```typescript
import type { Metadata } from 'next'
import { VirtusLabFooter } from '@/components/VirtusLabFooter'

export const metadata: Metadata = {
  title: "About — NYTW Engineer's Companion",
  description:
    'Why we built NYTW Companion, how we curate the 87 events, and who is behind the project.',
}

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#0A0A0A] text-[#FAFAFA]">
      <section className="max-w-3xl mx-auto px-6 py-12 space-y-12">
        <h1 className="font-mono text-3xl md:text-4xl font-bold">
          About NYTW Companion
        </h1>

        <section className="space-y-3">
          <h2 className="font-mono text-xl font-bold">Why this exists</h2>
          <p className="text-[#A3A3A3] text-base leading-relaxed">
            Tech Week NYC runs about a thousand events in a single week. No existing
            aggregator filters for engineers who ship code — they surface the same
            founder dinners, mixers, and demo nights. NYTW Companion is one engineer&apos;s
            opinionated cut: 87 events across AI infra, devtools, platform engineering,
            security, and open source. Day-grouped, mapped, with honest blurbs on the
            Editor&apos;s Picks.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-mono text-xl font-bold">How we curate</h2>
          <ul className="space-y-2 text-[#A3A3A3] text-base leading-relaxed">
            <li className="flex gap-3">
              <span className="text-[#FF6B35] font-mono shrink-0">•</span>
              <span>We read every event description, not just the title.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#FF6B35] font-mono shrink-0">•</span>
              <span>We pick for engineers who ship — devtools, AI infra, platform engineering, security, open source.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#FF6B35] font-mono shrink-0">•</span>
              <span>We disclose when VirtusLab hosts an event (see Editor&apos;s Picks).</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#FF6B35] font-mono shrink-0">•</span>
              <span>We link to alternatives we don&apos;t cover (see /beyond).</span>
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <p className="text-[#A3A3A3] text-sm leading-relaxed">
            NYTW Engineer&apos;s Companion is an independent project by VirtusLab. Not affiliated with a16z, Tech Week NYC, or any host listed.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-mono text-xl font-bold">Who built this</h2>
          <div className="flex items-start gap-4">
            <div
              aria-label="Artur Skowroński"
              className="shrink-0 w-16 h-16 rounded-full bg-[#FF6B35] flex items-center justify-center text-white font-mono font-bold text-lg"
            >
              AS
            </div>
            <div className="space-y-2">
              <p className="font-mono font-bold text-[#FAFAFA]">Artur Skowroński</p>
              <p className="font-mono text-sm text-[#A3A3A3]">Engineer at VirtusLab</p>
              {/* TODO: replace with real bio */}
              <p className="text-[#A3A3A3] text-sm leading-relaxed">
                Engineer working on developer experience and AI infrastructure. NYTW Companion is a side project to learn about NYC tech events from the inside.
              </p>
              {/* TODO: replace with real LinkedIn URL */}
              <a
                href="https://www.linkedin.com/in/askowronski/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-[#FF6B35] hover:underline font-mono text-sm"
              >
                LinkedIn →
              </a>
            </div>
          </div>
        </section>
      </section>

      <VirtusLabFooter />
    </main>
  )
}
```

- [ ] **Step 4: Flip `About` to live in `components/SiteNav.tsx`**

Find:
```typescript
  { label: 'About',        href: '/about',   live: false },
```
Replace with:
```typescript
  { label: 'About',        href: '/about',   live: true },
```

- [ ] **Step 5: Run tests — expect pass**

```bash
npx vitest run __tests__/app/about.test.tsx
```

Expected: PASS (4 tests green).

- [ ] **Step 6: Commit**

```bash
git add app/\(marketing\)/about/page.tsx __tests__/app/about.test.tsx components/SiteNav.tsx
git commit -m "feat(about): add /about page with curation transparency + author block + nav flip"
```

---

## Task 5a: SEO foundation — `lib/site-url.ts` + `metadataBase` + per-route metadata

**Files:**
- Create: `lib/site-url.ts`
- Create: `__tests__/lib/site-url.test.ts`
- Modify: `app/layout.tsx` (add `metadataBase`)
- Modify: `app/now/page.tsx` (add metadata)
- Modify: `app/my-plan/page.tsx` (add metadata)
- Modify: `app/plan/page.tsx` (add metadata)

- [ ] **Step 1: Write the failing test for `lib/site-url.ts`**

Create `__tests__/lib/site-url.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('SITE_URL', () => {
  const originalEnv = process.env.NEXT_PUBLIC_SITE_URL

  beforeEach(() => {
    // Reset module cache so re-importing re-reads env
    delete process.env.NEXT_PUBLIC_SITE_URL
  })

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
    else process.env.NEXT_PUBLIC_SITE_URL = originalEnv
  })

  it('defaults to http://localhost:3000 when env var is unset', async () => {
    const mod = await import('../../lib/site-url?default')
    expect(mod.SITE_URL).toBe('http://localhost:3000')
  })

  it('reads NEXT_PUBLIC_SITE_URL when set', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com'
    const mod = await import('../../lib/site-url?set')
    expect(mod.SITE_URL).toBe('https://example.com')
  })

  it('strips trailing slash', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com/'
    const mod = await import('../../lib/site-url?trailing')
    expect(mod.SITE_URL).toBe('https://example.com')
  })
})
```

(Note: the `?default` / `?set` / `?trailing` query suffixes are Vite's way to force a fresh module load per test. Vitest supports this for re-evaluating modules that compute values at import time.)

- [ ] **Step 2: Run test — expect fail**

```bash
npx vitest run __tests__/lib/site-url.test.ts
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Create `lib/site-url.ts`**

```typescript
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
```

- [ ] **Step 4: Run test — expect pass**

```bash
npx vitest run __tests__/lib/site-url.test.ts
```

Expected: PASS (3 tests green).

- [ ] **Step 5: Add `metadataBase` to `app/layout.tsx`**

Find:
```typescript
export const metadata: Metadata = {
  title: "NYTW Engineer's Companion",
  description: "1,000+ events. 168 hours. Plan the week you actually want.",
  manifest: '/manifest.json',
}
```

Replace with:
```typescript
import { SITE_URL } from '@/lib/site-url'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "NYTW Engineer's Companion",
  description: "1,000+ events. 168 hours. Plan the week you actually want.",
  manifest: '/manifest.json',
}
```

(Add the import to the top of the file alongside the existing imports.)

- [ ] **Step 6: Add `alternates.canonical` to existing per-route metadata**

All three pages already export `metadata` with title + description (verified during planning). We only need to add `alternates: { canonical: '/route' }` to each.

For `app/now/page.tsx` — find:
```typescript
export const metadata: Metadata = {
  title: "Now — NYTW Engineer's Companion",
  description: "What's next in your Tech Week plan.",
}
```
Replace with:
```typescript
export const metadata: Metadata = {
  title: "Now — NYTW Engineer's Companion",
  description: "What's next in your Tech Week plan.",
  alternates: { canonical: '/now' },
}
```

For `app/my-plan/page.tsx` — find the existing `export const metadata: Metadata = { ... }` block and add `alternates: { canonical: '/my-plan' },` as a sibling field.

For `app/plan/page.tsx` — find:
```typescript
export const metadata: Metadata = {
  title: "Plan with AI — NYTW Engineer's Companion",
  description: 'Describe yourself; AI picks 5–8 events for you.',
```
Add `alternates: { canonical: '/plan' },` before the closing `}`.

Also verify `/events` (`app/events/page.tsx`) — if its existing metadata lacks `alternates`, add `alternates: { canonical: '/events' },`.

No copy changes — keep existing titles and descriptions intact. The single SEO win we want here is canonical URLs resolving against `metadataBase`.

- [ ] **Step 7: Run lint + full test suite to verify no regressions**

```bash
npm run lint && npm test
```

Expected: 0 lint errors; all tests green.

- [ ] **Step 8: Commit**

```bash
git add lib/site-url.ts __tests__/lib/site-url.test.ts app/layout.tsx app/now/page.tsx app/my-plan/page.tsx app/plan/page.tsx
git commit -m "feat(seo): add SITE_URL helper + metadataBase + per-route metadata for /now /my-plan /plan"
```

---

## Task 5b: Sitemap + Robots

**Files:**
- Create: `app/sitemap.ts`
- Create: `app/robots.ts`
- Create: `__tests__/app/sitemap.test.ts`
- Create: `__tests__/app/robots.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/app/sitemap.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import sitemap from '../../app/sitemap'

describe('sitemap', () => {
  it('lists the seven public routes', () => {
    const entries = sitemap()
    const urls = entries.map((e) => new URL(e.url).pathname)
    expect(urls).toEqual(
      expect.arrayContaining(['/', '/events', '/now', '/my-plan', '/plan', '/beyond', '/about'])
    )
    expect(urls.length).toBe(7)
  })

  it('every URL is absolute', () => {
    const entries = sitemap()
    entries.forEach((e) => {
      expect(() => new URL(e.url)).not.toThrow()
    })
  })

  it('every entry has lastModified, changeFrequency, priority', () => {
    const entries = sitemap()
    entries.forEach((e) => {
      expect(e.lastModified).toBeInstanceOf(Date)
      expect(typeof e.changeFrequency).toBe('string')
      expect(typeof e.priority).toBe('number')
    })
  })
})
```

Create `__tests__/app/robots.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import robots from '../../app/robots'

describe('robots', () => {
  it('allows / and disallows /api/', () => {
    const r = robots()
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules
    expect(rule.userAgent).toBe('*')
    expect(rule.allow).toEqual(expect.arrayContaining(['/']))
    expect(rule.disallow).toEqual(expect.arrayContaining(['/api/']))
  })

  it('references the sitemap URL', () => {
    const r = robots()
    expect(r.sitemap).toMatch(/\/sitemap\.xml$/)
  })
})
```

- [ ] **Step 2: Run tests — expect fail**

```bash
npx vitest run __tests__/app/sitemap.test.ts __tests__/app/robots.test.ts
```

Expected: FAIL — modules do not exist.

- [ ] **Step 3: Create `app/sitemap.ts`**

```typescript
import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site-url'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const route = (
    path: string,
    priority: number,
    changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] = 'weekly'
  ): MetadataRoute.Sitemap[number] => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  })

  return [
    route('/', 1.0, 'weekly'),
    route('/events', 1.0, 'daily'),
    route('/now', 0.8, 'daily'),
    route('/my-plan', 0.7, 'weekly'),
    route('/plan', 0.7, 'weekly'),
    route('/beyond', 0.7, 'monthly'),
    route('/about', 0.6, 'monthly'),
  ]
}
```

- [ ] **Step 4: Create `app/robots.ts`**

```typescript
import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site-url'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/'],
      disallow: ['/api/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
```

- [ ] **Step 5: Run tests — expect pass**

```bash
npx vitest run __tests__/app/sitemap.test.ts __tests__/app/robots.test.ts
```

Expected: PASS (5 tests across two files).

- [ ] **Step 6: Commit**

```bash
git add app/sitemap.ts app/robots.ts __tests__/app/sitemap.test.ts __tests__/app/robots.test.ts
git commit -m "feat(seo): add sitemap + robots routes referencing SITE_URL"
```

---

## Task 5c: OG image

**Files:**
- Create: `app/opengraph-image.tsx`
- Create: `__tests__/app/opengraph-image.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/app/opengraph-image.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { ImageResponse } from 'next/og'
import OG from '../../app/opengraph-image'

describe('opengraph-image', () => {
  it('returns an ImageResponse', async () => {
    const result = await OG()
    expect(result).toBeInstanceOf(ImageResponse)
  })
})
```

- [ ] **Step 2: Run test — expect fail**

```bash
npx vitest run __tests__/app/opengraph-image.test.ts
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Create `app/opengraph-image.tsx`**

```typescript
import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = "NYTW Engineer's Companion — 87 engineering-relevant events for Tech Week NYC 2026"
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#0A0A0A',
          padding: '72px',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div
            style={{
              color: '#FF6B35',
              fontSize: 28,
              letterSpacing: 4,
              textTransform: 'uppercase',
            }}
          >
            Tech Week NYC · June 1–7, 2026
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ color: '#FAFAFA', fontSize: 96, fontWeight: 800, lineHeight: 1 }}>
            NYTW Engineer&apos;s
            <br />
            Companion
          </div>
          <div style={{ color: '#A3A3A3', fontSize: 36, lineHeight: 1.2 }}>
            87 engineering-relevant events.
            <br />
            Plan the week you actually want.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            color: '#555555',
            fontSize: 24,
          }}
        >
          virtuslab.com
        </div>
      </div>
    ),
    { ...size }
  )
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
npx vitest run __tests__/app/opengraph-image.test.ts
```

Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add app/opengraph-image.tsx __tests__/app/opengraph-image.test.ts
git commit -m "feat(seo): add runtime-generated opengraph-image with brand layout"
```

---

## Task 6: Error boundaries

**Files:**
- Create: `app/error.tsx`
- Create: `app/events/error.tsx`
- Create: `app/plan/error.tsx`
- Create: `app/my-plan/error.tsx`
- Create: `app/now/error.tsx`
- Create: `__tests__/app/error.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/app/error.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import GlobalError from '../../app/error'

describe('app/error.tsx', () => {
  it('renders the fallback message and the error message', () => {
    const reset = vi.fn()
    render(<GlobalError error={new Error('boom')} reset={reset} />)
    expect(screen.getByText(/something broke/i)).toBeInTheDocument()
    expect(screen.getByText(/boom/)).toBeInTheDocument()
  })

  it('Try again button calls reset', () => {
    const reset = vi.fn()
    render(<GlobalError error={new Error('x')} reset={reset} />)
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(reset).toHaveBeenCalledOnce()
  })

  it('renders a Home link', () => {
    const reset = vi.fn()
    render(<GlobalError error={new Error('x')} reset={reset} />)
    expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/')
  })
})
```

- [ ] **Step 2: Run test — expect fail**

```bash
npx vitest run __tests__/app/error.test.tsx
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Create the global `app/error.tsx`**

```typescript
'use client'

import Link from 'next/link'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
  heading?: string
}

export default function GlobalError({ error, reset, heading = 'Something broke.' }: ErrorProps) {
  return (
    <main className="min-h-[60vh] bg-[#0A0A0A] text-[#FAFAFA] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="font-mono text-2xl font-bold">{heading}</h1>
        <p className="font-mono text-sm text-[#A3A3A3] break-words">
          {error.message || 'Unknown error.'}
        </p>
        <div className="flex gap-3 justify-center pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="px-4 py-2 bg-[#FF6B35] text-white font-mono text-sm rounded hover:bg-[#e85a25] transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="px-4 py-2 border border-[#2A2A2A] text-[#A3A3A3] font-mono text-sm rounded hover:bg-[#111111] hover:text-[#FAFAFA] transition-colors"
          >
            Home
          </Link>
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Create the 4 per-route boundaries**

`app/events/error.tsx`:
```typescript
'use client'

import GlobalError from '@/app/error'

export default function EventsError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <GlobalError {...props} heading="Couldn't load events." />
}
```

`app/plan/error.tsx`:
```typescript
'use client'

import GlobalError from '@/app/error'

export default function PlanError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <GlobalError {...props} heading="AI concierge unavailable." />
}
```

`app/my-plan/error.tsx`:
```typescript
'use client'

import GlobalError from '@/app/error'

export default function MyPlanError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <GlobalError {...props} heading="Couldn't load your plan." />
}
```

`app/now/error.tsx`:
```typescript
'use client'

import GlobalError from '@/app/error'

export default function NowError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <GlobalError {...props} heading="Couldn't load /now." />
}
```

- [ ] **Step 5: Run tests — expect pass**

```bash
npx vitest run __tests__/app/error.test.tsx
```

Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add app/error.tsx app/events/error.tsx app/plan/error.tsx app/my-plan/error.tsx app/now/error.tsx __tests__/app/error.test.tsx
git commit -m "feat(error): add global error boundary + per-route shadows for events/plan/my-plan/now"
```

---

## Task 7: Loading skeletons

**Files:**
- Create: `app/events/loading.tsx`
- Create: `app/my-plan/loading.tsx`
- Create: `app/plan/loading.tsx`
- Create: `app/now/loading.tsx`
- Create: `__tests__/app/loading.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/app/loading.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import EventsLoading from '../../app/events/loading'
import MyPlanLoading from '../../app/my-plan/loading'
import PlanLoading from '../../app/plan/loading'
import NowLoading from '../../app/now/loading'

describe('loading skeletons', () => {
  it.each([
    ['events', EventsLoading],
    ['my-plan', MyPlanLoading],
    ['plan', PlanLoading],
    ['now', NowLoading],
  ])('%s loading renders without crashing', (_name, Component) => {
    const { container } = render(<Component />)
    expect(container.firstChild).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run test — expect fail**

```bash
npx vitest run __tests__/app/loading.test.tsx
```

Expected: FAIL — modules do not exist.

- [ ] **Step 3: Create the four loading files**

`app/events/loading.tsx`:
```typescript
export default function EventsLoading() {
  return (
    <main className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex gap-8">
        <nav className="hidden lg:flex flex-col gap-2 min-w-[80px] shrink-0">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-8 bg-[#111111] rounded animate-pulse" />
          ))}
        </nav>
        <div className="flex-1 space-y-3">
          <div className="h-10 bg-[#111111] rounded animate-pulse" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 bg-[#111111] rounded animate-pulse" />
          ))}
        </div>
      </div>
    </main>
  )
}
```

`app/my-plan/loading.tsx`:
```typescript
export default function MyPlanLoading() {
  return (
    <main className="max-w-5xl mx-auto px-6 py-8">
      <p className="font-mono text-sm text-[#A3A3A3]">Loading your plan…</p>
    </main>
  )
}
```

`app/plan/loading.tsx`:
```typescript
export default function PlanLoading() {
  return (
    <main className="max-w-5xl mx-auto px-6 py-8">
      <p className="font-mono text-sm text-[#A3A3A3]">Loading the AI concierge…</p>
    </main>
  )
}
```

`app/now/loading.tsx`:
```typescript
export default function NowLoading() {
  return (
    <main className="max-w-5xl mx-auto px-6 py-8">
      <div className="h-48 bg-[#111111] rounded animate-pulse" />
    </main>
  )
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run __tests__/app/loading.test.tsx
```

Expected: PASS (4 cases via it.each).

- [ ] **Step 5: Commit**

```bash
git add app/events/loading.tsx app/my-plan/loading.tsx app/plan/loading.tsx app/now/loading.tsx __tests__/app/loading.test.tsx
git commit -m "feat(loading): add route-level loading.tsx for events/my-plan/plan/now"
```

---

## Task 8: Keyboard helper + HelpModal + `?` shortcut + ViewToggle `m` shortcut

**Files:**
- Create: `lib/keyboard.ts`
- Create: `components/HelpModal.tsx`
- Create: `__tests__/lib/keyboard.test.ts`
- Create: `__tests__/components/HelpModal.test.tsx`
- Modify: `components/SiteNav.tsx` (mount HelpModal + listen for `?`)
- Modify: `components/ViewToggle.tsx` (listen for `m`)

- [ ] **Step 1: Write the failing test for `lib/keyboard.ts`**

Create `__tests__/lib/keyboard.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { isTypingTarget } from '../../lib/keyboard'

describe('isTypingTarget', () => {
  it('returns true for <input>', () => {
    const el = document.createElement('input')
    expect(isTypingTarget(el)).toBe(true)
  })

  it('returns true for <textarea>', () => {
    const el = document.createElement('textarea')
    expect(isTypingTarget(el)).toBe(true)
  })

  it('returns true for <select>', () => {
    const el = document.createElement('select')
    expect(isTypingTarget(el)).toBe(true)
  })

  it('returns true for contentEditable element', () => {
    const el = document.createElement('div')
    el.contentEditable = 'true'
    expect(isTypingTarget(el)).toBe(true)
  })

  it('returns false for plain <div>', () => {
    expect(isTypingTarget(document.createElement('div'))).toBe(false)
  })

  it('returns false for null', () => {
    expect(isTypingTarget(null)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test — expect fail**

```bash
npx vitest run __tests__/lib/keyboard.test.ts
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Create `lib/keyboard.ts`**

```typescript
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return target.isContentEditable
}
```

- [ ] **Step 4: Run keyboard test — expect pass**

```bash
npx vitest run __tests__/lib/keyboard.test.ts
```

Expected: PASS (6 tests).

- [ ] **Step 5: Write the failing HelpModal tests**

Create `__tests__/components/HelpModal.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HelpModal } from '../../components/HelpModal'

describe('HelpModal', () => {
  it('does not render the dialog content by default', () => {
    render(<HelpModal />)
    expect(screen.queryByText(/keyboard shortcuts/i)).toBeNull()
  })

  it('opens when "?" is pressed on document', () => {
    render(<HelpModal />)
    fireEvent.keyDown(document, { key: '?' })
    expect(screen.getByText(/keyboard shortcuts/i)).toBeInTheDocument()
  })

  it('does not open when target is an input', () => {
    render(
      <div>
        <input data-testid="search" />
        <HelpModal />
      </div>
    )
    const input = screen.getByTestId('search')
    input.focus()
    fireEvent.keyDown(input, { key: '?' })
    expect(screen.queryByText(/keyboard shortcuts/i)).toBeNull()
  })

  it('lists the documented shortcuts', () => {
    render(<HelpModal />)
    fireEvent.keyDown(document, { key: '?' })
    expect(screen.getByText('?')).toBeInTheDocument()
    expect(screen.getByText('/')).toBeInTheDocument()
    expect(screen.getByText('m')).toBeInTheDocument()
    expect(screen.getByText(/esc/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Run test — expect fail**

```bash
npx vitest run __tests__/components/HelpModal.test.tsx
```

Expected: FAIL — module does not exist.

- [ ] **Step 7: Create `components/HelpModal.tsx`**

```typescript
'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { isTypingTarget } from '@/lib/keyboard'

const SHORTCUTS: { key: string; label: string }[] = [
  { key: '?', label: 'Show this help' },
  { key: '/', label: 'Focus search (Browse page)' },
  { key: 'm', label: 'Toggle map / timeline (Browse page)' },
  { key: 'Esc', label: 'Close drawer / modal' },
]

export function HelpModal() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key !== '?') return
      if (isTypingTarget(e.target)) return
      e.preventDefault()
      setOpen(true)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="bg-[#0A0A0A] border border-[#1A1A1A] text-[#FAFAFA] max-w-md p-6">
        <DialogHeader>
          <DialogTitle className="font-mono text-base text-[#FAFAFA] text-left">
            Keyboard shortcuts
          </DialogTitle>
        </DialogHeader>
        <ul className="mt-4 space-y-3">
          {SHORTCUTS.map((s) => (
            <li key={s.key} className="flex items-center justify-between gap-4 font-mono text-sm">
              <kbd className="px-2 py-1 rounded border border-[#2A2A2A] bg-[#111111] text-[#FAFAFA] text-xs min-w-[36px] text-center">
                {s.key}
              </kbd>
              <span className="text-[#A3A3A3]">{s.label}</span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 8: Run HelpModal tests — expect pass**

```bash
npx vitest run __tests__/components/HelpModal.test.tsx
```

Expected: PASS (4 tests).

- [ ] **Step 9: Mount HelpModal inside `components/SiteNav.tsx`**

In `components/SiteNav.tsx`, add to the top imports:
```typescript
import { HelpModal } from '@/components/HelpModal'
```

Find the closing wrapper:
```typescript
      </div>
    </div>
  )
}
```

Replace with:
```typescript
      </div>
      <HelpModal />
    </div>
  )
}
```

- [ ] **Step 10: Add `m` shortcut to `components/ViewToggle.tsx`**

Find the existing imports at top and add:
```typescript
import { useEffect } from 'react'
import { isTypingTarget } from '@/lib/keyboard'
```

Inside the `ViewToggle` function body, after `const active: View = ...`, add:

```typescript
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key !== 'm' && e.key !== 'M') return
      if (isTypingTarget(e.target)) return
      e.preventDefault()
      setView(active === 'map' ? 'timeline' : 'map')
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [active])
```

(Note: `setView` is declared further down; in the actual file you'll need to either hoist it via `useCallback` or move the effect after the function declaration. Reorder if TypeScript complains.)

If `setView` cannot be referenced before declaration in the effect's closure, restructure:
```typescript
  const setView = useCallback((next: View) => {
    const updated = new URLSearchParams(params.toString())
    if (next === 'map') updated.set('view', 'map')
    else updated.delete('view')
    const qs = updated.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [params, router, pathname])

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key !== 'm' && e.key !== 'M') return
      if (isTypingTarget(e.target)) return
      e.preventDefault()
      setView(active === 'map' ? 'timeline' : 'map')
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [active, setView])
```

And import `useCallback` from React along with `useEffect`.

- [ ] **Step 11: Run full test suite + lint**

```bash
npm test && npm run lint
```

Expected: all green; 0 lint errors.

- [ ] **Step 12: Commit**

```bash
git add lib/keyboard.ts __tests__/lib/keyboard.test.ts components/HelpModal.tsx __tests__/components/HelpModal.test.tsx components/SiteNav.tsx components/ViewToggle.tsx
git commit -m "feat(shortcuts): add HelpModal (?), ViewToggle (m), and keyboard typing-target helper"
```

---

## Task 9: `IcalDownloadButton` toast

**Files:**
- Modify: `components/IcalDownloadButton.tsx`
- Modify: `__tests__/components/IcalDownloadButton.test.tsx` (if it exists; create if not)

- [ ] **Step 1: Check if a test file exists**

```bash
ls __tests__/components/IcalDownloadButton.test.tsx 2>/dev/null
```

If it does NOT exist, skip directly to Step 3 below. If it does, augment it.

- [ ] **Step 2: If a test file exists, add this test inside the `describe` block**

```typescript
  it('fires a success toast when downloading', () => {
    const toastSpy = vi.fn()
    vi.doMock('sonner', () => ({ toast: { success: toastSpy } }))
    // Re-import the component after mocking. Or, alternatively, mock at the top of the file.
    // (Simplest: spy at module scope and verify the spy was invoked after fireEvent.click on the button.)
    // See implementation below for the shape of the call.
  })
```

(If you have a clean setup with `vi.mock('sonner', ...)` already at module top, just add an assertion: `fireEvent.click(button); expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Downloaded'))`.)

If no test file exists, create one:

Create `__tests__/components/IcalDownloadButton.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const toastSuccess = vi.fn()
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: toastSuccess, error: vi.fn() }),
}))

import { IcalDownloadButton } from '../../components/IcalDownloadButton'
import type { Event, PlanItem } from '../../lib/types'

const mockEvent: Event = {
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
}

const mockItem: PlanItem = {
  event_id: 'e1',
  status: 'confirmed',
  added_via: 'manual',
  added_at: '',
}

describe('IcalDownloadButton', () => {
  it('fires a success toast when clicking the download button', () => {
    // jsdom does not support real downloads; stub URL methods
    const origCreate = URL.createObjectURL
    const origRevoke = URL.revokeObjectURL
    URL.createObjectURL = vi.fn(() => 'blob:test')
    URL.revokeObjectURL = vi.fn()
    try {
      render(<IcalDownloadButton items={[mockItem]} events={[mockEvent]} />)
      fireEvent.click(screen.getByRole('button', { name: /download \.ics/i }))
      expect(toastSuccess).toHaveBeenCalledWith(expect.stringContaining('Downloaded'))
    } finally {
      URL.createObjectURL = origCreate
      URL.revokeObjectURL = origRevoke
    }
  })
})
```

- [ ] **Step 3: Run test — expect fail (no toast wired yet)**

```bash
npx vitest run __tests__/components/IcalDownloadButton.test.tsx
```

Expected: FAIL — the component doesn't call `toast.success`.

- [ ] **Step 4: Modify `components/IcalDownloadButton.tsx`**

Add an import at the top:
```typescript
import { toast } from 'sonner'
```

Find the end of `handleDownload`:
```typescript
    URL.revokeObjectURL(url)
  }
```

Replace with:
```typescript
    URL.revokeObjectURL(url)
    toast.success(`Downloaded ${exportableCount} event${exportableCount !== 1 ? 's' : ''} to your calendar`)
  }
```

- [ ] **Step 5: Run test — expect pass**

```bash
npx vitest run __tests__/components/IcalDownloadButton.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/IcalDownloadButton.tsx __tests__/components/IcalDownloadButton.test.tsx
git commit -m "feat(toast): success toast after iCal download"
```

---

## Task 10: Final acceptance

**Files:** none. Verification only.

- [ ] **Step 1: Full test suite**

```bash
npm test
```

Expected: every test passes (Phase 6 left 191 passing; Phase 7 adds roughly 30+ new tests across these tasks).

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: clean build. The route table should now list: `/`, `/_not-found`, `/about`, `/api/concierge`, `/beyond`, `/events`, `/my-plan`, `/now`, `/plan`. Also expect `sitemap.xml`, `robots.txt`, and `opengraph-image` to appear in the build output.

- [ ] **Step 4: Inventory commits**

```bash
git log --oneline c4b9264..HEAD
```

Expected: 9 feature commits (Tasks 1–9) plus optionally smaller fixups.

- [ ] **Step 5: Manual smoke (with `npm run dev`)**

Open the running server and walk:
- `/` — see hero with "1,047 events", subtle "or see /beyond" link below CTAs, 3-step flow strip, Editor's Picks carousel cycling through 5 picks with full blurbs, VirtusLab disclosure shown on position 1, "Why we built this" with Artur signature, "What we don't do" three bullets, footer with About/Beyond links.
- `/beyond` — see 9 source cards, "Why we link the competition" footer, all Visit buttons open in new tab.
- `/about` — see four sections, initials avatar "AS", TODO comments still in source (grep `git grep "TODO: replace"`).
- `/events` — filter zero state now shows a real link to `/beyond`.
- `/events` — focus the page, press `?` → HelpModal opens with 4 shortcuts. Press Esc → closes.
- `/events` — press `m` → URL flips to `?view=map`, map renders. Press `m` again → returns to timeline.
- `/events` — press `/` → search input focuses (this was pre-existing; verify still works).
- `/my-plan` — download `.ics` → see toast "Downloaded N events to your calendar".
- Network tab: visit `/sitemap.xml` → see 7 URLs. Visit `/robots.txt` → see Allow: /, Disallow: /api/, Sitemap link. Visit `/opengraph-image` → see PNG with brand colors.
- View page source on `/events` → see `<meta property="og:url">` populated, `<link rel="canonical">` populated.

- [ ] **Step 6: Trigger an error to verify boundaries (optional)**

Temporarily throw inside `app/events/page.tsx` server function → reload → see "Couldn't load events." with Try again button. Revert.

- [ ] **Step 7: If anything needed adjustment, commit the fix**

Otherwise skip.

---

## Done criteria (matches design's Acceptance criteria)

- [ ] `/beyond` renders 9 sources from `external-sources.json`; all external links open in new tab; "Why we link the competition" paragraph present.
- [ ] `SiteNav` shows `Beyond` and `About` as live links.
- [ ] `/events` filter-zero empty state links to `/beyond`.
- [ ] Landing renders Editor's Picks with full blurbs (incl. VirtusLab disclosure); "Why we built this" + "What we don't do" sections present.
- [ ] `<VirtusLabFooter>` appears on `/`, `/about`, `/beyond`.
- [ ] `/about` renders 4 sections + initials avatar fallback + `{/* TODO: ... */}` source comments for bio and LinkedIn.
- [ ] `metadataBase` set in root layout; `/now`, `/my-plan`, `/plan`, `/beyond`, `/about` each export `metadata`.
- [ ] `/sitemap.xml` lists 7 public routes; `/robots.txt` allows `/`, disallows `/api/`.
- [ ] `/opengraph-image` returns an `ImageResponse`.
- [ ] `app/error.tsx` + 4 per-route `error.tsx` files exist and render fallback.
- [ ] `app/events/loading.tsx` renders skeleton; minimal `loading.tsx` exists for `/my-plan`, `/plan`, `/now`.
- [ ] `?` opens HelpModal globally; `m` toggles view on `/events`; both respect `isTypingTarget`.
- [ ] iCal download fires a success toast.
- [ ] `npm test` green; `npm run lint` clean; `npm run build` succeeds.

---

## Out-of-scope reminders

- Light/dark mode toggle — deferred.
- PWA + offline + deployment — Phase 8.
- Real bio copy + real LinkedIn URL + real Artur photo — post-merge edits.
- Per-route dynamic OG images — one static OG covers the site.
- Refactoring hex colors into design tokens — deferred.
