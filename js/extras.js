import { copyPlanFrom, planSize } from './template.js?v=55';
import { storagePanel } from './storage.js?v=55';
import { sampleButton } from './swipe.js?v=55';
import { backupsPanel } from './backups.js?v=55';
import { store } from './store.js?v=55';
import { h, toast, field, confirmBox, ago, dayHeading, shortDate, longDate } from './ui.js?v=55';
import { othersSummary, bringBackOthers } from './safety.js?v=55';
import { weddings, wedding, feedList, render, THEMES } from './app.js?v=55';
import { confirmAreaRestore, inr } from './budget.js?v=55';
import { clearAll } from './clear.js?v=55';
import { downloadBackup, decidesFor } from './tools.js?v=55';

const NOUN = { stages: 'stage', areas: 'area', steps: 'step', todos: 'to-do', weddings: 'wedding space', board_items: 'card', files: 'file', lists: 'list', budgets: 'budget', budget_areas: 'budget line', budget_items: 'payment', comments: 'comment' };
const CARD = { note: 'note', image: 'photo', video: 'video', file: 'document', link: 'link', contact: 'contact', compare: 'comparison', label: 'section title', palette: 'colours', shape: 'drawing', connector: 'connection', gallery: 'collage', checklist: 'checklist', option: 'option' };
const FIELD = {
  title: 'name', owner: 'person in charge', due: 'due date', status: 'status', notes: 'notes', area_id: 'area', stage_id: 'stage',
  couple: 'couple names', monogram: 'monogram', wedding_date: 'wedding date', date_note: 'date note', theme: 'theme', theme_custom: 'theme colours',
  text: 'text', caption: 'caption', rate: 'rate', phone: 'phone', role: 'role', url: 'address', options: 'options', colors: 'colours',
  tint: 'colour', path: 'file', thumb: 'picture', kind: 'type',
  planned: 'planned amount', amount: 'amount', total: 'total', contingency: 'contingency', paid_at: 'paid', payee: 'paid to', refund_expected: 'refund expected'
};
const STATUS = { todo: 'To do', doing: 'In progress', done: 'Done' };

function nounFor(a) {
  if (a.entity === 'board_items') {
    const row = store.find('board_items', a.entity_id);
    return row ? CARD[row.kind] || 'card' : 'card';
  }
  return NOUN[a.entity] || 'item';
}
function show(v, key) {
  if (v === null || v === undefined || v === '') return '(empty)';
  if (key === 'status') return STATUS[v] || v;
  if (key === 'due' || key === 'wedding_date') return /^\d{4}-\d{2}-\d{2}$/.test(v) ? shortDate(v) : v;
  if (key === 'area_id') { const r = store.find('areas', v) || (store.rows('budget_areas') || []).find(x => x.id === v); return r ? r.title : 'another section'; }
  if (['planned', 'amount', 'total', 'contingency'].includes(key)) return inr(Number(v) || 0);
  if (key === 'paid_at') return v ? 'paid' : 'not paid';
  if (key === 'refund_expected') return v ? 'yes' : 'no';
  if (key === 'stage_id') { const r = store.find('stages', v); return r ? r.title : 'another stage'; }
  if (typeof v === 'object') return null;
  const s = String(v);
  return s.length > 60 ? s.slice(0, 57) + '…' : s;
}

export function describe(a) {
  const noun = nounFor(a);
  const name = a.label ? `“${a.label.length > 70 ? a.label.slice(0, 67) + '…' : a.label}”` : '';
  const changes = [];
  let text;
  switch (a.action) {
    case 'create': text = a.entity === 'comments' ? `left a comment ${name}` : `added ${noun === 'wedding details' ? '' : 'a ' + noun} ${name}`; break;
    case 'remove': text = `moved ${noun === 'card' ? 'a card' : 'the ' + noun} ${name} to the Bin`; break;
    case 'restore': text = `restored ${noun === 'card' ? 'a card' : 'the ' + noun} ${name}`; break;
    case 'purge': text = `deleted ${noun === 'card' ? 'a card' : 'the ' + noun} ${name} for good`; break;
    default: {
      const ch = a.changes || {};
      const keys = Object.keys(ch);
      if (ch.locked_at && ch.locked_at.new && !ch.locked_at.old) {
        const ln = (ch.lock_note && ch.lock_note.new) || {};
        text = `made ${name} final` + (ln.with ? ` with ${ln.with}` : '') + (ln.amount ? ` for ₹${ln.amount}` : '');
        return { text: text.replace(/\s+/g, ' ').trim(), changes };
      } else if (ch.locked_at && !ch.locked_at.new && ch.locked_at.old) {
        return { text: `reopened ${name}`, changes };
      } else if (keys.length === 1 && keys[0] === 'gate') {
        return { text: ch.gate.new ? `marked ${name} as a big decision` : `took ${name} off the big decisions`, changes };
      } else if (keys.length === 1 && keys[0] === 'paid_at') {
        return { text: ch.paid_at.new ? `marked ${name} as paid` : `marked ${name} as not paid`, changes };
      } else if (keys.length === 1 && keys[0] === 'status') {
        text = ch.status.new === 'done' ? `marked ${name} as done` : `set ${name} to ${STATUS[ch.status.new] || ch.status.new}`;
      } else if (keys.length === 1 && keys[0] === 'area_id') {
        text = `moved ${name} to ${show(ch.area_id.new, 'area_id')}`;
      } else if (keys.length === 1 && keys[0] === 'chosen') {
        text = `changed the choice on ${name}`;
      } else {
        text = `changed ${keys.map(k => FIELD[k] || k).join(', ')} on ${noun === 'card' ? 'a card' : 'the ' + noun} ${name}`;
      }
      for (const k of keys) {
        const o = show(ch[k].old, k), n = show(ch[k].new, k);
        if (o === null || n === null) continue;
        changes.push(h('span', { style: { display: 'block' } }, (FIELD[k] || k) + ': ', h('s', {}, o), ' → ', n));
      }
    }
  }
  return { text: text.replace(/\s+/g, ' ').trim(), changes };
}

export function linkFor(a) {
  const w = a.wedding_id;
  const row = store.find(a.entity, a.entity_id);
  if (a.action === 'purge' || !row) return '#/activity';
  if (row.deleted_at) return '#/bin';
  if (a.entity === 'weddings') return '#/w/' + a.entity_id;
  if (a.entity === 'budgets' || a.entity === 'budget_areas' || a.entity === 'budget_items') return row.wedding_id ? `#/w/${row.wedding_id}/budget` : '#/budget?to=shared';
  if (row.wedding_id && (store.find('weddings', row.wedding_id) || {}).deleted_at) return '#/bin';
  if (a.entity === 'board_items') return `#/w/${w}/board?focus=${a.entity_id}`;
  if (a.entity === 'comments') return `#/w/${row.wedding_id}/board?focus=${row.item_id}`;
  if (a.entity === 'todos') return `#/w/${w}/todo?focus=${a.entity_id}`;
  if (a.entity === 'files' || a.entity === 'lists') return a.entity === 'lists' ? `#/w/${w}/lists?list=${row.id}` : row.step_id && store.find('steps', row.step_id) ? `#/w/${w}/plan?focus=${row.step_id}` : `#/w/${w}/files`;
  if (a.entity === 'steps') {
    const area = store.find('areas', row.area_id);
    if (!area || area.deleted_at || (store.find('stages', area.stage_id) || {}).deleted_at) return '#/bin';
  }
  if (a.entity === 'areas' && (store.find('stages', row.stage_id) || {}).deleted_at) return '#/bin';
  return `#/w/${w}/plan?focus=${a.entity_id}`;
}

/* ---------- Activity ---------- */
let actFilter = 'all';
export function renderActivity() {
  const all = store.rows('activity');
  const list = all.filter(a => actFilter === 'all' || a.wedding_id === actFilter);
  const newCount = all.filter(a => a.id > store.me.lastSeen && a.actor !== store.me.id).length;
  const box = h('div', { class: 'panel' });
  if (!list.length) box.append(h('p', { class: 'muted' }, 'No changes yet.'));
  let day = null; let chunk = [];
  const flush = () => { if (chunk.length) { box.append(h('div', { class: 'day-h' }, day), feedList(chunk)); chunk = []; } };
  for (const a of list) { const d = dayHeading(a.created_at); if (d !== day) { flush(); day = d; } chunk.push(a); }
  flush();
  const top = all[0];
  if (top) setTimeout(() => store.markSeen(top.id), 1500);
  return h('main', { class: 'wrap', style: { paddingBottom: '60px' } },
    h('div', { class: 'eyebrow' }, 'Both weddings'), h('h1', { class: 'page-title' }, 'Edit history'),
    h('p', { class: 'muted', style: { margin: 0 } }, newCount ? `${newCount} new since your last visit, highlighted below. Tap any change to see it.` : 'Every change across both weddings. Tap any change to see it.'),
    h('div', { class: 'filters', role: 'group', 'aria-label': 'Filter' },
      [['all', 'Both weddings'], ...weddings().map(w => [w.id, w.couple])].map(([k, l]) =>
        h('button', { class: 'filter', type: 'button', 'aria-pressed': String(actFilter === k), onclick: () => { actFilter = k; render(); } }, l))),
    box);
}

/* ---------- Bin ---------- */
export function renderBin() {
  const rows = [];
  for (const t of ['weddings', 'stages', 'areas', 'steps', 'todos', 'board_items', 'files', 'lists', 'budget_areas', 'budget_items', 'comments']) for (const r of (store.rows(t) || [])) if (r.deleted_at) rows.push({ t, r });
  rows.sort((a, b) => new Date(b.r.deleted_at) - new Date(a.r.deleted_at));
  const label = ({ t, r }) => {
    if (t === 'board_items') { const d = r.data || {}; return `${(CARD[r.kind] || 'card').replace(/^./, c => c.toUpperCase())}${d.title || d.text ? ': ' + (d.title || d.text).slice(0, 80) : ''}`; }
    if (t === 'comments') return `${r.kind === 'suggestion' ? 'Suggestion' : 'Comment'}: ${(r.body || '').slice(0, 80)}`;
    const n = NOUN[t]; return `${n[0].toUpperCase() + n.slice(1)}: ${r.title || r.couple}`;
  };
  const context = ({ t, r }) => {
    const w = store.find('weddings', r.wedding_id);
    const bits = [t === 'weddings' ? 'the whole space, with its plan, to-dos and board' : w ? w.couple + (w.deleted_at ? ' (removed)' : '') : t.startsWith('budget') ? 'Shared home costs' : ''];
    if (t === 'budget_areas') bits.push('planned ' + inr(Number(r.planned) || 0));
    if (t === 'budget_items') bits.push(inr(Number(r.amount) || 0) + (r.paid_at ? ' · paid' : ''));
    if (t === 'steps') { const a = store.find('areas', r.area_id); if (a) bits.push('in ' + a.title); }
    if (t === 'areas') { const s = store.find('stages', r.stage_id); if (s) bits.push('in ' + s.title); }
    if (t === 'stages') { const n = store.rows('areas').filter(a => a.stage_id === r.id && !a.deleted_at).length; if (n) bits.push(`with ${n} ${n === 1 ? 'section' : 'sections'} inside`); }
    const who = store.memberName(r.deleted_by);
    bits.push(`removed ${who ? 'by ' + who + ' ' : ''}${ago(r.deleted_at)}`);
    return bits.filter(Boolean).join(' · ');
  };
  const list = h('div', { class: 'panel' });
  if (!rows.length) list.append(h('p', { class: 'muted' }, 'The Bin is empty.'));
  // Things cleared together share one timestamp: show them as one group with Restore all.
  const byTime = new Map();
  for (const it of rows) { const k = it.r.deleted_at; if (!byTime.has(k)) byTime.set(k, []); byTime.get(k).push(it); }
  const groups = [...byTime.values()].filter(g => g.length >= 3);
  const grouped = new Set(groups.flat());
  const groupsEl = groups.map(g => {
    const who = store.memberName(g[0].r.deleted_by);
    const ws = [...new Set(g.map(it => (store.find('weddings', it.r.wedding_id) || {}).couple).filter(Boolean))];
    const tables = [...new Set(g.map(it => it.t))];
    const oth = othersSummary(tables.map(t => [t, g.filter(it => it.t === t).map(it => it.r)]));
    return h('div', { class: 'bin-group' + (oth.n ? ' has-others' : '') },
      h('div', { class: 'bin-row' },
        h('div', {}, h('div', { style: { fontWeight: 600 } }, `Cleared together · ${g.length} things`),
          h('div', { class: 'muted', style: { fontSize: '14px' } }, [ws.join(' & ') || 'Shared home costs', tables.map(t => NOUN[t] + 's').join(', '), `removed ${who ? 'by ' + who + ' ' : ''}${ago(g[0].r.deleted_at)}`].join(' · '))),
        h('div', { class: 'acts' },
          h('button', { class: 'btn small', type: 'button', onclick: async () => {
            try { await store.batch(async () => { for (const t of tables) await store.restoreMany(t, g.filter(it => it.t === t).map(it => it.r.id)); }); toast(`Restored ${g.length}`); } catch (e) { toast(e.message, 'error'); }
          } }, 'Restore all'),
          oth.n ? h('button', { class: 'btn small', type: 'button', style: { background: 'var(--gold)' }, title: oth.people.join(' · '), onclick: async () => {
            try { const k = await store.batch(() => bringBackOthers(g)); toast(`Brought back ${k} — steps whose section was gone are in “Brought back from the old plan”`); } catch (e) { toast(e.message, 'error'); }
          } }, `Bring back what others added (${oth.n})`) : null,
          store.me.isAdmin ? h('button', { class: 'btn ghost small', type: 'button', style: { color: 'var(--warn)' }, onclick: async () => {
            if (!(await confirmBox('Delete all of these for good?', `${g.length} things will be gone for everyone and can't be restored.` + (oth.n ? ` ${oth.n} of them were added by other people (${oth.people.join('; ')}).` : ''), 'Delete for good'))) return;
            await store.batch(async () => { for (const it of g) if (store.find(it.t, it.r.id)) await store.purge(it.t, it.r.id).catch(e => toast(e.message, 'error')); });
            toast('Deleted');
          } }, 'Delete all for good') : null)),
      oth.n ? h('p', { class: 'others-note' }, 'Includes things added by other people — ' + oth.people.join(' · ')) : null,
      h('details', {}, h('summary', {}, 'See what’s inside'), h('ul', { class: 'bin-inside' }, g.slice(0, 200).map(it => h('li', {}, label(it))))));
  });
  if (groupsEl.length) list.append(...groupsEl);
  for (const it of rows) {
    if (grouped.has(it)) continue;
    list.append(h('div', { class: 'bin-row' },
      h('div', {}, h('div', { style: { fontWeight: 500 } }, label(it)), h('div', { class: 'muted', style: { fontSize: '14px' } }, context(it))),
      h('div', { class: 'acts' },
        it.t === 'weddings' && !store.me.isAdmin ? h('span', { class: 'muted', style: { fontSize: '13px' } }, 'Only the admin can restore a whole space') :
        h('button', { class: 'btn soft small', type: 'button', onclick: () => restoreWithParents(it.t, it.r).then((ok) => { if (ok !== false) toast('Restored'); }).catch(e => toast(e.message, 'error')) }, 'Restore'),
        store.me.isAdmin ? h('button', {
          class: 'btn ghost small', type: 'button', style: { color: 'var(--warn)' }, onclick: async () => {
            if (!(await confirmBox('Delete for good?', `“${label(it)}” will be gone for everyone and can't be restored.`, 'Delete for good'))) return;
            store.purge(it.t, it.r.id).then(() => toast('Deleted')).catch(e => toast(e.message, 'error'));
          }
        }, 'Delete for good') : null)));
  }
  const emptyAll = store.me.isAdmin && rows.length ? h('button', {
    class: 'btn ghost small', type: 'button', style: { color: 'var(--warn)' }, onclick: async () => {
      if (!(await confirmBox('Empty the Bin?', `All ${rows.length} items will be deleted for everyone and can't be restored.`, 'Delete everything in the Bin'))) return;
      const order = ['budget_items', 'budget_areas', 'files', 'lists', 'board_items', 'todos', 'steps', 'areas', 'stages', 'weddings'];
      await store.batch(async () => { for (const t of order) for (const it of rows.filter(x => x.t === t)) { if (store.find(t, it.r.id)) await store.purge(t, it.r.id).catch(e => toast(e.message, 'error')); } });
      toast('The Bin is empty');
    }
  }, 'Empty the Bin') : null;
  return h('main', { class: 'wrap', style: { paddingBottom: '60px' } },
    h('div', { style: { display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px' } }, h('div', {}, h('div', { class: 'eyebrow' }, 'Anyone can restore'), h('h1', { class: 'page-title' }, 'Bin')), emptyAll),
    h('p', { class: 'muted', style: { marginTop: 0 } }, store.me.isAdmin ? 'Anyone can restore things from here. Only you, as admin, can delete them for good.' : 'Anything removed waits here. Anyone can restore it; only the admin can delete it for good.'),
    list);
}

// Restoring something inside a removed area or stage brings the parents back too.
async function restoreWithParents(t, r) {
  if (t === 'budget_areas' && !(await confirmAreaRestore(r))) return false;
  const chain = [];
  if (t === 'steps') { const a = store.find('areas', r.area_id); if (a) { chain.push(['areas', a]); const s = store.find('stages', a.stage_id); if (s) chain.push(['stages', s]); } }
  if (t === 'areas') { const s = store.find('stages', r.stage_id); if (s) chain.push(['stages', s]); }
  const w = store.find('weddings', r.wedding_id);
  if (w && w.deleted_at && store.me.isAdmin) chain.push(['weddings', w]);
  for (const [pt, pr] of chain.reverse()) if (pr.deleted_at) await store.restore(pt, pr.id);
  await store.restore(t, r.id);
}

/* ---------- Settings (admin) ---------- */
async function moveWedding(w, dir) {
  const list = weddings();
  const i = list.findIndex(x => x.id === w.id), j = i + dir;
  if (j < 0 || j >= list.length) return;
  const other = list[j];
  const a = w.position || i + 1, b = other.position || j + 1;
  try { await store.update('weddings', w.id, { position: b === a ? a + dir : b }); await store.update('weddings', other.id, { position: a }); }
  catch (e) { toast(e.message, 'error'); }
}

export function renderSettings() {
  if (!store.me.isAdmin) return h('main', { class: 'wrap' }, h('p', {}, 'Only the admin can open settings.'));
  const cards = weddings().map(w => {
    const couple = h('input', { value: w.couple, maxlength: 80 });
    const mono = h('input', { value: w.monogram, maxlength: 9, placeholder: 'e.g. C&A' });
    const date = h('input', { type: 'date', value: w.wedding_date || '' });
    const note = h('input', { value: w.date_note || '', placeholder: 'e.g. February – March 2027' });
    const theme = h('select', {}, Object.keys(THEMES).map(k => h('option', { value: k, selected: w.theme === k ? true : null }, k === 'blue' ? 'Navy & gold' : 'Emerald garden')));
    return h('section', { class: 'panel' },
      h('h2', { class: 'serif', style: { margin: '0 0 12px', fontWeight: 500, fontSize: '26px' } }, w.couple),
      h('div', { class: 'form-grid' },
        h('div', { class: 'full' }, field('Couple names', couple)),
        field('Monogram', mono), field('Wedding date', date, w.wedding_date ? longDate(w.wedding_date) : 'Leave empty until it’s fixed'),
        h('div', { class: 'full' }, field('When it’s roughly happening (shown until the date is set)', note)),
        h('div', { class: 'full' }, field('Look', theme, 'Navy & gold: blue medallion monogram. Emerald garden: wax-seal monogram on deep green.'))),
      h('div', { style: { display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' } },
        h('button', {
          class: 'btn', type: 'button', onclick: async () => {
            try {
              await store.update('weddings', w.id, { couple: couple.value.trim() || w.couple, monogram: mono.value.trim(), wedding_date: date.value || null, date_note: note.value.trim(), theme: theme.value, theme_custom: {} });
              toast('Saved');
            } catch (e) { toast(e.message, 'error'); }
          }
        }, 'Save')),
      h('div', { style: { display: 'flex', gap: '8px', marginTop: '18px', paddingTop: '14px', borderTop: '1px solid var(--line-soft)', flexWrap: 'wrap', alignItems: 'center' } },
        h('span', { class: 'muted', style: { fontSize: '14px', marginRight: 'auto' } }, 'Order on the home page'),
        h('button', { class: 'btn ghost small', type: 'button', 'aria-label': 'Move earlier', onclick: () => moveWedding(w, -1) }, '← Earlier'),
        h('button', { class: 'btn ghost small', type: 'button', 'aria-label': 'Move later', onclick: () => moveWedding(w, 1) }, 'Later →'),
        h('button', {
          class: 'btn ghost small', type: 'button', style: { color: 'var(--warn)' }, onclick: async () => {
            if (!(await confirmBox(`Remove ${w.couple}?`, 'The whole space (plan, to-dos and mood board) moves to the Bin. You can restore it from there.', 'Move to Bin'))) return;
            store.remove('weddings', w.id).then(() => toast('Moved to the Bin')).catch(e => toast(e.message, 'error'));
          }
        }, 'Remove this space')),
      h('div', { style: { display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap', alignItems: 'center' } },
        h('span', { class: 'muted', style: { fontSize: '14px', marginRight: 'auto' } }, 'Sample options (placeholders to try the swipe)'),
        sampleButton(w)));
  });

  // Add a new wedding or event space
  const nCouple = h('input', { maxlength: 80, placeholder: 'e.g. Engagement of …  or  Name & Name' });
  const nMono = h('input', { maxlength: 9, placeholder: 'e.g. A&B' });
  const nDate = h('input', { type: 'date' });
  const nTheme = h('select', {}, h('option', { value: 'blue' }, 'Navy & gold'), h('option', { value: 'rose' }, 'Emerald garden'));
  const nTpl = h('select', { id: 'new-tpl' },
    h('option', { value: 'template', selected: true }, 'The Before / During / After plan'),
    weddings().filter(x => planSize(x.id).steps).map(x => h('option', { value: 'copy:' + x.id }, `A copy of ${x.couple}’s plan (${planSize(x.id).steps} steps, nothing ticked)`)),
    h('option', { value: 'empty' }, 'An empty plan'));
  const addSpace = h('section', { class: 'panel' },
    h('h2', { class: 'serif', style: { margin: '0 0 6px', fontWeight: 500, fontSize: '26px' } }, 'Add a wedding or event'),
    h('p', { class: 'muted', style: { marginTop: 0 } }, 'Gives it its own arch on the home page, with a pipeline, to-do list and mood board.'),
    h('div', { class: 'form-grid' }, h('div', { class: 'full' }, field('Names or title', nCouple)), field('Monogram', nMono), field('Date (if fixed)', nDate), h('div', { class: 'full' }, field('Theme', nTheme))),
    h('div', { style: { margin: '12px 0' } }, field('Start with', nTpl, 'A copy keeps the stages, sections, steps, big decisions, list columns and budget lines — no names, dates, ticks, options or payments.')),
    h('button', {
      class: 'btn', type: 'button', style: { background: '#2F2B2C' }, onclick: async () => {
        const name = nCouple.value.trim(); if (!name) return toast('Add the names or a title first', 'error');
        const slug = (name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'space') + '-' + Math.random().toString(36).slice(2, 6);
        const pos = Math.max(0, ...store.rows('weddings').map(x => x.position || 0)) + 1;
        try {
          await store.insert('weddings', { id: slug, couple: name, monogram: nMono.value.trim(), wedding_date: nDate.value || null, date_note: nDate.value ? '' : 'Date to be fixed', theme: nTheme.value, theme_custom: {}, position: pos });
          if (nTpl.value === 'template') await store.addTemplate(slug);
          else if (nTpl.value.startsWith('copy:')) { const n = await copyPlanFrom(nTpl.value.slice(5), slug); toast(`Copied ${n.steps} steps in ${n.sections} sections`); }
          toast('Added'); location.hash = '#/w/' + slug;
        } catch (e) { toast(e.message.includes('policy') || e.message.includes('row-level') ? 'Run database update 2 in Supabase first.' : e.message, 'error'); }
      }
    }, 'Add this space'));
  cards.push(addSpace);

  const p1 = h('input', { type: 'password', autocomplete: 'new-password' });
  const p2 = h('input', { type: 'password', autocomplete: 'new-password' });
  const pass = h('section', { class: 'panel' },
    h('h2', { class: 'serif', style: { margin: '0 0 6px', fontWeight: 500, fontSize: '26px' } }, 'Family passcode'),
    h('p', { class: 'muted', style: { marginTop: 0 } }, 'Changing it does not sign out people who are already in. New devices will need the new passcode.'),
    h('div', { class: 'form-grid' }, field('New passcode', p1), field('Type it again', p2)),
    h('button', {
      class: 'btn', type: 'button', style: { marginTop: '14px', background: '#2F2B2C' }, onclick: async () => {
        if (p1.value.length < 4) return toast('Use at least 4 characters', 'error');
        if (p1.value !== p2.value) return toast('The two passcodes don’t match', 'error');
        try { await store.setPasscode(p1.value); p1.value = p2.value = ''; toast('Passcode changed'); } catch (e) { toast(e.message, 'error'); }
      }
    }, 'Change passcode'));

  const people = h('section', { class: 'panel' },
    h('h2', { class: 'serif', style: { margin: '0 0 6px', fontWeight: 500, fontSize: '26px' } }, 'Who has joined'),
    h('p', { class: 'muted', style: { marginTop: 0, fontSize: '14px' } }, 'Removing someone signs them out of the plans. They can come back only with the passcode — change it too if they shouldn’t.'),
    h('p', { class: 'muted', style: { marginTop: 0, fontSize: '14px' } }, 'Deciders change money, make decisions final and choose between options — for the weddings you tick. Everyone else can add, suggest, vote and tick off their jobs.'),
    h('p', { class: 'muted', style: { marginTop: 0, fontSize: '14px' } }, 'Role: Full can change everything they’re allowed to. Lists only can work on Lists & files. View only can look, comment and vote. The database enforces it (update 14).'),
    h('div', {}, store.rows('members').map(m => h('div', { class: 'bin-row mem-row' },
      h('span', { class: 'mem-who' }, h('b', {}, m.name), m.is_admin ? h('span', { class: 'muted' }, ' · admin · decides for every wedding') : null, memberStats(m)),
      m.is_admin ? h('span') : h('span', { class: 'acts' },
        h('select', { class: 'mem-role', 'aria-label': `Role for ${m.name}`, onchange: (e) => store.setRole(m.user_id, e.target.value).then(() => toast(`${m.name}: ${ROLE[e.target.value]}`)).catch(err => { toast(err.message, 'error'); render(); }) },
          Object.entries(ROLE).map(([k, l]) => h('option', { value: k, selected: (m.role || 'full') === k ? true : null }, l))),
        weddings().map(w => { const on = decidesFor(m, w.id) && !m.is_admin; const first = (w.couple || '').split('&')[0].trim();
          return h('button', { class: 'btn small ' + (on ? 'soft' : 'ghost'), type: 'button', 'aria-pressed': on ? 'true' : 'false', title: on ? `${m.name} decides for ${w.couple}` : `Make ${m.name} a Decider for ${w.couple}`, onclick: () => {
            const cur = weddings().filter(x => decidesFor(m, x.id)).map(x => x.id);
            const next = on ? cur.filter(x => x !== w.id) : [...new Set([...cur, w.id])];
            store.setDeciderFor(m.user_id, next).then(() => toast(on ? `${m.name} no longer decides for ${w.couple}` : `${m.name} now decides for ${w.couple}`)).catch(e => toast(e.message, 'error'));
          } }, (on ? '✓ ' : '') + 'Decider · ' + first); }),
        h('button', {
        class: 'btn ghost small', type: 'button', style: { color: 'var(--warn)' }, onclick: async () => {
          if (!(await confirmBox(`Remove ${m.name}?`, 'They will no longer see or change the plans on their devices.', 'Remove'))) return;
          store.removeMember(m.user_id).then(() => toast('Removed')).catch(e => toast(e.message, 'error'));
        }
      }, 'Remove'))))));

  const q = new URLSearchParams((location.hash.split('?')[1] || ''));
  const tab = ['weddings', 'family', 'data'].includes(q.get('tab')) ? q.get('tab') : settingsTab;
  const TABS = [['weddings', 'Weddings'], ['family', 'Family'], ['data', 'Backups & space']];
  const pick = (k) => { settingsTab = k; if (q.get('tab')) location.hash = '#/settings'; else render(); };
  return h('main', { class: 'wrap', style: { paddingBottom: '60px' } },
    h('div', { class: 'eyebrow' }, 'Admin only · only you can see this page'), h('h1', { class: 'page-title' }, 'Settings'),
    h('div', { class: 'viewtoggle set-tabs', role: 'group', 'aria-label': 'Settings' }, TABS.map(([k, l]) => h('button', { type: 'button', 'aria-pressed': String(tab === k), onclick: () => pick(k) }, l))),
    tab === 'weddings' ? h('div', { class: 'settings-grid' }, cards) : null,
    tab === 'family' ? h('div', { class: 'settings-grid' }, pass, people) : null,
    tab === 'data' ? [
      h('div', { style: { margin: '6px 0 14px', display: 'flex', gap: '8px', flexWrap: 'wrap' } },
        h('button', { class: 'btn ghost small', type: 'button', onclick: downloadBackup }, 'Download a backup'),
        h('button', { class: 'btn ghost small', type: 'button', style: { color: 'var(--warn)' }, onclick: () => clearAll() }, 'Clear all and start over…')),
      backupsPanel(),
      storagePanel()] : null);
}
let settingsTab = 'weddings';
const ROLE = { full: 'Full', lists: 'Lists only', view: 'View only' };
// Joined, last opened, last change, votes — so the admin can see who is keeping up.
function memberStats(m) {
  const votes = (store.rows('reactions') || []).filter(r => r.created_by === m.user_id && ['love', 'no', 'maybe'].includes(r.value)).length;
  const said = (store.rows('comments') || []).filter(c => c.created_by === m.user_id).length;
  const last = (store.rows('activity') || []).find(a => a.actor === m.user_id);
  const bits = [
    m.joined_at ? 'joined ' + new Date(m.joined_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : null,
    m.last_opened ? 'opened ' + ago(m.last_opened) : 'not opened since update 14',
    last ? 'last change ' + ago(last.created_at) : 'no changes yet',
    said ? `${said} ${said === 1 ? 'comment' : 'comments'}` : null];
  return h('span', { class: 'mem-stats' }, bits.filter(Boolean).join(' · '), ' · ', votes ? h('span', {}, `${votes} ${votes === 1 ? 'vote' : 'votes'}`) : h('span', { class: 'mem-never' }, 'never voted'));
}
