-- ============================================================
--  Update 13 — let everyone save their own WhatsApp number
--  Paste into Supabase → SQL Editor → New query → Run (once).
--
--  Update 11 added the phone column but forgot to allow saving it, so
--  "Your name and number" said "permission denied for table members".
--  Members may still only change their own row (name, number, last seen);
--  who is admin or a Decider stays admin-only.
-- ============================================================

grant update (phone) on public.members to authenticated;
