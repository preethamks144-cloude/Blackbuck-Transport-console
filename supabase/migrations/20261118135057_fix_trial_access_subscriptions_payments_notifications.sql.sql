/*
# Fix trial-mode access for subscriptions, payments, and notifications

## Problem
The frontend uses the anon key (no real Supabase auth sign-in), but the
`subscriptions`, `payments`, and `notifications` tables only had policies
scoped to `authenticated` admin users. This meant the app could not read
or write to these tables at all — reads returned empty arrays and writes
were silently rejected by row-level security.

## Changes
1. **subscriptions** — Add trial CRUD policies for `anon, authenticated`
   (select, insert, update, delete). The existing admin policies remain.
2. **payments** — Add trial CRUD policies for `anon, authenticated`.
3. **notifications** — Add trial CRUD policies for `anon, authenticated`.

## Security
These are intentionally permissive (`USING (true)`) because this is a
single-admin trial console with no per-user isolation — every table in
the trial already follows this pattern (loads, drivers, trips, invoices).
The admin-only `authenticated` policies are retained for when real auth
is connected later.
*/

-- subscriptions: trial CRUD
DROP POLICY IF EXISTS "trial_select_subscriptions" ON subscriptions;
CREATE POLICY "trial_select_subscriptions" ON subscriptions
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "trial_insert_subscriptions" ON subscriptions;
CREATE POLICY "trial_insert_subscriptions" ON subscriptions
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "trial_update_subscriptions" ON subscriptions;
CREATE POLICY "trial_update_subscriptions" ON subscriptions
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "trial_delete_subscriptions" ON subscriptions;
CREATE POLICY "trial_delete_subscriptions" ON subscriptions
  FOR DELETE TO anon, authenticated USING (true);

-- payments: trial CRUD
DROP POLICY IF EXISTS "trial_select_payments" ON payments;
CREATE POLICY "trial_select_payments" ON payments
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "trial_insert_payments" ON payments;
CREATE POLICY "trial_insert_payments" ON payments
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "trial_update_payments" ON payments;
CREATE POLICY "trial_update_payments" ON payments
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "trial_delete_payments" ON payments;
CREATE POLICY "trial_delete_payments" ON payments
  FOR DELETE TO anon, authenticated USING (true);

-- notifications: trial CRUD
DROP POLICY IF EXISTS "trial_select_notifications" ON notifications;
CREATE POLICY "trial_select_notifications" ON notifications
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "trial_insert_notifications" ON notifications;
CREATE POLICY "trial_insert_notifications" ON notifications
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "trial_update_notifications" ON notifications;
CREATE POLICY "trial_update_notifications" ON notifications
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "trial_delete_notifications" ON notifications;
CREATE POLICY "trial_delete_notifications" ON notifications
  FOR DELETE TO anon, authenticated USING (true);
