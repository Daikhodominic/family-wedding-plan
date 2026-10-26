-- Update 14, part A of 4. Run A, B, C, D in order (each in its own New query).
alter table public.members add column if not exists role text not null default 'full';
alter table public.members drop constraint if exists members_role_check;
alter table public.members add constraint members_role_check check (role in ('full', 'lists', 'view'));
alter table public.members add column if not exists last_opened timestamptz;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select case when is_admin then 'full' else role end from public.members where user_id = auth.uid();
$$;

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

create or replace function public.touch_opened() returns void
language sql security definer set search_path = public as $$
  update public.members set last_opened = now() where user_id = auth.uid();
$$;
grant execute on function public.touch_opened() to authenticated;
