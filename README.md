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
- **Optional env:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_MAPBOX_TOKEN`
- **Custom domain:** configured in Vercel dashboard. (`nytw.dev` is the preferred target per SPEC.)

## Healthcheck

```
GET /api/health
→ 200 { "status": "ok", "timestamp": "...", "checks": { "supabase": "ok|skipped|fail", "anthropic": "ok|skipped" }, "version": "<git sha>|dev" }
→ 503 when any check is "fail"
```

Use this for Vercel preview smoke verification and uptime monitoring.

## PWA

Installable from any modern browser. Service worker (Serwist) handles offline navigation fallback to `/offline`. Map tiles are cached for 7 days. AI Concierge calls are never cached. My Plan storage is local (zustand + localStorage) so it works fully offline.

## Documentation

Phase-by-phase design + plan docs live in `docs/superpowers/`:

- `specs/` — design briefs (one per phase)
- `plans/` — TDD implementation plans (one per phase)

## Environment variables

| Name | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_GA_ID` | Optional | GA4 Measurement ID (e.g. `G-XXXXXXXXXX`). When unset, no GA script is injected and no analytics requests fire. Set in Vercel Production env to enable. |

## License

(TBD — set before public launch.)
