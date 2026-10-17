-- ============================================================
--  Update 2 — add and remove everything
--  Paste into Supabase → SQL Editor → New query → Run (once).
--  • The admin can add new wedding/event spaces and remove them (to the Bin)
--  • The admin can remove people who have joined
--  • New spaces can start from the Before / During / After template
-- ============================================================

alter table public.weddings add column if not exists deleted_at timestamptz;
alter table public.weddings add column if not exists deleted_by uuid;
alter table public.weddings add column if not exists created_at timestamptz not null default now();

drop trigger if exists weddings_stamp on public.weddings;
create trigger weddings_stamp before update on public.weddings for each row execute function public.stamp_deleted();

-- Let bulk set-ups run quietly instead of filling the activity log.
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
    v_action := 'purge'; v_old := to_jsonb(old);
  end if;
  v_label := coalesce(v_new->>'title', v_old->>'title', v_new->>'couple', v_old->>'couple',
                      v_new#>>'{data,title}', v_old#>>'{data,title}',
                      v_new#>>'{data,text}', v_old#>>'{data,text}');
  insert into public.activity (wedding_id, actor, actor_name, action, entity, entity_id, label, changes)
  values (coalesce(v_new->>'wedding_id', v_old->>'wedding_id', v_new->>'id', v_old->>'id'),
          auth.uid(), (select name from public.members where user_id = auth.uid()),
          v_action, tg_table_name, coalesce(v_new->>'id', v_old->>'id'), left(v_label, 140), v_changes);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

-- Fill a wedding space with the starting template (admin only).
create or replace function public.add_template(p_wedding text) returns void
language plpgsql security definer set search_path = public as $$
declare
  s uuid; a uuid; si int; ai int; ti int;
  tpl jsonb := '[
    {"stage":"Before","areas":[
      {"area":"Dates & booking","steps":["Fix the date and church","Book the reception venue for the date"]},
      {"area":"Venue & location","steps":["Shortlist venues","Visit and compare","Pay the advance"]},
      {"area":"Food & menus","steps":["Shortlist caterers and compare rates","Food tasting","Finalise the menu","Confirm the head count"]},
      {"area":"Invitation list","steps":["Collect names from both families","Finalise the guest list","Print the invitation cards","Send the invitations"]},
      {"area":"Gift preparation","steps":["Decide gifts for guests and relatives","Buy the gifts","Pack and label the gifts"]}
    ]},
    {"stage":"During","areas":[
      {"area":"The day","steps":["Write the day-of schedule","Receive guests","Food service","Photography and video"]},
      {"area":"Guests & transport","steps":["Arrange transport for guests","Seating and welcome"]}
    ]},
    {"stage":"After","areas":[
      {"area":"Payments & returns","steps":["Settle vendor payments","Return rented items"]},
      {"area":"Thank-yous","steps":["Thank-you calls and messages","Collect photos from everyone"]},
      {"area":"Final accounts","steps":["Write up what was spent"]}
    ]}
  ]';
begin
  if not public.is_admin() then raise exception 'Only the admin can do this'; end if;
  perform set_config('fwp.quiet', 'on', true);
  for si in 0 .. jsonb_array_length(tpl) - 1 loop
    insert into public.stages (wedding_id, title, position) values (p_wedding, tpl->si->>'stage', (si + 1) * 1000) returning id into s;
    for ai in 0 .. jsonb_array_length(tpl->si->'areas') - 1 loop
      insert into public.areas (wedding_id, stage_id, title, position) values (p_wedding, s, tpl->si->'areas'->ai->>'area', (ai + 1) * 1000) returning id into a;
      for ti in 0 .. jsonb_array_length(tpl->si->'areas'->ai->'steps') - 1 loop
        insert into public.steps (wedding_id, area_id, title, position) values (p_wedding, a, tpl->si->'areas'->ai->'steps'->>ti, (ti + 1) * 1000);
      end loop;
    end loop;
  end loop;
  perform set_config('fwp.quiet', 'off', true);
end $$;
grant execute on function public.add_template(text) to authenticated;

-- Admin adds and permanently deletes wedding spaces.
drop policy if exists "admin adds weddings" on public.weddings;
drop policy if exists "admin deletes weddings" on public.weddings;
create policy "admin adds weddings" on public.weddings for insert to authenticated with check (public.is_admin());
create policy "admin deletes weddings" on public.weddings for delete to authenticated using (public.is_admin());

-- Admin removes people (never themselves).
drop policy if exists "admin removes members" on public.members;
create policy "admin removes members" on public.members for delete to authenticated using (public.is_admin() and user_id <> auth.uid());
grant delete on public.members to authenticated;

-- Live updates for the people list too.
do $$ begin
  begin execute 'alter publication supabase_realtime add table public.members'; exception when duplicate_object then null; end;
end $$;

-- ---------- To-do list: one quick list per wedding ----------
create table if not exists public.todos (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  text not null references public.weddings on delete cascade,
  title       text not null,
  notes       text not null default '',
  owner       text not null default '',
  due         date,
  status      text not null default 'todo' check (status in ('todo','doing','done')),
  position    double precision not null default 0,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  deleted_at  timestamptz,
  deleted_by  uuid
);
alter table public.todos enable row level security;
drop policy if exists "members read todos" on public.todos;
drop policy if exists "members add todos" on public.todos;
drop policy if exists "members edit todos" on public.todos;
drop policy if exists "admin deletes todos" on public.todos;
create policy "members read todos" on public.todos for select to authenticated using (public.is_member());
create policy "members add todos" on public.todos for insert to authenticated with check (public.is_member());
create policy "members edit todos" on public.todos for update to authenticated using (public.is_member()) with check (public.is_member());
create policy "admin deletes todos" on public.todos for delete to authenticated using (public.is_admin());
drop trigger if exists todos_stamp on public.todos;
create trigger todos_stamp before update on public.todos for each row execute function public.stamp_deleted();
drop trigger if exists todos_log on public.todos;
create trigger todos_log after insert or update or delete on public.todos for each row execute function public.log_change();
do $$ begin
  begin execute 'alter publication supabase_realtime add table public.todos'; exception when duplicate_object then null; end;
end $$;
