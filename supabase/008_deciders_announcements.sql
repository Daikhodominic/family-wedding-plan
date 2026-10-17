-- ============================================================
--  Update 8 — Deciders (money and final choices) and announcements
--  Paste into Supabase → SQL Editor → New query → Run (once).
-- ============================================================

-- Deciders: the admin plus the people the admin marks (e.g. Charani and Elow).
alter table public.members add column if not exists is_decider boolean not null default false;

create or replace function public.is_decider() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid() and (is_admin or is_decider));
$$;

-- Only the admin can make someone a Decider.
create or replace function public.set_decider(p_user uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only the admin can choose Deciders'; end if;
  update public.members set is_decider = p_on where user_id = p_user;
end $$;
grant execute on function public.set_decider(uuid, boolean) to authenticated;

-- Money: everyone in the family can see it, only Deciders can change it.
do $$
declare t text;
begin
  foreach t in array array['budgets','budget_areas','budget_items'] loop
    execute format('drop policy if exists "members add %1$s" on public.%1$I', t);
    execute format('drop policy if exists "members edit %1$s" on public.%1$I', t);
    execute format('drop policy if exists "deciders add %1$s" on public.%1$I', t);
    execute format('drop policy if exists "deciders edit %1$s" on public.%1$I', t);
    execute format('create policy "deciders add %1$s" on public.%1$I for insert to authenticated with check (public.is_decider())', t);
    execute format('create policy "deciders edit %1$s" on public.%1$I for update to authenticated using (public.is_decider()) with check (public.is_decider())', t);
  end loop;
end $$;

-- Making a decision final (locking) is for Deciders; reopening stays with the admin.
create or replace function public.guard_unlock() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.locked_at is not null and new.locked_at is null and not public.is_admin() then
    raise exception 'Only the admin can reopen a final decision';
  end if;
  if new.locked_at is not null and old.locked_at is null then
    if not public.is_decider() then raise exception 'Only the Deciders can make a decision final'; end if;
    new.locked_by := auth.uid();
  end if;
  return new;
end $$;

-- Announcements, with a "Got it" for each person.
create table if not exists public.announcements (
  id           uuid primary key default gen_random_uuid(),
  wedding_id   text references public.weddings on delete cascade,
  body         text not null,
  title        text,
  author_name  text,
  created_at   timestamptz not null default now(),
  created_by   uuid default auth.uid(),
  deleted_at   timestamptz,
  deleted_by   uuid
);
create table if not exists public.announcement_seen (
  id               uuid primary key default gen_random_uuid(),
  announcement_id  uuid not null references public.announcements on delete cascade,
  created_by       uuid not null default auth.uid(),
  created_at       timestamptz not null default now(),
  unique (announcement_id, created_by)
);
alter table public.announcements enable row level security;
alter table public.announcement_seen enable row level security;
drop policy if exists "members read announcements" on public.announcements;
drop policy if exists "deciders add announcements" on public.announcements;
drop policy if exists "deciders edit announcements" on public.announcements;
drop policy if exists "admin deletes announcements" on public.announcements;
create policy "members read announcements" on public.announcements for select to authenticated using (public.is_member());
create policy "deciders add announcements" on public.announcements for insert to authenticated with check (public.is_decider());
create policy "deciders edit announcements" on public.announcements for update to authenticated using (public.is_decider()) with check (public.is_decider());
create policy "admin deletes announcements" on public.announcements for delete to authenticated using (public.is_admin());
drop policy if exists "members read seen" on public.announcement_seen;
drop policy if exists "members mark seen" on public.announcement_seen;
create policy "members read seen" on public.announcement_seen for select to authenticated using (public.is_member());
create policy "members mark seen" on public.announcement_seen for insert to authenticated with check (public.is_member() and created_by = auth.uid());
do $$ begin alter publication supabase_realtime add table public.announcements; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.announcement_seen; exception when duplicate_object then null; end $$;
drop trigger if exists announcements_stamp on public.announcements;
create trigger announcements_stamp before update on public.announcements for each row execute function public.stamp_deleted();
drop trigger if exists announcements_log on public.announcements;
create trigger announcements_log after insert or update or delete on public.announcements for each row execute function public.log_change();
