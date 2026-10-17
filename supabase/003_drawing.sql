-- ============================================================
--  Update 3 — drawing on the mood board
--  Paste into Supabase → SQL Editor → New query → Run (once).
--  Allows two new kinds of board items: drawings (pen, lines,
--  arrows, circles, boxes, dots) and connections between cards.
-- ============================================================
alter table public.board_items drop constraint if exists board_items_kind_check;
alter table public.board_items add constraint board_items_kind_check
  check (kind in ('note','image','video','file','link','contact','compare','label','palette','shape','connector'));
