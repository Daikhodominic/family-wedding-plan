-- ============================================================
--  Update 16 — Our Family: the relatives register, tree and card list
--  Paste into Supabase → SQL Editor → New query → Run (once).
--
--  1. A table holding the family's relatives register (one shared copy
--     for both weddings). The list itself is loaded by a second file that
--     stays private (it is not kept in this public code).
--  2. Saving goes through one function that checks nobody else saved in
--     the same moment, and keeps an earlier copy every 15 minutes
--     (the newest 300 are kept), so nothing can be lost by mistake.
--  3. Everyone who has joined can read it. Full and Lists-only people can
--     change it; View-only people can only look.
--  4. Changes show on everyone's phone at once, and the nightly backup
--     includes the register.
--  Safe to run again: nothing already saved is replaced.
-- ============================================================

create table if not exists public.family_register (
  id text primary key,
  data jsonb not null,
  version int not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  updated_by_name text
);
create table if not exists public.family_register_versions (
  id bigserial primary key,
  register_id text not null,
  version int,
  data jsonb not null,
  saved_at timestamptz not null default now(),
  saved_by_name text
);
alter table public.family_register enable row level security;
alter table public.family_register_versions enable row level security;
drop policy if exists "members read the register" on public.family_register;
create policy "members read the register" on public.family_register for select to authenticated using (public.is_member());
drop policy if exists "admin reads register copies" on public.family_register_versions;
create policy "admin reads register copies" on public.family_register_versions for select to authenticated using (public.is_admin());
-- no insert/update/delete rules: changes only go through save_family_register() below

create or replace function public.save_family_register(p_data jsonb, p_version int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cur int; who text; r text := 'full';
begin
  if not public.is_member() then raise exception 'Only family members can change the register'; end if;
  if to_regprocedure('public.my_role()') is not null then execute 'select public.my_role()' into r; end if;
  if coalesce(r, 'view') not in ('full', 'lists') then raise exception 'You can look at the register but not change it'; end if;
  if jsonb_typeof(p_data) <> 'array' or jsonb_array_length(p_data) = 0 then raise exception 'The register came through empty, so it was not saved'; end if;
  select name into who from public.members where user_id = auth.uid();
  select version into cur from public.family_register where id = 'main' for update;
  if cur is null then
    insert into public.family_register (id, data, version, updated_by, updated_by_name) values ('main', p_data, 1, auth.uid(), who);
    return jsonb_build_object('version', 1);
  end if;
  if cur <> p_version then
    return jsonb_build_object('conflict', true, 'version', cur, 'data', (select data from public.family_register where id = 'main'));
  end if;
  if not exists (select 1 from public.family_register_versions where register_id = 'main' and saved_at > now() - interval '15 minutes') then
    insert into public.family_register_versions (register_id, version, data, saved_by_name)
      select id, version, data, updated_by_name from public.family_register where id = 'main';
    delete from public.family_register_versions where id not in (select id from public.family_register_versions order by saved_at desc limit 300);
  end if;
  update public.family_register set data = p_data, version = cur + 1, updated_at = now(), updated_by = auth.uid(), updated_by_name = who where id = 'main';
  return jsonb_build_object('version', cur + 1);
end $$;
revoke all on function public.save_family_register(jsonb, int) from public, anon;
grant execute on function public.save_family_register(jsonb, int) to authenticated;

do $$ begin alter publication supabase_realtime add table public.family_register; exception when duplicate_object then null; end $$;

-- The nightly backup now includes the register.
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
    'partner_links', 'partners', 'edit_locks', 'members', 'family_register'] loop
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

-- The family's own list is loaded separately (016_our_family_list.sql, kept out of this public code),
-- or the first save from the Our Family page fills the table.
