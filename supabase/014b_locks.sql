-- Update 14, part B of 4. Run A, B, C, D in order (each in its own New query).
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
