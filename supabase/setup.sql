-- ============================================================
--  Our Family Wedding Plan — Supabase setup
--  Paste this whole file into Supabase → SQL Editor → New query → Run.
--  It is safe to run once on a fresh project.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;

-- ---------- Tables ----------

create table if not exists public.weddings (
  id            text primary key,
  couple        text not null,
  monogram      text not null default '',
  wedding_date  date,
  date_note     text not null default '',
  theme         text not null default 'blue',
  theme_custom  jsonb not null default '{}'::jsonb,
  position      int not null default 0
);

create table if not exists public.members (
  user_id             uuid primary key references auth.users on delete cascade,
  name                text not null,
  is_admin            boolean not null default false,
  last_seen_activity  bigint not null default 0,
  joined_at           timestamptz not null default now()
);

create table if not exists private.secrets (
  key   text primary key,
  value text not null
);

create table if not exists public.stages (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  text not null references public.weddings on delete cascade,
  title       text not null,
  position    double precision not null default 0,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  deleted_at  timestamptz,
  deleted_by  uuid
);

create table if not exists public.areas (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  text not null references public.weddings on delete cascade,
  stage_id    uuid not null references public.stages on delete cascade,
  title       text not null,
  position    double precision not null default 0,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  deleted_at  timestamptz,
  deleted_by  uuid
);

create table if not exists public.steps (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  text not null references public.weddings on delete cascade,
  area_id     uuid not null references public.areas on delete cascade,
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

create table if not exists public.board_items (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  text not null references public.weddings on delete cascade,
  kind        text not null check (kind in ('note','image','video','file','link','contact','compare','label','palette')),
  x           double precision not null default 40,
  y           double precision not null default 40,
  w           double precision not null default 240,
  z           int not null default 1,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  deleted_at  timestamptz,
  deleted_by  uuid
);

create table if not exists public.activity (
  id          bigint generated always as identity primary key,
  wedding_id  text,
  actor       uuid,
  actor_name  text,
  action      text not null,
  entity      text not null,
  entity_id   text,
  label       text,
  changes     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists activity_created_idx on public.activity (id desc);

-- ---------- Helper functions ----------

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid());
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid() and is_admin);
$$;

-- Family members join with the shared passcode and their name.
create or replace function public.join_family(p_passcode text, p_name text) returns boolean
language plpgsql security definer set search_path = public, private, extensions as $$
declare h text;
begin
  if auth.uid() is null then return false; end if;
  select value into h from private.secrets where key = 'passcode';
  if h is null or extensions.crypt(p_passcode, h) <> h then return false; end if;
  insert into public.members (user_id, name)
  values (auth.uid(), left(trim(p_name), 60))
  on conflict (user_id) do update set name = excluded.name;
  return true;
end $$;

-- Only the admin can change the family passcode.
create or replace function public.set_passcode(p_passcode text) returns boolean
language plpgsql security definer set search_path = public, private, extensions as $$
begin
  if not public.is_admin() then raise exception 'Only the admin can change the passcode'; end if;
  if length(coalesce(p_passcode, '')) < 4 then raise exception 'Use at least 4 characters'; end if;
  insert into private.secrets (key, value)
  values ('passcode', extensions.crypt(p_passcode, extensions.gen_salt('bf')))
  on conflict (key) do update set value = excluded.value;
  return true;
end $$;

-- Who removed things: fill deleted_by automatically.
create or replace function public.stamp_deleted() returns trigger
language plpgsql as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    new.deleted_by := auth.uid();
  elsif new.deleted_at is null then
    new.deleted_by := null;
  end if;
  return new;
end $$;

-- Every change is written to the activity log, with old → new values.
create or replace function public.log_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb; v_new jsonb; v_action text; v_changes jsonb := '{}'::jsonb;
  k text; ik text; v_label text;
begin
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
      if v_changes = '{}'::jsonb then return new; end if;  -- moves and reorders are not logged
    end if;
  else
    v_action := 'purge'; v_old := to_jsonb(old);
  end if;

  v_label := coalesce(v_new->>'title', v_old->>'title', v_new->>'couple', v_old->>'couple',
                      v_new#>>'{data,title}', v_old#>>'{data,title}',
                      v_new#>>'{data,text}', v_old#>>'{data,text}');
  insert into public.activity (wedding_id, actor, actor_name, action, entity, entity_id, label, changes)
  values (coalesce(v_new->>'wedding_id', v_old->>'wedding_id', v_new->>'id'),
          auth.uid(),
          (select name from public.members where user_id = auth.uid()),
          v_action, tg_table_name,
          coalesce(v_new->>'id', v_old->>'id'),
          left(v_label, 140), v_changes);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

-- ---------- Starting data: the two weddings and the plan template ----------

insert into public.weddings (id, couple, monogram, wedding_date, date_note, theme, position) values
  ('charani', 'Charani & Adahrii', 'C&A', '2026-12-07', '', 'blue', 1),
  ('elow',    'Elow & Maniziia',   'E&M', null, 'February – March 2027', 'rose', 2)
on conflict (id) do nothing;

do $$
declare
  w text; s uuid; a uuid; si int; ai int; ti int;
  tpl jsonb := '[
    {"stage":"Before","areas":[
      {"area":"Dates & booking","steps":["Fix the wedding date and church","Book the reception venue for the date"]},
      {"area":"Venue & location","steps":["Shortlist venues","Visit and compare","Pay the advance"]},
      {"area":"Food & menus","steps":["Shortlist caterers and compare rates","Food tasting","Finalise the menu","Confirm the head count"]},
      {"area":"Invitation list","steps":["Collect names from both families","Finalise the guest list","Print the invitation cards","Send the invitations"]},
      {"area":"Gift preparation","steps":["Decide gifts for guests and relatives","Buy the gifts","Pack and label the gifts"]}
    ]},
    {"stage":"During","areas":[
      {"area":"The wedding day","steps":["Write the day-of schedule","Receive guests at the church","Food service at the reception","Photography and video"]},
      {"area":"Guests & transport","steps":["Arrange transport for guests","Seating and welcome"]}
    ]},
    {"stage":"After","areas":[
      {"area":"Payments & returns","steps":["Settle vendor payments","Return rented items"]},
      {"area":"Thank-yous","steps":["Thank-you calls and messages","Collect photos from everyone"]},
      {"area":"Final accounts","steps":["Write up what was spent"]}
    ]}
  ]';
begin
  foreach w in array array['charani','elow'] loop
    if exists (select 1 from public.stages where wedding_id = w) then continue; end if;
    for si in 0 .. jsonb_array_length(tpl) - 1 loop
      insert into public.stages (wedding_id, title, position, created_by)
      values (w, tpl->si->>'stage', (si + 1) * 1000, null) returning id into s;
      for ai in 0 .. jsonb_array_length(tpl->si->'areas') - 1 loop
        insert into public.areas (wedding_id, stage_id, title, position, created_by)
        values (w, s, tpl->si->'areas'->ai->>'area', (ai + 1) * 1000, null) returning id into a;
        for ti in 0 .. jsonb_array_length(tpl->si->'areas'->ai->'steps') - 1 loop
          insert into public.steps (wedding_id, area_id, title, position, created_by)
          values (w, a, tpl->si->'areas'->ai->'steps'->>ti, (ti + 1) * 1000, null);
        end loop;
      end loop;
    end loop;
  end loop;
end $$;

insert into public.board_items (wedding_id, kind, x, y, w, data, created_by)
select 'charani', 'palette', 40, 60, 280,
  '{"title":"Colour palette","colors":[{"name":"Cream White","hex":"#F9F7F2"},{"name":"Dusty Blue","hex":"#AFBEC8"},{"name":"French Blue","hex":"#637F99"},{"name":"Warm Beige","hex":"#DCC9B6"}]}'::jsonb, null
where not exists (select 1 from public.board_items where wedding_id = 'charani');

insert into public.board_items (wedding_id, kind, x, y, w, data, created_by)
select 'elow', 'palette', 40, 60, 320,
  '{"title":"Chateau Rose palette","colors":[{"name":"Dusty Rose","hex":"#D9A9A0"},{"name":"Vintage Mauve","hex":"#9E7280"},{"name":"English Rose","hex":"#E3B7AE"},{"name":"Champagne","hex":"#EFE3D3"},{"name":"Rose Gold","hex":"#C9967F"}]}'::jsonb, null
where not exists (select 1 from public.board_items where wedding_id = 'elow');

-- ---------- Triggers (created after the starting data, so it isn't logged) ----------

do $$
declare t text;
begin
  foreach t in array array['stages','areas','steps','board_items'] loop
    execute format('drop trigger if exists %I_stamp on public.%I', t, t);
    execute format('create trigger %I_stamp before update on public.%I for each row execute function public.stamp_deleted()', t, t);
  end loop;
  foreach t in array array['stages','areas','steps','board_items','weddings'] loop
    execute format('drop trigger if exists %I_log on public.%I', t, t);
    execute format('create trigger %I_log after insert or update or delete on public.%I for each row execute function public.log_change()', t, t);
  end loop;
end $$;

-- ---------- Security: only family members can see or change anything ----------

alter table public.weddings    enable row level security;
alter table public.members     enable row level security;
alter table public.stages      enable row level security;
alter table public.areas       enable row level security;
alter table public.steps       enable row level security;
alter table public.board_items enable row level security;
alter table public.activity    enable row level security;

revoke all on schema private from anon, authenticated;

drop policy if exists "members read weddings" on public.weddings;
drop policy if exists "admin edits weddings" on public.weddings;
create policy "members read weddings" on public.weddings for select to authenticated using (public.is_member());
create policy "admin edits weddings" on public.weddings for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "members read members" on public.members;
drop policy if exists "update own member row" on public.members;
create policy "members read members" on public.members for select to authenticated using (public.is_member() or user_id = auth.uid());
create policy "update own member row" on public.members for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.members from authenticated, anon;
grant update (name, last_seen_activity) on public.members to authenticated;

do $$
declare t text;
begin
  foreach t in array array['stages','areas','steps','board_items'] loop
    execute format('drop policy if exists "members read %1$s" on public.%1$I', t);
    execute format('drop policy if exists "members add %1$s" on public.%1$I', t);
    execute format('drop policy if exists "members edit %1$s" on public.%1$I', t);
    execute format('drop policy if exists "admin deletes %1$s" on public.%1$I', t);
    execute format('create policy "members read %1$s" on public.%1$I for select to authenticated using (public.is_member())', t);
    execute format('create policy "members add %1$s" on public.%1$I for insert to authenticated with check (public.is_member())', t);
    execute format('create policy "members edit %1$s" on public.%1$I for update to authenticated using (public.is_member()) with check (public.is_member())', t);
    execute format('create policy "admin deletes %1$s" on public.%1$I for delete to authenticated using (public.is_admin())', t);
  end loop;
end $$;

drop policy if exists "members read activity" on public.activity;
create policy "members read activity" on public.activity for select to authenticated using (public.is_member());

grant execute on function public.join_family(text, text) to authenticated;
grant execute on function public.set_passcode(text) to authenticated;

-- ---------- File storage for photos, videos and documents ----------

insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', false, 52428800)
on conflict (id) do nothing;

drop policy if exists "members read media" on storage.objects;
drop policy if exists "members upload media" on storage.objects;
drop policy if exists "admin deletes media" on storage.objects;
create policy "members read media" on storage.objects for select to authenticated using (bucket_id = 'media' and public.is_member());
create policy "members upload media" on storage.objects for insert to authenticated with check (bucket_id = 'media' and public.is_member());
create policy "admin deletes media" on storage.objects for delete to authenticated using (bucket_id = 'media' and public.is_admin());

-- ---------- Live updates ----------

do $$
declare t text;
begin
  foreach t in array array['weddings','stages','areas','steps','board_items','activity'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ============================================================
--  LAST STEP — make yourself the admin and set the first passcode.
--  1. Replace YOUR_EMAIL with the email you used in Authentication → Users.
--  2. Replace YOUR NAME and CHOOSE A PASSCODE.
--  3. Run just these lines (select them, then Run).
-- ============================================================
-- insert into public.members (user_id, name, is_admin)
-- select id, 'YOUR NAME', true from auth.users where email = 'YOUR_EMAIL'
-- on conflict (user_id) do update set is_admin = true;
--
-- insert into private.secrets (key, value)
-- values ('passcode', extensions.crypt('CHOOSE A PASSCODE', extensions.gen_salt('bf')))
-- on conflict (key) do update set value = excluded.value;
