-- Run once in Supabase SQL editor so QR reviews sync across devices.
create table if not exists public.customer_reviews (
  id text primary key,
  created_at timestamptz not null default now(),
  payload jsonb not null
);

alter table public.customer_reviews enable row level security;

drop policy if exists "Anyone can insert customer_reviews" on public.customer_reviews;
drop policy if exists "Anyone can read customer_reviews" on public.customer_reviews;
drop policy if exists "Authed can read customer_reviews" on public.customer_reviews;

create policy "Anyone can insert customer_reviews"
  on public.customer_reviews for insert to anon, authenticated
  with check (true);

create policy "Anyone can read customer_reviews"
  on public.customer_reviews for select to anon, authenticated using (true);
