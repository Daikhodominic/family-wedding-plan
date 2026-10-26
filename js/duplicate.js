// Duplicate a step (right after itself) or a list (with all its rows).
import { store } from './store.js?v=57';
import { toast } from './ui.js?v=57';

const live = (rows) => (rows || []).filter(r => !r.deleted_at);

export async function duplicateStep(s) {
  const sibs = live(store.rows('steps')).filter(x => x.area_id === s.area_id).sort((a, b) => (a.position || 0) - (b.position || 0));
  const next = sibs[sibs.indexOf(sibs.find(x => x.id === s.id)) + 1];
  const pos = next ? ((s.position || 0) + (next.position || 0)) / 2 : (s.position || 0) + 1000;
  const note = s.lock_note && s.lock_note.choose !== undefined ? { choose: s.lock_note.choose } : {};
  const copy = await store.insert('steps', { wedding_id: s.wedding_id, area_id: s.area_id, title: s.title + ' (copy)', notes: s.notes || '', owner: s.owner || '', due: s.due || null, status: 'todo', gate: !!s.gate, lock_note: note, position: pos });
  toast('Copied — the copy is right after it');
  return copy;
}

export async function duplicateList(l) {
  const copy = await store.insert('lists', { wedding_id: l.wedding_id, step_id: l.step_id || null, title: l.title + ' (copy)', columns: l.columns || ['Name', 'Notes'] });
  const rows = (store.rows('list_rows') || []).filter(r => r.list_id === l.id).sort((a, b) => (a.position || 0) - (b.position || 0));
  if (rows.length) await store.insertMany('list_rows', rows.map(r => ({ list_id: copy.id, wedding_id: l.wedding_id, cells: [...(r.cells || [])], position: r.position || 0 })));
  toast(`Copied “${l.title}” with ${rows.length} ${rows.length === 1 ? 'row' : 'rows'}`);
  return copy;
}
