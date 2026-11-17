/*
# Expose app tables through the api schema for the Data API

1. Purpose
- This project's REST endpoint (…/rest/v1/loads) resolves tables in an
  exposed schema named `api`, but the application tables (loads, drivers,
  trips, invoices) live in `public`. The REST API therefore returned
  "Could not find the table 'api.loads' in the schema cache" even though
  the rows exist and the app's writes were landing in public.loads.

2. Changes
- Create schema `api` if missing.
- Create simple pass-through views (security_invoker = ON) in `api` for:
  loads, drivers, trips, invoices — each selecting all columns from its
  public counterpart. Simple single-table views are auto-updatable, so
  INSERT/UPDATE/DELETE through the REST API continue to work and write to
  the real public tables.
- security_invoker ensures the public tables' row level security policies
  still apply to every read and write through these views.

3. Security
- GRANT USAGE on schema api to anon + authenticated.
- GRANT SELECT, INSERT, UPDATE, DELETE on the four views to anon +
  authenticated, matching the existing trial-mode policies on the base
  tables. RLS on the base tables remains the effective gate.

4. Notes
- Idempotent: CREATE SCHEMA IF NOT EXISTS, CREATE OR REPLACE VIEW.
- No data is moved or duplicated; views are transparent windows onto the
  existing public tables.
*/

CREATE SCHEMA IF NOT EXISTS api;

GRANT USAGE ON SCHEMA api TO anon, authenticated;

CREATE OR REPLACE VIEW api.loads WITH (security_invoker = true) AS
  SELECT * FROM public.loads;

CREATE OR REPLACE VIEW api.drivers WITH (security_invoker = true) AS
  SELECT * FROM public.drivers;

CREATE OR REPLACE VIEW api.trips WITH (security_invoker = true) AS
  SELECT * FROM public.trips;

CREATE OR REPLACE VIEW api.invoices WITH (security_invoker = true) AS
  SELECT * FROM public.invoices;

GRANT SELECT, INSERT, UPDATE, DELETE ON api.loads TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON api.drivers TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON api.trips TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON api.invoices TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
