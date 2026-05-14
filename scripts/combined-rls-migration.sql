-- ============================================================
-- NCR RESERVES — Combined RLS migration + data backfill
-- Run ONCE in Supabase SQL editor (Dashboard → SQL editor → Run).
-- Idempotent: safe to re-run.
-- ============================================================

-- ─── 1. Helper function: extract biz_ids from JWT ────────────
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

-- ─── 2. Drop the dangerous allow_all policies ────────────────
drop policy if exists "allow_all_reservations"    on public.reservations;
drop policy if exists "allow_all_customers"       on public.customers;
drop policy if exists "allow_all_floor_plans"     on public.floor_plans;
drop policy if exists "allow_all_shift_notes"     on public.shift_notes;
drop policy if exists "allow_all_app_events"      on public.app_events;
drop policy if exists "allow_all_biz_settings"    on public.biz_settings;
drop policy if exists "allow_all_employees"       on public.employees;
drop policy if exists "allow_all_employee_roles"  on public.employee_roles;
drop policy if exists "allow_all_employee_shifts" on public.employee_shifts;

-- Drop any previous versions of the tenant policies too (so re-runs work)
drop policy if exists "tenant_reservations_select"  on public.reservations;
drop policy if exists "tenant_reservations_modify"  on public.reservations;
drop policy if exists "tenant_customers_select"     on public.customers;
drop policy if exists "tenant_customers_modify"     on public.customers;
drop policy if exists "tenant_floor_plans"          on public.floor_plans;
drop policy if exists "tenant_shift_notes"          on public.shift_notes;
drop policy if exists "tenant_app_events"           on public.app_events;
drop policy if exists "tenant_biz_settings"         on public.biz_settings;
drop policy if exists "tenant_employees"            on public.employees;
drop policy if exists "tenant_employee_roles"       on public.employee_roles;
drop policy if exists "tenant_employee_shifts"      on public.employee_shifts;

-- ─── 3. Tenant-scoped policies (authenticated role only) ─────

-- reservations
create policy "tenant_reservations_select" on public.reservations
  for select to authenticated
  using (biz_id = ANY(public.auth_biz_ids()));

create policy "tenant_reservations_modify" on public.reservations
  for all to authenticated
  using      (biz_id = ANY(public.auth_biz_ids()))
  with check (biz_id = ANY(public.auth_biz_ids()));

-- customers (biz is a jsonb array; row matches if ANY of its biz tags is in scope)
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
    exists (
      select 1
      from jsonb_array_elements_text(coalesce(biz, '[]'::jsonb)) as t(val)
      where t.val = ANY(public.auth_biz_ids())
    )
  );

-- floor_plans (1 row per venue)
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

-- ─── 4. Data backfill: ensure existing customers aren't orphaned ────
-- Any customer row with an empty/null biz array would become invisible
-- to every authenticated user. Stamp them with all three venues so
-- they remain accessible. Existing non-empty arrays are untouched.
update public.customers
set biz = '["ganxo","pista","esquitx"]'::jsonb
where biz is null or biz = '[]'::jsonb;

-- ─── 5. Sanity check ─────────────────────────────────────────
-- Listed policies should now be the 11 tenant_* ones. Run:
--   select tablename, policyname from pg_policies
--    where schemaname = 'public'
--    order by tablename, policyname;
