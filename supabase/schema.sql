-- ============================================================
-- NCR RESERVES — Supabase schema
-- Run this in the Supabase SQL editor (Dashboard → SQL editor)
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
-- (already enabled by default on Supabase, just in case)
-- create extension if not exists "uuid-ossp";

-- ── reservations ─────────────────────────────────────────────
create table if not exists reservations (
  id         text primary key,
  biz_id     text not null,
  date       text not null,          -- 'YYYY-MM-DD'
  time       text not null,          -- 'HH:MM'
  name       text not null,
  pax        integer not null,
  status     text not null,
  phone      text,
  notes      text,
  source     text,
  tags       jsonb  default '[]'::jsonb,
  table_ids  jsonb  default '[]'::jsonb,  -- FloorTable IDs assigned to this reservation
  updated_at timestamptz default now()
);

-- ── Migration: add table_ids if upgrading from older schema ──
-- Run this if the table already exists without the column:
-- alter table reservations add column if not exists table_ids jsonb default '[]'::jsonb;

-- ── customers ────────────────────────────────────────────────
create table if not exists customers (
  id         text primary key,
  name       text not null,
  phone      text default '',
  email      text default '',
  visits     integer default 0,
  last_visit text  default '',
  spend      numeric default 0,
  tags       jsonb  default '[]'::jsonb,
  biz        jsonb  default '[]'::jsonb,  -- BusinessId[]
  notes      text  default '',
  updated_at timestamptz default now()
);

-- ── floor_plans ──────────────────────────────────────────────
-- One row per business; the full FloorPlan object is stored as JSONB.
create table if not exists floor_plans (
  biz_id     text primary key,
  data       jsonb not null,
  updated_at timestamptz default now()
);

-- ── shift_notes ──────────────────────────────────────────────
create table if not exists shift_notes (
  id             text primary key,
  biz_id         text not null,
  date           text not null,
  author         text not null,
  body           text not null,
  created_at_ms  bigint default 0,
  updated_at     timestamptz default now()
);

-- ── app_events ───────────────────────────────────────────────
create table if not exists app_events (
  id          text primary key,
  biz_id      text not null,
  date        text not null,
  title       text not null,
  time        text,
  description text,
  kind        text,
  updated_at  timestamptz default now()
);

-- ── biz_settings ─────────────────────────────────────────────
-- One row per business; config/hours/shifts/notif stored as JSONB.
create table if not exists biz_settings (
  biz_id     text primary key,
  config     jsonb not null default '{}'::jsonb,
  hours      jsonb not null default '{}'::jsonb,
  shifts     jsonb not null default '[]'::jsonb,
  notif      jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- ── employees ────────────────────────────────────────────────
create table if not exists employees (
  id          text primary key,
  biz_id      text not null,
  full_name   text not null,
  initials    text not null,
  role_id     text not null,
  phone       text,
  email       text,
  active      boolean default true,
  notes       text,
  clocked_in  boolean default false,
  started_at  text,
  updated_at  timestamptz default now()
);

-- ── employee_roles ───────────────────────────────────────────
create table if not exists employee_roles (
  id          text primary key,
  biz_id      text not null,
  name        text not null,
  color       text not null,
  text_color  text not null,
  "order"     integer default 0,
  active      boolean default true,
  updated_at  timestamptz default now()
);

-- ── employee_shifts ──────────────────────────────────────────
create table if not exists employee_shifts (
  id           text primary key,
  employee_id  text not null,
  business_id  text not null,
  dow          integer not null,  -- 0=Sun … 6=Sat
  start_time   text not null,
  end_time     text not null,
  role_id      text,
  updated_at   timestamptz default now()
);

-- ============================================================
-- Indexes (improve list-by-biz queries)
-- ============================================================
create index if not exists idx_reservations_biz_date on reservations(biz_id, date);
create index if not exists idx_shift_notes_biz       on shift_notes(biz_id);
create index if not exists idx_app_events_biz        on app_events(biz_id);
create index if not exists idx_employees_biz         on employees(biz_id);
create index if not exists idx_employee_roles_biz    on employee_roles(biz_id);
create index if not exists idx_employee_shifts_biz   on employee_shifts(business_id);

-- ============================================================
-- REPLICA IDENTITY FULL
-- Needed so Supabase realtime can emit the old row on DELETE.
-- ============================================================
alter table reservations    replica identity full;
alter table customers       replica identity full;
alter table floor_plans     replica identity full;
alter table shift_notes     replica identity full;
alter table app_events      replica identity full;
alter table biz_settings    replica identity full;
alter table employees       replica identity full;
alter table employee_roles  replica identity full;
alter table employee_shifts replica identity full;

-- ============================================================
-- Row-Level Security
-- Temporary: allow all authenticated + anon reads and writes.
-- Replace with proper policies once you add user auth.
-- ============================================================
alter table reservations    enable row level security;
alter table customers       enable row level security;
alter table floor_plans     enable row level security;
alter table shift_notes     enable row level security;
alter table app_events      enable row level security;
alter table biz_settings    enable row level security;
alter table employees       enable row level security;
alter table employee_roles  enable row level security;
alter table employee_shifts enable row level security;

-- Allow everything (anon + authenticated)
create policy "allow_all_reservations"    on reservations    for all using (true) with check (true);
create policy "allow_all_customers"       on customers       for all using (true) with check (true);
create policy "allow_all_floor_plans"     on floor_plans     for all using (true) with check (true);
create policy "allow_all_shift_notes"     on shift_notes     for all using (true) with check (true);
create policy "allow_all_app_events"      on app_events      for all using (true) with check (true);
create policy "allow_all_biz_settings"    on biz_settings    for all using (true) with check (true);
create policy "allow_all_employees"       on employees       for all using (true) with check (true);
create policy "allow_all_employee_roles"  on employee_roles  for all using (true) with check (true);
create policy "allow_all_employee_shifts" on employee_shifts for all using (true) with check (true);
