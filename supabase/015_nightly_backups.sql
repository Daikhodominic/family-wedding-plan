-- ============================================================
--  Update 15 — a backup every night, made by Supabase itself
--  Paste into Supabase → SQL Editor → New query → Run (once). Needs updates 1–14 first.
--
--  Every night at 3:00 am (India time) the database saves a copy of everything — the plans,
--  options and votes, lists, budget, comments, files list, who's in the family and the
--  recent edit history — into a "nightly_backups" table. The newest 14 are kept (two weeks).
--  It runs even if nobody opens the app. Only the admin can see or download them
--  (Settings → Backups & space). Photos and files themselves stay in Storage; these copies
--  hold everything else.
--  Safe to run again.
-- ============================================================

-- 1. The nightly job runner (Supabase's built-in "Cron").
create extension if not exists pg_cron;

-- 2. Where the copies go.
create table if not exists public.nightly_backups (
  id bigint generated always as identity primary key,
  taken_at timestamptz not null default now(),
  tables int not null default 0,
  rows_total int not null default 0,
  data jsonb not null
);
alter table public.nightly_backups enable row level security;
drop policy if exists "admin reads nightly backups" on public.nightly_backups;
create policy "admin reads nightly backups" on public.nightly_backups for select using (public.is_admin());
-- Nobody writes to it from the app; only the job below does.

-- 3. Making one copy. Tables that aren't there yet are skipped.
create or replace function public.take_nightly_backup() returns bigint
language plpgsql security definer set search_path = public as $$
declare
  t text;
  part jsonb;
  out jsonb := '{}'::jsonb;
  n int := 0;
  total int := 0;
  new_id bigint;
begin
  foreach t in array array['weddings', 'stages', 'areas', 'steps', 'todos', 'board_items', 'files', 'lists', 'list_rows',
    'budgets', 'budget_areas', 'budget_items', 'comments', 'reactions', 'announcements', 'announcement_seen',
    'partner_links', 'partners', 'edit_locks', 'members'] loop
    if to_regclass('public.' || t) is not null then
      execute format('select coalesce(jsonb_agg(x), ''[]''::jsonb) from public.%I x', t) into part;
      out := out || jsonb_build_object(t, part);
      n := n + 1; total := total + jsonb_array_length(part);
    end if;
  end loop;
  -- the newest 2,000 entries of the edit history
  if to_regclass('public.activity') is not null then
    execute 'select coalesce(jsonb_agg(x), ''[]''::jsonb) from (select * from public.activity order by created_at desc limit 2000) x' into part;
    out := out || jsonb_build_object('activity', part);
    n := n + 1; total := total + jsonb_array_length(part);
  end if;
  insert into public.nightly_backups (tables, rows_total, data) values (n, total, out) returning id into new_id;
  -- keep two weeks
  delete from public.nightly_backups where id not in (select id from public.nightly_backups order by taken_at desc limit 14);
  return new_id;
end;
$$;
revoke all on function public.take_nightly_backup() from public, anon, authenticated;

-- The admin can also make one straight away (Settings → Backups & space → "Make a nightly copy now").
create or replace function public.take_backup_now() returns bigint
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only the admin can do this'; end if;
  return public.take_nightly_backup();
end;
$$;
grant execute on function public.take_backup_now() to authenticated;

-- The list without the (big) contents, for the Settings page.
create or replace function public.list_nightly_backups() returns table (id bigint, taken_at timestamptz, tables int, rows_total int, size_kb int)
language sql stable security definer set search_path = public as $$
  select b.id, b.taken_at, b.tables, b.rows_total, (octet_length(b.data::text) / 1024)::int
  from public.nightly_backups b where public.is_admin() order by b.taken_at desc;
$$;
grant execute on function public.list_nightly_backups() to authenticated;

-- One copy's contents, to download.
create or replace function public.get_nightly_backup(p_id bigint) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('made', b.taken_at, 'by', 'Nightly copy (automatic)', 'data', b.data)
  from public.nightly_backups b where b.id = p_id and public.is_admin();
$$;
grant execute on function public.get_nightly_backup(bigint) to authenticated;

-- 4. Every night at 21:30 UTC = 3:00 am in India. Re-running this replaces the old schedule.
select cron.unschedule(jobid) from cron.job where jobname = 'war-room-nightly-backup';
select cron.schedule('war-room-nightly-backup', '30 21 * * *', 'select public.take_nightly_backup()');

-- 5. The first copy, now — so you can see it worked (Settings → Backups & space).
select public.take_nightly_backup() as first_backup_id;
