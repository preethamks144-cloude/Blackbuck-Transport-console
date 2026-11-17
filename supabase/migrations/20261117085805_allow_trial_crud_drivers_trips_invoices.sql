/*
# Allow trial-mode CRUD on drivers, trips, and invoices

1. Purpose
- The admin console runs in local trial mode: sign-in is handled in the app
  (hardcoded trial admin), not through Supabase auth. Without a Supabase
  authenticated session, every request runs as the `anon` role.
- The `loads` table already has open anon policies for this trial. The
  drivers, trips, and invoices tables did not, so driver lists stayed empty
  and trip assignment / invoice generation could not save anything.

2. Security changes
- Add permissive anon + authenticated policies (SELECT, INSERT, UPDATE,
  DELETE) on `drivers`, `trips`, and `invoices`, matching the existing
  trial-mode pattern used on `loads`.
- Grants already exist for both roles on these tables; no grant changes.
- These policies are intentionally open for the single-operator trial and
  must be replaced with admin-scoped policies when Supabase auth is attached.

3. Notes
- No schema or data changes. Fully idempotent (DROP POLICY IF EXISTS first).
*/

DROP POLICY IF EXISTS "trial_select_drivers" ON drivers;
DROP POLICY IF EXISTS "trial_insert_drivers" ON drivers;
DROP POLICY IF EXISTS "trial_update_drivers" ON drivers;
DROP POLICY IF EXISTS "trial_delete_drivers" ON drivers;

CREATE POLICY "trial_select_drivers" ON drivers FOR SELECT
TO anon, authenticated USING (true);
CREATE POLICY "trial_insert_drivers" ON drivers FOR INSERT
TO anon, authenticated WITH CHECK (true);
CREATE POLICY "trial_update_drivers" ON drivers FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "trial_delete_drivers" ON drivers FOR DELETE
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "trial_select_trips" ON trips;
DROP POLICY IF EXISTS "trial_insert_trips" ON trips;
DROP POLICY IF EXISTS "trial_update_trips" ON trips;
DROP POLICY IF EXISTS "trial_delete_trips" ON trips;

CREATE POLICY "trial_select_trips" ON trips FOR SELECT
TO anon, authenticated USING (true);
CREATE POLICY "trial_insert_trips" ON trips FOR INSERT
TO anon, authenticated WITH CHECK (true);
CREATE POLICY "trial_update_trips" ON trips FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "trial_delete_trips" ON trips FOR DELETE
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "trial_select_invoices" ON invoices;
DROP POLICY IF EXISTS "trial_insert_invoices" ON invoices;
DROP POLICY IF EXISTS "trial_update_invoices" ON invoices;
DROP POLICY IF EXISTS "trial_delete_invoices" ON invoices;

CREATE POLICY "trial_select_invoices" ON invoices FOR SELECT
TO anon, authenticated USING (true);
CREATE POLICY "trial_insert_invoices" ON invoices FOR INSERT
TO anon, authenticated WITH CHECK (true);
CREATE POLICY "trial_update_invoices" ON invoices FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "trial_delete_invoices" ON invoices FOR DELETE
TO anon, authenticated USING (true);
