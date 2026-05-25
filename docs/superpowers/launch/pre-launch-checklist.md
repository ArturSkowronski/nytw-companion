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
