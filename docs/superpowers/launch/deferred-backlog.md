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
