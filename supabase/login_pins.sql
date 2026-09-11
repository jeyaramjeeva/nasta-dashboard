-- Per-user login PIN vault (not per device).
-- Run in Supabase → SQL Editor. API uses service role; no client policies on purpose.

create table if not exists public.login_pins (
  account_key text primary key,
  vault jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.login_pins enable row level security;
