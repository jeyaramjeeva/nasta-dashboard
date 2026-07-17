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
