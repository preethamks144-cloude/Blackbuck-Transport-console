/*
# Allow read-only load listings for the local console

1. Purpose
- Lets the browser-based trial console display published load records from the connected Supabase project.
2. Security
- Grants only SELECT on `loads` to the anon role.
- Adds a read policy limited to published, confirmed, and archived load records.
- Does not allow anonymous inserts, updates, or deletes.
3. Data safety
- No existing tables, columns, or records are changed or removed.
*/

grant select on public.loads to anon;

drop policy if exists "public_read_visible_loads" on public.loads;
create policy "public_read_visible_loads"
on public.loads for select
to anon
using (status in ('published', 'confirmed', 'archived'));