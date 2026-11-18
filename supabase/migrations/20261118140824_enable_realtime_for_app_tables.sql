/*
# Enable realtime broadcasts for app tables

1. Purpose
- The admin console currently only shows fresh data when a page loads or the user taps Refresh.
- This migration adds the app's tables to the `supabase_realtime` publication so Postgres broadcasts INSERT / UPDATE / DELETE events to connected clients.
- The frontend subscribes to these events, so every page (loads, trips, drivers, invoices, payments, subscriptions, notifications, dashboard) updates instantly when data changes anywhere.

2. Modified objects (no schema or data changes)
- Adds `public.loads`, `public.drivers`, `public.trips`, `public.invoices`, `public.payments`, `public.subscriptions`, `public.notifications` to the `supabase_realtime` publication.
- Publication membership is idempotent: the DO block checks `pg_publication_tables` before each `ALTER PUBLICATION ... ADD TABLE`, so re-running is safe.

3. Security
- No RLS, policy, or grant changes. Realtime broadcasts respect each table's existing RLS policies, so the current trial-access policies continue to govern what each client receives.

4. Important notes
- Row-change payloads are delivered with the existing per-table RLS applied; nothing new is exposed.
- No transaction control statements are used.
*/

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['loads', 'drivers', 'trips', 'invoices', 'payments', 'subscriptions', 'notifications']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
