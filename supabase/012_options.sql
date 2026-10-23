-- ============================================================
--  Update 12 — Options (swipe, compare, choose) on the live site
--  Paste into Supabase → SQL Editor → New query → Run (once).
--
--  The database only accepted certain kinds of mood-board items, and "option"
--  (the vendor and product options people swipe on) wasn't one of them, so
--  adding options — and the sample options — failed on the live site.
--  This allows them, and keeps option cards (prices, phone numbers) out of the
--  partner view, as decided.
-- ============================================================

alter table public.board_items drop constraint if exists board_items_kind_check;
alter table public.board_items add constraint board_items_kind_check
  check (kind in ('note','image','video','file','link','contact','compare','label','palette','shape','connector','gallery','checklist','option'));

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
      from public.board_items b where b.wedding_id = w and b.deleted_at is null and b.kind not in ('contact', 'shape', 'connector', 'option')), '[]'::jsonb),
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
