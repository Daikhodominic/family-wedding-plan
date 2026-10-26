// Locks: the admin can lock a plan section, a list or a budget so only the admin can change it.
// Everyone can still see it and comment. The database enforces it (update 14).
import { store } from './store.js?v=56';
import { h, toast } from './ui.js?v=56';

const NAME = { areas: 'section', lists: 'list', budgets: 'budget' };
export const lockedBy = (target, id) => store.isLocked(target, id);

export function toggleLock(target, id, weddingId) {
  const on = lockedBy(target, id);
  return (on ? store.unlock(target, id) : store.lock(target, id, weddingId))
    .then(() => toast(on ? `Unlocked — the family can change this ${NAME[target]} again` : `Locked — only you can change this ${NAME[target]} now`))
    .catch(e => toast(e.message || 'That did not work', 'error'));
}
// An entry for a ⋯ menu (admin only).
export function lockMenuItem(target, id, weddingId) {
  if (!store.me || !store.me.isAdmin) return null;
  return { label: lockedBy(target, id) ? `Unlock this ${NAME[target]}` : `Lock this ${NAME[target]} (only you can change it)`, onClick: () => toggleLock(target, id, weddingId) };
}
// A small padlock chip; for the admin it's a button that unlocks.
export function lockChip(target, id, weddingId) {
  const l = lockedBy(target, id); if (!l) return null;
  const who = store.memberName(l.created_by) || 'the admin';
  if (store.me && store.me.isAdmin) return h('button', { type: 'button', class: 'lock-chip', title: 'Tap to unlock', onclick: (e) => { e.stopPropagation(); toggleLock(target, id, weddingId); } }, '🔒 Locked');
  return h('span', { class: 'lock-chip', title: `Locked by ${who}. You can still comment.` }, '🔒 Locked');
}
// A header button (admin only).
export function lockButton(target, id, weddingId) {
  if (!store.me || !store.me.isAdmin) return null;
  const on = lockedBy(target, id);
  return h('button', { type: 'button', class: 'btn ghost', title: on ? 'Let the family change it again' : 'Only you will be able to change it', onclick: () => toggleLock(target, id, weddingId) }, on ? '🔓 Unlock' : '🔒 Lock');
}
