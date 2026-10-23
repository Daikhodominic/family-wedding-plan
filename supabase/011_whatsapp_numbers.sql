-- ============================================================
--  Update 11 — WhatsApp numbers, and a lock on who can make themselves admin
--  Paste into Supabase → SQL Editor → New query → Run (once). Needs update 10 first.
--
--  1. Everyone can save their own WhatsApp number (menu → Your name and number),
--     so others can nudge them in one tap. Only family members can read it.
--  2. Safety fix: until now a signed-in member could, in theory, edit their own
--     row to make themselves admin or a Decider. Now only the admin can change those.
-- ============================================================

alter table public.members add column if not exists phone text not null default '';

create or replace function public.guard_member() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() is empty in the SQL Editor, so the owner can still fix things by hand there.
  if auth.uid() is not null and not public.is_admin() and (
       new.is_admin    is distinct from old.is_admin
    or new.is_decider  is distinct from old.is_decider
    or new.decider_for is distinct from old.decider_for
    or new.user_id     is distinct from old.user_id) then
    raise exception 'Only the admin can change who is admin or a Decider';
  end if;
  new.phone := left(regexp_replace(coalesce(new.phone, ''), '[^0-9+ ]', '', 'g'), 20);
  return new;
end $$;

drop trigger if exists members_guard on public.members;
create trigger members_guard before update on public.members for each row execute function public.guard_member();
