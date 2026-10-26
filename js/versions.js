// Version history for a list or an option: every change, who made it and when, with Restore —
// one change, one deleted row, or the whole list back to how it was at that moment.
// Built on the edit history (activity) the database already keeps.
import { store } from './store.js?v=56';
import { h, modal, toast, ago, confirmBox } from './ui.js?v=56';

const FIELD = { cells: 'the row', title: 'the name', rate: 'the price', notes: 'the notes', phone: 'the phone', links: 'the links', images: 'the photos', columns: 'the columns', status: 'the status', caption: 'the caption', text: 'the text', final: 'the final design', step_id: 'the category' };
const show = (v) => v == null || v === '' ? '—' : Array.isArray(v) ? (v.every(x => typeof x === 'string') ? v.filter(Boolean).join(' · ') || '—' : `${v.length} ${v.length === 1 ? 'item' : 'items'}`) : typeof v === 'object' ? '…' : String(v);

// Everything the history knows about a list (its rows, including deleted ones) or a single item.
async function entriesFor(kind, target) {
  if (kind === 'list') {
    const ids = new Set((store.rows('list_rows') || []).filter(r => r.list_id === target.id).map(r => r.id));
    const rows = await store.history({ entity: 'list_rows', weddingId: target.wedding_id });
    const own = rows.filter(a => ids.has(a.entity_id) || (a.changes && a.changes._old && a.changes._old.list_id === target.id) || (a.changes && a.changes._new && a.changes._new.list_id === target.id));
    const head = await store.history({ entity: 'lists', ids: [target.id] });
    return [...own, ...head].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)) || (b.id - a.id));
  }
  return (await store.history({ entity: 'board_items', ids: [target.id] })).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)) || (b.id - a.id));
}

// Undo one entry. Returns true if something changed.
async function revert(a, kind) {
  const table = a.entity;
  const ch = a.changes || {};
  if (a.action === 'purge' && ch._old) { await store.insert(table, { ...ch._old }); return true; }
  if (a.action === 'create') { const cur = store.find(table, a.entity_id); if (cur) { if (table === 'list_rows') await store.del(table, a.entity_id); else await store.remove(table, a.entity_id); return true; } return false; }
  if (a.action === 'remove') { await store.restore(table, a.entity_id); return true; }
  if (a.action === 'restore') { await store.remove(table, a.entity_id); return true; }
  const cur = store.find(table, a.entity_id); if (!cur) return false;
  const patch = {}, dataPatch = {};
  for (const [k, v] of Object.entries(ch)) {
    if (k.startsWith('_')) continue;
    if (table === 'board_items' && !(k in cur)) dataPatch[k] = v.old; else patch[k] = v.old;
  }
  if (Object.keys(dataPatch).length) patch.data = { ...(cur.data || {}), ...dataPatch };
  if (!Object.keys(patch).length) return false;
  await store.update(table, a.entity_id, patch); return true;
}

function describe(a, kind) {
  const ch = a.changes || {};
  const who = a.actor_name || 'Someone';
  if (a.entity === 'lists') return a.action === 'update' ? `${who} changed ${Object.keys(ch).filter(k => !k.startsWith('_')).map(k => FIELD[k] || k).join(', ')} of the list` : `${who} ${a.action === 'create' ? 'started' : a.action === 'remove' ? 'moved' : a.action} the list`;
  if (kind === 'list') {
    const cells = (x) => (x || []).filter(Boolean).slice(0, 3).join(' · ');
    if (a.action === 'create') return `${who} added a row${a.label ? ' — ' + a.label : ''}`;
    if (a.action === 'purge') return `${who} deleted a row — ${cells(ch._old && ch._old.cells) || 'empty row'}`;
    if (ch.cells) return `${who} changed a row: ${cells(ch.cells.old) || '—'} → ${cells(ch.cells.new) || '—'}`;
    return `${who} changed a row`;
  }
  if (a.action === 'create') return `${who} added it`;
  if (a.action === 'remove') return `${who} deleted it`;
  if (a.action === 'restore') return `${who} brought it back`;
  return Object.entries(ch).filter(([k]) => !k.startsWith('_')).map(([k, v]) => `${who} changed ${FIELD[k] || k}: ${show(v.old)} → ${show(v.new)}`).join('; ') || `${who} changed it`;
}

export async function openHistory(kind, target) {
  const body = h('div', { class: 'vh' }, h('p', { class: 'muted', style: { margin: 0 } }, 'Loading the history…'));
  const m = modal({ title: kind === 'list' ? `History of “${target.title}”` : `History of “${(target.data || {}).title || 'this option'}”`, wide: true, body, actions: [{ label: 'Close', onClick: () => { } }] });
  let list;
  try { list = await entriesFor(kind, target); } catch (e) { body.replaceChildren(h('p', { class: 'muted' }, 'Could not load the history: ' + (e.message || e))); return; }
  if (!list.length) { body.replaceChildren(h('p', { class: 'muted', style: { margin: 0 } }, kind === 'list' ? 'No changes recorded yet. From now on every edit, added row and deleted row shows here and can be undone.' : 'No changes recorded yet.')); return; }
  const doOne = async (a) => { try { if (await revert(a, kind)) { toast('Restored'); m.close(); } else toast('Nothing to restore — it’s already like that'); } catch (e) { toast(e.message || 'Could not restore', 'error'); } };
  const doBackTo = async (i) => {
    const later = list.slice(0, i); // newer than the chosen moment
    if (!(await confirmBox(`Put it back to how it was ${ago(list[i].created_at)}?`, `${later.length} later ${later.length === 1 ? 'change is' : 'changes are'} undone. This itself is recorded, so you can change your mind.`, 'Put it back'))) return;
    try { await store.batch(async () => { for (const a of later) await revert(a, kind).catch(() => null); }); toast('Back to how it was'); m.close(); } catch (e) { toast(e.message || 'Could not restore', 'error'); }
  };
  body.replaceChildren(
    h('p', { class: 'muted', style: { marginTop: 0 } }, 'Newest first. “Undo this” reverses one change; “Back to here” puts everything back to how it was just after that change.'),
    h('ol', { class: 'vh-list' }, list.map((a, i) => h('li', { class: 'vh-item' },
      h('div', { class: 'vh-tx' }, h('span', {}, describe(a, kind)), h('small', {}, ago(a.created_at))),
      h('div', { class: 'vh-acts' },
        h('button', { type: 'button', class: 'btn ghost small', onclick: () => doOne(a) }, a.action === 'purge' ? 'Bring back' : 'Undo this'),
        i > 0 ? h('button', { type: 'button', class: 'link-btn', onclick: () => doBackTo(i) }, 'Back to here') : null)))));
}
