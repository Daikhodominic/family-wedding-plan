-- ============================================================
--  Update 10 — Deciders per wedding
--  Paste into Supabase → SQL Editor → New query → Run (once).
--
--  A Decider can be limited to some weddings: e.g. the admin and Elow for
--  Elow & Maniziia, Charani for Charani & Adahrii. An empty list keeps the old
--  meaning (decides for every wedding). Set it in the site: Settings → Who has joined.
-- ============================================================

alter table public.members add column if not exists decider_for text[] not null default '{}';

-- Is the signed-in person a Decider for this wedding? ('shared' = home costs: any Decider.)
create or replace function public.is_decider_for(p_wedding text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.members m
    where m.user_id = auth.uid()
      and (m.is_admin or (m.is_decider and (cardinality(m.decider_for) = 0 or p_wedding is null or p_wedding = 'shared' or p_wedding = any(m.decider_for)))));
$$;

-- Only the admin chooses who decides for which wedding.
create or replace function public.set_decider_for(p_user uuid, p_weddings text[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only the admin can choose Deciders'; end if;
  update public.members
     set decider_for = coalesce(p_weddings, '{}'), is_decider = cardinality(coalesce(p_weddings, '{}')) > 0
   where user_id = p_user;
end $$;
grant execute on function public.set_decider_for(uuid, text[]) to authenticated;

-- Making a step final: only that wedding's Deciders. Reopening stays with the admin.
create or replace function public.guard_unlock() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.locked_at is not null and new.locked_at is null and not public.is_admin() then
    raise exception 'Only the admin can reopen a final decision';
  end if;
  if new.locked_at is not null and old.locked_at is null then
    if not public.is_decider_for(new.wedding_id) then raise exception 'Only this wedding''s Deciders can make a decision final'; end if;
    new.locked_by := auth.uid();
  end if;
  return new;
end $$;

-- Money: each wedding's budget is changed by that wedding's Deciders.
drop policy if exists "deciders add budgets" on public.budgets;
drop policy if exists "deciders edit budgets" on public.budgets;
create policy "deciders add budgets" on public.budgets for insert to authenticated with check (public.is_decider_for(id));
create policy "deciders edit budgets" on public.budgets for update to authenticated using (public.is_decider_for(id)) with check (public.is_decider_for(id));
do $$
declare t text;
begin
  foreach t in array array['budget_areas','budget_items'] loop
    execute format('drop policy if exists "deciders add %1$s" on public.%1$I', t);
    execute format('drop policy if exists "deciders edit %1$s" on public.%1$I', t);
    execute format('create policy "deciders add %1$s" on public.%1$I for insert to authenticated with check (public.is_decider_for(budget_id))', t);
    execute format('create policy "deciders edit %1$s" on public.%1$I for update to authenticated using (public.is_decider_for(budget_id)) with check (public.is_decider_for(budget_id))', t);
  end loop;
end $$;

-- Announcements and partner links follow the same rule.
drop policy if exists "deciders add announcements" on public.announcements;
drop policy if exists "deciders edit announcements" on public.announcements;
create policy "deciders add announcements" on public.announcements for insert to authenticated with check (public.is_decider_for(coalesce(wedding_id, 'shared')));
create policy "deciders edit announcements" on public.announcements for update to authenticated using (public.is_decider_for(coalesce(wedding_id, 'shared'))) with check (public.is_decider_for(coalesce(wedding_id, 'shared')));
drop policy if exists "deciders add partner links" on public.partner_links;
drop policy if exists "deciders edit partner links" on public.partner_links;
create policy "deciders add partner links" on public.partner_links for insert to authenticated with check (public.is_decider_for(wedding_id));
create policy "deciders edit partner links" on public.partner_links for update to authenticated using (public.is_decider_for(wedding_id)) with check (public.is_decider_for(wedding_id));
