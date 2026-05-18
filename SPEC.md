# NYTW Engineer's Companion — Claude Code Spec

**Wersja:** 2.0 — *My Plan jako centralny koncept. Brak integracji z Luma/Partiful API — wszystkie RSVP statusy są self-reported. Lista "spod lady" jako uczciwy link do reszty ekosystemu.*
**Data:** 2026-05-18
**Cel dokumentu:** Specyfikacja gotowa do wrzucenia do Claude Code. Każda sekcja "Phase" to osobny prompt, który możesz zapodać Claude Code sekwencyjnie. Spec jest samowystarczalny — nie zakłada żadnego wcześniejszego kontekstu.

**Trzy zasady przewodnie:**

1. **My Plan to serce appki.** Wszystkie inne funkcje (browse, mapa, AI Concierge, filtry, /beyond) są drogami do dodawania eventów do My Plan. Bez tego konceptu appka jest browserem, nie plannerem.
2. **Kuracja > filtry.** 80–120 ręcznie wybranych eventów to wartość. Filtry to power-user feature, dochodzą późno (Phase 6). Po Phase 3 (v1.3) browse jest w pełni funkcjonalny — bez ani jednego filtra.
3. **Brak integracji z RSVP platformami.** Luma API wymaga Luma Plus + klucza per-kalendarz. Partiful nie ma publicznego API. Eventbrite zamknął search API w 2019. **Wszystkie RSVP statusy są manualne, self-reported przez usera.** Appka linkuje na zewnątrz, user wraca, klika "Mark as RSVPed". Spec respektuje to ograniczenie wszędzie.

---

## 0. Kontekst produktowy (TL;DR dla Claude Code)

Budujemy **NYTW Engineer's Companion** — minimalistyczną web-appkę dla uczestników **Tech Week NYC 2026 (1–7 czerwca 2026)**, festiwalu organizowanego przez a16z z 1 000+ eventami w 7 dni.

**Co appka robi:**

1. **80–120 ręcznie wyselekcjonowanych eventów** "engineering-relevant" (AI infra, devtools, platform engineering, agentic AI, technical fundraising). Sama kuracja to filtr.
2. **My Plan** — user dodaje eventy do swojego planu jednym klikiem. Persistent widget na każdej stronie. localStorage default + opcjonalny email magic link do recovery.
3. **Status tracking (self-report)** — user ręcznie zaznacza per event: `interested / RSVPed / confirmed / waitlist / declined / attended`. **Nie integrujemy się z Luma/Partiful** — user RSVPuje na ich stronach i wraca zaznaczyć status.
4. **/now widok** — default mobile entry point. Pokazuje "next up in My Plan" z dojazdem. Działa offline. Real timezone NYC.
5. **AI Concierge** — Claude API. User opisuje siebie w 1–3 zdaniach, AI zwraca **propozycje** 5–8 eventów do dodania do My Plan (nie zastępuje, augmentuje).
6. **Mapa** (Mapbox) z pinami eventów per dzień. Osobny tryb "View My Plan on map" z routingiem między eventami.
7. **iCal feed** dla My Plan do subskrypcji w Google/Apple/Outlook Calendar.
8. **/beyond** — uczciwa lista linków do innych agregatorów (Yorkseed, GarysGuide, Andrew Yeung, Vibecal, Carly, Build Week NYC, oficjalny tech-week.com).
9. **"Editor's Picks"** carousel z 5–7 wyróżnionymi eventami (event VirtusLab w pierwszej dwójce, transparentnie jako human pick).

**Hierarchia wartości po Phase:**

- **v1.2 (po Phase 2):** browse + My Plan basic (add/remove + persistent widget). Useful.
- **v1.3 (po Phase 3):** + mapa + /now. Mobile-ready, in-event ready.
- **v1.4 (po Phase 4):** + dedicated /my-plan view + status tracking + iCal + conflict detection. Pełen planner.
- **v1.5 (po Phase 5):** + AI Concierge (augmenter) + email magic link recovery.
- **v1.6 (po Phase 6):** + filtry (power-user drawer). **Opcjonalne dla MVP — można wyciąć jeśli czas naciska.**
- **v1.7 (po Phase 7):** + /beyond + polish landing + transparent Editor's Picks blurbs.
- **v1.8 (po Phase 8):** + offline service worker + deployment.

**Trojan Horse:** branding "Made by VirtusLab" w stopce, event VirtusLab w Editor's Picks (transparentny human pick, NIE hardcoded w AI). Trust przez kuracje + uczciwy link do konkurencji w /beyond = pozycjonowanie VirtusLab jako trust layer Tech Week ecosystem.

---

## 1. Stack & decyzje architektoniczne

| Warstwa | Wybór | Powód |
|---|---|---|
| Framework | **Next.js 15 (App Router)** + TypeScript | Full-stack, server components, deploy jednym `git push` |
| Styling | **Tailwind CSS 4** + shadcn/ui | Szybka iteracja UI, gotowe komponenty (Dialog/Sheet dla modal) |
| Hosting | **Vercel** (free tier wystarczy dla MVP) | Zero config, edge functions, preview deployments |
| Database | **Supabase Postgres** (free tier) | Zarządzane Postgres, builtin auth dla magic link |
| Auth | **Supabase Auth — email magic link only** | Opcjonalne, nie OAuth. Soft prompt po 3 dodanych eventach do My Plan |
| State (My Plan) | **Zustand** + localStorage persistence (zustand/middleware) | Default. DB sync tylko jeśli user zrobił magic link signup |
| LLM | **Anthropic Claude API** (claude-sonnet-4-6) | Najlepsze structured output |
| Map | **Mapbox GL JS** | Free tier 50k loads/mc, dark theme, custom pinned markers |
| Map (static) | **Mapbox Static API** | Dla /now widoku — 1 obrazek, zero WebGL, oszczędność baterii |
| Analytics | **Vercel Analytics** + **Plausible** (opcjonalnie) | Privacy-friendly |
| Scraping | **Apify** (`avinashchby/tech-events-aggregator`) jako one-time seed | Nie scrapujemy live; ETL → JSON → DB. Brak Luma API. |
| iCal | **`ics`** npm package | Standard RFC 5545 |
| Offline | **next-pwa** + Service Worker | Cache My Plan + statyczne dane na 7 dni. Krytyczne dla in-event use |
| Forms | **react-hook-form** + **zod** | Type-safe forms |
| Search | **Fuse.js** | Fuzzy match po title/host/description/tags |
| Time | **date-fns-tz** | Wszystkie timestampy w `America/New_York` |

**Nie używamy:** Prisma (Supabase JS client wystarczy), tRPC (Server Actions + Route Handlers), Redis, queue systemów, **Google OAuth** (magic link wystarczy), **Luma/Partiful/Eventbrite API** (nie ma dostępu praktycznego).

---

## 2. Data model (Postgres / Supabase)

```sql
-- Events: kuratowska lista (zarządzana przez Artura)
create table events (
  id text primary key, -- slug, np. "openai-devtools-rooftop-2026-06-03"
  title text not null,
  description text not null,
  host text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  venue_name text,
  address text,
  lat double precision,
  lng double precision,
  neighborhood text, -- "Flatiron", "Williamsburg", etc.
  rsvp_url text not null, -- link do Luma/Partiful/Eventbrite — OPEN EXTERNALLY
  rsvp_platform text not null, -- "luma" | "partiful" | "eventbrite" | "other"
  tags text[] not null default '{}',
  audience_tags text[] not null default '{}',
  format text, -- "rooftop" | "dinner" | "panel" | "breakfast" | "hackathon" | "workshop"
  capacity int,
  is_invite_only boolean default false,
  has_free_food boolean default false,
  has_free_drinks boolean default false,
  is_editors_pick boolean default false,
  editors_pick_blurb text, -- "Dlaczego warto" — pokazane w UI
  is_virtuslab_event boolean default false,
  source text not null, -- "tech-week.com" | "luma" | "manual"
  source_url text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_events_starts_at on events(starts_at);
create index idx_events_tags on events using gin(tags);
create index idx_events_editors on events(is_editors_pick) where is_editors_pick = true;

-- My Plan: zapisane plany użytkowników. ANONYMOUS (URL token) lub AUTHENTICATED (email magic link)
create table plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade, -- NULL jeśli anonymous
  anonymous_token text unique, -- NULL jeśli authenticated. Używany do recovery z URL
  ical_token text unique not null default gen_random_uuid()::text, -- public read dla iCal feed
  email text, -- jeśli user dodał email do recovery (przed pełnym magic link signup)
  display_name text, -- np. "Artur's Plan" (default = "My NYTW Plan")
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_plans_user on plans(user_id);
create index idx_plans_anonymous_token on plans(anonymous_token);
create index idx_plans_ical_token on plans(ical_token);

-- Plan items: eventy w planie + status RSVP (self-reported)
create table plan_items (
  id bigserial primary key,
  plan_id uuid not null references plans(id) on delete cascade,
  event_id text not null references events(id) on delete cascade,
  status text not null default 'interested',
    -- 'interested' | 'rsvp_pending' | 'confirmed' | 'waitlist' | 'declined' | 'attended'
  notes text, -- user's own notes about the event
  added_at timestamptz default now(),
  status_updated_at timestamptz default now(),
  source text not null default 'manual', -- 'manual' | 'concierge' | 'editors_pick' | 'map'
  unique (plan_id, event_id)
);

create index idx_plan_items_plan on plan_items(plan_id);
create index idx_plan_items_status on plan_items(plan_id, status);

-- AI Concierge logs (analityka)
create table concierge_logs (
  id bigserial primary key,
  plan_id uuid references plans(id),
  profile_text text not null,
  recommended_event_ids text[] not null,
  accepted_event_ids text[], -- updated gdy user akceptuje konkretne propozycje
  prompt_tokens int,
  completion_tokens int,
  created_at timestamptz default now()
);

-- External sources (statyczna lista dla /beyond, można w JSON ale w DB ułatwia update)
create table external_sources (
  id text primary key, -- slug, np. "yorkseed"
  name text not null,
  url text not null,
  description text not null, -- 1-2 zdania
  best_for text not null, -- "I want to see EVERYTHING"
  category text not null, -- 'aggregator' | 'newsletter' | 'official' | 'curated'
  sort_order int default 0
);
```

**RLS:**
- `events`, `external_sources` — public read, write tylko service role.
- `plans` — anonymous: public read po `anonymous_token` lub `ical_token`. Authenticated: user reads/writes własne.
- `plan_items` — read/write tylko jeśli user owns parent plan (przez `anonymous_token` w cookies/header lub `auth.uid()`).
- `concierge_logs` — write tylko service role, read tylko admin.

**Rate limiting** (middleware): 5 AI Concierge calls / IP / godzina, 100 plan_item operations / IP / godzina.

---

## 3. Project structure

```
nytw-companion/
├── app/
│   ├── (marketing)/
│   │   ├── page.tsx                    # Landing
│   │   ├── about/page.tsx              # O projekcie
│   │   └── beyond/page.tsx             # Lista innych agregatorów
│   ├── events/
│   │   └── page.tsx                    # Browse — day-grouped timeline + Editor's Picks
│   ├── my-plan/
│   │   ├── page.tsx                    # Pełen widok My Plan + status + iCal
│   │   └── [shareToken]/page.tsx       # Read-only share view
│   ├── plan/
│   │   └── page.tsx                    # AI Concierge form
│   ├── now/
│   │   └── page.tsx                    # Mobile-first "next up" widok
│   ├── api/
│   │   ├── concierge/route.ts          # POST — generuje propozycje
│   │   ├── ical/[token]/route.ts       # GET — iCal feed dla My Plan
│   │   ├── plan/route.ts               # POST/PUT — sync My Plan z DB
│   │   ├── magic-link/route.ts         # POST — wysyła magic link
│   │   └── auth/callback/route.ts      # Supabase auth callback
│   ├── layout.tsx
│   ├── globals.css
│   └── opengraph-image.tsx
├── components/
│   ├── ui/                             # shadcn/ui
│   ├── EventCard.tsx                   # Karta z Add/Remove + RSVP button
│   ├── EventDetailModal.tsx            # Modal (Sheet/Dialog) z detalem
│   ├── EventList.tsx                   # Day-grouped timeline
│   ├── EventSearch.tsx                 # Fuse.js search bar
│   ├── EventFilters.tsx                # Power-user drawer (Phase 6)
│   ├── EventMap.tsx                    # Mapbox GL — pełna mapa per dzień
│   ├── MyPlanWidget.tsx                # Persistent floating bottom-right
│   ├── MyPlanTimeline.tsx              # Plan w day-grouped view
│   ├── MyPlanMap.tsx                   # Mapa TYLKO planu + routing
│   ├── StatusToggle.tsx                # Per-event status picker
│   ├── ConflictWarnings.tsx            # Subtelne klamerki
│   ├── NextUpCard.tsx                  # /now central widget
│   ├── ConciergeForm.tsx               # Profile input
│   ├── ConciergeProposals.tsx          # Lista propozycji z per-event Accept/Skip
│   ├── EditorsPicksCarousel.tsx        # Z visible blurb
│   ├── BeyondList.tsx                  # Lista external sources
│   ├── MagicLinkPrompt.tsx             # Soft inline, po 3 eventach
│   └── VirtusLabFooter.tsx
├── lib/
│   ├── supabase/                       # client / server / service
│   ├── anthropic.ts                    # Claude API wrapper
│   ├── ical.ts                         # iCal generator
│   ├── geo.ts                          # haversine, travel time, neighborhood centroids
│   ├── time.ts                         # NYC timezone helpers (date-fns-tz)
│   ├── plan-store.ts                   # Zustand store + localStorage middleware
│   └── types.ts                        # Shared types (zod schemas)
├── data/
│   ├── seed-events.json                # Kuratowska lista
│   ├── editors-picks.json              # 5-7 wyróżnionych
│   ├── external-sources.json           # Lista dla /beyond
│   └── seed.ts                         # Skrypt seedujący Supabase
├── public/
│   ├── og-image.png
│   ├── manifest.json                   # PWA manifest
│   └── icons/                          # PWA icons
├── middleware.ts                       # Rate limiting + cookie session
├── service-worker.ts                   # Offline cache (via next-pwa)
├── next.config.ts                      # PWA config
├── package.json
└── .env.local.example
```

---

## 4. Environment variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic
ANTHROPIC_API_KEY=

# Mapbox (public token, restricted to your domain)
NEXT_PUBLIC_MAPBOX_TOKEN=

# App
NEXT_PUBLIC_APP_URL=https://nytw.dev
NEXT_PUBLIC_VIRTUSLAB_EVENT_ID=virtuslab-ai-engineering-2026-06-04

# Email (Supabase Auth używa własnego SMTP albo Resend)
RESEND_API_KEY=  # opcjonalnie, jeśli custom branding magic link
```

---

## 5. Build phases — prompty dla Claude Code

### Phase 1 — Scaffold + Supabase + brand foundations

```
Cel: Postaw nowy projekt Next.js 15 z TypeScript, Tailwind, shadcn/ui, Supabase, podstawową strukturą i first version landing page.

Wymagania:
1. `npx create-next-app@latest nytw-companion --typescript --tailwind --app --eslint`
2. Zainstaluj: @supabase/ssr, @supabase/supabase-js, @anthropic-ai/sdk, mapbox-gl, ics, zod, zustand, react-hook-form, @hookform/resolvers, date-fns, date-fns-tz, lucide-react, fuse.js, next-pwa
3. shadcn/ui init: button, card, input, textarea, badge, dialog, sheet, sonner (toasts), tabs, scroll-area, tooltip, separator
4. Skonfiguruj Supabase clients w `lib/supabase/` (browser, server, service) zgodnie z @supabase/ssr docs
5. Utwórz migrację Supabase z DDL z sekcji "Data model" tej spec — WSZYSTKIE tabele (events, plans, plan_items, concierge_logs, external_sources)
6. Włącz Supabase Auth z magic link email provider (bez Google OAuth)
7. Stwórz `lib/time.ts` z helperami:
   - `nowInNYC(): Date` — bieżący czas w America/New_York
   - `formatInNYC(date: Date, format: string): string`
   - `isHappeningNow(starts_at, ends_at): boolean`
8. Stwórz `lib/plan-store.ts` — Zustand store z `persist` middleware (localStorage key: 'nytw-my-plan'). Pola:
   - `planId: string | null` (UUID, generated client-side)
   - `anonymousToken: string` (UUID, dla URL recovery i DB sync)
   - `items: { event_id: string, status: PlanStatus, notes?: string, added_at: string }[]`
   - Actions: addItem, removeItem, updateStatus, updateNotes, clear, hydrate
9. Landing page (`app/(marketing)/page.tsx`):
   - Header: "NYTW Engineer's Companion" + tagline "1,000+ events. 168 hours. Plan the week you actually want."
   - Two equal CTAs: "Browse 87 events →" i "Plan my week with AI →"
   - Editor's Picks teaser (placeholder na razie)
   - Stopka: VirtusLab brand + "Not affiliated with a16z or Tech Week"
   - Brand: dark mode default, JetBrains Mono headlines, accent #FF6B35
10. Setup `.env.local.example` z env vars z sekcji 4
11. README z setup instructions
12. PWA config (`next.config.ts` + `public/manifest.json`) — minimal, refine'owany w Phase 8

Nie implementuj jeszcze: events list, my-plan, concierge, mapy, /now. Tylko fundament.
```

### Phase 2 — Browse + My Plan basic (add/remove + persistent widget + modal detail)

```
Cel: User może browse'ować eventy w day-grouped timeline, dodawać do My Plan jednym klikiem, widzieć persistent licznik. Eventy otwierają się jako modal — bez utraty kontekstu scroll.

Wymagania:
1. Stwórz `data/seed-events.json` z minimum 30 mockowych eventów (Artur podmieni potem na realne). Format zgodny z `events` schema. Realistic NYC venues + neighborhoods (Flatiron, SoHo, Williamsburg, DUMBO, Hudson Yards). Pola obowiązkowe:
   - id (slug), title, description (2-3 zdania), host, starts_at + ends_at (rozsiane między 2026-06-01 a 2026-06-07), venue_name, address, lat, lng, neighborhood, rsvp_url (link do Lumy/Partiful), rsvp_platform, tags (paleta: ai-infra, devtools, platform-eng, agentic-ai, fundraising, hiring, open-source, data-eng, founder-stories), audience_tags (founder/cto/engineer/vc/designer), format, is_editors_pick (5-7 z nich = true), editors_pick_blurb dla nich, is_virtuslab_event (1 = true z id z env)
2. Skrypt `data/seed.ts` z Supabase service client upsertujący JSON → DB
3. Strona `app/events/page.tsx`:
   - Server component, pobiera eventy z Supabase posortowane po starts_at
   - **Day-grouped timeline**: sticky headery "Monday June 1", "Tuesday June 2"...
   - W obrębie dnia chronologicznie z subtelnymi separatorami "EARLY" / "MID" / "LATE" (bez sztywnych godzin)
   - Sticky day nav po lewej desktop / horizontal chip nav mobile
   - Counter eventów per dzień ("12 events")
   - Editor's Picks carousel na samej górze (z visible blurb!)
4. Komponent `EventCard` (autonomiczny, działa bez filtrów):
   - Tytuł (large, monospace)
   - Host (z avatarem/inicjałem)
   - Czas w timezone NYC: "Wed 6:00 PM – 9:00 PM"
   - Neighborhood badge
   - Tag chips (read-only w v1.2 — klikalność dochodzi w Phase 6)
   - Format icon
   - 1-line teaser description
   - **Primary action**: "Open RSVP →" (otwiera external link w nowej zakładce + automatycznie dodaje do My Plan z status='interested' + toast "Added — confirm RSVP on Luma")
   - **Secondary action**: "Save" (mniejszy, dodaje do My Plan bez otwierania external)
   - Jeśli już w My Plan: oba buttony zmieniają się na "In your plan ✓" + dropdown z opcjami [Open RSVP / Update status / Remove]
   - Badges: "Editor's Pick" (gold), "Featured" (event VirtusLab), "Invite-only", "Free food/drinks", capacity hint jeśli znana
5. Komponent `EventDetailModal` (shadcn Sheet na mobile, Dialog na desktop):
   - Otwiera się przy kliknięciu w body karty (nie buttona)
   - Pełny opis, mapa pojedyncza (Mapbox static API — 1 obrazek), info o hoście, "Other events at same time", "Earlier/later same day nearby"
   - **NIE jest osobnym routem** — zostaje w `/events`, ale można pushState dla deep link (`/events#event-id`)
   - Zamknięcie wraca user dokładnie tam gdzie był w scroll
6. Komponent `EventSearch`:
   - Search bar na górze `/events`
   - Fuse.js fuzzy match po title + host + description + tags
   - Real-time, ESC żeby wyczyścić, focus przez `/` keyboard shortcut
   - Wynik = ta sama struktura day-grouped, mniej kart
   - Empty state: "No matches — try broader terms, or browse other agregators →" (link do /beyond w Phase 7, na razie placeholder)
7. **Persistent `MyPlanWidget`** (komponent renderowany w root layout):
   - Bottom-right floating button na desktop (z licznikiem "My Plan (3)")
   - Bottom bar na mobile
   - Klik = expand mini-preview (lista 3-5 ostatnich + "Open full plan →")
   - Widoczny ZAWSZE, na każdej stronie
   - Hidden gdy plan jest pusty
8. **Klawiatura first**: na zaznaczonej karcie spacja/A = add to plan, R = open RSVP, ESC = close modal, / = focus search
9. **Implicit-add UX**: po kliknięciu "Open RSVP" zewnętrzny link otwiera się w nowej zakładce, ale przed otwarciem appka pokazuje 2-sec toast "Added to your plan" + delikatna animacja na widgecie

NIE buduj w tej fazie:
- Komponentu `EventFilters` (Phase 6)
- Klikalnych tagów (Phase 6)
- /my-plan dedicated route (Phase 4)
- Status tracking UI (Phase 4)
- iCal feed (Phase 4)
- Konfliktów (Phase 4)
- AI Concierge (Phase 5)
- Mapy (Phase 3)

**Acceptance test:** new user wchodzi na /events, w 30 sekund znajduje 3 ciekawe eventy, klika "Open RSVP" na każdym (otwierają się Luma w 3 zakładkach), zamyka Lumy, wraca do appki, widzi widget "My Plan (3)" w prawym dolnym rogu. Zero confusion, zero formularzy, zero loginów.
```

### Phase 3 — Mapa + /now mobile entry (v1.3 = full functional browse)

```
Cel: Dodaj widok mapy z eventami per dzień + strona /now jako mobile entry point. Po tej fazie browse jest publishable.

Wymagania:
1. Komponent `EventMap` (client, mapbox-gl):
   - Centrum NYC (40.7589, -73.9851)
   - Default zoom 12, dark theme (`mapbox://styles/mapbox/dark-v11`)
   - Każdy event = pin, kolor po formacie (rooftop: amber, dinner: red, panel: blue, breakfast: green, hackathon: purple, workshop: teal)
   - Pin VirtusLab event = większy, gold, z labelem
   - Editor's Picks = z gwiazdką
   - Klik na pin = popup z mini-cardem + "Open details" (otwiera EventDetailModal z Phase 2)
   - Klastry przy > 5 pinów w viewport
2. Toggle "Timeline view" / "Map view" segmented control top-right `/events`
3. **Day selector chip nav** wbudowany w mapę (NIE filter — kontroluje JAKI dzień widzisz, default najbliższy lub Mon 1 czerwca). Bez "all days" — wizualnie nieczytelne.
4. **Click pin → "Explore around here"**: popup eventu + sekcja "5 nearest events same day" sortowane po walking time
5. State w URL: `/events?view=map&day=wed` — shareable
6. Helper `lib/geo.ts`:
   - `haversineKm(lat1, lng1, lat2, lng2): number`
   - `walkingTimeMin(distanceKm): number` — 12 min/km
   - `uberTimeMin(distanceKm): number` — 4 min/km + 5 min wait
   - `neighborhoodCentroids: Record<string, [lat, lng]>` — hardcoded NYC dzielnice
7. **`MyPlanWidget` na mapie**: pokazuje toggle "Show all" / "Show only My Plan" — gdy "My Plan", piny innych eventów wyszarzane

8. **Strona `app/now/page.tsx`** — krytyczna dla in-event UX:
   - Mobile-first (przekierowuje desktop userów na /events z toast "On mobile, /now is your home screen")
   - Default route dla PWA install (manifest start_url = "/now")
   - Real-time co minutę: `lib/time.ts` `nowInNYC()`
   - **Główny widget `NextUpCard`**:
     - Jeśli My Plan ma event który zaczyna się w najbliższych 2h: pokaż go duży
     - Tytuł, host, dokładny adres, godzina, czas do startu ("Starts in 47 min")
     - Travel time z aktualnej lokalizacji (jeśli user da geolocation permission; opt-in z prompt)
     - Button "Open in Maps" — natywne deep link (`maps:?address=...` na iOS, `geo:` na Android, fallback Google Maps URL)
     - Button "Update status" (otwiera StatusToggle z Phase 4 — na razie placeholder)
     - Button "Skip this event" (status = declined)
   - **Sekundarne widgety**:
     - "After this": następny event w My Plan po obecnym
     - "Nothing planned next 2h": pokazuje 3 sugestie z My Plan (jeśli puste plan, sugestie z Editor's Picks)
   - **Layout offline-first**: dane My Plan z Zustand/localStorage (zero network), travel time z cached geo, tylko mapa wymaga online (gradacja: jeśli offline, pokaż adres tekstem)
   - Mini-mapa: **Mapbox Static API** (1 obrazek z pinem) zamiast WebGL — battery friendly
   - Pull-to-refresh dla update statusu
9. **Hamburger menu** w `/now` z linkami do: My Plan, Browse, Plan with AI, Beyond, About
10. State persistence: `/events?view=map&day=wed` w URL params (shareable widoki)

Mobile timeline view: bottom sheet z "now / next hour" (z My Plan, fallback z Editor's Picks). Desktop: split 60% mapa / 40% lista same-day eventów.

**Acceptance test v1.3:**
- Desktop: user otwiera `/events?view=map&day=wed`, widzi piny środowych eventów, klika pin w Williamsburg, widzi 5 najbliższych środowych eventów z czasem dojścia, klika "Open RSVP" → toast "Added to plan" → widget My Plan (n+1).
- Mobile: PWA install → otwiera się na `/now` → widzi "Next up: OpenAI Rooftop in 47 min, Williamsburg, 35 min Uber" → klika "Open in Maps" → leci taxi.
```

### Phase 4 — Dedicated /my-plan + status tracking + iCal + conflict detection

```
Cel: Pełen widok My Plan z timeline'em, mapą, per-event status, iCal feedem, conflict warnings, batch operations. To jest pełny planner.

Wymagania:
1. Strona `app/my-plan/page.tsx`:
   - Hydratuje stan z Zustand store (localStorage) + jeśli authenticated, sync z DB
   - Header: nazwa planu (editable inline, default "My NYTW Plan"), liczniki ("8 events: 3 confirmed, 2 pending, 1 waitlist, 2 interested")
   - **Tabs**: "Timeline" / "Map" / "All statuses"
   
2. Tab "Timeline" (komponent `MyPlanTimeline`):
   - Day-grouped (jak /events) ale TYLKO eventy z planu
   - Każdy event = bogata karta z:
     - Wszystko z standard EventCard (Phase 2)
     - **`StatusToggle`** — segmented picker: [Interested / RSVPed / Confirmed / Waitlist / Declined / Attended]
     - Notes textarea (collapsed default, "Add note ▼")
     - "Remove from plan" link (małe, w corner)
     - "Open RSVP →" button (jak w EventCard)
   - **`ConflictWarnings`**: jeśli 2+ confirmed/RSVPed events overlap, wizualna klamerka po lewej łącząca je + subtelny tekst "Conflict — 2 confirmed events same time". Bez modali, bez alertów. Tap = highlight obu.
   - **Pro-social CTA przy konfliktach**: gdy user ma 2 confirmed conflicting, mały button "Pick one and decline the other →" — ułatwia drop'nięcie żeby zwolnić waitlist
   
3. Tab "Map" (komponent `MyPlanMap`):
   - Mapa NYC z pinami TYLKO z planu, kolory po statusie (confirmed/pending = full kolor, interested = wyszarzone, declined = przekreślone)
   - **Day selector** (jak Phase 3)
   - **Routing**: linie między eventami w kolejności chronologicznej dnia + label czasu dojścia ("32 min Uber / 1h 15min walking")
   - Klik na pin = popup + statusToggle
   - "Geographic concentration" hint: jeśli wszystkie dnia w Manhattan, pokaż badge "Manhattan day"; jeśli mix Manhattan+Brooklyn, pokaż "⚠ Cross-borough day — plan transit"
   
4. Tab "All statuses" — kompaktowy grid view, dobrego do D-1 review:
   - Lista wszystkich event w planie posortowana po statusie (Confirmed first, Interested last)
   - **Batch operations**: checkboxy + "Mark selected as: [RSVPed / Confirmed / Declined]"
   - Quick filters: button bar "Show only: All / Confirmed / Pending / Waitlist / Interested"
   - Export: "Copy as text", "Email me my plan"

5. **iCal feed**: route handler `app/api/ical/[token]/route.ts`:
   - Pobiera plan po `ical_token`
   - Generuje iCal feed z `ics` package — TYLKO eventy ze statusami `rsvp_pending`, `confirmed`, `waitlist` (skip `interested` i `declined`)
   - Każdy event = VEVENT z UID, SUMMARY (status emoji prefix: ✅ confirmed, ⏳ pending, 📋 waitlist), DESCRIPTION (host + notes + reasoning if from concierge), LOCATION (address), DTSTART, DTEND, URL (rsvp_url)
   - Calendar name: "NYTW 2026 — {plan display_name}"
   - Refresh hint: 1h
   - Headers: `Content-Type: text/calendar; charset=utf-8`
   - **Update via webhook trick**: gdy user zmienia status w UI, ical_token nadal ten sam, ale `updated_at` plan bumpsi. Google Calendar refreshuje co 24h domyślnie — pokazujemy w UI hint "Calendar syncs once a day"

6. **Share read-only link**:
   - Button "Share" w `/my-plan`
   - Generuje URL `/my-plan/[shareToken]` (shareToken = `ical_token` reused, ale READ-ONLY widok)
   - Page `app/my-plan/[shareToken]/page.tsx`: pokazuje plan w timeline view, **bez** edit controls. Na górze "Shared by: {display_name}". Z CTA dla viewera "Build your own plan →"

7. **Sync z DB** (jeśli user zrobił magic link signup w Phase 5):
   - Server Action `syncPlanToDb()` — wywoływana po każdej zmianie planu (debounced 2s)
   - DB jest source of truth dla authenticated users; localStorage zostaje jako cache
   - Konflikty (user otworzył w 2 tabach): last-write-wins (proste, OK dla MVP)

8. **Empty state** dla pustego planu:
   - Ilustracja
   - "Your plan is empty. Start here:"
   - 3 CTAs: "Browse events →", "Plan with AI →", "Check Editor's Picks →"

**Acceptance test v1.4:** user ma 8 eventów w planie, otwiera /my-plan, widzi timeline z 5 confirmed + 3 interested, klika "Map" tab, widzi środowe 3 eventy z liniami i czasem dojazdu między nimi, wraca, zaznacza 2 ostatnie jako "Confirmed", klika "Share" → kopiuje URL, otwiera w incognito → widzi read-only plan. Kopiuje iCal URL z My Plan settings, wkleja do Google Calendar → 5 confirmed events pojawia się z ✅ prefix.
```

### Phase 5 — AI Concierge (augmenter) + email magic link recovery

```
Cel: AI Concierge augmentuje istniejący plan (lub seed'uje pusty plan), zwraca propozycje per-event z Accept/Skip. Magic link save uruchamiany po 3 eventach.

Wymagania:
1. Strona `app/plan/page.tsx`:
   - Komponent `ConciergeForm`:
     - Pre-fill: jeśli user ma już events w My Plan, pokaż "You have 4 events. AI will suggest more — won't replace your plan."
     - Textarea: "Tell us about yourself" (placeholder: "I'm a CTO at a 30-person AI startup, flying in from Warsaw. Looking for GenAI infrastructure talks, fundraising contacts, and AI talent. Available Tue-Fri.")
     - Optional second field: "What kind of suggestions?" (multiselect chips: "Fill gaps in my plan", "Add evening social events", "Add invite-only seeming events", "All")
     - Submit: "Get 5-8 suggestions →"
2. Route handler `app/api/concierge/route.ts`:
   - Input: `{ profile_text: string, plan_id: string, existing_event_ids: string[] }`
   - Walidacja: zod, max 1000 znaków profile_text
   - Rate limit: 5/IP/godzina (in-memory Map dla MVP)
   - Pobierz wszystkie eventy z DB (filter out existing_event_ids — AI nie powinno proponować duplikatów)
   - Wywołaj Claude API z system prompt z sekcji 6
   - Parse structured output
   - Zapisz do `concierge_logs` z plan_id
   - Zwróć { proposals: [...] }
3. Komponent `ConciergeProposals`:
   - Lista 5-8 propozycji jako cards (read-only, podobne do EventCard)
   - Każda z `reasoning` ("Why for you: ...")
   - Każda z `priority` badge ("must-attend" / "high" / "medium")
   - Per-event buttons: **"Add to plan ✓"** / **"Skip"** / **"Tell me more"** (opens modal)
   - **Bulk action**: "Add all 5 →" w góry (z confirmation toast)
   - Po akceptacji: status na karcie "Added ✓ — see /my-plan", event pojawia się w My Plan z source='concierge'
4. **UWAGA krytyczna**: w prompt'cie do AI **NIE MA hardcoded reguły o VirtusLab event**. Event VirtusLab jest po prostu jednym z 80-120 w bazie, ma uczciwie wybrane tagi, jest w Editor's Picks (transparentny human pick). AI go zaproponuje jeśli faktycznie pasuje do profilu — i to ważna feedback loop dla Artura: jeśli AI go nie proponuje dla AI/eng profili, to znak że event tags/description są źle ustawione.

5. **`MagicLinkPrompt`** — soft inline component:
   - Trigger: po 3 dodanych eventach do My Plan (counter w Zustand)
   - Render: inline bar nad MyPlanWidget: "Save your plan? Email magic link, no password."
   - Form: email input + submit. POST `/api/magic-link`
   - Dismissible (X). Jeśli dismissed, nie pokazuj ponownie przez 24h (localStorage flag)
   - Po sukcesie: toast "Check {email}. Click link to recover from anywhere."
   - Magic link → Supabase Auth standard flow → callback → associuje aktualny anonymous_token z user_id w `plans` table

6. Route `/api/magic-link`:
   - Wywołuje `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: '/my-plan' } })`
   - Customizowany email subject/body przez Supabase template settings (lub Resend jeśli chcesz brand)

7. Route `/api/auth/callback`:
   - Standard Supabase callback
   - Po session exchange: jeśli w cookies był anonymous_token, update'uje `plans.user_id = session.user.id` dla tego anonymous_token
   - Redirect do `/my-plan`

NIE implementuj: edycja zapisanego planu z innego device (last-write-wins jest OK dla MVP), share-with-edit, social login.

**Acceptance test v1.5:** user otwiera /plan, wpisuje "Solo founder pre-seed building AI agents, Tue-Fri available", dostaje 6 propozycji, klika "Add all" → wszystkie w My Plan, widzi "Save your plan?" prompt, wpisuje email, dostaje link w skrzynce, klika z innego device → widzi plan z 6 eventami.
```

### Phase 6 — Filters (power-user side feature) — OPCJONALNE DLA MVP

```
Cel: Filtry jako opcjonalna warstwa. Schowane domyślnie. **Możesz wyciąć tę fazę z MVP** — Search + Editor's Picks + AI Concierge + Mapa + My Plan pokrywają 90% use case'ów.

Wymagania:
1. UI placement: ikonka "Filters" (z badge'em aktywnych) w toolbar `/events` i `/my-plan`. Klik = sliding sheet/drawer (mobile bottom sheet).
2. Komponent `EventFilters` (Zustand store `useFilters`):
   - Day chips (multi-select)
   - Tag chips (multi-select z palety)
   - Audience chips
   - Neighborhood chips
   - Format chips
   - Toggles: "Only Editor's Picks", "Free food/drinks", "Hide invite-only"
   - Time of day slider (rano/popołudnie/wieczór)
   - "Reset all" + "Apply"
3. State w URL params (`/events?tags=ai-infra,devtools&day=wed`) — shareable
4. **Aktywne filtry chip rack** pod toolbar gdy aktywne, każdy z `x`, plus "Clear all"
5. **Klikalne tagi w EventCard** (aktualizacja Phase 2): klik na tag = dodaje do filtrów + otwiera drawer "Filtered by: ai-infra"
6. Counter w toolbar: "Showing X of Y events"
7. Empty state przy zerze wyników: "No matches — try removing filters, or check Beyond →"
8. Filtry działają w obu widokach (timeline + mapa)
9. **NIE wpływają na**:
   - AI Concierge (Concierge ma własną curacje per profile, ignoruje filters)
   - Editor's Picks carousel (zawsze pełny)
   - Sticky day headers w timeline (zawsze)
   - /my-plan (filtry tylko na browse)

**Acceptance test:** user który nigdy nie otworzy drawera filtrów ma identyczny experience jak po Phase 1-5. Power user klika tag chip w EventCard, drawer się otwiera z tagiem zaznaczonym, widzi 12 z 87 eventów, klika "Open RSVP" na 3, share'uje URL, znajomy widzi te same filtry.
```

### Phase 7 — /beyond + landing polish + Editor's Picks transparency

```
Cel: Strona /beyond z linkami do innych agregatorów, landing page hook, Editor's Picks z widocznymi blurbami.

Wymagania:
1. **Strona `app/(marketing)/beyond/page.tsx`** — uczciwa lista alternatyw:
   - Header: "We curate 87 engineering-relevant events from 1,000+. We skip a lot. Here's where to find the rest."
   - Lista z `data/external-sources.json` (lub DB external_sources table):
     - **Yorkseed** (nytw.yorkseed.co) — "1,800+ events. Broader scope. Best for: I want to see EVERYTHING."
     - **Andrew Yeung Tech Week** (luma.com/AndrewTechWeek) — "Mega-events from a known NYC operator. Best for: founder-heavy networking."
     - **GarysGuide** (garysguide.com/lists/h48w42m/NY-Tech-Week) — "15+ year NYC tech newsletter. Best for: longer-term scene context."
     - **Vibecal** (vibecal.com/nytw) — "Tag-based filtering by niche (#ai #founders). Best for: I know exactly what I want."
     - **Carly AI** (usecarly.com/nyc-tech-week-schedule) — "Full iCal subscribe of ALL 1,000+ events. Best for: just sync everything to my calendar."
     - **Build Week NYC** (techweeknyc.com) — "Civic tech and public sector focus. Best for: govtech / civic tech audiences."
     - **Partiful #NYTechWeek** (partiful.com/u/7DFu4rITofNzKIjA7hCx) — "Native Partiful hub. Best for: discovering afterparties and rooftops."
     - **Tech Week Official** (tech-week.com/calendar/nyc) — "The source of truth from a16z. Best for: official listings, weak filters."
     - **Luma /nytw + /nytw/map** — "Luma's own NYTW calendar with map view. Best for: Luma-native events with geo browse."
   - Każda pozycja: nazwa, tagline, "Best for" wyróżnione, link button "Visit →"
   - Sekcja "Why we link the competition": 2 zdania uczciwości — "Tech Week is too big for one tool. We're the curated engineering layer; these cover what we don't."
2. **Linki do /beyond z empty states**:
   - Search bez wyników: "No matches. Try one of these places →"
   - Filter zero wyników (Phase 6): "Try removing filters or check broader sources →"
   - AI Concierge gdy zwraca < 4 dobrych matches: "Your profile is specific — for more options, check Beyond →"
3. **Nav**: dodaj "Beyond" jako 4th item (Browse / My Plan / Plan with AI / Beyond)
4. **Stopka**: link "Other resources" → /beyond

5. **Landing polish** (`app/(marketing)/page.tsx`):
   - Hero z bold copy: "1,047 events. 168 hours. Don't lose your week."
   - **Two equal CTAs** (jak w Phase 1 ale teraz funkcjonalne):
     - "Browse 87 curated events →" (large button)
     - "Plan my week with AI →" (large button)
     - Plus subtle "or check /beyond if you want it all"
   - 3-step flow visualization: "1. Browse or AI-plan → 2. Add to My Plan → 3. Sync to your calendar"
   - **Editor's Picks teaser carousel** z FULL BLURBS (nie tylko tytuł):
     - Każda karta pokazuje: tytuł, host, **"Why we picked this:" + 1-2 zdania blurb**, godzina, neighborhood, "Add to plan →" button
     - Auto-rotate 5s + manual prev/next
     - Event VirtusLab zawsze na pozycji 1 lub 2, z TRANSPARENTNYM disclaimerem w blurb: "Disclosure: this event is hosted by VirtusLab, who built this tool. We picked it because it's a deep technical session on [topic] — judge for yourself."
   - "Why we built this" — 2 paragrafy, persona-honest (signed: Artur Skowroński, VirtusLab)
   - "What we don't do" — bullet pointy o uczciwych ograniczeniach:
     - "We don't RSVP for you. You click through to Luma/Partiful, then mark status here."
     - "We don't have every event — we have 87 we'd recommend to an engineer friend."
     - "We don't track you. Plan stored in your browser. Email link only if you want recovery."
   - VirtusLab footer (komponent `VirtusLabFooter`)

6. **About page** (`app/(marketing)/about/page.tsx`):
   - "Why this exists" — short essay
   - "How we curate" — transparent
   - Disclaimer "Not affiliated with a16z / Tech Week"
   - Artur bio + LinkedIn + zdjęcie

7. **SEO**:
   - `app/opengraph-image.tsx` — generated OG z "NYTW Companion — 87 engineering-relevant events"
   - Metadata per route
   - sitemap.xml + robots.txt

8. **Polish**:
   - Loading states (skeletons)
   - Empty states (każdy z meaningful CTA)
   - Error boundaries
   - Toast notifications (sonner)
   - Keyboard shortcuts visible w "? = help" modal
   - Light/dark mode toggle (dark default)
   - Mobile-first responsive

**Acceptance test v1.7:** user wchodzi na landing, widzi Editor's Picks z blurbami (czyta "Why we picked this" dla każdego), klika "Browse 87 events", w empty state search po "robotics" widzi "No matches — try one of these places →" które leci do /beyond, na /beyond widzi 9 alternatyw z uczciwym opisem.
```

### Phase 8 — Offline PWA + deployment + monitoring

```
Cel: PWA installable, offline-capable, deployed na production domain, basic monitoring.

Wymagania:
1. **PWA setup** (`next-pwa`):
   - manifest.json: name "NYTW Companion", short_name "NYTW", icons, theme_color, background_color, start_url "/now", display "standalone"
   - Service Worker (next-pwa generuje):
     - Cache: static assets (JS, CSS, fonts)
     - Cache: API responses dla events (24h TTL)
     - Cache: tile mapy najbliższych dzielnic NYC (Mapbox cache strategy)
     - Network-first dla `/api/plan`, `/api/concierge`
     - Cache-first dla `/api/events`, `/api/ical/[token]`
   - Offline fallback: jeśli całkiem offline i request do nowej strony — graceful "You're offline. /now should still work →"
2. **My Plan w pełni offline**:
   - Zustand z localStorage = działa offline natywnie
   - /now route renderuje z localStorage, zero network
   - StatusToggle update — optimistic, queue do DB sync gdy back online
3. **Geolocation prompt** (tylko w /now):
   - Opt-in, jasna copy: "Get travel times to your events — uses your location, only stored on this device"
   - Cache last position 5 min
4. **Real-time clock** w /now widget: update co minute, używa `lib/time.ts` `nowInNYC()` (date-fns-tz)
5. **Vercel deploy**:
   - Połącz repo z Vercel
   - Env vars w Vercel dashboard
   - Production = `main`, preview = każdy PR
   - Custom domain (sprawdź dostępność: `nytw.dev` — preferred, fallback `nytw-companion.app`)
6. **Vercel Analytics** enable
7. **Sentry** (opcjonalnie):
   - `@sentry/nextjs`
   - Source maps, error boundary integration
8. **Healthcheck** `app/api/health/route.ts`: Supabase ping + Anthropic key check
9. **Vercel Cron** (`vercel.json`):
   - Daily 4 AM EST: refresh events z seed-events.json (idempotent upsert)
10. **README update**:
    - Local dev setup
    - Production deploy
    - Data update workflow (edytuj seed-events.json + commit + auto-deploy)

Skip: A/B testing, advanced cache invalidation, multi-region.

**Acceptance test v1.8:** user instaluje PWA na iPhone, włącza tryb samolotowy, otwiera appkę, widzi /now z eventami z lokalnego planu, klika "Update status" — UI aktualizuje natychmiast, wraca online, sync do DB happens automatycznie.
```

### Phase 9 — Pre-launch QA

```
Cel: Pre-launch checklist.

Wymagania:
1. **E2E test scenariusze (Playwright)**:
   - Visit landing → click "Browse 87" → search "AI" → click EventCard → modal opens → click "Open RSVP" → new tab opens to Luma + My Plan widget shows (1)
   - Visit /plan → fill profile → submit → see 6 proposals → "Add all" → /my-plan shows 6 events
   - Add 3rd event → magic link prompt appears → enter email → magic link sent
   - On mobile: install PWA → opens /now → see "Next up" widget with countdown
2. **Lighthouse**: perf > 90 desktop, > 80 mobile; a11y > 95; SEO 100; PWA installable check passes
3. **Manual QA**:
   - iPhone Safari, Android Chrome
   - Test offline mode (airplane → /now still works)
   - Test z pustą bazą (graceful empty states)
   - Test z 200+ eventami w bazie (perf)
   - Test rate limit (6th AI Concierge call → 429)
4. **Social cards** (opengraph.xyz check)
5. **Privacy policy + Terms** (Vercel templates, edit dla naszego context)
6. **iCal subskrypcja w 3 kalendarzach**: Google Calendar, Apple Calendar, Outlook Online
7. **Magic link email**: SPF/DKIM check, deliverability test
8. **Mobile gestures testing**: swipe, long-press, pull-to-refresh działają

Output: checklist do MD + raport gotowości.
```

---

## 6. AI Concierge — system prompt

System prompt do `lib/anthropic.ts`. **Zmiana z v1.1: usunięta hardcoded reguła o VirtusLab. AI jest uczciwym kuratorem.**

```typescript
export const CONCIERGE_SYSTEM_PROMPT = `You are an event concierge for NYTW Engineer's Companion — a curation tool for Tech Week NYC 2026 (June 1-7, 2026).

Your job: given a user's profile and the list of curated events (and their existing plan), suggest 5-8 additional events the user should consider adding.

PRINCIPLES:
1. Augment, don't replace. The user already has a plan. You're proposing additions, not rebuilding.
2. Quality over quantity. 5-8 max. Tech Week burnout is real.
3. Geographic awareness. Don't suggest Manhattan event at 6pm followed by Brooklyn at 7pm in their existing plan. Account for travel.
4. Diversity of formats. Mix panels, dinners, breakfasts. Don't all be cocktail hours.
5. Strategic spread across days. Don't pile 4 suggestions on one already-busy day.
6. Honor stated priorities. If user says "AI infrastructure", weight those heavily.
7. Include 1 "stretch" suggestion — something tangentially related that might surprise them.
8. Skip duplicates. existing_event_ids are events already in plan — never propose those.
9. Be honest about uncertainty. If the user's profile is highly specific (e.g., "robotics + Polish-speaking + Tuesday only"), and few events match, suggest fewer (3-4) rather than padding with weak matches. The "Beyond" page exists for cases when we don't have enough.

OUTPUT FORMAT (strict JSON, no markdown):
{
  "proposals": [
    {
      "event_id": "string",
      "reasoning": "1-2 sentence explanation of why THIS event for THIS user, referencing their stated interests",
      "priority": "must-attend" | "high" | "medium",
      "is_stretch": boolean
    }
  ],
  "notes": "Optional 1-sentence honest meta-comment, e.g., 'Limited matches for niche interest — consider checking /beyond' or null"
}`;
```

Wywołanie:

```typescript
import Anthropic from '@anthropic-ai/sdk';

export async function generateProposals(
  profileText: string,
  events: Event[],
  existingEventIds: string[]
): Promise<{ proposals: Proposal[]; notes: string | null }> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const candidateEvents = events.filter(e => !existingEventIds.includes(e.id));

  const userMessage = `USER PROFILE:
${profileText}

USER'S EXISTING PLAN (do not propose these again):
${existingEventIds.length > 0 ? existingEventIds.join(', ') : '(empty — user is starting fresh)'}

CANDIDATE EVENTS:
${JSON.stringify(candidateEvents.map(e => ({
  id: e.id,
  title: e.title,
  host: e.host,
  starts_at: e.starts_at,
  ends_at: e.ends_at,
  neighborhood: e.neighborhood,
  tags: e.tags,
  audience_tags: e.audience_tags,
  format: e.format,
  is_editors_pick: e.is_editors_pick,
  description: e.description.slice(0, 200),
})), null, 2)}

Suggest 5-8 events to add (or fewer if matches are weak — be honest).`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: CONCIERGE_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  return JSON.parse(text);
}
```

**Test prompty** (do walidacji w Phase 5):

1. *"I'm a CTO at a 30-person AI startup, flying in from Warsaw. Looking for GenAI infrastructure talks, fundraising contacts, and AI talent. Available Tue-Fri."* → spodziewane: 6-8 propozycji, mix AI infra panels + 1-2 founder dinners + 1 hiring/recruiting event. Event VirtusLab proponowany **jeśli i tylko jeśli** jego tagi naprawdę pasują (powinny — to jest cały sens jego pozycjonowania).
2. *"Polish-speaking robotics founder, Tuesday only, no AI."* → spodziewane: 2-3 propozycje + `notes: "Limited matches for niche interest — consider /beyond"`.
3. *"VP Engineering at fintech series B. Want agent platforms and candidate hires. Wed-Thu only."* → spodziewane: 4-5 propozycji, fintech-friendly AI infra + hiring events, środy/czwartki only.

**Co valid'ować:** jeśli VirtusLab event NIE pojawia się dla case'u 1 mimo realnego overlapu — to znak że trzeba **poprawić tagi/description eventu VirtusLab**, nie hardcode'ować w AI. To jest **najlepszy possible feedback loop** dla Artura jako organizatora.

---

## 7. Data: jak skompletować 80–120 realnych eventów

**Workflow (bez Luma API!):**

1. **Tydzień 1, dzień 1** — uruchom **Apify actor** `avinashchby/tech-events-aggregator` na publicznych URLach: `luma.com/nytw`, `tech-week.com/calendar/nyc`, `partiful.com/u/7DFu4rITofNzKIjA7hCx`. Output: JSON z 1 000+ eventami z publicznych stron. (Apify wystarczy free tier dla one-time scrape; cost ~$1-5.)
2. **Dzień 2-3** — manualnie przejrzyj (w Notion/Coda) i otaguj:
   - **Include** (engineering-relevant): AI infra, devtools, platform eng, agentic AI, technical fundraising, hiring eng talent, open source, data eng
   - **Skip**: pure consumer, fashion tech, crypto trading, wellness, marketing without tech angle
3. **Dzień 4** — wybierz 5–7 **Editor's Picks** (event VirtusLab + 4–6 najbardziej must-attend). Napisz dla każdego 2-zdaniowy `editors_pick_blurb` ("Why we picked this").
4. **Dzień 5** — eksport z Notion/Coda do `data/seed-events.json` w formacie z sekcji 2.
5. **Daily podczas Tech Week** — szybki refresh nowych eventów → commit → Vercel auto-deploy.

**Live scraping w MVP: NIE.** Powody:
- Luma rate-limituje agresywnie publiczne strony
- Partiful często wymaga konta żeby zobaczyć
- ETL ręczny + commit do repo = transparency + audit trail
- Compute koszt zero

---

## 8. Brand & ton

**Visual:**
- Dark mode default (signal "engineer's tool")
- Headlines: JetBrains Mono / IBM Plex Mono
- Body: Inter
- Akcent: `#FF6B35` (pomarańczowy)
- Tło: `#0A0A0A` / `#1A1A1A`
- Tekst: `#FAFAFA` / `#A3A3A3`

**Tone:**
- Krótkie zdania, bez korpomowy
- Honest: *"We curate 87 events from 1,047. We skip the noise so you don't have to."*
- Self-aware: *"Disclosure: VirtusLab built this tool, and one of the Editor's Picks is our event. We picked it because [reason]. Judge for yourself."*
- Engineer-to-engineer: assume technical literacy
- Acknowledge limits: *"We don't RSVP for you. Luma doesn't expose that to third parties. You'll click through and come back to mark status."*

**Don't:**
- Słowa "synergy", "leverage", "ecosystem", "thought leadership"
- Emoji w copy (poza CTA opcjonalnie)
- Stock photos
- Cookie banner z 30 opcjami

---

## 9. Open questions / decisions dla Artura (przed Phase 1)

1. **Domena.** Sprawdź: `nytw.dev`, `techweek.engineering`, `nytw-companion.app`. Rekomendacja: `nytw.dev`.
2. **Event VirtusLab** — venue, data, format zarezerwowane? Spec zakłada że tak. Tags eventu VirtusLab w `seed-events.json` muszą być **uczciwe i bogate** (np. `["ai-infra", "platform-eng", "agentic-ai", "founder-stories"]`) — bo AI proponuje tylko jeśli pasuje. To jest dyscyplina marketing copy: jeśli twoje tagi nie pasują, **event nie pasuje**, to nie problem AI.
3. **Editor's Picks copy.** AI generuje draft, ty edytujesz w 30 min. Disclosure dla eventu VirtusLab — transparent.
4. **Twoja bio na /about.**
5. **GitHub public czy private?** Rekomendacja: **public** od początku.
6. **Co z blog post po Tech Week?** Plan: long-form "Jak zbudowaliśmy NYTW Companion z Claude Code" + open source repo + post-mortem co działało / co nie.
7. **/beyond — czy wszystkie 9 źródeł od dnia 1?** Tak. Lista zarządzana w `data/external-sources.json`, edycja = 1 commit.

---

## 10. Akceptacja MVP — definition of done

**Minimum MVP (po Phase 5) — launch-ready bez filtrów:**

- [ ] User browse'uje eventy w day-grouped timeline, klika "Open RSVP" → external opens + event ląduje w My Plan z status='interested'
- [ ] Persistent MyPlanWidget pokazuje licznik na każdej stronie
- [ ] EventDetail otwiera się jako modal, bez utraty kontekstu scroll
- [ ] User przełącza na mapę, wybiera dzień, klika pin → popup + 5 najbliższych
- [ ] User w /my-plan widzi timeline + map tab + status tracking per event
- [ ] User zaznacza confirmed/waitlist statusy, widzi conflict warning subtelnie
- [ ] iCal feed działa: subscribe URL → Google Calendar pokazuje confirmed events z ✅ prefix
- [ ] AI Concierge: profile → 5-8 propozycji z reasoning → Accept/Skip per event → akceptowane lądują w My Plan
- [ ] Po 3 dodanych eventach: magic link prompt appears, signup wysyła email, klik linkiem → plan visible z innego urządzenia
- [ ] /now widget na mobile pokazuje "next up in My Plan" z real time NYC
- [ ] Geo permission opt-in działa, travel time computed
- [ ] Działa offline (PWA + /now z localStorage)
- [ ] Stopka: "Made by VirtusLab — Not affiliated with a16z / Tech Week"

**Pełne MVP (po Phase 7) — z /beyond + filtrami:**

- [ ] Powyższe + filters drawer (klik tag w karcie = drawer open)
- [ ] /beyond strona z 9 alternatywami
- [ ] Editor's Picks carousel z visible blurbami
- [ ] Landing page polished z "What we don't do" sekcja
- [ ] Empty states linkują do /beyond

---

## 11. Luma / Partiful / Eventbrite — explicit caveats

**To jest osobna sekcja bo to fundamentalna konstrukcyjna decyzja, nie incidentalny detal.**

| Co byśmy chcieli | Czy możemy? | Co robimy zamiast |
|---|---|---|
| RSVP w imieniu usera | **NIE** — Luma/Partiful API nie pozwala | Link "Open RSVP →" otwiera external, user wraca, klika status |
| Auto-detect czy user RSVPował | **NIE** — żaden API ani webhook dla third-party | Self-report status (warstwa 1 z poprzedniej iteracji) |
| Cancel attendance w naszym UI | **NIE** — wymaga session na Luma | Status "declined" w My Plan + link "Cancel on Luma →" (user musi sam) |
| Live attendee count | **NIE** — privacy + brak API | Pokazujemy capacity jeśli host dał w description |
| Push notifications "starts in 1h" | **TAK** (PWA) ale bazujemy na My Plan status, nie real RSVP | Phase 8 jeśli starczy czasu, inaczej iCal notifications wystarczą |
| Email user'a hostowi | **NIE** | Link do hosta LinkedIn jeśli mamy w description |
| Webhook gdy event się zmieni | **NIE** | Daily re-scrape w cron (Phase 8) + email do owner planu jeśli event z planu się zmienił |

**Dlaczego nie próbujemy obejść:**
- Browser extension byłby techniczną opcją ale wymaga osobnej apki (Chrome Web Store review) i odpadłby przed 1 czerwca
- Headless browser z user credentials = naruszenie TOS Luma + security nightmare
- Gmail OAuth do parsowania confirmation emails = Google security review trwa tygodnie

**Mental model dla usera:** "NYTW Companion to twój notes + mapa + planner. Lumę i Partiful używasz jak zwykle — my pomagamy ci nie zgubić się w 1 000+ eventach i pamiętać co robisz."

To jest **uczciwy product framing** — nie udajemy magii której nie mamy.

---

## 12. Use it like this

```
1. cd ~/projects && mkdir nytw-companion && cd nytw-companion
2. claude code .
3. Wklej Phase 1 prompt. Test lokalnie. Git commit "Phase 1: scaffold".
4. Wklej Phase 2. → v1.2: browse + My Plan basic.
5. Po Phase 3 zdeployuj do Vercel preview. → v1.3: full browse + map + /now.
6. Phase 4 → v1.4: dedicated /my-plan + status tracking + iCal. **Tu już można launchować jeśli czas naciska.**
7. Phase 5 → v1.5: AI Concierge + magic link.
8. Phase 6 → v1.6: filtry (opcjonalne — możesz wyciąć).
9. Phase 7 → v1.7: /beyond + landing polish.
10. Phase 8 → v1.8: PWA offline + production deploy.
11. Phase 9 → QA.
12. Soft launch dla 10 osób VirtusLab → feedback → fix → public launch.
```

**Strategiczna obserwacja:** Phase 6 (filtry) jest świadomie opcjonalne. Jeśli kalendarz naciska — **wyciąć i wydać bez filtrów**. Search + Editor's Picks + AI Concierge + Mapa + My Plan pokrywają 90% use case'ów.

**Phase 4 to absolutne minimum żeby appka była planerem, nie browserem.** Bez Phase 4 spec nie jest skończony.

Każda faza ma być **completable w 1-3h pracy Claude Code** z review. Jeśli któraś trwa > 4h — podziel na mniejsze prompty.

**Powodzenia. Pamiętaj — to MVP. Lepszy zdeployowany 26 maja niż perfekcyjny 5 czerwca.**
