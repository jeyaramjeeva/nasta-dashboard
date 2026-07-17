-- Run in Supabase → SQL Editor (free project)
--
-- AUTH SETUP (do this first):
-- 1. Authentication → Providers → Email: ON
-- 2. Authentication → Users → Add user (×3):
--      jeeva@… / sriram@… / sneha@…  (set passwords, Auto Confirm User)
-- 3. Put those emails in VITE_ALLOWED_EMAILS on Vercel
-- 4. Authentication → Users shows last sign-in for each person

create table if not exists public.snapshots (
  id text primary key,
  payload jsonb not null,
  uploaded_at timestamptz not null default now()
);

alter table public.snapshots enable row level security;

drop policy if exists "Anyone can read snapshots" on public.snapshots;
drop policy if exists "Anyone can upsert latest snapshot" on public.snapshots;
drop policy if exists "Anyone can update latest snapshot" on public.snapshots;
drop policy if exists "Authed can read snapshots" on public.snapshots;
drop policy if exists "Authed can upsert latest snapshot" on public.snapshots;
drop policy if exists "Authed can update latest snapshot" on public.snapshots;

create policy "Authed can read snapshots"
  on public.snapshots for select to authenticated using (true);

create policy "Authed can upsert latest snapshot"
  on public.snapshots for insert to authenticated with check (true);

create policy "Authed can update latest snapshot"
  on public.snapshots for update to authenticated using (true) with check (true);

-- Version history (restore previous uploads)
create table if not exists public.snapshot_versions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source_file text not null default '',
  mode text not null default 'replace',
  note text,
  summary jsonb not null default '{}'::jsonb,
  payload jsonb not null
);

create index if not exists snapshot_versions_created_at_idx
  on public.snapshot_versions (created_at desc);

alter table public.snapshot_versions enable row level security;

drop policy if exists "Anyone can read versions" on public.snapshot_versions;
drop policy if exists "Anyone can insert versions" on public.snapshot_versions;
drop policy if exists "Authed can read versions" on public.snapshot_versions;
drop policy if exists "Authed can insert versions" on public.snapshot_versions;

create policy "Authed can read versions"
  on public.snapshot_versions for select to authenticated using (true);

create policy "Authed can insert versions"
  on public.snapshot_versions for insert to authenticated with check (true);

-- Shared team extras (weather, inventory, mission) — synced across devices
create table if not exists public.team_extras (
  id text primary key default 'latest',
  weather jsonb not null default '{}'::jsonb,
  inventory_defs jsonb not null default '[]'::jsonb,
  inventory_events jsonb not null default '{}'::jsonb,
  mission text,
  drive_settings jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.team_extras enable row level security;

drop policy if exists "Authed can read team_extras" on public.team_extras;
drop policy if exists "Authed can upsert team_extras" on public.team_extras;
drop policy if exists "Authed can update team_extras" on public.team_extras;

create policy "Authed can read team_extras"
  on public.team_extras for select to authenticated using (true);

create policy "Authed can upsert team_extras"
  on public.team_extras for insert to authenticated with check (true);

create policy "Authed can update team_extras"
  on public.team_extras for update to authenticated using (true) with check (true);

-- Per-user theme preference (cloud)
create table if not exists public.user_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  updated_at timestamptz not null default now()
);

alter table public.user_prefs enable row level security;

drop policy if exists "Users read own prefs" on public.user_prefs;
drop policy if exists "Users upsert own prefs" on public.user_prefs;
drop policy if exists "Users update own prefs" on public.user_prefs;

create policy "Users read own prefs"
  on public.user_prefs for select to authenticated
  using (auth.uid() = user_id);

create policy "Users upsert own prefs"
  on public.user_prefs for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users update own prefs"
  on public.user_prefs for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Live plate counts during a stall day
create table if not exists public.plate_counts (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  counted_at date not null default (timezone('Europe/Berlin', now()))::date,
  plates integer not null default 0 check (plates >= 0),
  plate_price numeric(10, 2) not null default 8,
  note text,
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (event_id, counted_at)
);

create index if not exists plate_counts_event_idx on public.plate_counts (event_id);

alter table public.plate_counts enable row level security;

drop policy if exists "Authed can read plate_counts" on public.plate_counts;
drop policy if exists "Authed can insert plate_counts" on public.plate_counts;
drop policy if exists "Authed can update plate_counts" on public.plate_counts;

create policy "Authed can read plate_counts"
  on public.plate_counts for select to authenticated using (true);

create policy "Authed can insert plate_counts"
  on public.plate_counts for insert to authenticated with check (true);

create policy "Authed can update plate_counts"
  on public.plate_counts for update to authenticated using (true) with check (true);

-- Stall stock + POS orders (JSON blob on team_extras)
alter table public.team_extras
  add column if not exists stall_ops jsonb not null default '{}'::jsonb;
