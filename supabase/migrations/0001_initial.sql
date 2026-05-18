-- ============================================================
-- NYTW Companion — initial schema
-- Apply via: Supabase dashboard → SQL editor, or `supabase db push`
-- ============================================================

-- Events: hand-curated list (managed by curator via seed.ts)
create table events (
  id text primary key,
  title text not null,
  description text not null,
  host text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  venue_name text,
  address text,
  lat double precision,
  lng double precision,
  neighborhood text,
  rsvp_url text not null,
  rsvp_platform text not null, -- 'luma' | 'partiful' | 'eventbrite' | 'other'
  tags text[] not null default '{}',
  audience_tags text[] not null default '{}',
  format text,
  capacity int,
  is_invite_only boolean default false,
  has_free_food boolean default false,
  has_free_drinks boolean default false,
  is_editors_pick boolean default false,
  editors_pick_blurb text,
  is_virtuslab_event boolean default false,
  source text not null,
  source_url text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_events_starts_at on events(starts_at);
create index idx_events_tags on events using gin(tags);
create index idx_events_editors on events(is_editors_pick) where is_editors_pick = true;

-- Plans: anonymous (URL token) or authenticated (magic link)
create table plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  anonymous_token text unique,
  ical_token text unique not null default gen_random_uuid()::text,
  email text,
  display_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_plans_user on plans(user_id);
create index idx_plans_anonymous_token on plans(anonymous_token);
create index idx_plans_ical_token on plans(ical_token);

-- Plan items: events + self-reported RSVP status
create table plan_items (
  id bigserial primary key,
  plan_id uuid not null references plans(id) on delete cascade,
  event_id text not null references events(id) on delete cascade,
  status text not null default 'interested',
    -- 'interested' | 'rsvp_pending' | 'confirmed' | 'waitlist' | 'declined' | 'attended'
  notes text,
  added_at timestamptz default now(),
  status_updated_at timestamptz default now(),
  source text not null default 'manual', -- 'manual' | 'concierge' | 'editors_pick' | 'map'
  unique (plan_id, event_id)
);

create index idx_plan_items_plan on plan_items(plan_id);
create index idx_plan_items_status on plan_items(plan_id, status);

-- AI Concierge logs (analytics only)
create table concierge_logs (
  id bigserial primary key,
  plan_id uuid references plans(id),
  profile_text text not null,
  recommended_event_ids text[] not null,
  accepted_event_ids text[],
  prompt_tokens int,
  completion_tokens int,
  created_at timestamptz default now()
);

-- External sources for /beyond page
create table external_sources (
  id text primary key,
  name text not null,
  url text not null,
  description text not null,
  best_for text not null,
  category text not null, -- 'aggregator' | 'newsletter' | 'official' | 'curated'
  sort_order int default 0
);

-- ============================================================
-- Row Level Security
-- ============================================================

-- Events: public read, write only via service role
alter table events enable row level security;
create policy "events_public_read" on events for select using (true);

-- External sources: public read, write only via service role
alter table external_sources enable row level security;
create policy "external_sources_public_read" on external_sources for select using (true);

-- Plans: readable by token (anonymous) or authenticated owner
alter table plans enable row level security;

create policy "plans_read_by_owner" on plans
  for select using (
    anonymous_token = current_setting('request.headers', true)::json->>'x-anonymous-token'
    or ical_token = current_setting('request.headers', true)::json->>'x-ical-token'
    or auth.uid() = user_id
  );

create policy "plans_insert" on plans
  for insert with check (user_id is null or auth.uid() = user_id);

create policy "plans_update_by_owner" on plans
  for update using (
    anonymous_token = current_setting('request.headers', true)::json->>'x-anonymous-token'
    or auth.uid() = user_id
  );

-- Plan items: all access via service role through API routes (no direct client access)
alter table plan_items enable row level security;
-- No client-accessible policies — service client bypasses RLS.

-- Concierge logs: write via service role only
alter table concierge_logs enable row level security;
-- No client-accessible policies — service client bypasses RLS.
