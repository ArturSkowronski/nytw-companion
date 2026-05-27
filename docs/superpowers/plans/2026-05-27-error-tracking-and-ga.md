# Error tracking + Cookieless GA4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship two related observability features in one PR — Vercel-native error capture (client + server, via `/api/log-error` → Vercel Function logs → Vercel Agent) and cookieless GA4 (`client_storage:'none'`, no PII).

**Architecture:** Pure `lib/report-error.ts` reporter posts to a thin `app/api/log-error/route.ts` endpoint that `console.error`s the payload (so Vercel logs/Agent pick it up). A small `<ErrorListeners />` client component wires `window.onerror` + `unhandledrejection`. A `<GoogleAnalytics />` client component (no-op when `NEXT_PUBLIC_GA_ID` unset) loads gtag.js via `next/script`. The global `app/error.tsx` boundary calls the reporter — the four route-level error.tsx files already delegate to it, so no per-route wiring needed. CSP gains two Google domains.

**Tech Stack:** Next 16 App Router (Node.js runtime), React 19, Zod, `next/script`, Vitest + RTL, existing Vercel Hobby deploy.

**Spec:** `docs/superpowers/specs/2026-05-27-error-tracking-and-ga-design.md`

---

## File structure

| Path | Status | Responsibility |
| --- | --- | --- |
| `lib/report-error.ts` | Create | Pure: `reportError(err, kind)` — SSR-safe no-op, truncates fields, fire-and-forget POST, never throws. |
| `__tests__/lib/report-error.test.ts` | Create | 5 tests: SSR no-op, truncation, payload shape, fetch fail swallow, non-Error values. |
| `app/api/log-error/route.ts` | Create | POST → Zod-validate → `console.error('[client-error]', JSON.stringify(payload))` → 204. GET → 405. |
| `__tests__/api/log-error-route.test.ts` | Create | 4 tests: 204 on valid, 400 on missing field, 400 on non-JSON, 405 on GET. |
| `components/ErrorListeners.tsx` | Create | `'use client'`, mounts `window.error` + `unhandledrejection` listeners via `useEffect`. Renders null. |
| `components/GoogleAnalytics.tsx` | Create | `'use client'`, renders two `next/script` tags + cookieless gtag config; null when env var unset. |
| `__tests__/components/GoogleAnalytics.test.tsx` | Create | 3 tests: renders when GA_ID set, returns null when empty, returns null when undefined. |
| `app/error.tsx` | Modify | Add `useEffect(() => reportError(error, 'boundary'), [error])`. The 4 route-level error.tsx files inherit. |
| `app/layout.tsx` | Modify | Mount `<ErrorListeners />` and `<GoogleAnalytics />` once in body. |
| `next.config.ts` | Modify | Extend `script-src` with `https://www.googletagmanager.com`; extend `connect-src` with `https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com`. |
| `README.md` | Modify | Document `NEXT_PUBLIC_GA_ID` env var. |

Reference patterns already in the repo:
- API route + Zod: `app/api/concierge/route.ts` + `lib/concierge-schema.ts`
- `next/script` + cookieless integration: `@vercel/analytics` in `app/layout.tsx` is the precedent (already cookieless; we coexist with it).
- `'use client'` + `useEffect` for one-shot SSR-safe wiring: `components/MyPlanClient.tsx` and `components/SharePlanButton.tsx`.

---

## Task 1: Error reporter library

**Files:**
- Create: `lib/report-error.ts`
- Test: `__tests__/lib/report-error.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/report-error.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { reportError, type ReportErrorPayload } from '../../lib/report-error'

const originalFetch = globalThis.fetch
const originalWindow = globalThis.window

describe('reportError', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response)
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    globalThis.window = originalWindow
    vi.unstubAllGlobals()
  })

  function readBody(): ReportErrorPayload {
    return JSON.parse(fetchMock.mock.calls[0][1].body as string) as ReportErrorPayload
  }

  it('is a no-op when window is undefined (SSR)', () => {
    vi.stubGlobal('window', undefined)
    reportError(new Error('x'), 'boundary')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('POSTs payload with message, stack, url, userAgent, kind', () => {
    const err = new Error('boom')
    err.stack = 'Error: boom\n    at test'
    reportError(err, 'boundary')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/log-error')
    expect(init.method).toBe('POST')
    const body = readBody()
    expect(body.message).toBe('boom')
    expect(body.stack).toBe('Error: boom\n    at test')
    expect(body.kind).toBe('boundary')
    expect(body.url).toContain('http')
    expect(typeof body.userAgent).toBe('string')
  })

  it('truncates message and stack to 2KB with truncated suffix', () => {
    const huge = 'x'.repeat(5000)
    const err = new Error(huge)
    err.stack = huge
    reportError(err, 'window')
    const body = readBody()
    expect(body.message.length).toBeLessThanOrEqual(2048)
    expect(body.message.endsWith('…(truncated)')).toBe(true)
    expect(body.stack!.length).toBeLessThanOrEqual(2048)
  })

  it('does not throw when fetch rejects', () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'))
    expect(() => reportError(new Error('x'), 'rejection')).not.toThrow()
  })

  it('accepts non-Error values (string, plain object)', () => {
    reportError('a plain string failure', 'rejection')
    const body = readBody()
    expect(body.message).toBe('a plain string failure')
    expect(body.stack).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run __tests__/lib/report-error.test.ts`
Expected: FAIL — `Cannot find module '../../lib/report-error'`.

- [ ] **Step 3: Implement `lib/report-error.ts`**

```ts
const MAX_FIELD_LENGTH = 2048
const TRUNCATION_SUFFIX = '…(truncated)'

export type ErrorKind = 'boundary' | 'window' | 'rejection'

export interface ReportErrorPayload {
  message: string
  stack?: string
  url?: string
  userAgent?: string
  kind: ErrorKind
}

function truncate(value: string): string {
  if (value.length <= MAX_FIELD_LENGTH) return value
  return value.slice(0, MAX_FIELD_LENGTH - TRUNCATION_SUFFIX.length) + TRUNCATION_SUFFIX
}

function normalizeError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      message: truncate(error.message || error.name || 'Unknown error'),
      stack: error.stack ? truncate(error.stack) : undefined,
    }
  }
  if (typeof error === 'string') {
    return { message: truncate(error) }
  }
  return { message: truncate(String(error)) }
}

export function reportError(error: unknown, kind: ErrorKind): void {
  if (typeof window === 'undefined') return
  const normalized = normalizeError(error)
  const payload: ReportErrorPayload = {
    ...normalized,
    kind,
    url: window.location?.href,
    userAgent: window.navigator?.userAgent,
  }
  try {
    void fetch('/api/log-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      // swallow — never throw from the reporter
    })
  } catch {
    // synchronous fetch error (rare) — swallow
  }
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run __tests__/lib/report-error.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/report-error.ts __tests__/lib/report-error.test.ts
git commit -m "feat(observability): client-side error reporter with SSR no-op and truncation"
```

---

## Task 2: `/api/log-error` route

**Files:**
- Create: `app/api/log-error/route.ts`
- Test: `__tests__/api/log-error-route.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/api/log-error-route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('POST /api/log-error', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  async function importRoute() {
    return await import('../../app/api/log-error/route')
  }

  it('returns 204 on valid payload and console.errors once with [client-error] prefix', async () => {
    const { POST } = await importRoute()
    const request = new Request('http://localhost/api/log-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'boom', kind: 'boundary' }),
    })
    const res = await POST(request)
    expect(res.status).toBe(204)
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
    expect(consoleErrorSpy.mock.calls[0][0]).toBe('[client-error]')
    expect(consoleErrorSpy.mock.calls[0][1]).toContain('"message":"boom"')
    expect(consoleErrorSpy.mock.calls[0][1]).toContain('"kind":"boundary"')
  })

  it('returns 400 when message is missing', async () => {
    const { POST } = await importRoute()
    const request = new Request('http://localhost/api/log-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'boundary' }),
    })
    const res = await POST(request)
    expect(res.status).toBe(400)
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it('returns 400 on non-JSON body', async () => {
    const { POST } = await importRoute()
    const request = new Request('http://localhost/api/log-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    })
    const res = await POST(request)
    expect(res.status).toBe(400)
  })

  it('returns 405 on GET', async () => {
    const { GET } = await importRoute()
    const res = await GET()
    expect(res.status).toBe(405)
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run __tests__/api/log-error-route.test.ts`
Expected: FAIL — `Cannot find module '../../app/api/log-error/route'`.

- [ ] **Step 3: Implement `app/api/log-error/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'

const PayloadSchema = z.object({
  message: z.string().min(1).max(4096),
  stack: z.string().max(4096).optional(),
  url: z.string().max(2048).optional(),
  userAgent: z.string().max(1024).optional(),
  kind: z.enum(['boundary', 'window', 'rejection']),
})

export async function POST(request: Request): Promise<Response> {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = PayloadSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }
  console.error('[client-error]', JSON.stringify(parsed.data))
  return new NextResponse(null, { status: 204 })
}

export async function GET(): Promise<Response> {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run __tests__/api/log-error-route.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/log-error/route.ts __tests__/api/log-error-route.test.ts
git commit -m "feat(observability): POST /api/log-error sink for client error reports"
```

---

## Task 3: Global error listeners + `app/error.tsx` wiring

**Files:**
- Create: `components/ErrorListeners.tsx`
- Modify: `app/error.tsx`

No new tests here — `ErrorListeners` is a thin composition of `useEffect`s with no branching logic (covered by Task 1's tests of the underlying reporter and Task 5/Task 6's smoke verification). The `error.tsx` change is one `useEffect` line.

- [ ] **Step 1: Create `components/ErrorListeners.tsx`**

```tsx
'use client'

import { useEffect } from 'react'
import { reportError } from '@/lib/report-error'

export function ErrorListeners() {
  useEffect(() => {
    function handleError(event: ErrorEvent) {
      reportError(event.error ?? event.message, 'window')
    }
    function handleRejection(event: PromiseRejectionEvent) {
      reportError(event.reason, 'rejection')
    }
    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleRejection)
    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleRejection)
    }
  }, [])
  return null
}
```

- [ ] **Step 2: Modify `app/error.tsx` to call the reporter**

Read the current file. Add `useEffect` import and a useEffect call inside the component. The result should be:

```tsx
'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { reportError } from '@/lib/report-error'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
  heading?: string
}

export default function GlobalError({ error, reset, heading = 'Something broke.' }: ErrorProps) {
  useEffect(() => {
    reportError(error, 'boundary')
  }, [error])

  return (
    <main className="min-h-[60vh] bg-[#000000] text-[#F5F5F5] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="font-mono text-2xl font-bold">{heading}</h1>
        <p className="font-mono text-sm text-[#9B9B9B] break-words">
          {error.message || 'Unknown error.'}
        </p>
        <div className="flex gap-3 justify-center pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="px-4 py-2 bg-[#FF5B25] text-white font-mono text-sm rounded hover:bg-[#e85a25] transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="px-4 py-2 border border-[#262626] text-[#9B9B9B] font-mono text-sm rounded hover:bg-[#0B0B0B] hover:text-[#F5F5F5] transition-colors"
          >
            Home
          </Link>
        </div>
      </div>
    </main>
  )
}
```

The four route-level error.tsx files (`app/plan/error.tsx`, `app/my-plan/error.tsx`, `app/now/error.tsx`, `app/events/error.tsx`) already `import GlobalError from '@/app/error'` and pass props through — they inherit the wiring automatically. **Do not modify them.**

- [ ] **Step 3: Run the test suite**

Run: `npx vitest run`
Expected: all existing tests pass (no new tests added in this task — Task 1 already covers the reporter).

- [ ] **Step 4: Commit**

```bash
git add components/ErrorListeners.tsx app/error.tsx
git commit -m "feat(observability): ErrorListeners + GlobalError reporter wiring"
```

---

## Task 4: Google Analytics component

**Files:**
- Create: `components/GoogleAnalytics.tsx`
- Test: `__tests__/components/GoogleAnalytics.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/components/GoogleAnalytics.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render } from '@testing-library/react'

// Mock next/script — it renders a placeholder we can query.
vi.mock('next/script', () => ({
  default: ({ src, children, id }: { src?: string; children?: string; id?: string }) => (
    <script data-testid={src ? `script-src-${id ?? 'external'}` : `script-inline-${id}`} src={src}>
      {children}
    </script>
  ),
}))

describe('GoogleAnalytics', () => {
  const original = process.env.NEXT_PUBLIC_GA_ID

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_GA_ID
    else process.env.NEXT_PUBLIC_GA_ID = original
  })

  it('renders nothing when NEXT_PUBLIC_GA_ID is unset', async () => {
    delete process.env.NEXT_PUBLIC_GA_ID
    const { GoogleAnalytics } = await import('../../components/GoogleAnalytics')
    const { container } = render(<GoogleAnalytics />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when NEXT_PUBLIC_GA_ID is empty', async () => {
    process.env.NEXT_PUBLIC_GA_ID = ''
    const { GoogleAnalytics } = await import('../../components/GoogleAnalytics')
    const { container } = render(<GoogleAnalytics />)
    expect(container.firstChild).toBeNull()
  })

  it('renders loader + init scripts with cookieless config when GA_ID is set', async () => {
    process.env.NEXT_PUBLIC_GA_ID = 'G-TEST123'
    const { GoogleAnalytics } = await import('../../components/GoogleAnalytics')
    const { container } = render(<GoogleAnalytics />)
    const html = container.innerHTML
    expect(html).toContain('googletagmanager.com/gtag/js?id=G-TEST123')
    expect(html).toContain("client_storage: 'none'")
    expect(html).toContain('anonymize_ip: true')
    expect(html).toContain('allow_google_signals: false')
    expect(html).toContain("'config', 'G-TEST123'")
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run __tests__/components/GoogleAnalytics.test.tsx`
Expected: FAIL — `Cannot find module '../../components/GoogleAnalytics'`.

- [ ] **Step 3: Implement `components/GoogleAnalytics.tsx`**

```tsx
'use client'

import Script from 'next/script'

export function GoogleAnalytics() {
  const id = process.env.NEXT_PUBLIC_GA_ID
  if (!id) return null
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${id}', {
            client_storage: 'none',
            anonymize_ip: true,
            allow_google_signals: false,
            allow_ad_personalization_signals: false,
          });
        `}
      </Script>
    </>
  )
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run __tests__/components/GoogleAnalytics.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add components/GoogleAnalytics.tsx __tests__/components/GoogleAnalytics.test.tsx
git commit -m "feat(observability): cookieless GA4 component, no-op when NEXT_PUBLIC_GA_ID unset"
```

---

## Task 5: CSP update + layout mount + README

**Files:**
- Modify: `next.config.ts`
- Modify: `app/layout.tsx`
- Modify: `README.md`

- [ ] **Step 1: Update CSP in `next.config.ts`**

Open `next.config.ts`. Find the `const csp = [` block (around line 25). Two specific lines change:

Change `script-src` from:
```
"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com",
```
to:
```
"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://www.googletagmanager.com",
```

Change `connect-src` from:
```
"connect-src 'self' https://*.supabase.co https://api.anthropic.com https://api.mapbox.com https://events.mapbox.com https://va.vercel-scripts.com https://*.vercel-analytics.com",
```
to:
```
"connect-src 'self' https://*.supabase.co https://api.anthropic.com https://api.mapbox.com https://events.mapbox.com https://va.vercel-scripts.com https://*.vercel-analytics.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com",
```

Do not touch any other CSP directive.

- [ ] **Step 2: Mount components in `app/layout.tsx`**

Find the import block at the top. Add two imports next to the existing component imports (alphabetical with the other `@/components/...` imports):

```tsx
import { ErrorListeners } from '@/components/ErrorListeners'
import { GoogleAnalytics } from '@/components/GoogleAnalytics'
```

Find the `<body …>…</body>` block. Currently it contains `<SiteJsonLd />`, `<StatusBar />`, `<SiteNav />`, `{children}`, `<MyPlanWidget />`, `<PartnerToastTrigger />`, `<Toaster …/>`, `<Analytics />`. Mount the two new components inside `<body>` — `<GoogleAnalytics />` near the top (early load), `<ErrorListeners />` anywhere in body. After the change the body's first lines look like:

```tsx
      <body
        className="bg-[#000000] text-[#F5F5F5] font-sans antialiased min-h-screen"
        suppressHydrationWarning
      >
        <GoogleAnalytics />
        <ErrorListeners />
        <SiteJsonLd />
        <StatusBar />
        <SiteNav />
        {children}
        ...
```

Leave everything below unchanged.

- [ ] **Step 3: Document the env var in `README.md`**

Open `README.md`. Append (or insert into an existing "Environment variables" / "Configuration" section if one exists; otherwise append at end):

```markdown
## Environment variables

| Name | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_GA_ID` | Optional | GA4 Measurement ID (e.g. `G-XXXXXXXXXX`). When unset, no GA script is injected and no analytics requests fire. Set in Vercel Production env to enable. |
```

If an env-vars table already exists in the README, add the new row in alphabetical order and skip the heading. Use your judgement — the goal is one discoverable place documenting this var.

- [ ] **Step 4: Run lint + full test suite**

```bash
npm run lint && npx vitest run
```
Expected: lint clean, all tests pass (count up from 314 by the tests added in Tasks 1, 2, 4 = 5 + 4 + 3 = 12 new; total around 326).

- [ ] **Step 5: Build to verify the route table and CSP**

```bash
npm run build
```
Expected: build completes; route table includes `/api/log-error`. No CSP-related warnings.

- [ ] **Step 6: Commit**

```bash
git add next.config.ts app/layout.tsx README.md
git commit -m "feat(observability): wire ErrorListeners + GoogleAnalytics into layout, extend CSP, document GA_ID"
```

---

## Task 6: Push, watch CI, post-deploy smoke

- [ ] **Step 1: Push**

```bash
git push origin main
```

- [ ] **Step 2: Watch CI**

```bash
gh run watch $(gh run list --limit 1 --json databaseId --jq '.[0].databaseId') --exit-status
```

Expected: lint+test, e2e, and lighthouse jobs all green.

- [ ] **Step 3: Set `NEXT_PUBLIC_GA_ID` in Vercel**

In the Vercel dashboard → Project → Settings → Environment Variables, add `NEXT_PUBLIC_GA_ID` with the production GA4 Measurement ID under the **Production** environment (and optionally **Preview** if you want preview pageviews tracked, but typically you don't). Then trigger a redeploy of the latest production deployment so the env var is baked in.

If no GA4 property exists yet, create one in https://analytics.google.com → "Admin" → "Create" → property → "Web" data stream → copy the Measurement ID.

- [ ] **Step 4: Post-deploy smoke**

Once the redeploy is live:

a. **Pageview hit + no cookies:**
```bash
curl -sI https://nytw.dev/ | grep -i "set-cookie"
```
Expected: no `_ga`, no `_gid`. (There may be other cookies from middleware — only Google's are what we care about.)

Then in a real browser: open `https://nytw.dev/`. DevTools → Network → filter `google-analytics`. Expect a `g/collect` request returning 2xx. DevTools → Application → Cookies → no `_ga*`, no Google-set entries.

b. **Client error → Vercel logs:**

In DevTools Console on `https://nytw.dev/`, run:
```js
const tag = 'observability-smoke-' + Date.now()
console.log('Looking for tag:', tag)
throw new Error(tag)
```

Wait ~5s. In Vercel dashboard → Logs (Production), search for the `tag` value. Expect a line:
```
[client-error] {"message":"observability-smoke-…","stack":"...","kind":"window","url":"https://nytw.dev/","userAgent":"..."}
```

c. **Error boundary hit:** open `https://nytw.dev/my-plan` with the localStorage manually corrupted (`localStorage.setItem('nytw-my-plan', '{"corrupted')`) and reload. The error UI should render and a `[client-error]` line with `kind:"boundary"` should land in Vercel logs.

If any of a/b/c fails, stop and investigate (likely candidates: CSP blocking GA, env var typo, route deployed without env var baked in).

---

## Self-review

**Spec coverage:**
- `/api/log-error` POST + Zod validation + 204/400/405 → Task 2.
- Client reporter (SSR no-op, truncation, never throws) → Task 1.
- Global window listeners → Task 3 (`ErrorListeners`).
- `error.tsx` boundary wiring → Task 3 (`app/error.tsx` modification). Spec noted "5× error.tsx" but on inspection the four route-level files already delegate to `app/error.tsx`, so only the global file needs the `useEffect`.
- `<GoogleAnalytics />` with cookieless config + no-op when unset → Task 4.
- CSP additions (Google domains in script-src and connect-src) → Task 5 Step 1.
- Layout mounts both components → Task 5 Step 2.
- README env-var doc → Task 5 Step 3.
- Out-of-scope items (Sentry, alerting, source map upload, custom events, rate limiting) → no tasks, by design.

**Placeholder scan:** No `TBD`, no `TODO`, no "fill in details", no "similar to Task N". Every code block is complete. Every command lists expected output.

**Type consistency:**
- `ErrorKind` defined in Task 1 (`'boundary' \| 'window' \| 'rejection'`) and used in Task 2's Zod enum, Task 3's `ErrorListeners`, and the `useEffect` in Task 3's `app/error.tsx`.
- `ReportErrorPayload` shape in Task 1 matches the Zod schema in Task 2 (same field names, optionality, kind enum values).
- `reportError(error, kind)` signature is identical across Task 1's definition, Task 3's `ErrorListeners` and `app/error.tsx`, and the tests.
- `process.env.NEXT_PUBLIC_GA_ID` referenced consistently in Task 4 (component), Task 5 Step 3 (README), Task 6 Step 3 (Vercel dashboard).
- CSP domains in Task 5 Step 1 exactly match the spec.
