-- Fix: "new row violates row-level security policy for table snapshots"
-- Run once in Supabase → SQL Editor, then retry Publish.
--
-- Why: Developer often uses a local browser session (anon key). Policies that
-- only allow `authenticated` block Publish + upload history.
-- Preferred long-term: set SUPABASE_SERVICE_ROLE_KEY on Vercel and use
-- /api/publish-snapshot (already deployed in the app).

-- Latest snapshot
drop policy if exists "Anon can read snapshots" on public.snapshots;
drop policy if exists "Anon can insert latest snapshot" on public.snapshots;
drop policy if exists "Anon can update latest snapshot" on public.snapshots;

create policy "Anon can read snapshots"
  on public.snapshots for select to anon using (true);

create policy "Anon can insert latest snapshot"
  on public.snapshots for insert to anon with check (id = 'latest');

create policy "Anon can update latest snapshot"
  on public.snapshots for update to anon
  using (id = 'latest') with check (id = 'latest');

-- Version history
drop policy if exists "Anon can read versions" on public.snapshot_versions;
drop policy if exists "Anon can insert versions" on public.snapshot_versions;

create policy "Anon can read versions"
  on public.snapshot_versions for select to anon using (true);

create policy "Anon can insert versions"
  on public.snapshot_versions for insert to anon with check (true);
