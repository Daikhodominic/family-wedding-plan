-- ============================================================
--  Update 7 — collage and checklist cards on the mood board
--  Paste into Supabase → SQL Editor → New query → Run (once).
-- ============================================================
alter table public.board_items drop constraint if exists board_items_kind_check;
alter table public.board_items add constraint board_items_kind_check
  check (kind in ('note','image','video','file','link','contact','compare','label','palette','shape','connector','gallery','checklist'));
