-- ============================================================
--  Update 16 — RSVPs from the online invitation (invite/)
--  Paste into Supabase → SQL Editor → New query → Run (once). Needs update 1 (setup.sql) first.
--
--  Guests open the invitation link (no login) and send a reply: name, coming or not,
--  how many, phone and a message. They can only SEND a reply — they cannot see anyone
--  else's. Family members signed in to the War Room can read the replies at
--  invite/responses.html. Only the admin can delete a reply.
--  Nothing already in the database is changed. Safe to run again.
-- ============================================================

-- 1. Where the replies go.
create table if not exists public.rsvps (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  wedding     text not null default 'charani-adahrii',
  name        text not null,
  attending   boolean not null,
  guests      int not null default 1,
  phone       text,
  message     text
);
alter table public.rsvps enable row level security;

-- 2. Who can see them: family members read, the admin deletes. Nobody writes directly.
drop policy if exists "members read rsvps" on public.rsvps;
create policy "members read rsvps" on public.rsvps for select to authenticated using (public.is_member());
drop policy if exists "admin deletes rsvps" on public.rsvps;
create policy "admin deletes rsvps" on public.rsvps for delete to authenticated using (public.is_admin());
revoke insert, update on public.rsvps from anon, authenticated;

-- 3. Sending a reply (used by the invitation page). Checks the reply, then saves it.
create or replace function public.submit_rsvp(
  p_name text, p_attending boolean, p_guests int default 1,
  p_phone text default null, p_message text default null,
  p_wedding text default 'charani-adahrii'
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  n text := left(trim(coalesce(p_name, '')), 80);
begin
  if length(n) < 2 then raise exception 'Please write your name'; end if;
  if p_attending is null then raise exception 'Please say if you can come'; end if;
  insert into public.rsvps (wedding, name, attending, guests, phone, message)
  values (
    left(coalesce(nullif(trim(p_wedding), ''), 'charani-adahrii'), 40),
    n,
    p_attending,
    case when p_attending then greatest(1, least(coalesce(p_guests, 1), 20)) else 0 end,
    nullif(left(trim(coalesce(p_phone, '')), 20), ''),
    nullif(left(trim(coalesce(p_message, '')), 600), '')
  );
  return true;
end $$;

revoke all on function public.submit_rsvp(text, boolean, int, text, text, text) from public;
grant execute on function public.submit_rsvp(text, boolean, int, text, text, text) to anon, authenticated;
