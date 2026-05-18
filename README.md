# NYTW Engineer's Companion

87 hand-curated engineering events for Tech Week NYC 2026 (June 1–7).

Built with Next.js 16, Supabase, Zustand, and Claude API. Deployed on Vercel.

## Quick start

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project (free tier works)
- Anthropic API key — needed in Phase 5 (AI Concierge)
- Mapbox token — needed in Phase 3 (map views)

### Setup

```bash
git clone https://github.com/YOUR_ORG/nytw-companion
cd nytw-companion
npm install
cp .env.local.example .env.local   # fill in your values
```

### Supabase setup

1. Create a project at [supabase.com](https://supabase.com)
2. Go to SQL Editor → paste and run `supabase/migrations/0001_initial.sql`
3. Go to Authentication → Providers → Email → enable **Magic Link**
4. Copy your Project URL and anon key into `.env.local`

### Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Tests

```bash
npm test          # run once
npm run test:watch  # watch mode
```

### Seed event data (after Phase 2)

```bash
npx tsx data/seed.ts
```

## Deployment

1. Push to GitHub
2. Import project at [vercel.com](https://vercel.com)
3. Add all `.env.local` values as Vercel environment variables
4. Production branch: `main`

## Architecture

See [SPEC.md](./SPEC.md) for the full product spec, data model, and 9-phase build plan.

---

Built by [Artur Skowroński](https://linkedin.com/in/artur-skowronski) · [VirtusLab](https://virtuslab.com)
Not affiliated with a16z or Tech Week NYC.
