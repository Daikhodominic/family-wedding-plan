-- ============================================================
--  Update 6 — comments, suggestions, reactions and votes on the mood board
--  Paste into Supabase → SQL Editor → New query → Run (once).
-- ============================================================

-- Comments and suggestions on any mood board card.
create table if not exists public.comments (
  id           uuid primary key default gen_random_uuid(),
  wedding_id   text not null references public.weddings on delete cascade,
  item_id      uuid not null references public.board_items on delete cascade,
  kind         text not null default 'comment' check (kind in ('comment', 'suggestion')),
  body         text not null,
  title        text,                       -- short copy of the text, for the edit history
  author_name  text,
  created_at   timestamptz not null default now(),
  created_by   uuid default auth.uid(),
  deleted_at   timestamptz,
  deleted_by   uuid
);

-- Reactions (♥ 👍 …) on cards, and up/down votes on comparison options.
-- target = 'card' for a reaction, or the option's key for a vote; value = the emoji, 'up' or 'down'.
create table if not exists public.reactions (
  id           uuid primary key default gen_random_uuid(),
  wedding_id   text not null references public.weddings on delete cascade,
  item_id      uuid not null references public.board_items on delete cascade,
  target       text not null default 'card',
  value        text not null,
  user_name    text,
  created_at   timestamptz not null default now(),
  created_by   uuid default auth.uid(),
  unique (item_id, target, created_by, value)
);

alter table public.comments enable row level security;
alter table public.reactions enable row level security;

drop policy if exists "members read comments" on public.comments;
drop policy if exists "members add comments" on public.comments;
drop policy if exists "members edit comments" on public.comments;
drop policy if exists "admin deletes comments" on public.comments;
create policy "members read comments" on public.comments for select to authenticated using (public.is_member());
create policy "members add comments" on public.comments for insert to authenticated with check (public.is_member() and created_by = auth.uid());
create policy "members edit comments" on public.comments for update to authenticated using (public.is_member() and (created_by = auth.uid() or public.is_admin())) with check (public.is_member());
create policy "admin deletes comments" on public.comments for delete to authenticated using (public.is_admin());

drop policy if exists "members read reactions" on public.reactions;
drop policy if exists "members add reactions" on public.reactions;
drop policy if exists "members remove own reactions" on public.reactions;
create policy "members read reactions" on public.reactions for select to authenticated using (public.is_member());
create policy "members add reactions" on public.reactions for insert to authenticated with check (public.is_member() and created_by = auth.uid());
create policy "members remove own reactions" on public.reactions for delete to authenticated using (created_by = auth.uid() or public.is_admin());

do $$ begin alter publication supabase_realtime add table public.comments; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.reactions; exception when duplicate_object then null; end $$;

drop trigger if exists comments_stamp on public.comments;
create trigger comments_stamp before update on public.comments for each row execute function public.stamp_deleted();
drop trigger if exists comments_log on public.comments;
create trigger comments_log after insert or update or delete on public.comments for each row execute function public.log_change();
