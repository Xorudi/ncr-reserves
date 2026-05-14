-- ============================================================
-- NCR RESERVES — Auth + tenant-scoped RLS migration
--
-- Run this in Supabase SQL editor AFTER you have:
--   1. Created the original schema (supabase/schema.sql)
--   2. Created one Auth user per device/venue in
--      Dashboard → Authentication → Users → Invite user
--        e.g. device-ganxo@ncr-reserves.local
--             device-lapista@ncr-reserves.local
--             device-lesquitx@ncr-reserves.local
--   3. For EACH of those users, edited their "App Metadata"
--      to contain the biz_ids they can access:
--        { "biz_ids": ["ganxo"] }
--        { "biz_ids": ["lapista"] }
--        { "biz_ids": ["lesquitx"] }
--      (an admin/HQ user can have all three:
--        { "biz_ids": ["ganxo","lapista","lesquitx"] })
--
-- Why app_metadata and NOT user_metadata?
--   user_metadata is editable by the end user from the client SDK.
--   app_metadata is only writable by service_role keys — i.e. the
--   security boundary actually holds.
-- ============================================================

-- ─── Helper: extract biz_ids from the JWT ────────────────────
-- Returns the text[] of biz_ids stored in app_metadata.biz_ids of
-- the currently authenticated user, or empty array if none.
create or replace function public.auth_biz_ids()
returns text[]
language sql
stable
as $$
  select coalesce(
    array(
      select jsonb_array_elements_text(
        coalesce(
          (auth.jwt() -> 'app_metadata' -> 'biz_ids'),
          '[]'::jsonb
        )
      )
    ),
    array[]::text[]
  );
$$;

-- ─── Drop the dangerous allow_all policies ───────────────────
drop policy if exists "allow_all_reservations"    on public.reservations;
drop policy if exists "allow_all_customers"       on public.customers;
drop policy if exists "allow_all_floor_plans"     on public.floor_plans;
drop policy if exists "allow_all_shift_notes"     on public.shift_notes;
drop policy if exists "allow_all_app_events"      on public.app_events;
drop policy if exists "allow_all_biz_settings"    on public.biz_settings;
drop policy if exists "allow_all_employees"       on public.employees;
drop policy if exists "allow_all_employee_roles"  on public.employee_roles;
drop policy if exists "allow_all_employee_shifts" on public.employee_shifts;

-- ─── Tenant-scoped policies ──────────────────────────────────
-- Pattern: a row is visible/writeable only if its biz_id is in the
-- authenticated user's allow-list. Anonymous users get NOTHING
-- because every policy is restricted to the `authenticated` role.

-- reservations
create policy "tenant_reservations_select" on public.reservations
  for select to authenticated
  using (biz_id = ANY(public.auth_biz_ids()));

create policy "tenant_reservations_modify" on public.reservations
  for all to authenticated
  using      (biz_id = ANY(public.auth_biz_ids()))
  with check (biz_id = ANY(public.auth_biz_ids()));

-- customers (has a biz jsonb array, may span multiple venues)
-- A customer row is accessible if ANY of its biz tags overlap the user's allow-list.
create policy "tenant_customers_select" on public.customers
  for select to authenticated
  using (
    exists (
      select 1
      from jsonb_array_elements_text(coalesce(biz, '[]'::jsonb)) as t(val)
      where t.val = ANY(public.auth_biz_ids())
    )
  );

create policy "tenant_customers_modify" on public.customers
  for all to authenticated
  using (
    exists (
      select 1
      from jsonb_array_elements_text(coalesce(biz, '[]'::jsonb)) as t(val)
      where t.val = ANY(public.auth_biz_ids())
    )
  )
  with check (
    -- On insert/update, require that the new biz array still overlaps the user's scope
    exists (
      select 1
      from jsonb_array_elements_text(coalesce(biz, '[]'::jsonb)) as t(val)
      where t.val = ANY(public.auth_biz_ids())
    )
  );

-- floor_plans (1 row per venue, key is biz_id)
create policy "tenant_floor_plans" on public.floor_plans
  for all to authenticated
  using      (biz_id = ANY(public.auth_biz_ids()))
  with check (biz_id = ANY(public.auth_biz_ids()));

-- shift_notes
create policy "tenant_shift_notes" on public.shift_notes
  for all to authenticated
  using      (biz_id = ANY(public.auth_biz_ids()))
  with check (biz_id = ANY(public.auth_biz_ids()));

-- app_events
create policy "tenant_app_events" on public.app_events
  for all to authenticated
  using      (biz_id = ANY(public.auth_biz_ids()))
  with check (biz_id = ANY(public.auth_biz_ids()));

-- biz_settings
create policy "tenant_biz_settings" on public.biz_settings
  for all to authenticated
  using      (biz_id = ANY(public.auth_biz_ids()))
  with check (biz_id = ANY(public.auth_biz_ids()));

-- employees
create policy "tenant_employees" on public.employees
  for all to authenticated
  using      (biz_id = ANY(public.auth_biz_ids()))
  with check (biz_id = ANY(public.auth_biz_ids()));

-- employee_roles
create policy "tenant_employee_roles" on public.employee_roles
  for all to authenticated
  using      (biz_id = ANY(public.auth_biz_ids()))
  with check (biz_id = ANY(public.auth_biz_ids()));

-- employee_shifts (column is business_id, not biz_id)
create policy "tenant_employee_shifts" on public.employee_shifts
  for all to authenticated
  using      (business_id = ANY(public.auth_biz_ids()))
  with check (business_id = ANY(public.auth_biz_ids()));

-- ─── Sanity check ────────────────────────────────────────────
-- After running this, the `anon` role can NO longer read or write
-- any table. Verify with:
--   set role anon;
--   select * from reservations;   -- expect 0 rows / permission denied
--   reset role;
-- ============================================================
