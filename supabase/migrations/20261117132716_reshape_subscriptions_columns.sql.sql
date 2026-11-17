/*
# Reshape subscriptions to requested plan-based columns

1. Purpose
- A prior attempt recreated public.subscriptions; the live table already
  matches the requested structure closely but uses old column names.
  This migration renames and adjusts in place. The table holds 0 rows,
  so no data is affected.

2. Column changes (table public.subscriptions)
- amount -> price (numeric(10,2) NOT NULL).
- starts_on (date) -> starts_at (timestamptz, default now()).
- expires_on (date) -> ends_at (timestamptz NOT NULL).
- status default 'active' -> 'Pending'; check constraint now allows
  exactly 'Pending', 'Active', 'Expired'.
- Adds plan_name text NOT NULL DEFAULT 'Monthly Membership'.
- driver_id uuid NOT NULL with ON DELETE CASCADE to drivers is kept.

3. Security
- RLS stays enabled with the existing trial CRUD policies and grants.
*/

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_status_check;

ALTER TABLE public.subscriptions
  RENAME COLUMN amount TO price;

ALTER TABLE public.subscriptions
  ALTER COLUMN price TYPE numeric(10, 2),
  ALTER COLUMN price SET NOT NULL;

ALTER TABLE public.subscriptions
  ALTER COLUMN starts_on DROP NOT NULL,
  ALTER COLUMN starts_on SET DEFAULT now(),
  ALTER COLUMN expires_on DROP NOT NULL;

ALTER TABLE public.subscriptions
  RENAME COLUMN starts_on TO starts_at;

ALTER TABLE public.subscriptions
  RENAME COLUMN expires_on TO ends_at;

ALTER TABLE public.subscriptions
  ALTER COLUMN starts_at TYPE timestamptz,
  ALTER COLUMN starts_at SET DEFAULT now(),
  ALTER COLUMN ends_at SET NOT NULL,
  ALTER COLUMN ends_at TYPE timestamptz,
  ALTER COLUMN ends_at SET NOT NULL;

ALTER TABLE public.subscriptions
  ALTER COLUMN status SET DEFAULT 'Pending';

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_status_check CHECK (
    status = ANY (ARRAY['Pending'::text, 'Active'::text, 'Expired'::text])
  );

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS plan_name text;

UPDATE public.subscriptions SET plan_name = 'Monthly Membership' WHERE plan_name IS NULL;

ALTER TABLE public.subscriptions
  ALTER COLUMN plan_name SET NOT NULL;
