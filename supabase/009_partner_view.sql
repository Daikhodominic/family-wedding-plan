-- ============================================================
--  Update 9 — partner view (viewer links for the partner families)
--  Paste into Supabase → SQL Editor → New query → Run (once).
--
--  Partners never get access to the family's tables. They open a link,
--  give their name, and receive a cleaned-up copy of THEIR wedding only:
--  the mood board (no prices, rates or phone numbers), final decisions by
--  name (no amounts), and progress. They can react, vote and suggest.
-- ============================================================

create table if not exists public.partner_links (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  text not null references public.weddings on delete cascade,
  token       uuid not null unique default gen_random_uuid(),
  label       text not null default 'Partner family',
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  revoked_at  timestamptz
);
create table if not exists public.partners (
  user_id     uuid primary key,
  wedding_id  text not null references public.weddings on delete cascade,
  link_id     uuid not null references public.partner_links on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now()
);

alter table public.comments alter column item_id drop not null;
alter table public.comments add column if not exists from_partner boolean not null default false;
alter table public.reactions add column if not exists from_partner boolean not null default false;

alter table public.partner_links enable row level security;
alter table public.partners enable row level security;
drop policy if exists "members read partner links" on public.partner_links;
drop policy if exists "deciders add partner links" on public.partner_links;
drop policy if exists "deciders edit partner links" on public.partner_links;
create policy "members read partner links" on public.partner_links for select to authenticated using (public.is_member());
create policy "deciders add partner links" on public.partner_links for insert to authenticated with check (public.is_decider());
create policy "deciders edit partner links" on public.partner_links for update to authenticated using (public.is_decider()) with check (public.is_decider());
drop policy if exists "members read partners" on public.partners;
create policy "members read partners" on public.partners for select to authenticated using (public.is_member());

-- Which wedding this signed-in partner may see (null if none or the link was turned off).
create or replace function public.partner_wedding() returns text
language sql stable security definer set search_path = public as $$
  select p.wedding_id from public.partners p join public.partner_links l on l.id = p.link_id
  where p.user_id = auth.uid() and l.revoked_at is null limit 1;
$$;

create or replace function public.join_partner(p_token uuid, p_name text) returns text
language plpgsql security definer set search_path = public as $$
declare l public.partner_links;
begin
  if auth.uid() is null then raise exception 'No session'; end if;
  select * into l from public.partner_links where token = p_token and revoked_at is null;
  if l.id is null then raise exception 'This link is no longer active. Ask the family for a new one.'; end if;
  insert into public.partners (user_id, wedding_id, link_id, name)
  values (auth.uid(), l.wedding_id, l.id, left(coalesce(nullif(trim(p_name), ''), 'Guest'), 60))
  on conflict (user_id) do update set wedding_id = excluded.wedding_id, link_id = excluded.link_id, name = excluded.name;
  return l.wedding_id;
end $$;

-- Everything a partner may see, cleaned of prices, rates, phone numbers and family comments.
create or replace function public.partner_data() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare w text := public.partner_wedding(); res jsonb; me text;
begin
  if w is null then raise exception 'This link is no longer active. Ask the family for a new one.'; end if;
  select name into me from public.partners where user_id = auth.uid();
  select jsonb_build_object(
    'me', me,
    'wedding', (select jsonb_build_object('id', id, 'couple', couple, 'monogram', monogram, 'wedding_date', wedding_date, 'date_note', date_note, 'theme', theme, 'theme_custom', theme_custom) from public.weddings where id = w),
    'board', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'kind', b.kind, 'x', b.x, 'y', b.y, 'w', b.w, 'z', b.z,
        'data', case when b.kind = 'compare' then (b.data - 'job_id') || jsonb_build_object('options',
                     coalesce((select jsonb_agg(o - 'rate' - 'contact' - 'notes') from jsonb_array_elements(coalesce(b.data->'options', '[]'::jsonb)) o), '[]'::jsonb))
                     else b.data - 'phone' - 'rate' - 'job_id' - 'role' end) order by b.y, b.x)
      from public.board_items b where b.wedding_id = w and b.deleted_at is null and b.kind not in ('contact', 'shape', 'connector')), '[]'::jsonb),
    'decisions', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'title', s.title, 'area', a.title, 'stage', st.title, 'locked_at', s.locked_at,
        'with', split_part(coalesce(s.lock_note->>'with', ''), ' — ', 1), 'choice', s.lock_note->'choice' - 'item_id', 'image', s.lock_note->>'image') order by st.position, a.position, s.position)
      from public.steps s join public.areas a on a.id = s.area_id join public.stages st on st.id = a.stage_id
      where s.wedding_id = w and s.locked_at is not null and s.deleted_at is null and a.deleted_at is null and st.deleted_at is null), '[]'::jsonb),
    'progress', (select jsonb_build_object('total', count(*), 'done', count(*) filter (where s.status = 'done' or s.locked_at is not null), 'final', count(*) filter (where s.locked_at is not null))
      from public.steps s join public.areas a on a.id = s.area_id join public.stages st on st.id = a.stage_id
      where s.wedding_id = w and s.deleted_at is null and a.deleted_at is null and st.deleted_at is null),
    'reactions', coalesce((select jsonb_agg(jsonb_build_object('item_id', item_id, 'target', target, 'value', value, 'n', n, 'mine', mine))
      from (select item_id, target, value, count(*) n, bool_or(created_by = auth.uid()) mine from public.reactions where wedding_id = w group by 1, 2, 3) r), '[]'::jsonb),
    'my_suggestions', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'item_id', item_id, 'body', body, 'created_at', created_at) order by created_at)
      from public.comments where created_by = auth.uid() and deleted_at is null), '[]'::jsonb)
  ) into res;
  return res;
end $$;

create or replace function public.partner_react(p_item uuid, p_target text, p_value text) returns void
language plpgsql security definer set search_path = public as $$
declare w text := public.partner_wedding(); me text;
begin
  if w is null then raise exception 'This link is no longer active.'; end if;
  if not exists (select 1 from public.board_items where id = p_item and wedding_id = w and deleted_at is null) then raise exception 'Not found'; end if;
  if p_value not in ('up', 'down', '❤️', '👍', '😍', '😂', '😮', '🙏') then raise exception 'Not allowed'; end if;
  select name into me from public.partners where user_id = auth.uid();
  if exists (select 1 from public.reactions where item_id = p_item and target = p_target and created_by = auth.uid() and value = p_value) then
    delete from public.reactions where item_id = p_item and target = p_target and created_by = auth.uid() and value = p_value;
  else
    if p_value in ('up', 'down') then delete from public.reactions where item_id = p_item and target = p_target and created_by = auth.uid() and value in ('up', 'down'); end if;
    insert into public.reactions (wedding_id, item_id, target, value, user_name, created_by, from_partner) values (w, p_item, p_target, p_value, me, auth.uid(), true);
  end if;
end $$;

create or replace function public.partner_suggest(p_item uuid, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare w text := public.partner_wedding(); me text;
begin
  if w is null then raise exception 'This link is no longer active.'; end if;
  if p_item is not null and not exists (select 1 from public.board_items where id = p_item and wedding_id = w and deleted_at is null) then raise exception 'Not found'; end if;
  if length(trim(coalesce(p_body, ''))) = 0 then raise exception 'Write something first'; end if;
  select name into me from public.partners where user_id = auth.uid();
  insert into public.comments (wedding_id, item_id, kind, body, title, author_name, created_by, from_partner)
  values (w, p_item, 'suggestion', left(p_body, 2000), left(p_body, 120), me, auth.uid(), true);
end $$;

grant execute on function public.join_partner(uuid, text) to authenticated;
grant execute on function public.partner_data() to authenticated;
grant execute on function public.partner_react(uuid, text, text) to authenticated;
grant execute on function public.partner_suggest(uuid, text) to authenticated;

-- Partners can open the photos on their board (paths are long random names they only learn from partner_data).
drop policy if exists "partners read media" on storage.objects;
create policy "partners read media" on storage.objects for select to authenticated
  using (bucket_id = 'media' and public.partner_wedding() is not null);

do $$ begin alter publication supabase_realtime add table public.partner_links; exception when duplicate_object then null; end $$;
