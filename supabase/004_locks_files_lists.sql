-- ============================================================
--  Update 4 — locks, files and lists
--  Paste into Supabase → SQL Editor → New query → Run (once).
-- ============================================================

-- ---------- Locks on pipeline steps ----------
alter table public.steps add column if not exists locked_at  timestamptz;
alter table public.steps add column if not exists locked_by  uuid;
alter table public.steps add column if not exists lock_note  jsonb not null default '{}'::jsonb;
alter table public.steps add column if not exists gate       boolean not null default false;

-- Only the admin can unlock something once it's locked.
create or replace function public.guard_unlock() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.locked_at is not null and new.locked_at is null and not public.is_admin() then
    raise exception 'Only the admin can unlock this';
  end if;
  if new.locked_at is not null and old.locked_at is null then
    new.locked_by := auth.uid();
  end if;
  return new;
end $$;
drop trigger if exists steps_guard_unlock on public.steps;
create trigger steps_guard_unlock before update on public.steps for each row execute function public.guard_unlock();

-- Mark the big decisions in the starting plan as lock points.
update public.steps set gate = true
where title in ('Fix the wedding date and church', 'Fix the date and church', 'Book the reception venue for the date',
                'Pay the advance', 'Finalise the menu', 'Finalise the guest list', 'Print the invitation cards', 'Buy the gifts');

-- ---------- Files attached to steps (or the wedding as a whole) ----------
create table if not exists public.files (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  text not null references public.weddings on delete cascade,
  step_id     uuid references public.steps on delete set null,
  title       text not null,
  path        text not null,
  thumb       text,
  mime        text not null default '',
  size        bigint not null default 0,
  pages       int,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  deleted_at  timestamptz,
  deleted_by  uuid
);

-- ---------- Lists (guest list, invitation list, shopping list …) ----------
create table if not exists public.lists (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  text not null references public.weddings on delete cascade,
  step_id     uuid references public.steps on delete set null,
  title       text not null,
  columns     jsonb not null default '["Name","Notes"]'::jsonb,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  deleted_at  timestamptz,
  deleted_by  uuid
);

create table if not exists public.list_rows (
  id          uuid primary key default gen_random_uuid(),
  list_id     uuid not null references public.lists on delete cascade,
  wedding_id  text not null references public.weddings on delete cascade,
  cells       jsonb not null default '[]'::jsonb,
  position    double precision not null default 0,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid()
);

do $$
declare t text;
begin
  foreach t in array array['files','lists','list_rows'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "members read %1$s" on public.%1$I', t);
    execute format('drop policy if exists "members add %1$s" on public.%1$I', t);
    execute format('drop policy if exists "members edit %1$s" on public.%1$I', t);
    execute format('drop policy if exists "admin deletes %1$s" on public.%1$I', t);
    execute format('create policy "members read %1$s" on public.%1$I for select to authenticated using (public.is_member())', t);
    execute format('create policy "members add %1$s" on public.%1$I for insert to authenticated with check (public.is_member())', t);
    execute format('create policy "members edit %1$s" on public.%1$I for update to authenticated using (public.is_member()) with check (public.is_member())', t);
    execute format('create policy "admin deletes %1$s" on public.%1$I for delete to authenticated using (public.is_admin())', t);
    begin execute format('alter publication supabase_realtime add table public.%I', t); exception when duplicate_object then null; end;
  end loop;
end $$;

-- Anyone can delete a single row inside a list (rows have no Bin; the list itself does).
drop policy if exists "members delete list rows" on public.list_rows;
create policy "members delete list rows" on public.list_rows for delete to authenticated using (public.is_member());

-- Removal stamps and the activity log for files and lists (not every list row).
drop trigger if exists files_stamp on public.files;
create trigger files_stamp before update on public.files for each row execute function public.stamp_deleted();
drop trigger if exists lists_stamp on public.lists;
create trigger lists_stamp before update on public.lists for each row execute function public.stamp_deleted();
drop trigger if exists files_log on public.files;
create trigger files_log after insert or update or delete on public.files for each row execute function public.log_change();
drop trigger if exists lists_log on public.lists;
create trigger lists_log after insert or update or delete on public.lists for each row execute function public.log_change();
