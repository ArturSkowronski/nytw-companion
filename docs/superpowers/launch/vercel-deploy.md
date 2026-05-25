# Vercel deploy walkthrough

Concrete click-through for getting the app live on Vercel. Estimated time: ~10 minutes for first deploy.

**Prerequisites already done** (this session):
- Repo: https://github.com/ArturSkowronski/nytw-companion (public, branch `main`)
- Build script: `npm run build` → `next build --webpack` (Serwist needs webpack, not Turbopack — already configured)
- All env vars are *optional* — app falls back to seed JSON / mock concierge / "Map disabled" if any are unset.

---

## Step 1 — Create the Vercel project

1. Go to https://vercel.com/new
2. Sign in with GitHub if not already.
3. Click **"Import Git Repository"** → find `ArturSkowronski/nytw-companion` → **Import**.
4. Framework Preset: should auto-detect **Next.js**. Leave as-is.
5. Root Directory: leave as `./`.
6. Build & Output Settings: leave defaults. Vercel runs `npm run build` which already has `--webpack`.

**Don't deploy yet — add env vars first.**

## Step 2 — Add environment variables

Click **"Environment Variables"** section. Add each of these. **All are optional** but `NEXT_PUBLIC_SITE_URL` is strongly recommended.

| Name | Value | Why |
|------|-------|-----|
| `NEXT_PUBLIC_SITE_URL` | `https://nytw-companion.vercel.app` | Canonical URLs, sitemap, OG image. Update after custom domain. |
| `ANTHROPIC_API_KEY` | (your key from console.anthropic.com) | Real AI Concierge. Without it, app serves deterministic mocks. |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | (your token from account.mapbox.com) | Real map view. Without it, /events?view=map shows "Map disabled". |
| `NEXT_PUBLIC_SUPABASE_URL` | (your project URL) | Optional — pulls events from DB instead of seed JSON. Skip for now. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (your anon key) | Companion to SUPABASE_URL. Skip if you skipped above. |

Apply each to **Production, Preview, Development** (all checkboxes).

## Step 3 — Deploy

Click **Deploy**. First build takes ~2 minutes (Serwist generates the service worker; Next compiles all routes).

Watch the build log for:
- ✅ `✓ Compiled successfully` — Next build
- ✅ `(serwist) Bundling the service worker script with the URL '/sw.js'` — service worker generated
- ✅ Route table showing 14 routes (the static ones + `/api/concierge`, `/api/health`, `/opengraph-image`)

If the build fails with "This build is using Turbopack" — the build script swap to `--webpack` wasn't picked up. Double-check `package.json` `"build"` is `"next build --webpack"`.

## Step 4 — Smoke the live URL

Vercel gives you a URL like `https://nytw-companion.vercel.app` (or with a `-username` suffix).

Hit these paths in a browser:

- `/` — landing renders, Editor's Picks carousel loops
- `/events` — event list renders; filter button works
- `/api/health` — returns JSON with `status: "ok"` and `version: <git sha>`
- `/sitemap.xml` — XML lists 9 routes
- `/robots.txt` — `Allow: /`, `Disallow: /api/`
- `/opengraph-image` — 1200×630 PNG with brand styling
- DevTools → Application → Manifest — icons load (192 + 512)
- DevTools → Application → Service Workers — registered + activated

## Step 5 — Update `NEXT_PUBLIC_SITE_URL` if it changed

If your Vercel URL is `nytw-companion-arturskowronski.vercel.app` (or anything other than what you set in Step 2), update the env var in Project Settings → Environment Variables → edit → save → **redeploy** (Deployments tab → ⋯ → Redeploy).

This makes `sitemap.xml`, OG image URL, and canonical link tags resolve correctly.

## Step 6 — Custom domain (optional, when ready)

1. Buy domain (Cloudflare Registrar / Namecheap / wherever — `nytw.dev` per SPEC, or `nytw-companion.app`).
2. Project Settings → Domains → Add → enter the domain.
3. Vercel shows DNS records to add at your registrar:
   - `A` record `@` → `76.76.21.21`
   - `CNAME` `www` → `cname.vercel-dns.com`
4. Wait for DNS propagation (5 min – 24h; usually under an hour).
5. Update `NEXT_PUBLIC_SITE_URL` to the new domain. Redeploy.

## Step 7 — Vercel Analytics (already in code)

`<Analytics />` is mounted in `app/layout.tsx`. It auto-activates on Vercel deploys; no toggle needed. View at Project → Analytics tab. Free tier: 2.5K events/month — if you're heading for more, enable Vercel Web Analytics' Pro features ($10/mo add-on) or upgrade to Vercel Pro ($20/mo team).

## Step 8 — Run Lighthouse against production

```bash
npm run lighthouse -- --collect.url=https://<your-vercel-url>/
```

Acceptance per `lighthouserc.json`:
- Performance ≥ 0.8
- Accessibility ≥ 0.95
- SEO = 1.0

If any assertion fails, the report lists which audits. Most common fixes:
- Missing alt text on images → none in this app currently
- Mixed-content warnings → only if you've added HTTP resources
- LCP slow → usually fine on Vercel's edge

## Step 9 — Production smoke

Walk `docs/superpowers/launch/pre-launch-checklist.md` with the live URL substituted everywhere. The 12-section checklist covers devices, offline, social cards, mobile gestures, and more.

## Troubleshooting

**"This commit hasn't deployed yet"**
- Vercel only auto-deploys the `main` branch by default. Push to `main`, not a feature branch (or check the Production Branch setting in Project Settings → Git).

**Build fails with "Module not found: @serwist/next"**
- `npm ci` may have cached weirdly. In Vercel Project Settings → General → toggle "Build & Development Settings" override and clear, or push a no-op commit to force a fresh install.

**`/api/concierge` returns 500 in production**
- Check the env vars are set on **Production** scope, not just Preview/Development.
- Check Vercel function logs for the real error (Project → Logs → filter by `/api/concierge`).

**OG image loads but is blank or wrong**
- `NEXT_PUBLIC_SITE_URL` is wrong or missing. Update and redeploy.
- `metadataBase` is read at module-load time, so a redeploy is required after env-var changes.

**Custom domain doesn't switch over after DNS update**
- Use `dig <your-domain>` or https://www.whatsmydns.net/ to confirm propagation.
- Vercel re-checks DNS automatically every few minutes; in Project → Domains, click "Refresh" if it's stuck.

**Vercel Analytics shows no events**
- The `<Analytics />` component no-ops in development. On Vercel deploys it auto-activates after a few page views.
- If still nothing after 10+ visits, enable Analytics explicitly in Project → Analytics → Enable.

## When you're done

Update `README.md` with the live URL (replace `(set after Vercel deploy)`). Commit + push — Vercel auto-redeploys.

If you switched domains, also update:
- `package.json` `homepage` field (if you add one)
- Any social card validators you tested with previously

## What's still deferred

Per `docs/superpowers/launch/deferred-backlog.md`:
1. Magic-link email recovery (feature doesn't exist)
2. iCal subscribe via `webcal://` URL (depends on magic-link)
3. Lighthouse score gates against production (Step 8 here is the manual check; CI doesn't gate prod yet)
4. Real-device manual QA (run the pre-launch checklist)
