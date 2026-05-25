# Phase 8a — PWA + deploy prep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the code-side parts of v1.8 — install Serwist (Next 16 PWA), an offline fallback page, generated brand icons, a healthcheck route, Vercel Analytics, and a real README. Deployment infrastructure is deferred to Phase 8b where the user drives the Vercel dashboard.

**Architecture:** Module-per-surface. Each task is a self-contained slice with TDD. Tasks 1–2 set up Serwist. Task 3 ships the offline page. Task 4 generates brand icons. Task 5 ships the healthcheck. Task 6 mounts Vercel Analytics. Task 7 updates README + .env.example. Task 8 is acceptance.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, `@serwist/next` + `serwist` (Workbox-based service worker), `sharp` (icon generation, devDep), `@vercel/analytics`, Vitest + Testing Library.

**Reference design:** `docs/superpowers/specs/2026-05-25-phase-8a-pwa-and-deploy-prep-design.md`

---

## Conventions

- All new components are `'use client'` only if they need state/effects. Server components by default.
- Brand colors: bg `#0A0A0A`, surface `#111111`, border `#1A1A1A` / `#2A2A2A`, fg `#FAFAFA`, muted `#A3A3A3`, dim `#555555`/`#666666`, accent `#FF6B35`.
- One commit per task.
- The codebase uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` (verified in `lib/supabase/server.ts`), not a service-role key. The plan reflects that.

---

## Pre-flight: codebase reality

Already true; do not re-do:

- `public/manifest.json` exists and is correct.
- `app/layout.tsx` references `manifest: '/manifest.json'`.
- `NowClient.tsx` already has the real-time clock and geolocation flow.
- `lib/plan-store.ts` is local-only (zustand+localStorage). No remote sync needed.
- `public/icons/` contains only `README.md`; PNGs missing → Task 4 fills them.
- `next.config.ts` is empty → Task 2 fills it.
- `next-pwa@^5.6.0` is in `package.json` but **not imported anywhere** (verified by `grep -r "next-pwa" .`). Task 1 removes it.

---

## Task 1: Dependency swap — install Serwist, sharp, @vercel/analytics; remove next-pwa

**Files:**
- Modify: `package.json`

This task touches only dependencies. No code; no test. The verification gate is `npm install` succeeding and `npm test` still passing.

- [ ] **Step 1: Edit `package.json` dependencies**

Open `/Users/askowronski/Projects/nytw-companion/package.json`.

Remove this line from `dependencies`:
```jsonc
"next-pwa": "^5.6.0",
```

Add these two lines to `dependencies` (alphabetical order; place after the entry for `next` or wherever fits):
```jsonc
"@serwist/next": "^9.0.0",
"serwist": "^9.0.0",
"@vercel/analytics": "^1.4.0",
```

Add to `devDependencies` (alphabetical order):
```jsonc
"sharp": "^0.34.0"
```

- [ ] **Step 2: Run `npm install`**

```bash
cd /Users/askowronski/Projects/nytw-companion && npm install
```

Expected: install completes; `node_modules/@serwist`, `node_modules/serwist`, `node_modules/sharp`, `node_modules/@vercel/analytics` exist; no `node_modules/next-pwa`.

If any of the version pins fail to resolve (e.g., a new major dropped), fall back to the major's `latest` tag — `npm install @serwist/next@latest serwist@latest sharp@latest @vercel/analytics@latest`. Update the version strings in `package.json` to match what was installed.

- [ ] **Step 3: Verify next-pwa is gone**

```bash
cd /Users/askowronski/Projects/nytw-companion && npm ls next-pwa 2>&1
```

Expected: either `(empty)` or non-zero exit with "not found" — anything that proves no `next-pwa` in the tree.

Also confirm no source still imports it:
```bash
cd /Users/askowronski/Projects/nytw-companion && grep -r "from 'next-pwa'\|require('next-pwa')\|\"next-pwa\"" --include='*.ts' --include='*.tsx' --include='*.js' --include='*.mjs' . 2>/dev/null | grep -v node_modules | grep -v package-lock.json | grep -v docs/
```

Expected: empty output.

- [ ] **Step 4: Run the existing test suite — expect all still green**

```bash
cd /Users/askowronski/Projects/nytw-companion && npm test 2>&1 | tail -10
```

Expected: all tests pass (236+ from Phase 7 baseline).

- [ ] **Step 5: Commit**

```bash
cd /Users/askowronski/Projects/nytw-companion && git add package.json package-lock.json && git commit -m "chore(deps): swap next-pwa for @serwist/next; add sharp + @vercel/analytics"
```

---

## Task 2: Service worker source + Serwist wiring

**Files:**
- Create: `app/sw.ts`
- Modify: `next.config.ts`

Per the spec, the service worker source is NOT unit-tested (it references worker-only globals). The verification gate is `npm run build` producing `public/sw.js`.

- [ ] **Step 1: Create `app/sw.ts`**

```typescript
import { defaultCache } from '@serwist/next/worker'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { Serwist } from 'serwist'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Mapbox tiles — cache-first, expire after 7 days, cap entries.
    {
      matcher: ({ url }) => url.origin === 'https://api.mapbox.com',
      handler: 'CacheFirst',
      options: {
        cacheName: 'mapbox-tiles',
        expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
    // /api/concierge — never cache (cost-bearing AI call).
    {
      matcher: ({ url, sameOrigin }) =>
        sameOrigin && url.pathname.startsWith('/api/concierge'),
      handler: 'NetworkOnly',
    },
    // Everything else same-origin → Serwist defaults (stale-while-revalidate).
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: '/offline',
        matcher: ({ request }) => request.destination === 'document',
      },
    ],
  },
})

serwist.addEventListeners()
```

- [ ] **Step 2: Replace `next.config.ts`**

Find the existing content:
```typescript
// next.config.ts
// next-pwa full service worker config is done in Phase 8.
// Manifest is wired up via app/layout.tsx metadata.manifest.
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {}

export default nextConfig
```

Replace with:
```typescript
// next.config.ts
import type { NextConfig } from 'next'
import withSerwistInit from '@serwist/next'

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
  reloadOnOnline: true,
})

const nextConfig: NextConfig = {}

export default withSerwist(nextConfig)
```

- [ ] **Step 3: Ignore the built `public/sw.js` in git**

Add to `.gitignore` (at the end if there's a blank line, otherwise append a new line):

```
# Service worker (generated by Serwist on build)
public/sw.js
public/sw.js.map
public/swe-worker-*.js
public/workbox-*.js
```

(The exact filenames Serwist emits may vary; the patterns above cover all of them.)

- [ ] **Step 4: Build and verify the service worker is generated**

```bash
cd /Users/askowronski/Projects/nytw-companion && npm run build 2>&1 | tail -30
```

Expected: build succeeds. After it completes:

```bash
cd /Users/askowronski/Projects/nytw-companion && ls -la public/sw.js
```

Expected: `public/sw.js` exists.

If the build fails with a Serwist-related error, common fixes:
- The `import withSerwistInit from '@serwist/next'` may need a different shape per the major. If the version is newer than `^9`, check the upstream README for the current default-export shape.
- If TypeScript complains about `self.__SW_MANIFEST`, ensure `app/sw.ts` is *not* picked up by the Next page-router compiler. Serwist treats `swSrc` specially.

- [ ] **Step 5: Run the existing test suite — expect still green**

```bash
cd /Users/askowronski/Projects/nytw-companion && npm test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/askowronski/Projects/nytw-companion && git add app/sw.ts next.config.ts .gitignore && git commit -m "feat(pwa): add Serwist service worker with Mapbox cache + concierge no-cache + /offline fallback"
```

---

## Task 3: Offline fallback page

**Files:**
- Create: `app/offline/page.tsx`
- Create: `__tests__/app/offline.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/app/offline.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import OfflinePage from '../../app/offline/page'

describe('/offline', () => {
  it('renders the offline heading and lede', () => {
    render(<OfflinePage />)
    expect(screen.getByRole('heading', { level: 1, name: /you're offline/i })).toBeInTheDocument()
    expect(screen.getByText(/can't reach the network/i)).toBeInTheDocument()
  })

  it('renders links to My Plan, Now, and Browse', () => {
    render(<OfflinePage />)
    expect(screen.getByRole('link', { name: /my plan/i })).toHaveAttribute('href', '/my-plan')
    expect(screen.getByRole('link', { name: /^now$/i })).toHaveAttribute('href', '/now')
    expect(screen.getByRole('link', { name: /browse events/i })).toHaveAttribute('href', '/events')
  })

  it('renders the VirtusLabFooter (not-affiliated text)', () => {
    render(<OfflinePage />)
    expect(screen.getByText(/not affiliated with a16z or tech week nyc/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test — expect fail**

```bash
cd /Users/askowronski/Projects/nytw-companion && npx vitest run __tests__/app/offline.test.tsx
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Create `app/offline/page.tsx`**

```typescript
import type { Metadata } from 'next'
import Link from 'next/link'
import { VirtusLabFooter } from '@/components/VirtusLabFooter'

export const metadata: Metadata = {
  title: "Offline — NYTW Engineer's Companion",
  description: "You're offline. Some pages may still work from local cache.",
  robots: { index: false },
}

const LINKS = [
  { href: '/my-plan', label: 'My Plan', hint: 'Works offline natively (stored in your browser).' },
  { href: '/now', label: 'Now', hint: "Works offline if you've visited it before." },
  { href: '/events', label: 'Browse events', hint: "Works offline if you've visited it before." },
]

export default function OfflinePage() {
  return (
    <main className="min-h-screen bg-[#0A0A0A] text-[#FAFAFA]">
      <section className="max-w-2xl mx-auto px-6 py-16 space-y-8">
        <div className="space-y-3">
          <h1 className="font-mono text-3xl md:text-4xl font-bold">You&apos;re offline.</h1>
          <p className="text-[#A3A3A3] text-base leading-relaxed">
            We can&apos;t reach the network right now. The pages you&apos;ve already visited should still work.
          </p>
        </div>

        <ul className="space-y-4">
          {LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="block rounded-lg border border-[#1A1A1A] bg-[#111111] p-5 hover:border-[#FF6B35] transition-colors"
              >
                <p className="font-mono text-lg text-[#FAFAFA]">{link.label} →</p>
                <p className="text-[#A3A3A3] text-sm mt-1">{link.hint}</p>
              </Link>
            </li>
          ))}
        </ul>

        <p className="text-[#555555] text-sm font-mono">
          When you&apos;re back online, everything reconnects automatically.
        </p>
      </section>

      <VirtusLabFooter />
    </main>
  )
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd /Users/askowronski/Projects/nytw-companion && npx vitest run __tests__/app/offline.test.tsx
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/askowronski/Projects/nytw-companion && git add app/offline/page.tsx __tests__/app/offline.test.tsx && git commit -m "feat(pwa): add /offline fallback page with My Plan / Now / Browse links"
```

---

## Task 4: Icon generation (source SVG + script + PNGs)

**Files:**
- Create: `public/icons/icon-source.svg`
- Create: `scripts/generate-icons.mjs`
- Modify: `public/icons/README.md`
- Modify: `package.json` (add `icons` script)
- Generated + committed: `public/icons/icon-192x192.png`, `public/icons/icon-512x512.png`
- Create: `__tests__/scripts/generate-icons.test.ts`

- [ ] **Step 1: Create `public/icons/icon-source.svg`**

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <!-- Background: rounded square in brand black -->
  <rect width="512" height="512" rx="96" fill="#0A0A0A"/>
  <!-- Brand glyph: orange ≡ centered, large -->
  <text x="256" y="232" text-anchor="middle"
        font-family="ui-monospace, SFMono-Regular, Menlo, monospace"
        font-size="200" font-weight="800" fill="#FF6B35">≡</text>
  <!-- Wordmark below -->
  <text x="256" y="380" text-anchor="middle"
        font-family="ui-monospace, SFMono-Regular, Menlo, monospace"
        font-size="84" font-weight="800" fill="#FAFAFA">NYTW</text>
</svg>
```

- [ ] **Step 2: Create `scripts/generate-icons.mjs`**

```javascript
import { mkdir, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(__dirname, '..', 'public', 'icons', 'icon-source.svg')
const OUT_DIR = resolve(__dirname, '..', 'public', 'icons')

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const svg = await readFile(SRC)
  for (const size of [192, 512]) {
    const out = resolve(OUT_DIR, `icon-${size}x${size}.png`)
    await sharp(svg).resize(size, size).png().toFile(out)
    console.log(`wrote ${out}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 3: Add the `icons` script to `package.json`**

In `/Users/askowronski/Projects/nytw-companion/package.json`, in the `"scripts"` object, add this line (alongside existing `dev`, `build`, `start`, `lint`, `test`):

```jsonc
"icons": "node scripts/generate-icons.mjs",
```

- [ ] **Step 4: Run the generator to produce the PNGs**

```bash
cd /Users/askowronski/Projects/nytw-companion && npm run icons
```

Expected output:
```
wrote /Users/askowronski/Projects/nytw-companion/public/icons/icon-192x192.png
wrote /Users/askowronski/Projects/nytw-companion/public/icons/icon-512x512.png
```

Verify the files:
```bash
cd /Users/askowronski/Projects/nytw-companion && ls -la public/icons/icon-*.png
```

Expected: both PNG files exist and are non-zero size.

If sharp fails to install or render — common cause is platform-specific binaries missing — fix it then retry. The PNGs MUST be committed; they're shipping artifacts.

- [ ] **Step 5: Replace `public/icons/README.md`**

```markdown
# PWA icons

Source: `icon-source.svg` (committed).
Generated by: `npm run icons` → produces `icon-192x192.png` and `icon-512x512.png`.

Both PNGs are committed to the repo so deploys don't depend on `sharp` being installable in CI.

To change the brand mark: edit `icon-source.svg` and re-run `npm run icons`. Commit the regenerated PNGs alongside the SVG.

Referenced by `public/manifest.json` (`/icons/icon-192x192.png` and `/icons/icon-512x512.png`).
```

- [ ] **Step 6: Write the test**

Create `__tests__/scripts/generate-icons.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '..', '..')

describe('PWA icons', () => {
  it('icon-source.svg exists and is non-empty', () => {
    const p = resolve(ROOT, 'public/icons/icon-source.svg')
    expect(existsSync(p)).toBe(true)
    expect(statSync(p).size).toBeGreaterThan(100)
  })

  it('icon-192x192.png exists and is non-empty (committed)', () => {
    const p = resolve(ROOT, 'public/icons/icon-192x192.png')
    expect(existsSync(p)).toBe(true)
    expect(statSync(p).size).toBeGreaterThan(500)
  })

  it('icon-512x512.png exists and is non-empty (committed)', () => {
    const p = resolve(ROOT, 'public/icons/icon-512x512.png')
    expect(existsSync(p)).toBe(true)
    expect(statSync(p).size).toBeGreaterThan(500)
  })

  it('generator script exists', () => {
    const p = resolve(ROOT, 'scripts/generate-icons.mjs')
    expect(existsSync(p)).toBe(true)
  })
})
```

- [ ] **Step 7: Run tests — expect pass**

```bash
cd /Users/askowronski/Projects/nytw-companion && npx vitest run __tests__/scripts/generate-icons.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 8: Commit**

```bash
cd /Users/askowronski/Projects/nytw-companion && git add public/icons/icon-source.svg scripts/generate-icons.mjs public/icons/README.md package.json public/icons/icon-192x192.png public/icons/icon-512x512.png __tests__/scripts/generate-icons.test.ts && git commit -m "feat(pwa): add brand-mark SVG source + generator script + committed 192/512 PNG icons"
```

---

## Task 5: Healthcheck route

**Files:**
- Create: `app/api/health/route.ts`
- Create: `__tests__/api/health.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/api/health.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const originalAnthropicKey = process.env.ANTHROPIC_API_KEY
const originalCommitSha = process.env.VERCEL_GIT_COMMIT_SHA

beforeEach(() => {
  vi.resetModules()
  vi.unstubAllEnvs()
  delete process.env.NEXT_PUBLIC_SUPABASE_URL
  delete process.env.ANTHROPIC_API_KEY
  delete process.env.VERCEL_GIT_COMMIT_SHA
})

afterEach(() => {
  if (originalSupabaseUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl
  if (originalAnthropicKey !== undefined) process.env.ANTHROPIC_API_KEY = originalAnthropicKey
  if (originalCommitSha !== undefined) process.env.VERCEL_GIT_COMMIT_SHA = originalCommitSha
})

describe('GET /api/health', () => {
  it('returns 200 with both checks skipped when no env is set', async () => {
    const { GET } = await import('../../app/api/health/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.checks.supabase).toBe('skipped')
    expect(body.checks.anthropic).toBe('skipped')
    expect(body.version).toBe('dev')
    expect(typeof body.timestamp).toBe('string')
  })

  it('reports anthropic ok when ANTHROPIC_API_KEY is set', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test'
    const { GET } = await import('../../app/api/health/route')
    const res = await GET()
    const body = await res.json()
    expect(body.checks.anthropic).toBe('ok')
  })

  it('uses VERCEL_GIT_COMMIT_SHA for version when set', async () => {
    process.env.VERCEL_GIT_COMMIT_SHA = 'abc1234'
    const { GET } = await import('../../app/api/health/route')
    const res = await GET()
    const body = await res.json()
    expect(body.version).toBe('abc1234')
  })

  it('reports supabase fail and returns 503 when client throws', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co'
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: async () => {
        throw new Error('boom')
      },
    }))
    const { GET } = await import('../../app/api/health/route')
    const res = await GET()
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.checks.supabase).toBe('fail')
    expect(body.status).toBe('degraded')
  })

  it('reports supabase ok and returns 200 when client query succeeds', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co'
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: async () => ({
        from: () => ({
          select: () => ({
            limit: () => ({ error: null, count: 1 }),
          }),
        }),
      }),
    }))
    const { GET } = await import('../../app/api/health/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.checks.supabase).toBe('ok')
    expect(body.status).toBe('ok')
  })
})
```

- [ ] **Step 2: Run test — expect fail**

```bash
cd /Users/askowronski/Projects/nytw-companion && npx vitest run __tests__/api/health.test.ts
```

Expected: FAIL — route does not exist.

- [ ] **Step 3: Create `app/api/health/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type CheckStatus = 'ok' | 'skipped' | 'fail'

async function checkSupabase(): Promise<CheckStatus> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return 'skipped'
  try {
    const supabase = await createClient()
    // Light ping: ask for a single row, ignore the data.
    // 2-second cap via Promise.race; the supabase-js abortSignal API varies by version.
    const query = supabase.from('events').select('id').limit(1)
    const timeout = new Promise<{ error: { message: string } }>((resolve) =>
      setTimeout(() => resolve({ error: { message: 'timeout' } }), 2000)
    )
    const result = (await Promise.race([query, timeout])) as { error: unknown }
    return result.error ? 'fail' : 'ok'
  } catch {
    return 'fail'
  }
}

function checkAnthropic(): CheckStatus {
  return process.env.ANTHROPIC_API_KEY ? 'ok' : 'skipped'
}

export async function GET() {
  const checks = {
    supabase: await checkSupabase(),
    anthropic: checkAnthropic(),
  }
  const hasFailure = Object.values(checks).includes('fail')
  const status: 'ok' | 'degraded' = hasFailure ? 'degraded' : 'ok'
  const body = {
    status,
    timestamp: new Date().toISOString(),
    checks,
    version: process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev',
  }
  return NextResponse.json(body, { status: hasFailure ? 503 : 200 })
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd /Users/askowronski/Projects/nytw-companion && npx vitest run __tests__/api/health.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/askowronski/Projects/nytw-companion && git add app/api/health/route.ts __tests__/api/health.test.ts && git commit -m "feat(health): add /api/health route with Supabase ping + Anthropic key presence + version"
```

---

## Task 6: Mount Vercel Analytics

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Modify `app/layout.tsx`**

Read `/Users/askowronski/Projects/nytw-companion/app/layout.tsx`.

Add this import near the top, with the other component imports (after `import { Toaster } from '@/components/ui/sonner'`):

```typescript
import { Analytics } from '@vercel/analytics/next'
```

In the JSX body, add `<Analytics />` right after the existing `<Toaster ... />` element. Look for:

```tsx
        <Toaster
          theme="dark"
          toastOptions={{
            classNames: {
              toast: 'bg-[#111111] border border-[#2A2A2A] text-[#FAFAFA] font-mono text-sm',
            },
          }}
        />
```

Add immediately after the closing `/>`:
```tsx
        <Analytics />
```

If `@vercel/analytics/next` doesn't resolve at TypeScript time (the package may expose `/react` only in some versions), change the import to:
```typescript
import { Analytics } from '@vercel/analytics/react'
```

Use whichever resolves cleanly. Document your choice in the commit message if you needed to switch.

- [ ] **Step 2: Run the full test suite — expect still green**

```bash
cd /Users/askowronski/Projects/nytw-companion && npm test 2>&1 | tail -10
```

Expected: all tests pass. Analytics is a no-op outside Vercel; it shouldn't affect any test.

- [ ] **Step 3: Lint**

```bash
cd /Users/askowronski/Projects/nytw-companion && npm run lint 2>&1 | tail -10
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/askowronski/Projects/nytw-companion && git add app/layout.tsx && git commit -m "feat(analytics): mount @vercel/analytics in root layout"
```

---

## Task 7: README + .env.example

**Files:**
- Create or overwrite: `README.md`
- Create: `.env.example`

No test file. The verification gate is that the README renders correctly on GitHub (we can't test that in unit) and `.env.example` exists.

- [ ] **Step 1: Create `.env.example`**

```bash
# Required in production — used by Phase 7 SEO (canonical URLs, sitemap, OG image).
# Defaults to http://localhost:3000 when unset.
NEXT_PUBLIC_SITE_URL=

# Optional — when set, the app reads events from Supabase instead of data/seed-events.json.
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Optional — when set, the AI Concierge calls Claude. Otherwise serves deterministic mock proposals.
ANTHROPIC_API_KEY=

# Optional — when set, the map view renders real Mapbox tiles. Without it the map is disabled.
NEXT_PUBLIC_MAPBOX_TOKEN=
```

- [ ] **Step 2: Read the existing README**

```bash
cd /Users/askowronski/Projects/nytw-companion && cat README.md
```

Take note of any sections to preserve (e.g., existing license/badges). The next step replaces the whole file; merge any preserved content back into the new structure.

- [ ] **Step 3: Replace `README.md`**

Write the following to `/Users/askowronski/Projects/nytw-companion/README.md`:

```markdown
# NYTW Engineer's Companion

87 hand-curated engineering events for Tech Week NYC 2026 (June 1–7). One engineer's opinionated cut across AI infra, devtools, platform engineering, security, and open source — day-grouped, mapped, with honest blurbs on the Editor's Picks. AI Concierge proposes additions based on a user profile.

Live at: (set after Vercel deploy)

## Local development

Prerequisites: Node 22+, npm.

```bash
git clone <repo-url>
cd nytw-companion
npm install
cp .env.example .env.local   # fill optional vars (Supabase, Anthropic, Mapbox)
npm run dev                   # http://localhost:3000
```

Without any env vars the app runs in **seed-fallback mode**: events come from `data/seed-events.json`, the AI Concierge returns deterministic mock proposals, and the map view shows a "Map disabled" notice. Good for design / demo work; nothing breaks.

## Project structure

```
app/                — Next.js 16 App Router routes
  (marketing)/       landing, /beyond, /about
  api/               /api/concierge, /api/health
  events/, my-plan/, now/, plan/, offline/
  sw.ts              service worker source (Serwist)
  sitemap.ts, robots.ts, opengraph-image.tsx
components/         — UI primitives + feature components
  filters/           filter drawer + chips
  ui/                shadcn primitives over Base UI
data/               — seed-events.json (source of truth for events)
docs/superpowers/   — spec + plan docs per phase
lib/                — pure logic (filters, plan-store, time, anthropic, keyboard, site-url)
public/             — manifest.json, generated /sw.js, icons/
scripts/            — generate-icons.mjs
```

## Data update workflow

1. Edit `data/seed-events.json` (or change Supabase rows if production DB is wired).
2. Commit + push.
3. Vercel auto-deploys → new events live in ~2 minutes.

For Supabase production: the seed file is still the source of truth; populate the DB by running an idempotent upsert script (not in this repo yet; planned for Phase 8b).

## Scripts

| Script               | What it does                                       |
|----------------------|----------------------------------------------------|
| `npm run dev`        | Next dev server (service worker disabled in dev)  |
| `npm run build`      | Production build (also generates `public/sw.js`)  |
| `npm run start`      | Production server (requires `npm run build` first)|
| `npm test`           | Vitest run                                         |
| `npm run lint`       | ESLint                                             |
| `npm run icons`      | Regenerate PWA icons from `public/icons/icon-source.svg` |

## Deployment

Connected to Vercel (the wiring itself is done in the Vercel dashboard, not in this repo).

- **Production branch:** `main`
- **Preview:** every PR / non-main branch
- **Required env (prod):** `NEXT_PUBLIC_SITE_URL` (e.g. `https://nytw-companion.vercel.app`)
- **Optional env:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_MAPBOX_TOKEN`
- **Custom domain:** configured in Vercel dashboard. (`nytw.dev` is the preferred target per SPEC.)

## Healthcheck

```
GET /api/health
→ 200 { "status": "ok", "timestamp": "...", "checks": { "supabase": "ok|skipped|fail", "anthropic": "ok|skipped" }, "version": "<git sha>|dev" }
→ 503 when any check is "fail"
```

Use this for Vercel preview smoke verification and uptime monitoring.

## PWA

Installable from any modern browser. Service worker handles offline navigation fallback to `/offline`. Map tiles are cached for 7 days. AI Concierge calls are never cached. My Plan storage is local (zustand + localStorage) so it works fully offline.

## Documentation

Phase-by-phase design + plan docs live in `docs/superpowers/`:

- `specs/` — design briefs (one per phase)
- `plans/` — TDD implementation plans (one per phase)

## License

(TBD — set before public launch.)
```

(Note: this README assumes the existing repo has no license file yet. If a license already exists, link to it.)

- [ ] **Step 4: Verify the README + env example exist**

```bash
cd /Users/askowronski/Projects/nytw-companion && ls -la README.md .env.example
```

Expected: both files exist.

- [ ] **Step 5: Run lint + tests — sanity check (no regression)**

```bash
cd /Users/askowronski/Projects/nytw-companion && npm test 2>&1 | tail -5
cd /Users/askowronski/Projects/nytw-companion && npm run lint 2>&1 | tail -5
```

Expected: tests still green; 0 lint errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/askowronski/Projects/nytw-companion && git add README.md .env.example && git commit -m "docs: rewrite README with local dev, deploy, scripts, healthcheck; add .env.example"
```

---

## Task 8: Final acceptance

**Files:** none. Verification only.

- [ ] **Step 1: Full test suite**

```bash
cd /Users/askowronski/Projects/nytw-companion && npm test 2>&1 | tail -10
```

Expected: all tests green. Phase 7 left 236; Phase 8a adds:
- Task 3 offline: 3 tests
- Task 4 icons: 4 tests
- Task 5 health: 5 tests

Total ≈ 248.

- [ ] **Step 2: Lint**

```bash
cd /Users/askowronski/Projects/nytw-companion && npm run lint 2>&1 | tail -10
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 3: Build (also produces the service worker)**

```bash
cd /Users/askowronski/Projects/nytw-companion && npm run build 2>&1 | tail -30
```

Expected: clean build. The route table should now also list:
- `/offline`
- `/api/health`

Plus the service worker should appear in `public/sw.js`:

```bash
cd /Users/askowronski/Projects/nytw-companion && ls -la public/sw.js
```

Expected: file exists, non-zero size.

- [ ] **Step 4: Inventory commits**

```bash
cd /Users/askowronski/Projects/nytw-companion && git log --oneline 7ee1eb2..HEAD
```

Expected: 7 feature commits + optional fixups (Tasks 1–7).

- [ ] **Step 5: Manual smoke (`npm run start` after `npm run build`)**

```bash
cd /Users/askowronski/Projects/nytw-companion && npm run build && npm run start
```

(Or use `npm run dev` and note that the service worker is disabled in dev.)

Open browser:
- Visit `/api/health` — JSON response with `{ status, timestamp, checks: { supabase, anthropic }, version }`.
- DevTools → Application → Manifest — manifest renders, icons load (192 + 512).
- DevTools → Application → Service Workers — service worker registered and activated.
- Visit `/offline` directly — page renders with three CTA links.
- DevTools → Network → set "Offline" → reload `/events` → service worker should serve from cache; for an un-cached route reload, the fallback `/offline` should appear.
- DevTools → Application → Storage → Cache Storage — see precache + runtime caches.

- [ ] **Step 6: If anything needed adjustment, commit the fix**

Otherwise skip.

---

## Done criteria

- [ ] `next-pwa` removed from `package.json`. No source imports it.
- [ ] `@serwist/next` + `serwist` + `sharp` (devDep) + `@vercel/analytics` installed.
- [ ] `app/sw.ts` exists; `next.config.ts` wires `withSerwist`; `npm run build` produces `public/sw.js`.
- [ ] `app/offline/page.tsx` renders with My Plan / Now / Browse links and the VirtusLabFooter.
- [ ] `public/icons/icon-source.svg`, `icon-192x192.png`, `icon-512x512.png` committed; `npm run icons` regenerates the PNGs from the SVG.
- [ ] `GET /api/health` returns the documented JSON shape; 200/503 status semantics correct.
- [ ] `<Analytics />` mounted in `app/layout.tsx`.
- [ ] `README.md` rewritten; `.env.example` lists all five env vars with one-line comments.
- [ ] `npm test` green; `npm run lint` clean (0 errors, 0 warnings); `npm run build` succeeds.
- [ ] All previously-passing tests still pass.

## Out-of-scope reminders (for Phase 8b or later)

- Vercel project creation + env-var entry in dashboard.
- Custom domain DNS configuration.
- Sentry project + DSN + SDK + source-map upload.
- Vercel Cron `vercel.json` + `/api/cron/refresh` route.
- Production Supabase wiring + initial DB seed.
- Lighthouse audit (Phase 9 — pre-launch QA).
