-- Run in Supabase → SQL Editor (free project)

create table if not exists public.snapshots (
  id text primary key,
  payload jsonb not null,
  uploaded_at timestamptz not null default now()
);

alter table public.snapshots enable row level security;

drop policy if exists "Anyone can read snapshots" on public.snapshots;
create policy "Anyone can read snapshots"
  on public.snapshots for select using (true);

drop policy if exists "Anyone can upsert latest snapshot" on public.snapshots;
create policy "Anyone can upsert latest snapshot"
  on public.snapshots for insert with check (true);

drop policy if exists "Anyone can update latest snapshot" on public.snapshots;
create policy "Anyone can update latest snapshot"
  on public.snapshots for update using (true) with check (true);

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
create policy "Anyone can read versions"
  on public.snapshot_versions for select using (true);

drop policy if exists "Anyone can insert versions" on public.snapshot_versions;
create policy "Anyone can insert versions"
  on public.snapshot_versions for insert with check (true);
