/*
# Replace loads table with admin-facing load schema

1. Purpose
- Recreates the `loads` table using the admin-facing column set the operator provided.
- The table currently holds zero rows, so recreating it loses no data.
2. New schema
- id (uuid, primary key, auto-generated)
- from_city / from_state: origin city (required) and state (optional)
- to_city / to_state: destination city (required) and state (optional)
- goods: goods description (required)
- description: optional details
- weight: weight as text (required)
- bales_or_units: optional package info
- vehicle_type: required vehicle type
- posted_by: defaults to 'Ramesh Kumar (Admin)'
- posted_on: posting date text (required)
- time_ago: defaults to '2h ago'
- is_new: defaults true
- distance: distance text (required)
- load_type: defaults 'FTL'
- pickup_date / delivery_date: required text dates
- price: numeric amount (required)
- status: defaults 'Available'
- created_at: defaults now()
3. Security
- RLS enabled.
- Grant SELECT, INSERT, UPDATE, DELETE to anon and authenticated.
- Public CRUD policies (single-operator trial console).
*/

drop table if exists public.loads cascade;

create table public.loads (
  id uuid not null default gen_random_uuid(),
  from_city text not null,
  from_state text null,
  to_city text not null,
  to_state text null,
  goods text not null,
  description text null,
  weight text not null,
  bales_or_units text null,
  vehicle_type text not null,
  posted_by text null default 'Ramesh Kumar (Admin)'::text,
  posted_on text not null,
  time_ago text null default '2h ago'::text,
  is_new boolean null default true,
  distance text not null,
  load_type text null default 'FTL'::text,
  pickup_date text not null,
  delivery_date text not null,
  price numeric(10, 2) not null,
  status text null default 'Available'::text,
  created_at timestamp with time zone null default now(),
  constraint loads_pkey primary key (id)
) tablespace pg_default;

alter table public.loads enable row level security;

grant select, insert, update, delete on public.loads to anon, authenticated;

drop policy if exists "anon_select_loads" on public.loads;
create policy "anon_select_loads" on public.loads for select
  to anon, authenticated using (true);

drop policy if exists "anon_insert_loads" on public.loads;
create policy "anon_insert_loads" on public.loads for insert
  to anon, authenticated with check (true);

drop policy if exists "anon_update_loads" on public.loads;
create policy "anon_update_loads" on public.loads for update
  to anon, authenticated using (true) with check (true);

drop policy if exists "anon_delete_loads" on public.loads;
create policy "anon_delete_loads" on public.loads for delete
  to anon, authenticated using (true);