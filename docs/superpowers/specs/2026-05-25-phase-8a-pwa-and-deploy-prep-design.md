# Phase 8a — PWA + deploy prep (Design)

**Status:** Draft for review
**Date:** 2026-05-25
**Author:** brainstorming session (collaborator: Artur Skowroński)
**Predecessor:** Phase 7 — /beyond + landing + about + SEO + polish (shipped 2026-05-25)
**Successor:** Phase 8b — actual Vercel deploy + monitoring (you do the dashboard work; I write the verification checklist)

---

## North Star

Make the app installable and resilient offline, ship a healthcheck endpoint, mount Vercel Analytics, document the deploy workflow — everything that can be done from a git commit. Deployment infrastructure (Vercel project creation, custom domain DNS, env var setup, Sentry project) is deferred to Phase 8b where you drive the dashboards and I supply the checklist.

## Scope

Five surfaces, each self-contained:

1. **Service worker (Serwist)** — replace broken `next-pwa@5` with `@serwist/next`. Write a minimal `app/sw.ts` with sane caching strategies. Wire `withSerwist` in `next.config.ts`.
2. **Offline fallback page** — static `app/offline/page.tsx` shown when navigation requests miss both the cache and the network.
3. **Icon generation** — committed SVG source + `scripts/generate-icons.mjs` (sharp) + the resulting 192×192 and 512×512 PNGs.
4. **Healthcheck route** — `app/api/health/route.ts` reporting status of Supabase + Anthropic key + version.
5. **Vercel Analytics + README** — mount `<Analytics />` in root layout, rewrite `README.md` with local dev / deploy / data-update workflow, remove the obsolete `next-pwa` dep.

**Explicitly out of scope** (deferred or moot):

- Sentry — SPEC marked optional; deferred for now (Vercel logs + Phase 6 error boundaries cover us short-term).
- Vercel Cron + `/api/cron/refresh` — depends on production Supabase being wired; defer until you connect it.
- Offline My Plan sync queue — moot; `lib/plan-store.ts` is already pure localStorage with no backend sync, so My Plan works offline natively.
- Custom domain DNS, Vercel project creation, env var setup — dashboard work for Phase 8b.
- Sentry source-map upload wizard.
- Geolocation prompt — already implemented in `NowClient.tsx` (verified during planning).
- Real-time clock in /now — already implemented (`setInterval(nowInNYC, 60_000)` in `NowClient.tsx`).
- Icons that are designed by a human — script renders a brand-mark placeholder you can replace later by editing `public/icons/icon-source.svg`.

---

## Pre-flight: codebase reality (already true)

- `public/manifest.json` exists and is correct (start_url `/now`, icons listed, theme `#0A0A0A`, display `standalone`, maskable purpose).
- `app/layout.tsx` already references `manifest: '/manifest.json'`.
- `NowClient.tsx` already implements: real-time clock via `setInterval(nowInNYC, 60_000)`, geolocation request flow with opt-in copy, 5-minute position cache.
- `lib/plan-store.ts` is pure zustand+localStorage. No remote sync needed.
- `public/icons/` contains only `README.md` (placeholder). Real PNGs missing → Section 3 fixes.
- `next.config.ts` is empty (`const nextConfig: NextConfig = {}`). Section 1 fills it.
- `next-pwa@^5.6.0` is in `package.json` but **not** imported anywhere. Section 5 removes it.

---

## Section 1 — Service worker (Serwist)

### Dependency swap

```jsonc
// package.json edits
- "next-pwa": "^5.6.0"     // remove (Next 16 incompatible, not imported)
+ "@serwist/next": "^9",   // latest stable
+ "serwist": "^9"          //   "      "
```

Run `npm install` after edits.

### `next.config.ts`

```ts
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

Service worker is **disabled in development** — no stale-cache headaches during dev cycles.

### `app/sw.ts`

```ts
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
    // Everything else same-origin → stale-while-revalidate (Serwist defaults).
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

### Caching summary

| Surface                | Strategy             | Where                  |
|------------------------|----------------------|------------------------|
| `_next/static/*`, icons, manifest | Precache (build) | Serwist `__SW_MANIFEST` injection |
| Page navigations (`/`, `/events`, `/now`, …) | Stale-while-revalidate | `defaultCache` |
| Fonts, images           | Stale-while-revalidate | `defaultCache` |
| Mapbox tiles            | Cache-first, 7d expiry | custom rule           |
| `/api/concierge`        | Network-only         | custom rule            |
| Navigation miss (offline) | Fallback to `/offline` | `fallbacks` entry    |

### Tests

- **Don't** try to import `app/sw.ts` in vitest — it references `self`, `ServiceWorkerGlobalScope`, and Serwist's worker-only `__SW_MANIFEST` injection. The file is built and validated by Serwist at `npm run build` time; that build is our test gate. The unit-test gate for this slice is just "all existing tests still pass after the config changes."
- Build gate: `npm run build` must produce `public/sw.js`. Verified during Section 1 implementation and again in the Phase-level acceptance walk.
- Dependency removal: `npm ls next-pwa` exits non-zero or shows `(empty)`.

---

## Section 2 — Offline fallback page

### Route

`app/offline/page.tsx` — server component, static (no `revalidate`).

```
[Header]
  H1: "You're offline."
  Lede: "We can't reach the network right now. The pages you've already visited
         should still work."

[CTA list, large mono links]
  → My Plan       (link to /my-plan — works natively from localStorage)
  → Now            (link to /now — works offline if previously cached)
  → Browse events (link to /events — works offline if previously cached)

[Footer hint, small gray]
  "When you're back online, everything reconnects automatically."

<VirtusLabFooter />
```

### Metadata

```ts
export const metadata: Metadata = {
  title: "Offline — NYTW Engineer's Companion",
  description: "You're offline. Some pages may still work from local cache.",
  robots: { index: false },
}
```

(`robots.index = false` because there's no value in indexing a state page.)

### Sitemap

Do **not** add `/offline` to `app/sitemap.ts`. It's an interstitial.

### Tests

- `__tests__/app/offline.test.tsx` — render the page; assert the H1, the three navigation links (`/my-plan`, `/now`, `/events`), and the VirtusLabFooter text.

---

## Section 3 — Icon generation

### Files

- `public/icons/icon-source.svg` — committed brand-mark source.
- `public/icons/icon-192x192.png` — generated, committed.
- `public/icons/icon-512x512.png` — generated, committed.
- `scripts/generate-icons.mjs` — generator using `sharp`.
- `public/icons/README.md` — update to point at source + `npm run icons`.
- `package.json` — add `"icons": "node scripts/generate-icons.mjs"` to `scripts`.

### `public/icons/icon-source.svg`

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <!-- Maskable safe area: keep meaningful content inside a centered 410×410 box -->
  <rect width="512" height="512" rx="96" fill="#0A0A0A"/>
  <text x="256" y="232" text-anchor="middle"
        font-family="ui-monospace, SFMono-Regular, Menlo, monospace"
        font-size="200" font-weight="800" fill="#FF6B35">≡</text>
  <text x="256" y="380" text-anchor="middle"
        font-family="ui-monospace, SFMono-Regular, Menlo, monospace"
        font-size="84" font-weight="800" fill="#FAFAFA">NYTW</text>
</svg>
```

Choice of `≡` is provisional — adjust in PR review if it looks off at 192px. The structural shape (rounded square, orange brand glyph, white wordmark, 96px corner radius for maskable safe area) is the commitment.

### `scripts/generate-icons.mjs`

```js
import { readFile, writeFile, mkdir } from 'node:fs/promises'
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

### `sharp` dependency

If not already in `package.json` (likely not), add as **devDependency**:

```jsonc
"devDependencies": {
  "sharp": "^0.34"
}
```

(`sharp` is sometimes a transitive dep of Next; declaring it explicitly as devDep removes guesswork.)

### Tests

- `__tests__/scripts/generate-icons.test.ts` — verify `scripts/generate-icons.mjs` exists and exports/runs without throwing on import (don't actually execute the file generation in CI; it's a build artifact). Optionally: verify `public/icons/icon-192x192.png` and `icon-512x512.png` exist as real files after commit (file-system existence assertion).

---

## Section 4 — Healthcheck route

### Route

`app/api/health/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type CheckStatus = 'ok' | 'skipped' | 'fail'

async function checkSupabase(): Promise<CheckStatus> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return 'skipped'
  try {
    const supabase = await createClient()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)
    const { error } = await supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .limit(1)
      .abortSignal(controller.signal)
    clearTimeout(timeout)
    return error ? 'fail' : 'ok'
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
  const failures = Object.values(checks).filter((s) => s === 'fail').length
  const status = failures === 0 ? 'ok' : 'degraded'
  const body = {
    status,
    timestamp: new Date().toISOString(),
    checks,
    version: process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev',
  }
  return NextResponse.json(body, { status: status === 'ok' ? 200 : 503 })
}
```

### Tests

- `__tests__/api/health.test.ts`:
  - With Supabase env unset and Anthropic env unset → 200, `checks.supabase === 'skipped'`, `checks.anthropic === 'skipped'`.
  - With Anthropic key set → `checks.anthropic === 'ok'`.
  - With Supabase env set + mock client returning error → 503, `checks.supabase === 'fail'`.
  - With Supabase env set + mock client returning success → 200, `checks.supabase === 'ok'`.
  - With `VERCEL_GIT_COMMIT_SHA` set → `version` matches.

(Mock `@/lib/supabase/server`'s `createClient` per case using `vi.mock`.)

### Robots

`/api/health` is under `/api/*`, already disallowed by `app/robots.ts` from Phase 7. ✓

---

## Section 5 — Vercel Analytics + README + cleanup

### 5.1 Vercel Analytics

- `package.json`: add `"@vercel/analytics": "^1"` to dependencies.
- `app/layout.tsx`: add import and mount inside `<body>`, near `<Toaster />`:

```tsx
import { Analytics } from '@vercel/analytics/next'

// ...inside <body>
<Analytics />
```

(Note: `@vercel/analytics@1.x` for Next 16 uses the `/next` subpath; if the package shape differs at install time, fall back to `/react`.)

No env var. No-ops outside Vercel. No new tests — existing layout tests must still pass.

### 5.2 README update

Rewrite `README.md` with sections:

- **One-paragraph what-this-is** (lift from SPEC's North Star)
- **Local development** (Node 22+, npm install, env vars, fallback mode)
- **Project structure** (top-level dirs)
- **Data update workflow** (edit seed-events.json → commit → Vercel auto-deploys)
- **Deployment** (Vercel-connected, required + optional env vars, prod/preview branches, custom domain note)
- **Scripts** table (`dev`, `build`, `start`, `test`, `lint`, `icons`)
- **Healthcheck** one-liner with the `/api/health` shape
- **License** placeholder

Also create `.env.example` if missing, with the optional env vars and one-line comments each:

```bash
# Optional — when set, the app reads events from Supabase instead of data/seed-events.json
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Optional — when set, the AI Concierge uses real Claude. Otherwise mock proposals.
ANTHROPIC_API_KEY=

# Optional — when set, the map view renders real Mapbox tiles.
NEXT_PUBLIC_MAPBOX_TOKEN=

# Required for canonical URLs / OG image. Default localhost in dev.
NEXT_PUBLIC_SITE_URL=
```

### 5.3 next-pwa cleanup

Verified by `grep -r "next-pwa" .` returning nothing under the repo root after the dependency is removed.

### Tests

- `__tests__/app/layout-analytics.test.tsx` (optional, light) — render `<RootLayout>{stub}</RootLayout>`, assert no crash. (Most existing tests render pages which include layout indirectly; if those still pass, this is redundant. Skip if redundant.)

---

## Architecture overview

```
app/
├── layout.tsx                       (+ <Analytics />)
├── sw.ts                            NEW (service worker source)
├── offline/page.tsx                 NEW
└── api/
    └── health/route.ts              NEW

public/
├── manifest.json                    (unchanged)
├── sw.js                            GENERATED by Serwist on build
└── icons/
    ├── icon-source.svg              NEW (brand mark)
    ├── icon-192x192.png             NEW (generated, committed)
    ├── icon-512x512.png             NEW (generated, committed)
    └── README.md                    UPDATED

scripts/
└── generate-icons.mjs               NEW

next.config.ts                       REPLACE (wire withSerwist)
package.json                         + @serwist/next, serwist, sharp, @vercel/analytics
                                     - next-pwa
README.md                            REWRITE
.env.example                         NEW (or update if exists)
```

## Risks & mitigations

- **Risk:** `@serwist/next` API drift between versions. **Mitigation:** pin to `^9` and lock at install time; the example matches the upstream README of that major.
- **Risk:** `sharp` install fails on some platforms / CI. **Mitigation:** dev-only dep, not part of build; failure is just "run npm run icons manually." Committed PNGs make CI green.
- **Risk:** Service worker shipping stale caches in production after a deploy. **Mitigation:** `skipWaiting: true` + `clientsClaim: true` + `reloadOnOnline: true` together force clients onto the new SW immediately.
- **Risk:** `@vercel/analytics` import path differs from the example. **Mitigation:** fallback to `@vercel/analytics/react` if `/next` doesn't resolve; verified at install time.
- **Risk:** Healthcheck times out on Supabase if the connection is slow. **Mitigation:** 2-second `AbortController` keeps the endpoint snappy.

## Acceptance criteria

- [ ] `next-pwa` removed from `package.json`. `npm ls next-pwa` empty.
- [ ] `@serwist/next` + `serwist` installed; `app/sw.ts` exists; `next.config.ts` exports `withSerwist(nextConfig)`.
- [ ] `npm run build` produces `public/sw.js` and the build succeeds. Service worker disabled in `npm run dev`.
- [ ] `app/offline/page.tsx` renders correctly; three internal links present.
- [ ] `public/icons/icon-192x192.png` and `icon-512x512.png` exist as real PNG files committed to the repo.
- [ ] `npm run icons` regenerates the two PNGs from `public/icons/icon-source.svg` without error.
- [ ] `GET /api/health` returns JSON `{ status, timestamp, checks, version }`; status code 200 when all checks ok/skipped, 503 when any fail.
- [ ] `<Analytics />` is mounted in `app/layout.tsx`. `@vercel/analytics` in `dependencies`.
- [ ] `README.md` covers local dev, deploy, data update, scripts, healthcheck.
- [ ] `.env.example` lists `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_MAPBOX_TOKEN`.
- [ ] `npm test` green; `npm run lint` clean; `npm run build` succeeds.
- [ ] All previously-passing tests still pass (Phase 1–7 unchanged).

## Out-of-scope reminders (for Phase 8b or later)

- Vercel project creation + env var entry in dashboard.
- Custom domain DNS configuration.
- Sentry project + DSN + SDK + source-map upload.
- Vercel Cron `vercel.json` + `/api/cron/refresh` route.
- Production Supabase wiring.
- Lighthouse audit (Phase 9 — pre-launch QA).
- Push notifications (parking-lot per SPEC).
