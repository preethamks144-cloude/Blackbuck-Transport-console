/*
# Tighten Blackbuck admin access policies

1. Security changes
- Replaces broad ALL policies with four explicit policies per shared table.
- Keeps admin profiles scoped to the signed-in user's own profile.
- Requires an active admin profile for every shared console record.
2. Data safety
- No tables, columns, or records are removed.
- Existing data remains available under the same relationships.
*/

drop policy if exists "admins_manage_own_profile" on public.admin_users;
create policy "admins_select_own_profile" on public.admin_users for select to authenticated using (auth.uid() = user_id);
create policy "admins_insert_own_profile" on public.admin_users for insert to authenticated with check (auth.uid() = user_id);
create policy "admins_update_own_profile" on public.admin_users for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "admins_delete_own_profile" on public.admin_users for delete to authenticated using (auth.uid() = user_id);

do $$
declare
  table_name text;
  tables text[] := array['drivers','vehicles','loads','load_assignments','trips','subscriptions','invoices','payments','notifications','application_settings','admin_activity_logs'];
begin
  foreach table_name in array tables loop
    execute format('drop policy if exists %I on public.%I', 'admins_access_' || table_name, table_name);
    execute format('drop policy if exists %I on public.%I', 'admins_select_' || table_name, table_name);
    execute format('drop policy if exists %I on public.%I', 'admins_insert_' || table_name, table_name);
    execute format('drop policy if exists %I on public.%I', 'admins_update_' || table_name, table_name);
    execute format('drop policy if exists %I on public.%I', 'admins_delete_' || table_name, table_name);
    execute format('create policy %I on public.%I for select to authenticated using (exists (select 1 from public.admin_users where user_id = auth.uid() and is_active))', 'admins_select_' || table_name, table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check (exists (select 1 from public.admin_users where user_id = auth.uid() and is_active))', 'admins_insert_' || table_name, table_name);
    execute format('create policy %I on public.%I for update to authenticated using (exists (select 1 from public.admin_users where user_id = auth.uid() and is_active)) with check (exists (select 1 from public.admin_users where user_id = auth.uid() and is_active))', 'admins_update_' || table_name, table_name);
    execute format('create policy %I on public.%I for delete to authenticated using (exists (select 1 from public.admin_users where user_id = auth.uid() and is_active))', 'admins_delete_' || table_name, table_name);
  end loop;
end $$;