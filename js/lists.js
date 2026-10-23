// The Lists tab: guest list, gifts, vehicles, songs … each one a full page you can
// read at a glance, edit in place, tick off and download.
import { store } from './store.js?v=29';
import { h, toast, modal, field, confirmBox, ICONS, secHead } from './ui.js?v=29';
import { live } from './app.js?v=29';
import { LIST_TEMPLATES, downloadList, newList } from './panel.js?v=29';
import { renderFiles } from './files.js?v=29';
import { copyList, otherWeddings } from './planauto.js?v=29';

const fail = (e) => { console.error(e); toast(e.message || 'That did not save. Check your connection.', 'error'); };
const byPos = (a, b) => (a.position || 0) - (b.position || 0);
const rowsOf = (l) => live(store.rows('list_rows') || []).filter(r => r.list_id === l.id).sort(byPos);

// Columns that are yes/no become tick boxes; number columns get totals.
const isTick = (c) => /^(confirmed|bought|packed|sent|card sent|ready|done|paid|given|booked|arranged|rsvp|yes\/no|delivered|collected)$/i.test(c.trim());
const isNum = (c) => /^(count|qty|quantity|seats|people|guests|no\.?|price.*|cost.*|amount.*|₹.*)$/i.test(c.trim());
const ticked = (v) => /^(y|yes|✓|true|1|done|x)$/i.test(String(v || '').trim());
const num = (v) => { const n = parseFloat(String(v || '').replace(/[₹,\s]/g, '')); return isFinite(n) ? n : 0; };

export function listSummary(l) {
  const rows = rowsOf(l), cols = l.columns || [];
  const bits = [`${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}`];
  cols.forEach((c, i) => {
    if (isNum(c)) { const t = rows.reduce((s, r) => s + num((r.cells || [])[i]), 0); if (t) bits.push(/price|cost|amount|₹/i.test(c) ? `₹${Math.round(t).toLocaleString('en-IN')} in total` : /^count$/i.test(c.trim()) ? `${t} people` : `${t} ${c.toLowerCase()}`); }
    if (isTick(c) && rows.length) bits.push(`${rows.filter(r => ticked((r.cells || [])[i])).length} of ${rows.length} ${c.toLowerCase()}`);
  });
  return bits;
}

/* ---------- The tab ---------- */
let q = '';
export function renderLists(root, w, params) {
  if (store.missing && store.missing.lists) { root.append(h('div', { class: 'panel' }, h('p', { style: { margin: 0 } }, 'Lists need database update 4. Ask the admin to run it in Supabase, then reload.'))); return; }
  if (params.list) { const l = store.find('lists', params.list); if (l && !l.deleted_at) { renderListPage(root, w, l); return; } }
  const lists = live(store.rows('lists') || []).filter(l => l.wedding_id === w.id).sort((a, b) => a.title.localeCompare(b.title));
  root.append(secHead('Lists and files', 'Lists & files', h('button', { class: 'btn', type: 'button', onclick: () => newList(w.id, null) }, '+ New list'), h('a', { class: 'btn ghost', href: '#files', onclick: (e) => { e.preventDefault(); const f = document.getElementById('files'); if (f) f.scrollIntoView({ behavior: 'smooth' }); } }, 'Files ↓')));
  if (lists.length) root.append(h('div', { class: 'lgrid' }, lists.map(l => {
    const step = l.step_id ? store.find('steps', l.step_id) : null;
    const s = listSummary(l);
    return h('a', { class: 'lcard', href: `#/w/${w.id}/lists?list=${l.id}` },
      h('span', { class: 'lc-ic', html: ICONS.label }),
      h('span', { class: 'lc-t' }, l.title),
      h('span', { class: 'lc-big' }, s[0]),
      s.length > 1 ? h('span', { class: 'lc-s' }, s.slice(1).join(' · ')) : null,
      step ? h('span', { class: 'lc-step' }, 'For: ' + step.title) : null);
  })));
  // Ready-made lists not started yet
  const have = new Set(lists.map(l => l.title.toLowerCase()));
  const missing = Object.entries(LIST_TEMPLATES).filter(([k, t]) => k !== 'blank' && !have.has(t.title.toLowerCase()));
  if (missing.length) root.append(h('section', { class: 'dsec' },
    h('div', { class: 'dsec-h' }, h('h2', {}, lists.length ? 'Start another list' : 'Start a list')),
    h('div', { class: 'lchips' }, missing.map(([k, t]) => h('button', {
      type: 'button', class: 'lchip', title: t.blurb, onclick: async () => {
        try { const l = await store.insert('lists', { wedding_id: w.id, step_id: null, title: t.title, columns: t.columns }); location.hash = `#/w/${w.id}/lists?list=${l.id}`; } catch (e) { fail(e); }
      }
    }, '+ ' + t.title)))));
  renderFiles(root, w, params, { embedded: true });
}

/* ---------- One list, full page ---------- */
function renderListPage(root, w, l) {
  const cols = l.columns || [];
  const all = rowsOf(l);
  const needle = q.trim().toLowerCase();
  const rows = needle ? all.filter(r => (r.cells || []).join(' ').toLowerCase().includes(needle)) : all;
  const saveCell = (r, i, v) => {
    const cur = store.find('list_rows', r.id) || r;   // always the latest copy, so a quick tick never undoes typing
    const cells = cols.map((_, j) => (cur.cells || [])[j] ?? '');
    if ((cells[i] || '') === v) return;
    cells[i] = v;
    store.update('list_rows', r.id, { cells }).catch(fail);
  };
  const editCol = (c, i) => {
    const inp = h('input', { value: c, maxlength: 40 });
    modal({
      title: 'Column', body: [field('Column name', inp, 'Name a column “Confirmed”, “Bought”, “Packed”, “Sent” or “Ready” to get tick boxes. “Count”, “Qty”, “Seats” or “Price” columns are added up.')],
      actions: [
        { label: 'Remove column', kind: 'ghost', onClick: async () => { if (cols.length < 2) return false; const nc = cols.filter((_, j) => j !== i); await store.update('lists', l.id, { columns: nc }).catch(fail); for (const r of all) await store.update('list_rows', r.id, { cells: (r.cells || []).filter((_, j) => j !== i) }).catch(fail); } },
        { label: 'Save', onClick: async () => { const v = inp.value.trim(); if (!v) return false; const nc = cols.slice(); nc[i] = v; await store.update('lists', l.id, { columns: nc }).catch(fail); } }]
    });
  };
  const addRow = async () => {
    const last = all.length ? all[all.length - 1].position : 0;
    q = '';
    const r = await store.insert('list_rows', { list_id: l.id, wedding_id: l.wedding_id, cells: cols.map(() => ''), position: last + 1000 }).catch(fail);
    if (r) setTimeout(() => { const ins = document.querySelector(`tr[data-id="${r.id}"] input`); if (ins) ins.focus(); }, 120);
  };
  const totals = cols.map((c, i) => isNum(c) ? all.reduce((s, r) => s + num((r.cells || [])[i]), 0) : isTick(c) ? all.filter(r => ticked((r.cells || [])[i])).length : null);

  const table = h('table', { class: 'ltable big' },
    h('thead', {}, h('tr', {}, h('th', { class: 'num' }, '#'),
      cols.map((c, i) => h('th', { class: isTick(c) ? 'tickcol' : '' }, h('button', { type: 'button', class: 'colbtn', title: 'Rename or remove this column', onclick: () => editCol(c, i) }, c))),
      h('th', { class: 'act' }, h('button', { type: 'button', class: 'colbtn add', 'aria-label': 'Add a column', title: 'Add a column', onclick: () => store.update('lists', l.id, { columns: cols.concat(['New column']) }).catch(fail) }, '+')))),
    h('tbody', {}, rows.map((r) => {
      const ri = all.indexOf(r);
      return h('tr', { dataset: { id: r.id }, class: cols.some((c, i) => isTick(c) && ticked((r.cells || [])[i])) && cols.filter(isTick).every(c => ticked((r.cells || [])[cols.indexOf(c)])) ? 'all-ticked' : '' },
        h('td', { class: 'num' }, String(ri + 1)),
        cols.map((c, i) => {
          const v = (r.cells || [])[i] ?? '';
          if (isTick(c)) return h('td', { class: 'tickcol' }, h('button', { type: 'button', class: 'lt-tick' + (ticked(v) ? ' on' : ''), 'aria-label': `${c}: ${ticked(v) ? 'yes' : 'no'}, row ${ri + 1}`, html: ticked(v) ? ICONS.check : '', onclick: () => saveCell(r, i, ticked(v) ? '' : 'Yes') }));
          return h('td', {}, h('input', { value: v, 'aria-label': `${c}, row ${ri + 1}`, inputmode: isNum(c) ? 'decimal' : null, onchange: (e) => saveCell(r, i, e.target.value), onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); const next = e.target.closest('tr').nextElementSibling; if (next) { const ni = next.querySelectorAll('td input')[i] || next.querySelector('input'); if (ni) { e.target.blur(); ni.focus(); return; } } e.target.blur(); } } }));
        }),
        h('td', { class: 'act' }, h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Delete row ${ri + 1}`, html: ICONS.trash, onclick: () => store.del('list_rows', r.id).catch(fail) })));
    })),
    all.length && totals.some(t => t !== null) ? h('tfoot', {}, h('tr', {}, h('td', { class: 'num' }, ''),
      cols.map((c, i) => h('td', { class: isTick(c) ? 'tickcol' : '' }, totals[i] === null ? (i === 0 ? 'Total' : '') : isTick(c) ? `${totals[i]} of ${all.length}` : /price|cost|amount|₹/i.test(c) ? '₹' + Math.round(totals[i]).toLocaleString('en-IN') : String(totals[i]))),
      h('td', {}))) : null);

  const search = h('input', { type: 'search', value: q, placeholder: 'Find in this list…', 'aria-label': 'Find in this list', oninput: (e) => { q = e.target.value; const term = q.trim().toLowerCase(); document.querySelectorAll('.ltable.big tbody tr').forEach(tr => { const t = [...tr.querySelectorAll('input')].map(i => i.value).join(' ').toLowerCase(); tr.hidden = !!term && !t.includes(term); }); } });
  const step = l.step_id ? store.find('steps', l.step_id) : null;
  const title = h('input', { class: 'ltitle lt-page', value: l.title, maxlength: 80, 'aria-label': 'List name', onchange: (e) => { const v = e.target.value.trim(); if (v && v !== l.title) store.update('lists', l.id, { title: v }).catch(fail); } });
  root.append(
    h('a', { class: 'back-link', href: `#/w/${w.id}/lists` }, h('span', { html: ICONS.back }), 'All lists'),
    h('div', { class: 'lpage-head' },
      h('div', { class: 'ph-title' }, h('div', { class: 'eyebrow' }, 'List'), title, h('div', { class: 'lp-sum' }, listSummary(l).join(' · '), step ? ` · for “${step.title}”` : '')),
      h('div', { class: 'ph-right' },
        h('button', { type: 'button', class: 'btn', onclick: addRow }, '+ Add a row'),
        h('button', { type: 'button', class: 'btn ghost', onclick: () => downloadList(l) }, 'Download for Excel'),
        h('button', { type: 'button', class: 'btn ghost', onclick: () => window.print() }, 'Print'),
        ...otherWeddings(w.id).map(o => h('button', { type: 'button', class: 'btn ghost', onclick: () => copyList(l, o.id) }, 'Copy to ' + o.couple.split('&')[0].trim())),
        h('button', { type: 'button', class: 'btn ghost', style: { color: 'var(--warn)' }, onclick: async () => { if (await confirmBox('Move this list to the Bin?', 'Anyone can restore it from the Bin.', 'Move to Bin')) { await store.remove('lists', l.id).then(() => { toast('Moved to the Bin'); location.hash = `#/w/${w.id}/lists`; }).catch(fail); } } }, 'Move to Bin'))),
    h('div', { class: 'lp-tools' }, h('label', { class: 'find-in' }, h('span', { html: ICONS.search }), search), h('span', { class: 'hint', style: { margin: 0 } }, 'Tap a column name to rename it. Press Enter to jump to the next row.')),
    h('div', { class: 'ltable-wrap lt-page' }, all.length ? table : h('div', { class: 'lp-empty' }, h('p', {}, 'Nothing here yet.'), h('button', { type: 'button', class: 'btn', onclick: addRow }, '+ Add the first row'))),
    all.length ? h('button', { type: 'button', class: 'dashed', style: { marginTop: '10px' }, onclick: addRow }, '+ Add a row') : null);
}
