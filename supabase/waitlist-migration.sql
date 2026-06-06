-- ============================================================
-- NCR RESERVES — waitlist table + RLS + realtime
--
-- The live walk-in queue ("Llista d'espera") was the only operational
-- entity NOT persisted to Supabase — it lived only in each device's
-- localStorage, so the queue never synced across devices. This migration
-- adds the table, the tenant-scoped RLS policies (same biz_ids pattern as
-- every other table), replica identity, and the realtime publication entry.
--
-- Run once in the Supabase SQL editor.
-- ============================================================

create table if not exists public.waitlist (
  id           text primary key,
  biz_id       text not null,
  name         text not null,
  pax          integer not null default 2,
  phone        text,
  notes        text,
  added_at     bigint not null,
  notified_at  bigint,
  status       text not null default 'waiting'
);

create index if not exists idx_waitlist_biz on public.waitlist(biz_id);

-- Needed so realtime can emit the old row on DELETE.
alter table public.waitlist replica identity full;

-- Row-Level Security — tenant-scoped by biz_id, authenticated only.
alter table public.waitlist enable row level security;

drop policy if exists "tenant_waitlist" on public.waitlist;
create policy "tenant_waitlist" on public.waitlist
  for all to authenticated
  using      (biz_id = ANY(public.auth_biz_ids()))
  with check (biz_id = ANY(public.auth_biz_ids()));

-- Add to the realtime publication (idempotent).
do $$
begin
  begin
    alter publication supabase_realtime add table public.waitlist;
  exception
    when duplicate_object then null;
    when undefined_object then
      create publication supabase_realtime;
      alter publication supabase_realtime add table public.waitlist;
  end;
end $$;
