-- ============================================================
--  Update 14 — roles, activity per person, locks, fuller history
--  Paste into Supabase → SQL Editor → New query → Run (once). Needs updates 1–13 first.
--
--  1. Roles: each person is Full (default), Lists only, or View only.
--     Lists only: can work on Lists & files, comment and vote — nothing else.
--     View only: can look, comment and vote — nothing else.
--     Enforced here in the database, not just hidden in the app.
--  2. "Last opened" for each person, so the admin sees who is keeping up.
--  3. Locks: the admin can lock a plan section, a list or a budget. While locked,
--     only the admin can change it (everyone can still see it and comment).
--  4. History: deleted list rows keep a full copy, so they can be brought back,
--     and edits to list rows are recorded too.
--  Safe to run again.
-- ============================================================

-- 1. Roles ----------------------------------------------------
alter table public.members add column if not exists role text not null default 'full';
alter table public.members drop constraint if exists members_role_check;
alter table public.members add constraint members_role_check check (role in ('full', 'lists', 'view'));
alter table public.members add column if not exists last_opened timestamptz;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select case when is_admin then 'full' else role end from public.members where user_id = auth.uid();
$$;

-- What a role may change. Comments, votes and "seen" are open to every member.
create or replace function public.may_write(p_table text) returns boolean
language sql stable security definer set search_path = public as $$
  select case coalesce(public.my_role(), 'view')
    when 'full' then true
    when 'lists' then p_table in ('lists', 'list_rows', 'files', 'comments', 'reactions', 'announcement_seen')
    else p_table in ('comments', 'reactions', 'announcement_seen')
  end;
$$;

create or replace function public.set_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only the admin can change roles'; end if;
  if p_role not in ('full', 'lists', 'view') then raise exception 'Unknown role'; end if;
  update public.members set role = p_role where user_id = p_user;
end $$;
grant execute on function public.set_role(uuid, text) to authenticated;

-- Only the admin may change someone's role (on top of the update-11 guard).
create or replace function public.guard_member() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() and (
       new.is_admin    is distinct from old.is_admin
    or new.is_decider  is distinct from old.is_decider
    or new.decider_for is distinct from old.decider_for
    or new.role        is distinct from old.role
    or new.user_id     is distinct from old.user_id) then
    raise exception 'Only the admin can change who is admin, a Decider, or a role';
  end if;
  new.phone := left(regexp_replace(coalesce(new.phone, ''), '[^0-9+ ]', '', 'g'), 20);
  return new;
end $$;

-- 2. Last opened ----------------------------------------------
create or replace function public.touch_opened() returns void
language sql security definer set search_path = public as $$
  update public.members set last_opened = now() where user_id = auth.uid();
$$;
grant execute on function public.touch_opened() to authenticated;

-- 3. Locks ----------------------------------------------------
create table if not exists public.edit_locks (
  target_table text not null check (target_table in ('areas', 'lists', 'budgets')),
  target_id    text not null,
  wedding_id   text,
  note         text not null default '',
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now(),
  primary key (target_table, target_id)
);
alter table public.edit_locks enable row level security;
drop policy if exists "members read locks" on public.edit_locks;
drop policy if exists "admin adds locks" on public.edit_locks;
drop policy if exists "admin removes locks" on public.edit_locks;
create policy "members read locks" on public.edit_locks for select to authenticated using (public.is_member());
create policy "admin adds locks" on public.edit_locks for insert to authenticated with check (public.is_admin());
create policy "admin removes locks" on public.edit_locks for delete to authenticated using (public.is_admin());

create or replace function public.is_held(p_table text, p_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select not public.is_admin() and p_id is not null
     and exists (select 1 from public.edit_locks where target_table = p_table and target_id = p_id);
$$;

-- Restrictive policies on top of the existing ones: a change must pass both.
-- (Written out table by table, with no DO block, so the Supabase editor reads it correctly.)
drop policy if exists "role insert stages" on public.stages;
drop policy if exists "role update stages" on public.stages;
drop policy if exists "role delete stages" on public.stages;
create policy "role insert stages" on public.stages as restrictive for insert to authenticated with check (public.may_write('stages') and not public.is_held('budgets', null::text));
create policy "role update stages" on public.stages as restrictive for update to authenticated using (public.may_write('stages') and not public.is_held('budgets', null::text)) with check (public.may_write('stages') and not public.is_held('budgets', null::text));
create policy "role delete stages" on public.stages as restrictive for delete to authenticated using (public.may_write('stages') and not public.is_held('budgets', null::text));

drop policy if exists "role insert areas" on public.areas;
drop policy if exists "role update areas" on public.areas;
drop policy if exists "role delete areas" on public.areas;
create policy "role insert areas" on public.areas as restrictive for insert to authenticated with check (public.may_write('areas') and not public.is_held('areas', id::text));
create policy "role update areas" on public.areas as restrictive for update to authenticated using (public.may_write('areas') and not public.is_held('areas', id::text)) with check (public.may_write('areas') and not public.is_held('areas', id::text));
create policy "role delete areas" on public.areas as restrictive for delete to authenticated using (public.may_write('areas') and not public.is_held('areas', id::text));

drop policy if exists "role insert steps" on public.steps;
drop policy if exists "role update steps" on public.steps;
drop policy if exists "role delete steps" on public.steps;
create policy "role insert steps" on public.steps as restrictive for insert to authenticated with check (public.may_write('steps') and not public.is_held('areas', area_id::text));
create policy "role update steps" on public.steps as restrictive for update to authenticated using (public.may_write('steps') and not public.is_held('areas', area_id::text)) with check (public.may_write('steps') and not public.is_held('areas', area_id::text));
create policy "role delete steps" on public.steps as restrictive for delete to authenticated using (public.may_write('steps') and not public.is_held('areas', area_id::text));

drop policy if exists "role insert todos" on public.todos;
drop policy if exists "role update todos" on public.todos;
drop policy if exists "role delete todos" on public.todos;
create policy "role insert todos" on public.todos as restrictive for insert to authenticated with check (public.may_write('todos') and not public.is_held('budgets', null::text));
create policy "role update todos" on public.todos as restrictive for update to authenticated using (public.may_write('todos') and not public.is_held('budgets', null::text)) with check (public.may_write('todos') and not public.is_held('budgets', null::text));
create policy "role delete todos" on public.todos as restrictive for delete to authenticated using (public.may_write('todos') and not public.is_held('budgets', null::text));

drop policy if exists "role insert board_items" on public.board_items;
drop policy if exists "role update board_items" on public.board_items;
drop policy if exists "role delete board_items" on public.board_items;
create policy "role insert board_items" on public.board_items as restrictive for insert to authenticated with check (public.may_write('board_items') and not public.is_held('budgets', null::text));
create policy "role update board_items" on public.board_items as restrictive for update to authenticated using (public.may_write('board_items') and not public.is_held('budgets', null::text)) with check (public.may_write('board_items') and not public.is_held('budgets', null::text));
create policy "role delete board_items" on public.board_items as restrictive for delete to authenticated using (public.may_write('board_items') and not public.is_held('budgets', null::text));

drop policy if exists "role insert files" on public.files;
drop policy if exists "role update files" on public.files;
drop policy if exists "role delete files" on public.files;
create policy "role insert files" on public.files as restrictive for insert to authenticated with check (public.may_write('files') and not public.is_held('budgets', null::text));
create policy "role update files" on public.files as restrictive for update to authenticated using (public.may_write('files') and not public.is_held('budgets', null::text)) with check (public.may_write('files') and not public.is_held('budgets', null::text));
create policy "role delete files" on public.files as restrictive for delete to authenticated using (public.may_write('files') and not public.is_held('budgets', null::text));

drop policy if exists "role insert lists" on public.lists;
drop policy if exists "role update lists" on public.lists;
drop policy if exists "role delete lists" on public.lists;
create policy "role insert lists" on public.lists as restrictive for insert to authenticated with check (public.may_write('lists') and not public.is_held('lists', id::text));
create policy "role update lists" on public.lists as restrictive for update to authenticated using (public.may_write('lists') and not public.is_held('lists', id::text)) with check (public.may_write('lists') and not public.is_held('lists', id::text));
create policy "role delete lists" on public.lists as restrictive for delete to authenticated using (public.may_write('lists') and not public.is_held('lists', id::text));

drop policy if exists "role insert list_rows" on public.list_rows;
drop policy if exists "role update list_rows" on public.list_rows;
drop policy if exists "role delete list_rows" on public.list_rows;
create policy "role insert list_rows" on public.list_rows as restrictive for insert to authenticated with check (public.may_write('list_rows') and not public.is_held('lists', list_id::text));
create policy "role update list_rows" on public.list_rows as restrictive for update to authenticated using (public.may_write('list_rows') and not public.is_held('lists', list_id::text)) with check (public.may_write('list_rows') and not public.is_held('lists', list_id::text));
create policy "role delete list_rows" on public.list_rows as restrictive for delete to authenticated using (public.may_write('list_rows') and not public.is_held('lists', list_id::text));

drop policy if exists "role insert budgets" on public.budgets;
drop policy if exists "role update budgets" on public.budgets;
drop policy if exists "role delete budgets" on public.budgets;
create policy "role insert budgets" on public.budgets as restrictive for insert to authenticated with check (public.may_write('budgets') and not public.is_held('budgets', id::text));
create policy "role update budgets" on public.budgets as restrictive for update to authenticated using (public.may_write('budgets') and not public.is_held('budgets', id::text)) with check (public.may_write('budgets') and not public.is_held('budgets', id::text));
create policy "role delete budgets" on public.budgets as restrictive for delete to authenticated using (public.may_write('budgets') and not public.is_held('budgets', id::text));

drop policy if exists "role insert budget_areas" on public.budget_areas;
drop policy if exists "role update budget_areas" on public.budget_areas;
drop policy if exists "role delete budget_areas" on public.budget_areas;
create policy "role insert budget_areas" on public.budget_areas as restrictive for insert to authenticated with check (public.may_write('budget_areas') and not public.is_held('budgets', budget_id::text));
create policy "role update budget_areas" on public.budget_areas as restrictive for update to authenticated using (public.may_write('budget_areas') and not public.is_held('budgets', budget_id::text)) with check (public.may_write('budget_areas') and not public.is_held('budgets', budget_id::text));
create policy "role delete budget_areas" on public.budget_areas as restrictive for delete to authenticated using (public.may_write('budget_areas') and not public.is_held('budgets', budget_id::text));

drop policy if exists "role insert budget_items" on public.budget_items;
drop policy if exists "role update budget_items" on public.budget_items;
drop policy if exists "role delete budget_items" on public.budget_items;
create policy "role insert budget_items" on public.budget_items as restrictive for insert to authenticated with check (public.may_write('budget_items') and not public.is_held('budgets', budget_id::text));
create policy "role update budget_items" on public.budget_items as restrictive for update to authenticated using (public.may_write('budget_items') and not public.is_held('budgets', budget_id::text)) with check (public.may_write('budget_items') and not public.is_held('budgets', budget_id::text));
create policy "role delete budget_items" on public.budget_items as restrictive for delete to authenticated using (public.may_write('budget_items') and not public.is_held('budgets', budget_id::text));

drop policy if exists "role insert weddings" on public.weddings;
drop policy if exists "role update weddings" on public.weddings;
drop policy if exists "role delete weddings" on public.weddings;
create policy "role insert weddings" on public.weddings as restrictive for insert to authenticated with check (public.may_write('weddings') and not public.is_held('budgets', null::text));
create policy "role update weddings" on public.weddings as restrictive for update to authenticated using (public.may_write('weddings') and not public.is_held('budgets', null::text)) with check (public.may_write('weddings') and not public.is_held('budgets', null::text));
create policy "role delete weddings" on public.weddings as restrictive for delete to authenticated using (public.may_write('weddings') and not public.is_held('budgets', null::text));

-- Storage: View-only people can't upload or delete files.
drop policy if exists "role uploads media" on storage.objects;
create policy "role uploads media" on storage.objects as restrictive for insert to authenticated
  with check (bucket_id <> 'media' or public.my_role() in ('full', 'lists'));

-- 4. Fuller history -------------------------------------------
create or replace function public.log_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb; v_new jsonb; v_action text; v_changes jsonb := '{}'::jsonb;
  k text; ik text; v_label text;
begin
  if current_setting('fwp.quiet', true) = 'on' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    v_action := 'create'; v_new := to_jsonb(new);
    -- which list a new row belongs to, so a list's history can find it
    if v_new ? 'list_id' then v_changes := jsonb_build_object('_new', jsonb_build_object('list_id', v_new->'list_id')); end if;
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old); v_new := to_jsonb(new);
    if (v_old->>'deleted_at') is null and (v_new->>'deleted_at') is not null then
      v_action := 'remove';
    elsif (v_old->>'deleted_at') is not null and (v_new->>'deleted_at') is null then
      v_action := 'restore';
    else
      v_action := 'update';
      for k in select jsonb_object_keys(v_new) loop
        continue when k in ('position','x','y','w','z','deleted_by','created_at','created_by');
        if k = 'data' then
          for ik in select jsonb_object_keys(coalesce(v_old->'data','{}'::jsonb) || coalesce(v_new->'data','{}'::jsonb)) loop
            if (v_old->'data'->ik) is distinct from (v_new->'data'->ik) then
              v_changes := v_changes || jsonb_build_object(ik, jsonb_build_object('old', v_old->'data'->ik, 'new', v_new->'data'->ik));
            end if;
          end loop;
        elsif (v_old->k) is distinct from (v_new->k) then
          v_changes := v_changes || jsonb_build_object(k, jsonb_build_object('old', v_old->k, 'new', v_new->k));
        end if;
      end loop;
      if v_changes = '{}'::jsonb then return new; end if;
    end if;
  else
    -- deleted for good: keep a full copy so it can be brought back
    v_action := 'purge'; v_old := to_jsonb(old);
    v_changes := jsonb_build_object('_old', v_old);
  end if;
  v_label := coalesce(v_new->>'title', v_old->>'title', v_new->>'couple', v_old->>'couple',
                      v_new#>>'{data,title}', v_old#>>'{data,title}',
                      v_new#>>'{data,text}', v_old#>>'{data,text}',
                      left(coalesce(v_new#>>'{cells,0}', v_old#>>'{cells,0}'), 140));
  insert into public.activity (wedding_id, actor, actor_name, action, entity, entity_id, label, changes)
  values (coalesce(v_new->>'wedding_id', v_old->>'wedding_id',
                   (select l.wedding_id from public.lists l where l.id::text = coalesce(v_new->>'list_id', v_old->>'list_id')),
                   v_new->>'id', v_old->>'id'),
          auth.uid(), (select name from public.members where user_id = auth.uid()),
          v_action, tg_table_name, coalesce(v_new->>'id', v_old->>'id'), left(v_label, 140), v_changes);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists list_rows_log on public.list_rows;
create trigger list_rows_log after insert or update or delete on public.list_rows for each row execute function public.log_change();

-- Live updates for locks. (If this last line says the table is already a member, that's fine — it was added before.)
alter publication supabase_realtime add table public.edit_locks;
