// The side panel that opens when you tap a step: details, lock, files and lists.
import { store } from './store.js?v=8';
import { h, toast, modal, field, confirmBox, ICONS, shortDate, longDate, ago, prettySize, fileExt } from './ui.js?v=8';
import { uploadFile, pickFiles } from './board.js?v=8';

const STATUS = { todo: 'To do', doing: 'In progress', done: 'Done' };
export const LIST_TEMPLATES = {
  guest: { title: 'Guest list', columns: ['Name', 'Side', 'Phone', 'Count', 'Notes'] },
  invite: { title: 'Invitation list', columns: ['Name', 'Address', 'Phone', 'Card sent', 'Notes'] },
  shopping: { title: 'Shopping list', columns: ['Item', 'Qty', 'Price (₹)', 'Bought', 'Notes'] },
  blank: { title: 'New list', columns: ['Name', 'Notes'] }
};
const live = (rows) => rows.filter(r => !r.deleted_at);
function fail(e) { console.error(e); toast(e.message || 'That did not save. Check your connection.', 'error'); }

/* ---------- Downloads ---------- */
export async function downloadFile(f) {
  try {
    const url = await store.downloadUrl(f.path, f.title);
    const a = h('a', { href: url, download: f.title || 'file', rel: 'noopener' });
    document.body.append(a); a.click(); a.remove();
  } catch (e) { fail(e); }
}
export async function openFile(f) { const u = await store.url(f.path); if (u) window.open(u, '_blank', 'noopener'); }

export function listToCsv(list) {
  const rows = live(store.rows('list_rows')).filter(r => r.list_id === list.id).sort((a, b) => a.position - b.position);
  const esc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const lines = [list.columns.map(esc).join(',')].concat(rows.map(r => list.columns.map((_, i) => esc((r.cells || [])[i])).join(',')));
  return '﻿' + lines.join('\r\n');
}
export function downloadList(list) {
  const blob = new Blob([listToCsv(list)], { type: 'text/csv;charset=utf-8' });
  const a = h('a', { href: URL.createObjectURL(blob), download: (list.title || 'list').replace(/[^\w\- ]+/g, '') + '.csv' });
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/* ---------- Files ---------- */
export async function uploadTo(weddingId, stepId, files) {
  for (const f of files) {
    toast(`Uploading ${f.name}…`);
    try {
      const r = await uploadFile(f);
      const d = r.data;
      await store.insert('files', { wedding_id: weddingId, step_id: stepId || null, title: f.name, path: d.path, thumb: r.kind === 'image' ? d.path : (d.thumb || null), mime: f.type || '', size: f.size, pages: d.pages || null });
    } catch (e) { fail(e); }
  }
}

export function fileTile(f, { showStep = false } = {}) {
  const isImg = /^image\//.test(f.mime);
  const ext = fileExt(f.title).toUpperCase();
  let pic;
  if (f.thumb) { pic = h('img', { alt: '', loading: 'lazy' }); store.url(f.thumb).then(u => { if (u) pic.src = u; }); }
  else pic = h('div', { class: 'ft-doc' }, ext);
  const step = showStep && f.step_id ? store.find('steps', f.step_id) : null;
  return h('div', { class: 'ftile' },
    h('button', { type: 'button', class: 'ft-pic', onclick: () => openFile(f), 'aria-label': 'Open ' + f.title }, pic, /^video\//.test(f.mime) ? h('span', { class: 'ft-badge' }, 'Video') : null),
    h('div', { class: 'ft-meta' },
      h('div', { class: 'ft-name', title: f.title }, f.title),
      h('div', { class: 'ft-sub' }, [isImg ? 'Photo' : ext, f.pages ? f.pages + ' pages' : null, prettySize(f.size)].filter(Boolean).join(' · ')),
      step ? h('div', { class: 'ft-sub' }, 'Step: ' + step.title) : null,
      h('div', { class: 'ft-sub' }, (store.memberName(f.created_by) || 'Someone') + ' · ' + ago(f.created_at))),
    h('div', { class: 'ft-acts' },
      h('button', { type: 'button', class: 'pill', onclick: () => downloadFile(f) }, 'Download'),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Move ' + f.title + ' to the Bin', html: ICONS.trash, onclick: () => store.remove('files', f.id).then(() => toast('Moved to the Bin')).catch(fail) })));
}

/* ---------- Lists ---------- */
export function newList(weddingId, stepId) {
  return new Promise((resolve) => {
    const m = modal({
      title: 'New list',
      body: h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
        Object.entries(LIST_TEMPLATES).map(([k, t]) => h('button', {
          class: 'btn ghost', type: 'button', style: { justifyContent: 'space-between' }, onclick: async () => {
            m.close();
            try {
              const list = await store.insert('lists', { wedding_id: weddingId, step_id: stepId || null, title: t.title, columns: t.columns });
              openList(list.id); resolve(list);
            } catch (e) { fail(e); resolve(null); }
          }
        }, h('span', {}, t.title), h('span', { class: 'muted', style: { fontSize: '13px' } }, t.columns.join(' · ')))))
    });
  });
}

export function listRow(l, { showStep = false } = {}) {
  const n = live(store.rows('list_rows')).filter(r => r.list_id === l.id).length;
  const step = showStep && l.step_id ? store.find('steps', l.step_id) : null;
  return h('div', { class: 'lrow' },
    h('span', { class: 'lrow-ic', html: ICONS.label }),
    h('button', { type: 'button', class: 'lrow-t', onclick: () => openList(l.id) },
      h('b', {}, l.title), h('span', { class: 'ft-sub' }, `${n} ${n === 1 ? 'entry' : 'entries'}` + (step ? ' · Step: ' + step.title : ''))),
    h('button', { type: 'button', class: 'pill', onclick: () => downloadList(l) }, 'Download'),
    h('button', { type: 'button', class: 'pill', onclick: () => openList(l.id) }, 'Open'));
}

export function openList(listId) {
  let wrap = null;
  const draw = () => {
    const l = store.find('lists', listId);
    if (!l || l.deleted_at) { close(); return; }
    const rows = live(store.rows('list_rows')).filter(r => r.list_id === l.id).sort((a, b) => a.position - b.position);
    const cols = l.columns || [];
    const countIdx = cols.findIndex(c => /^(count|qty|people|guests|no\.?)$/i.test(c.trim()));
    const total = countIdx >= 0 ? rows.reduce((s, r) => s + (parseFloat((r.cells || [])[countIdx]) || 0), 0) : null;
    const saveCell = (r, i, v) => {
      const cells = cols.map((_, j) => (r.cells || [])[j] ?? '');
      if ((cells[i] || '') === v) return;
      cells[i] = v;
      store.update('list_rows', r.id, { cells }).catch(fail);
    };
    const table = h('table', { class: 'ltable' },
      h('thead', {}, h('tr', {}, h('th', { class: 'num' }, '#'), cols.map((c, i) => h('th', {},
        h('button', {
          type: 'button', class: 'colbtn', onclick: () => {
            const inp = h('input', { value: c, maxlength: 40 });
            modal({
              title: 'Column', body: field('Column name', inp), actions: [
                { label: 'Remove column', kind: 'ghost', onClick: async () => { if (cols.length < 2) return false; const nc = cols.filter((_, j) => j !== i); await store.update('lists', l.id, { columns: nc }).catch(fail); for (const r of rows) await store.update('list_rows', r.id, { cells: (r.cells || []).filter((_, j) => j !== i) }).catch(fail); } },
                { label: 'Save', onClick: async () => { const v = inp.value.trim(); if (!v) return false; const nc = cols.slice(); nc[i] = v; await store.update('lists', l.id, { columns: nc }).catch(fail); } }
              ]
            });
          }
        }, c))), h('th', {}, h('button', { type: 'button', class: 'colbtn add', 'aria-label': 'Add a column', onclick: () => store.update('lists', l.id, { columns: cols.concat(['New column']) }).catch(fail) }, '+')))),
      h('tbody', {}, rows.map((r, ri) => h('tr', {},
        h('td', { class: 'num' }, String(ri + 1)),
        cols.map((c, i) => h('td', {}, h('input', { value: (r.cells || [])[i] ?? '', 'aria-label': `${c}, row ${ri + 1}`, onchange: (e) => saveCell(r, i, e.target.value), onkeydown: (e) => { if (e.key === 'Enter') e.target.blur(); } }))),
        h('td', {}, h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Delete row ${ri + 1}`, html: ICONS.trash, onclick: () => store.del('list_rows', r.id).catch(fail) }))))));
    const addRow = async () => {
      const last = rows.length ? rows[rows.length - 1].position : 0;
      await store.insert('list_rows', { list_id: l.id, wedding_id: l.wedding_id, cells: cols.map(() => ''), position: last + 1000 }).catch(fail);
      setTimeout(() => { const ins = wrap && wrap.querySelectorAll('tbody tr:last-child input'); if (ins && ins[0]) ins[0].focus(); }, 80);
    };
    const titleIn = h('input', { value: l.title, class: 'ltitle', maxlength: 80, 'aria-label': 'List name', onchange: (e) => { const v = e.target.value.trim(); if (v && v !== l.title) store.update('lists', l.id, { title: v }).catch(fail); } });
    const step = l.step_id ? store.find('steps', l.step_id) : null;
    const body = h('div', { class: 'lpanel' },
      h('div', { class: 'lhead' },
        titleIn,
        h('div', { class: 'lacts' },
          h('button', { type: 'button', class: 'btn small', onclick: () => downloadList(l) }, 'Download (Excel / CSV)'),
          h('button', { type: 'button', class: 'btn ghost small', onclick: async () => { if (await confirmBox('Move this list to the Bin?', 'Anyone can restore it from the Bin.', 'Move to Bin')) { store.remove('lists', l.id).then(() => toast('Moved to the Bin')).catch(fail); } } }, 'Move to Bin'),
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close', html: ICONS.close, onclick: () => close() }))),
      h('div', { class: 'muted', style: { fontSize: '13px' } }, `${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}`, total !== null ? ` · ${cols[countIdx]} total: ${total}` : '', step ? ` · attached to “${step.title}”` : '', ' · tap a column name to rename or remove it'),
      h('div', { class: 'ltable-wrap' }, table),
      h('button', { type: 'button', class: 'dashed', onclick: addRow }, '+ Add a row'));
    if (!wrap) {
      wrap = h('div', { class: 'modal-wrap list-wrap', onmousedown: (e) => { if (e.target === wrap) close(); } });
      document.body.append(wrap);
    }
    const keep = document.activeElement && wrap.contains(document.activeElement) ? document.activeElement.getAttribute('aria-label') : null;
    wrap.replaceChildren(h('div', { class: 'modal wide list-modal', role: 'dialog', 'aria-label': l.title }, body));
    if (keep) { const el = wrap.querySelector(`[aria-label="${CSS.escape(keep)}"]`); if (el) el.focus(); }
  };
  let pending = false;
  const off = store.onChange(({ table }) => {
    if (!['lists', 'list_rows'].includes(table)) return;
    const a = document.activeElement;
    if (a && wrap && wrap.contains(a) && a.tagName === 'INPUT') { if (!pending) { pending = true; a.addEventListener('blur', () => { pending = false; setTimeout(draw, 50); }, { once: true }); } return; }
    draw();
  });
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  function close() { off(); document.removeEventListener('keydown', onKey); if (wrap) wrap.remove(); wrap = null; }
  document.addEventListener('keydown', onKey);
  draw();
}

/* ---------- The step panel ---------- */
let current = null;
export function openStep(stepId) {
  if (current) current.close();
  const root = h('aside', { class: 'drawer', role: 'dialog', 'aria-label': 'Step details' });
  const shade = h('div', { class: 'drawer-shade', onclick: () => close() });
  document.body.append(shade, root);
  requestAnimationFrame(() => { root.classList.add('open'); shade.classList.add('open'); });
  let lockForm = false;

  const draw = () => {
    const s = store.find('steps', stepId);
    if (!s || s.deleted_at) { close(); return; }
    const area = store.find('areas', s.area_id), stage = area && store.find('stages', area.stage_id);
    const locked = !!s.locked_at;
    const canEdit = !locked || store.me.isAdmin;
    const set = (patch) => store.update('steps', s.id, patch).catch(fail);
    const files = live(store.rows('files')).filter(f => f.step_id === s.id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const lists = live(store.rows('lists')).filter(l => l.step_id === s.id);
    const note = s.lock_note || {};
    const missing = store.missing || {};

    const title = h('textarea', { class: 'd-title', rows: 2, disabled: !canEdit ? true : null, 'aria-label': 'Step name', onchange: (e) => { const v = e.target.value.trim(); if (v && v !== s.title) set({ title: v }); } });
    title.value = s.title;

    // Lock block
    let lockBlock;
    if (missing.files && s.locked_at === undefined) {
      lockBlock = h('div', { class: 'd-card muted' }, 'Locking needs database update 4. Ask the admin to run it in Supabase.');
    } else if (locked) {
      lockBlock = h('div', { class: 'd-lock on' },
        h('div', { class: 'd-lock-h' }, h('span', { html: lockIcon(22) }), h('b', {}, 'Locked'), h('span', { class: 'ft-sub' }, `by ${store.memberName(s.locked_by) || 'someone'} · ${longDate(String(s.locked_at).slice(0, 10))}`)),
        h('dl', { class: 'd-dl' },
          note.with ? [h('dt', {}, 'With'), h('dd', {}, note.with)] : null,
          note.amount ? [h('dt', {}, 'Amount'), h('dd', {}, '₹ ' + note.amount)] : null,
          note.advance ? [h('dt', {}, 'Advance paid'), h('dd', {}, '₹ ' + note.advance)] : null,
          note.notes ? [h('dt', {}, 'Notes'), h('dd', {}, note.notes)] : null),
        store.me.isAdmin
          ? h('button', { type: 'button', class: 'btn ghost small', onclick: async () => { if (await confirmBox('Unlock this?', 'It can be edited and changed again. The unlock is recorded in the edit history.', 'Unlock', '')) set({ locked_at: null, lock_note: note }); } }, 'Unlock')
          : h('div', { class: 'ft-sub' }, 'Only the admin can unlock this.'));
    } else if (lockForm) {
      const wWith = h('input', { placeholder: 'Vendor, venue or person', value: note.with || '' });
      const wAmt = h('input', { placeholder: 'e.g. 85000', inputmode: 'decimal', value: note.amount || '' });
      const wAdv = h('input', { placeholder: 'e.g. 20000', inputmode: 'decimal', value: note.advance || '' });
      const wNotes = h('textarea', { rows: 2, placeholder: 'Anything to remember about this deal' }); wNotes.value = note.notes || '';
      lockBlock = h('div', { class: 'd-lock' },
        h('div', { class: 'd-lock-h' }, h('span', { html: lockIcon(20) }), h('b', {}, 'Lock this decision')),
        h('div', { class: 'form-grid' }, h('div', { class: 'full' }, field('Who or what it’s with', wWith)), field('Amount (₹)', wAmt), field('Advance paid (₹)', wAdv), h('div', { class: 'full' }, field('Notes', wNotes))),
        h('div', { style: { display: 'flex', gap: '8px', marginTop: '10px' } },
          h('button', { type: 'button', class: 'btn', style: { background: 'var(--gold)' }, onclick: () => { lockForm = false; set({ locked_at: new Date().toISOString(), status: 'done', lock_note: { with: wWith.value.trim(), amount: wAmt.value.trim(), advance: wAdv.value.trim(), notes: wNotes.value } }); toast('Locked'); } }, 'Lock it'),
          h('button', { type: 'button', class: 'btn ghost', onclick: () => { lockForm = false; draw(); } }, 'Cancel')));
    } else {
      lockBlock = h('div', { class: 'd-lock' },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' } },
          h('button', { type: 'button', class: 'btn', style: { background: 'var(--gold)' }, onclick: () => { lockForm = true; draw(); } }, h('span', { html: lockIcon(18) }), 'Lock this decision'),
          h('label', { class: 'd-check' }, h('input', { type: 'checkbox', checked: s.gate ? true : null, onchange: (e) => set({ gate: e.target.checked }) }), 'Lock point')),
        h('div', { class: 'ft-sub', style: { marginTop: '6px' } }, 'Lock it once it’s confirmed, like a vendor booked or a menu agreed. A lock point is a key decision, shown as a gold gate on the map.'));
    }

    const owner = h('input', { value: s.owner || '', maxlength: 60, disabled: !canEdit ? true : null, placeholder: 'Who is handling it', onchange: (e) => set({ owner: e.target.value.trim() }) });
    const due = h('input', { type: 'date', value: s.due || '', disabled: !canEdit ? true : null, onchange: (e) => set({ due: e.target.value || null }) });
    const notes = h('textarea', { rows: 3, placeholder: 'Details, decisions, phone numbers…', onchange: (e) => set({ notes: e.target.value }) }); notes.value = s.notes || '';

    const dropZone = h('div', { class: 'd-files' }, files.length ? files.map(f => fileTile(f)) : h('div', { class: 'ft-sub' }, 'No files yet. Add photos, PDFs, quotes, receipts or spreadsheets.'));
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('over'));
    dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.classList.remove('over'); if (e.dataTransfer.files.length) uploadTo(s.wedding_id, s.id, [...e.dataTransfer.files]); });

    root.replaceChildren(
      h('div', { class: 'd-top' },
        h('div', { class: 'ft-sub' }, [stage && stage.title, area && area.title].filter(Boolean).join(' › ')),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close', html: ICONS.close, onclick: () => close() })),
      h('div', { class: 'd-body' },
        title,
        h('div', { class: 'd-seg', role: 'group', 'aria-label': 'Status' }, Object.entries(STATUS).map(([k, v]) => h('button', { type: 'button', disabled: !canEdit ? true : null, 'aria-pressed': String(s.status === k), class: s.status === k ? 'on' : '', onclick: () => set({ status: k }) }, v))),
        lockBlock,
        h('div', { class: 'form-grid' }, field('Person in charge', owner), field('Due by', due)),
        field('Notes', notes),
        h('section', { class: 'd-sec' },
          h('div', { class: 'd-sec-h' }, h('h3', {}, 'Files'), missing.files ? null : h('button', { type: 'button', class: 'btn small soft', onclick: async () => { const fs = await pickFiles('*/*'); if (fs.length) uploadTo(s.wedding_id, s.id, fs); } }, '+ Upload')),
          missing.files ? h('div', { class: 'ft-sub' }, 'Files need database update 4.') : dropZone),
        h('section', { class: 'd-sec' },
          h('div', { class: 'd-sec-h' }, h('h3', {}, 'Lists'), missing.lists ? null : h('button', { type: 'button', class: 'btn small soft', onclick: () => newList(s.wedding_id, s.id) }, '+ New list')),
          missing.lists ? h('div', { class: 'ft-sub' }, 'Lists need database update 4.') : lists.length ? h('div', {}, lists.map(l => listRow(l))) : h('div', { class: 'ft-sub' }, 'No lists yet. Start a guest list, invitation list or shopping list.')),
        h('div', { class: 'd-foot' },
          h('span', { class: 'ft-sub' }, s.created_by ? 'Added by ' + (store.memberName(s.created_by) || 'someone') : 'From the starting plan'),
          canEdit ? h('button', { type: 'button', class: 'link-btn', style: { color: 'var(--warn)' }, onclick: () => store.remove('steps', s.id).then(() => { toast('Moved to the Bin'); close(); }).catch(fail) }, 'Move step to Bin') : null)));
  };

  let pending = false;
  const off = store.onChange(() => {
    const a = document.activeElement;
    if (a && root.contains(a) && /^(INPUT|TEXTAREA)$/.test(a.tagName)) { if (!pending) { pending = true; a.addEventListener('blur', () => { pending = false; setTimeout(draw, 60); }, { once: true }); } return; }
    if (!lockForm) draw();
  });
  const onKey = (e) => { if (e.key === 'Escape' && !document.querySelector('.modal-wrap')) close(); };
  document.addEventListener('keydown', onKey);
  function close() {
    off(); document.removeEventListener('keydown', onKey);
    root.classList.remove('open'); shade.classList.remove('open');
    setTimeout(() => { root.remove(); shade.remove(); }, 220);
    if (current && current.root === root) current = null;
  }
  current = { close, root };
  draw();
}

export function lockIcon(size = 16) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`;
}
