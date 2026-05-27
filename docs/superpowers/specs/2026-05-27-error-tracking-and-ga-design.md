# Error tracking (Vercel-native) + Cookieless GA4 — Design

**Date:** 2026-05-27
**Phase:** Feature add (post-launch observability)
**Status:** Draft, awaiting user review

---

## Goal

Two related observability features shipped together:

1. **Error tracking.** Every unhandled exception — client or server — lands in Vercel Function logs so Vercel Agent can investigate. Today only `console.error` inside API routes does this; client-side React errors, unhandled promise rejections, and per-route `error.tsx` boundaries are silent.
2. **Cookieless pageview analytics.** GA4 in no-PII mode (`client_storage: 'none'`, no `_ga` cookie, anonymized IP). Sits alongside the existing `@vercel/analytics`. Tracks aggregate pageviews only — does not violate the "We don't track you" landing copy under the user's stated definition (PII / per-user profiling = tracking; aggregate cookieless = not tracking).

Acceptance test:

> 1. With the app deployed, throw an error from devtools (`throw new Error('test-1')`). Within 10s, `[client-error]` line containing `test-1` is visible in Vercel Function logs.
> 2. Open `https://nytw.dev/`. DevTools Network shows a request to `*.google-analytics.com/g/collect` returning 2xx. DevTools Application > Cookies shows no `_ga`, no `_gid`, no Google-set cookie.
> 3. `npx vitest run` is green across 3 new test files.

---

## Decisions captured during brainstorm

| Topic | Decision |
| --- | --- |
| Error tracking vendor | **Vercel-native** (Function logs + Vercel Agent). User chose this over Sentry. No third-party SDK, no client bundle bloat, no vendor lock-in. |
| Client-side error capture | Custom: small `/api/log-error` POST endpoint + `lib/report-error.ts` reporter + global window listeners + per-route `error.tsx` wiring. Vercel doesn't offer this turnkey; ~50 lines of code closes the gap. |
| Server-side error capture | Already in place via `console.error` calls in API routes. No change. Vercel Function logs already capture these. |
| Alerting | None in v1. User manually reviews Vercel Agent / Function logs. Slack/email alerts deferred — overkill for low traffic. |
| Source maps | None — Vercel auto-emits stack traces in Function logs that reference compiled bundle paths. Acceptable for v1; revisit if traces become unreadable. |
| Rate limiting on `/api/log-error` | None in v1. Low traffic. Vercel function quotas are the only ceiling. Add IP-based rate limit if abuse appears. |
| Deduplication / grouping of client errors | None in our code — we trust Vercel Agent's log grouping. |
| Analytics vendor | **Cookieless GA4.** User explicitly clarified that "tracking" in their landing copy means PII/per-user profiles, not aggregate measurement. GA4 with `client_storage='none'` is acceptable. |
| Analytics events | **Pageviews only in v1.** No `share_clicked`, `plan_added`, etc. Custom events are a separate spec once we know what to optimize for. |
| Cookie consent banner | **Not needed** — cookieless GA4 does not set Google cookies, and no first-party tracking cookie is created either. |
| Existing `@vercel/analytics` | **Keep.** Coexists with GA4. Different dashboards, both cookieless, both no-PII. No conflict. |
| Spec/PR scoping | **One combined spec.** Both subsystems touch `app/layout.tsx` and `next.config.ts`; coordinating them in one PR is simpler than two. User confirmed. |

---

## Architecture

### Subsystem 1: Error tracking

```
┌─────────────────────────────────────────────────────────────┐
│ Client                                                       │
│                                                              │
│  React render throws ─────┐                                  │
│  window.onerror ──────────┤                                  │
│  unhandledrejection ──────┼──► lib/report-error.ts           │
│  app/error.tsx useEffect ─┤      (fetch POST /api/log-error) │
│  app/(route)/error.tsx ───┘                                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Server (Vercel Function)                                     │
│                                                              │
│  app/api/log-error/route.ts                                  │
│    POST → Zod validate → console.error('[client-error]', …)  │
│                                                              │
│  Existing API routes already use console.error              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
              Vercel Function logs → Vercel Agent
```

### Subsystem 2: Cookieless GA4

```
┌─────────────────────────────────────────────────────────────┐
│ app/layout.tsx                                               │
│                                                              │
│  <GoogleAnalytics />  ──► next/script (afterInteractive)     │
│                            loads gtag.js from                │
│                            www.googletagmanager.com          │
│                            calls gtag('config', GA_ID, {     │
│                              client_storage: 'none',         │
│                              anonymize_ip: true,             │
│                              allow_google_signals: false,    │
│                              allow_ad_personalization_       │
│                                signals: false,               │
│                            })                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
              Pageview hits to *.google-analytics.com
              No cookies, no localStorage
```

CSP needs additions:
- `script-src` += `https://www.googletagmanager.com`
- `connect-src` += `https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com`

---

## Files

### New

| Path | Lines | Responsibility |
| --- | --- | --- |
| `app/api/log-error/route.ts` | ~40 | POST endpoint. Zod-validates payload, `console.error('[client-error]', …serialized…)`, returns 204. 400 on invalid body. |
| `lib/report-error.ts` | ~35 | `reportError(error: unknown, kind: 'boundary' \| 'window' \| 'rejection')`. SSR-safe no-op. Truncates message + stack to 2KB each. Wraps fetch in try/catch — never throws. |
| `components/ErrorListeners.tsx` | ~25 | `'use client'`. In `useEffect`, attaches `window.addEventListener('error', …)` and `window.addEventListener('unhandledrejection', …)`. Cleans up on unmount. Calls `reportError`. |
| `components/GoogleAnalytics.tsx` | ~35 | `'use client'`. Uses `next/script` for gtag.js. Inline config call with cookieless flags. Renders nothing when `NEXT_PUBLIC_GA_ID` is not set. |
| `__tests__/lib/report-error.test.ts` | ~50 | SSR no-op, fetch fail swallow, >2KB truncation, payload shape. |
| `__tests__/api/log-error-route.test.ts` | ~40 | 204 on valid POST, 400 on garbage, `console.error` called once with `[client-error]` prefix. |
| `__tests__/components/GoogleAnalytics.test.tsx` | ~25 | Renders script tag when `NEXT_PUBLIC_GA_ID` set, renders null when unset. |

### Modified

| Path | Change |
| --- | --- |
| `app/layout.tsx` | Mount `<ErrorListeners />` once in body. Mount `<GoogleAnalytics />` once near the top of body (or inside `<head>` via `next/script`). |
| `app/error.tsx` | Add `useEffect(() => { reportError(error, 'boundary') }, [error])`. |
| `app/plan/error.tsx` | Same. |
| `app/my-plan/error.tsx` | Same. |
| `app/now/error.tsx` | Same. |
| `app/events/error.tsx` | Same. |
| `next.config.ts` | Add Google domains to `csp` constant (script-src + connect-src). |
| `README.md` or `.env.example` | Document `NEXT_PUBLIC_GA_ID`. Use whichever already exists; if neither, add a 3-line block to `README.md`. |

---

## Interfaces

### `lib/report-error.ts`

```ts
export type ErrorKind = 'boundary' | 'window' | 'rejection'

export interface ReportErrorPayload {
  message: string       // truncated to 2KB
  stack?: string        // truncated to 2KB
  url?: string          // window.location.href when available
  userAgent?: string    // navigator.userAgent when available
  kind: ErrorKind
}

export function reportError(error: unknown, kind: ErrorKind): void
```

- Returns synchronously. Fetch fires in the background. Never throws.
- No-ops when `typeof window === 'undefined'`.
- POST `/api/log-error` with JSON body matching `ReportErrorPayload`.

### `app/api/log-error/route.ts`

- POST only. Other methods → 405.
- Body validated by Zod schema mirroring `ReportErrorPayload`.
- Logs once via `console.error('[client-error]', JSON.stringify(payload))` so Vercel Function logs render it as a single line.
- Returns `new Response(null, { status: 204 })` on success, `400` on validation failure.
- No response body on success — saves bytes; reporter ignores response anyway.

### `components/GoogleAnalytics.tsx`

```tsx
export function GoogleAnalytics(): JSX.Element | null
```

- Reads `process.env.NEXT_PUBLIC_GA_ID` at module level.
- If unset (empty string or undefined), returns `null` — zero render, zero network.
- Otherwise renders two `<Script>` elements: external gtag.js loader + inline config call.

---

## Edge cases

| Case | Behaviour |
| --- | --- |
| `/api/log-error` returns 5xx | Reporter swallows. No retry. No user-visible effect. |
| Reporter's own fetch throws (e.g. offline) | Caught and ignored. Never re-thrown. No log loop. |
| Same error fires 100×/s | Endpoint receives 100×/s. No client-side dedup in v1. Vercel Agent groups in its UI. |
| Server-side error inside `/api/log-error` itself | Vercel renders 500. We do NOT call reportError from inside the endpoint (no recursive logging). |
| `window` undefined (SSR) | `reportError` returns immediately. `ErrorListeners` `useEffect` only runs client-side anyway. |
| `NEXT_PUBLIC_GA_ID` unset (dev / preview / forgot to set) | `<GoogleAnalytics />` renders `null`. No script load, no warning. |
| User has uBlock / Brave Shields / Pi-hole | gtag.js fails to load. App keeps working. Silent. |
| User runs the app behind a strict CSP-blocking corporate proxy | Same as above — silent failure of analytics, no impact. |
| Stack trace > 2KB | Reporter truncates with `…(truncated)` suffix. Endpoint sees a string ≤ 2KB. |
| Payload missing `kind` | Zod 400. Reporter never sends invalid payloads, so this only happens on tampering. |
| Large burst of errors during a deployment | Each is a 204; Vercel functions scale; no app impact. Vercel logs may rate-limit, that's their concern. |

---

## Testing

### Unit (Vitest)

**`__tests__/lib/report-error.test.ts`** — 5 tests:
1. No-op when `window` is undefined (uses `vi.stubGlobal('window', undefined)`).
2. Truncates `error.message` and `error.stack` over 2KB with `…(truncated)` suffix.
3. Builds payload with `kind`, `url` from `window.location.href`, `userAgent`.
4. Swallows fetch rejection — call doesn't throw.
5. Accepts non-Error values (string, object) — falls back to `String(value)`.

**`__tests__/api/log-error-route.test.ts`** — 4 tests:
1. POST with valid body → 204, `console.error` called once with `[client-error]` prefix.
2. POST with missing `message` → 400, no `console.error`.
3. POST with non-JSON body → 400.
4. GET → 405.

**`__tests__/components/GoogleAnalytics.test.tsx`** — 3 tests:
1. `NEXT_PUBLIC_GA_ID` set → renders two `<script>`-ish elements (Next's Script component wraps in `<script>`).
2. `NEXT_PUBLIC_GA_ID` empty string → renders nothing.
3. `NEXT_PUBLIC_GA_ID` undefined → renders nothing.

### Existing tests

- `__tests__/lib/site-url.test.ts`, `__tests__/app/landing.test.tsx`, etc. must remain green. Lint + full suite + e2e in CI confirm nothing regressed.

### Manual smoke (post-deploy)

1. Open `https://nytw.dev/`. DevTools Network → confirm `gtag/js?id=G-…` loaded, confirm one `g/collect` hit, confirm zero `_ga*` cookies.
2. In DevTools Console: `throw new Error('observability-smoke-' + Date.now())`. Wait 5s. In Vercel dashboard → Logs → find a line with `[client-error]` containing that timestamp.
3. Open `/events`, click something that triggers a route render. Reload Network — see a fresh `g/collect`. (Pageview on each route.)
4. (Optional) Open `https://nytw.dev/error-doesnt-exist` → confirm 404 page renders without errors.

---

## Out of scope (deferred — explicit)

- **Sentry or other third-party error SDK** — explicitly chosen against; Vercel-native is the path.
- **Slack / email alerts on new errors** — manual Vercel Agent review for v1. Hook up when error volume justifies it.
- **Source map upload** — Vercel already serves source maps in Function log stack traces. Sentry-style guaranteed unmin is deferred.
- **Custom GA events** (`share_clicked`, `plan_added`, `editors_pick_clicked`, `rsvp_opened`) — separate spec once we know which conversion to optimize.
- **Server-side GA hits** (Measurement Protocol) — would require API secret + identifies users. Out of scope.
- **Funnel / cohort analysis in GA** — requires cookies; we've chosen not to.
- **Rate limiting on `/api/log-error`** — low traffic; revisit if abuse appears.
- **Persisting client errors beyond Vercel's 7-day Hobby retention** — out of scope; if needed, set up a Log Drain to Better Stack / Datadog later.
- **In-app error UI improvement** — `error.tsx` already shows a friendly message. Logging is additive.

---

## Migration / compatibility

- All changes additive. No existing behavior changes.
- `@vercel/analytics` stays installed and active. GA4 ships alongside.
- CSP change adds two domains to allowlist; does not remove anything. Pre-existing sources (Mapbox, Anthropic, Supabase, Vercel scripts) unaffected.
- Per-route `error.tsx` files gain a `useEffect` — existing render behavior unchanged.
- Env var `NEXT_PUBLIC_GA_ID`:
  - **Required for GA to be active** in any environment. Absent → `<GoogleAnalytics />` no-ops.
  - Add via Vercel dashboard → Settings → Environment Variables → Production (and Preview if you want preview pageviews counted, which probably you don't).
- No data migrations. No URL changes.
