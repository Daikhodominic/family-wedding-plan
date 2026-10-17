-- ============================================================
--  Update 5 — budgets
--  Paste into Supabase → SQL Editor → New query → Run (once).
--  Family members can read and change budgets; only the admin
--  deletes for good. Partner viewers (coming later) never see this.
-- ============================================================

-- One budget per wedding (id = the wedding's id) plus 'shared' for home costs.
create table if not exists public.budgets (
  id           text primary key,
  wedding_id   text references public.weddings on delete cascade,
  title        text not null,
  total        numeric not null default 0,
  contingency  numeric not null default 0,
  position     double precision not null default 0,
  created_at   timestamptz not null default now(),
  created_by   uuid default auth.uid(),
  deleted_at   timestamptz,
  deleted_by   uuid
);

-- Areas the total is split into (catering, décor, dress stitching …).
create table if not exists public.budget_areas (
  id           uuid primary key default gen_random_uuid(),
  budget_id    text not null references public.budgets on delete cascade,
  wedding_id   text references public.weddings on delete cascade,
  title        text not null,
  planned      numeric not null default 0,
  position     double precision not null default 0,
  created_at   timestamptz not null default now(),
  created_by   uuid default auth.uid(),
  deleted_at   timestamptz,
  deleted_by   uuid
);

-- Payments: what is owed or paid. No area = unplanned, drawn from contingency.
create table if not exists public.budget_items (
  id               uuid primary key default gen_random_uuid(),
  budget_id        text not null references public.budgets on delete cascade,
  area_id          uuid references public.budget_areas on delete set null,
  wedding_id       text references public.weddings on delete cascade,
  step_id          uuid references public.steps on delete set null,
  title            text not null,
  payee            text not null default '',
  amount           numeric not null default 0,
  due              date,
  paid_at          timestamptz,
  refund_expected  boolean not null default false,
  notes            text not null default '',
  position         double precision not null default 0,
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid(),
  deleted_at       timestamptz,
  deleted_by       uuid
);

do $$
declare t text;
begin
  foreach t in array array['budgets','budget_areas','budget_items'] loop
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
    execute format('drop trigger if exists %1$s_stamp on public.%1$I', t);
    execute format('create trigger %1$s_stamp before update on public.%1$I for each row execute function public.stamp_deleted()', t);
    execute format('drop trigger if exists %1$s_log on public.%1$I', t);
    execute format('create trigger %1$s_log after insert or update or delete on public.%1$I for each row execute function public.log_change()', t);
  end loop;
end $$;
