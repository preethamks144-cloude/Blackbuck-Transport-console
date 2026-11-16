/*
# Create Blackbuck Transport admin schema

1. New tables
- `admin_users`: authenticated admin profiles and roles.
- `drivers`, `vehicles`: shared driver/owner directory and vehicle records.
- `loads`, `load_assignments`, `trips`: shipment, assignment, and trip lifecycle data.
- `subscriptions`, `invoices`, `payments`: subscription, invoice, and financial records.
- `notifications`, `application_settings`, `admin_activity_logs`: operational messaging, settings, and audit history.
2. Relationships and integrity
- UUID primary keys, foreign keys, unique business identifiers, status checks, and timestamps.
- Trip creation is protected from duplicate confirmed loads with a unique load reference.
3. Security
- RLS is enabled on every table.
- Authenticated admins can access shared console records; new admin profiles are limited to their own auth identity.
- The browser never receives service-role or payment-provider secrets.
4. Important notes
- This schema supports one loading and one unloading location per load/trip for V1.
- Payment gateway, messaging, storage, and scheduled-job providers can attach to these durable records later.
*/

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null default 'Admin User',
  phone text,
  role text not null default 'admin' check (role in ('admin','manager','operator')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null unique,
  account_status text not null default 'active' check (account_status in ('active','inactive','restricted')),
  registered_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  registration_number text not null unique,
  vehicle_type text not null,
  capacity_tons numeric(10,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.loads (
  id uuid primary key default gen_random_uuid(),
  gc_number text not null unique,
  goods_description text not null,
  weight_tons numeric(10,2) not null check (weight_tons > 0),
  loading_city text not null,
  unloading_city text not null,
  vehicle_type text not null,
  posting_date date not null default current_date,
  additional_details text,
  status text not null default 'draft' check (status in ('draft','published','pending_confirmation','confirmed','archived')),
  posted_by uuid references public.admin_users(id) on delete set null,
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.load_assignments (
  id uuid primary key default gen_random_uuid(),
  load_id uuid not null unique references public.loads(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete restrict,
  assigned_by uuid references public.admin_users(id) on delete set null,
  confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  trip_number text not null unique,
  load_id uuid not null unique references public.loads(id) on delete restrict,
  driver_id uuid not null references public.drivers(id) on delete restrict,
  status text not null default 'assigned' check (status in ('assigned','ongoing','completed','cancelled')),
  assigned_date date not null default current_date,
  completed_at timestamptz,
  advance_amount numeric(12,2) not null default 0,
  freight_amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  starts_on date not null,
  expires_on date not null,
  status text not null default 'active' check (status in ('active','expiring_soon','expired')),
  payment_reference text,
  amount numeric(12,2) not null default 1000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  trip_id uuid references public.trips(id) on delete set null,
  gc_number text,
  invoice_date date not null default current_date,
  consignor text,
  consignee text,
  freight numeric(12,2) not null default 0,
  hamali numeric(12,2) not null default 0,
  other_charges numeric(12,2) not null default 0,
  gst numeric(12,2) not null default 0,
  advance numeric(12,2) not null default 0,
  total_amount numeric(12,2) generated always as (freight + hamali + other_charges + gst - advance) stored,
  paid_amount numeric(12,2) not null default 0,
  status text not null default 'draft' check (status in ('draft','pending','partially_paid','paid','overdue')),
  document_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.invoices(id) on delete set null,
  driver_id uuid references public.drivers(id) on delete set null,
  trip_id uuid references public.trips(id) on delete set null,
  amount numeric(12,2) not null check (amount > 0),
  payment_type text not null check (payment_type in ('subscription','advance','freight_settlement','other')),
  payment_method text not null check (payment_method in ('upi','qr_code','card','net_banking','cash')),
  status text not null default 'pending' check (status in ('pending','verified','failed','refunded')),
  reference text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  category text not null check (category in ('new_load','load_confirmed','driver_assigned','trip_completed','subscription_expiring','subscription_expired','payment_received','invoice_generated','payment_overdue','announcement')),
  driver_id uuid references public.drivers(id) on delete cascade,
  is_read boolean not null default false,
  delivery_status text not null default 'pending' check (delivery_status in ('pending','sent','failed')),
  created_at timestamptz not null default now()
);

create table if not exists public.application_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.admin_users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_activity_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.admin_users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists loads_status_idx on public.loads(status);
create index if not exists loads_posting_date_idx on public.loads(posting_date desc);
create index if not exists drivers_status_idx on public.drivers(account_status);
create index if not exists subscriptions_expiry_idx on public.subscriptions(expires_on);
create index if not exists trips_status_idx on public.trips(status);
create index if not exists invoices_status_idx on public.invoices(status);
create index if not exists payments_created_idx on public.payments(created_at desc);
create index if not exists notifications_created_idx on public.notifications(created_at desc);

alter table public.admin_users enable row level security;
alter table public.drivers enable row level security;
alter table public.vehicles enable row level security;
alter table public.loads enable row level security;
alter table public.load_assignments enable row level security;
alter table public.trips enable row level security;
alter table public.subscriptions enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;
alter table public.notifications enable row level security;
alter table public.application_settings enable row level security;
alter table public.admin_activity_logs enable row level security;

grant select, insert, update on public.admin_users to authenticated;
grant select, insert, update, delete on public.drivers, public.vehicles, public.loads, public.load_assignments, public.trips, public.subscriptions, public.invoices, public.payments, public.notifications, public.application_settings, public.admin_activity_logs to authenticated;

drop policy if exists "admins_manage_own_profile" on public.admin_users;
create policy "admins_manage_own_profile" on public.admin_users for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "admins_access_drivers" on public.drivers;
create policy "admins_access_drivers" on public.drivers for all to authenticated using (exists (select 1 from public.admin_users where user_id = auth.uid() and is_active)) with check (exists (select 1 from public.admin_users where user_id = auth.uid() and is_active));
drop policy if exists "admins_access_vehicles" on public.vehicles;
create policy "admins_access_vehicles" on public.vehicles for all to authenticated using (exists (select 1 from public.admin_users where user_id = auth.uid() and is_active)) with check (exists (select 1 from public.admin_users where user_id = auth.uid() and is_active));
drop policy if exists "admins_access_loads" on public.loads;
create policy "admins_access_loads" on public.loads for all to authenticated using (exists (select 1 from public.admin_users where user_id = auth.uid() and is_active)) with check (exists (select 1 from public.admin_users where user_id = auth.uid() and is_active));
drop policy if exists "admins_access_assignments" on public.load_assignments;
create policy "admins_access_assignments" on public.load_assignments for all to authenticated using (exists (select 1 from public.admin_users where user_id = auth.uid() and is_active)) with check (exists (select 1 from public.admin_users where user_id = auth.uid() and is_active));
drop policy if exists "admins_access_trips" on public.trips;
create policy "admins_access_trips" on public.trips for all to authenticated using (exists (select 1 from public.admin_users where user_id = auth.uid() and is_active)) with check (exists (select 1 from public.admin_users where user_id = auth.uid() and is_active));
drop policy if exists "admins_access_subscriptions" on public.subscriptions;
create policy "admins_access_subscriptions" on public.subscriptions for all to authenticated using (exists (select 1 from public.admin_users where user_id = auth.uid() and is_active)) with check (exists (select 1 from public.admin_users where user_id = auth.uid() and is_active));
drop policy if exists "admins_access_invoices" on public.invoices;
create policy "admins_access_invoices" on public.invoices for all to authenticated using (exists (select 1 from public.admin_users where user_id = auth.uid() and is_active)) with check (exists (select 1 from public.admin_users where user_id = auth.uid() and is_active));
drop policy if exists "admins_access_payments" on public.payments;
create policy "admins_access_payments" on public.payments for all to authenticated using (exists (select 1 from public.admin_users where user_id = auth.uid() and is_active)) with check (exists (select 1 from public.admin_users where user_id = auth.uid() and is_active));
drop policy if exists "admins_access_notifications" on public.notifications;
create policy "admins_access_notifications" on public.notifications for all to authenticated using (exists (select 1 from public.admin_users where user_id = auth.uid() and is_active)) with check (exists (select 1 from public.admin_users where user_id = auth.uid() and is_active));
drop policy if exists "admins_access_settings" on public.application_settings;
create policy "admins_access_settings" on public.application_settings for all to authenticated using (exists (select 1 from public.admin_users where user_id = auth.uid() and is_active)) with check (exists (select 1 from public.admin_users where user_id = auth.uid() and is_active));
drop policy if exists "admins_access_logs" on public.admin_activity_logs;
create policy "admins_access_logs" on public.admin_activity_logs for all to authenticated using (exists (select 1 from public.admin_users where user_id = auth.uid() and is_active)) with check (exists (select 1 from public.admin_users where user_id = auth.uid() and is_active));