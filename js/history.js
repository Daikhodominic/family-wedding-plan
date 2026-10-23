// Undo and redo for your own changes in this session.
// Every write goes through the store, so we wrap its write methods and keep
// a list of what to reverse. Several writes made together (moving a group,
// clearing a page) are undone as one step.
import { store, nowIso } from './store.js?v=25';
import { h, toast, ICONS } from './ui.js?v=25';

const MAX = 80;
const SKIP = new Set(['activity', 'members', 'reactions']); // reactions and votes toggle on their own
const HARD = new Set(['list_rows']);                     // rows with no Bin: undoing an add deletes them
const undoS = [], redoS = [];
let replaying = false, grouping = null;
const listeners = new Set();
const notify = () => { for (const fn of listeners) fn(); refreshButtons(); };

const orig = {
  insert: store.insert.bind(store),
  update: store.update.bind(store),
  patchMany: store.patchMany.bind(store),
  del: store.del.bind(store)
};

function push(op) {
  if (replaying) return;
  if (grouping) { grouping.push(op); return; }
  undoS.push([op]); if (undoS.length > MAX) undoS.shift();
  redoS.length = 0; notify();
}
const pick = (row, keys) => Object.fromEntries(keys.map(k => [k, row && row[k] !== undefined ? row[k] : null]));

store.insert = async (t, row) => { const r = await orig.insert(t, row); if (!SKIP.has(t) && r) push({ k: 'insert', t, id: r.id, row: { ...r } }); return r; };
store.update = async (t, id, patch) => {
  const before = { ...(store.find(t, id) || {}) };
  await orig.update(t, id, patch);
  if (!SKIP.has(t)) push({ k: 'update', t, id, patch: { ...patch }, prev: pick(before, Object.keys(patch)) });
};
store.patchMany = async (t, ids, patch) => {
  const prevs = Object.fromEntries(ids.map(id => [id, pick(store.find(t, id), Object.keys(patch))]));
  await orig.patchMany(t, ids, patch);
  if (!SKIP.has(t)) push({ k: 'many', t, ids: [...ids], patch: { ...patch }, prevs });
};
store.del = async (t, id) => {
  const row = { ...(store.find(t, id) || {}) };
  await orig.del(t, id);
  if (!SKIP.has(t) && row.id) push({ k: 'del', t, row });
};

// Run several writes as one undo step.
export async function together(fn) {
  if (grouping) return fn();
  grouping = [];
  try { await fn(); }
  finally {
    const ops = grouping; grouping = null;
    if (ops.length && !replaying) { undoS.push(ops); if (undoS.length > MAX) undoS.shift(); redoS.length = 0; notify(); }
  }
}

async function backward(op) {
  if (op.k === 'insert') {
    if (HARD.has(op.t)) return orig.del(op.t, op.id);
    return orig.update(op.t, op.id, { deleted_at: nowIso(), deleted_by: store.me && store.me.id });
  }
  if (op.k === 'update') return orig.update(op.t, op.id, op.prev);
  if (op.k === 'many') {
    const byPrev = new Map();
    for (const id of op.ids) { const key = JSON.stringify(op.prevs[id]); if (!byPrev.has(key)) byPrev.set(key, []); byPrev.get(key).push(id); }
    for (const [key, ids] of byPrev) await orig.patchMany(op.t, ids, JSON.parse(key));
    return;
  }
  if (op.k === 'del') { const { ...row } = op.row; return orig.insert(op.t, row); }
}
async function forward(op) {
  if (op.k === 'insert') {
    const now = store.find(op.t, op.id);
    if (now) return orig.update(op.t, op.id, { deleted_at: null, deleted_by: null });
    return orig.insert(op.t, op.row);
  }
  if (op.k === 'update') return orig.update(op.t, op.id, op.patch);
  if (op.k === 'many') return orig.patchMany(op.t, op.ids, op.patch);
  if (op.k === 'del') return orig.del(op.t, op.row.id);
}

const NOUN = { board_items: 'card', steps: 'step', areas: 'area', stages: 'stage', todos: 'to-do', files: 'file', lists: 'list', list_rows: 'list row', budget_items: 'payment', budget_areas: 'budget area', budgets: 'budget', comments: 'comment', weddings: 'wedding' };
export function describeStep(ops) {
  if (!ops) return '';
  if (ops.length > 1) {
    const moves = ops.every(o => o.k === 'update' && Object.keys(o.patch).every(k => ['x', 'y', 'w', 'z'].includes(k)));
    if (moves) return `moving ${ops.length} cards`;
    return `${ops.length} changes`;
  }
  const o = ops[0], n = NOUN[o.t] || 'item';
  if (o.k === 'insert') return 'adding a ' + n;
  if (o.k === 'del') return 'removing a ' + n;
  if (o.k === 'many') return (o.patch.deleted_at ? 'clearing ' : o.patch.deleted_at === null ? 'restoring ' : 'changing ') + o.ids.length + ' ' + n + 's';
  const keys = Object.keys(o.patch);
  if (keys.includes('deleted_at')) return (o.patch.deleted_at ? 'removing the ' : 'restoring the ') + n;
  if (keys.every(k => ['x', 'y', 'z'].includes(k))) return 'moving the ' + n;
  if (keys.every(k => ['w'].includes(k))) return 'resizing the ' + n;
  if (keys.includes('locked_at')) return o.patch.locked_at ? 'making it final' : 'reopening';
  if (keys.includes('paid_at')) return o.patch.paid_at ? 'marking paid' : 'marking not paid';
  return 'editing the ' + n;
}

let busy = false;
export async function undo() {
  if (busy || !undoS.length) { if (!undoS.length) toast('Nothing to undo'); return; }
  busy = true; replaying = true;
  const ops = undoS.pop();
  try { for (const op of [...ops].reverse()) await backward(op); redoS.push(ops); toast('Undid ' + describeStep(ops)); }
  catch (e) { console.error(e); toast(e.message || 'Could not undo that', 'error'); }
  finally { replaying = false; busy = false; notify(); }
}
export async function redo() {
  if (busy || !redoS.length) { if (!redoS.length) toast('Nothing to redo'); return; }
  busy = true; replaying = true;
  const ops = redoS.pop();
  try { for (const op of ops) await forward(op); undoS.push(ops); toast('Redid ' + describeStep(ops)); }
  catch (e) { console.error(e); toast(e.message || 'Could not redo that', 'error'); }
  finally { replaying = false; busy = false; notify(); }
}

// Two small buttons for headers.
export function undoButtons(cls = '') {
  return h('span', { class: 'undo-redo ' + cls },
    h('button', { type: 'button', class: 'ur-btn undo-btn', 'aria-label': 'Undo', title: undoS.length ? 'Undo ' + describeStep(undoS[undoS.length - 1]) + ' (Ctrl+Z)' : 'Nothing to undo', disabled: !undoS.length ? true : null, html: ICONS.undo, onclick: undo }),
    h('button', { type: 'button', class: 'ur-btn redo-btn', 'aria-label': 'Redo', title: redoS.length ? 'Redo ' + describeStep(redoS[redoS.length - 1]) + ' (Ctrl+Shift+Z)' : 'Nothing to redo', disabled: !redoS.length ? true : null, html: ICONS.redo, onclick: redo }));
}
function refreshButtons() {
  document.querySelectorAll('.undo-btn').forEach(b => { b.disabled = !undoS.length; b.title = undoS.length ? 'Undo ' + describeStep(undoS[undoS.length - 1]) + ' (Ctrl+Z)' : 'Nothing to undo'; });
  document.querySelectorAll('.redo-btn').forEach(b => { b.disabled = !redoS.length; b.title = redoS.length ? 'Redo ' + describeStep(redoS[redoS.length - 1]) + ' (Ctrl+Shift+Z)' : 'Nothing to redo'; });
}

document.addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
  const tag = (document.activeElement || {}).tagName;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) || (document.activeElement && document.activeElement.isContentEditable)) return; // let text boxes undo their own typing
  if (document.querySelector('.modal-wrap')) return;
  const k = e.key.toLowerCase();
  if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
  else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redo(); }
});
