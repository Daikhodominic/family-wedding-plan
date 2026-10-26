// The side panel that opens when you tap a step: details, lock, files and lists.
import { duplicateStep } from './duplicate.js?v=53';
import { store } from './store.js?v=53';
import { h, toast, modal, field, confirmBox, ICONS, shortDate, longDate, ago, prettySize, fileExt, dragToClose, buzz } from './ui.js?v=53';
import { addStepAt } from './addhere.js?v=53';
import { uploadFile, pickFiles } from './board.js?v=53';
import { isDecider, deciderNames, personInput } from './tools.js?v=53';
import { cardsForStep, cardTitle, chooseOption, openIdeas, afterFinal, stepPicture, previewUrl } from './decisions.js?v=53';
import { voteCounts, optionKey } from './feedback.js?v=53';
import { suggestDue } from './planauto.js?v=53';
import { guestCount } from './boardauto.js?v=53';
import { optionsOf, pendingFor, votesOf, editOption, wantsOptions } from './swipe.js?v=53';
import { stepWaButton } from './nudge.js?v=53';

const STATUS = { todo: 'To do', doing: 'In progress', done: 'Done' };
export const LIST_TEMPLATES = {
  guest: { title: 'Guest list', columns: ['Name', 'Side', 'Phone', 'Count', 'Confirmed', 'Notes'], blurb: 'Who is coming, how many, and who has confirmed' },
  gifts: { title: 'Gifts', columns: ['Gift', 'For whom', 'Bought', 'Price (₹)', 'Packed', 'Notes'], blurb: 'Gifts to buy, wrap and hand over' },
  vehicles: { title: 'Vehicles & drivers', columns: ['Vehicle', 'Driver', 'Phone', 'Seats', 'Pick-up / route', 'Time', 'Notes'], blurb: 'Cars, drivers and who goes where, when' },
  songs: { title: 'Songs & performances', columns: ['Song / item', 'By whom', 'When', 'Length', 'Ready', 'Notes'], blurb: 'Hymns, specials, choir items, speeches and dances' },
  vendors: { title: 'Vendors', columns: ['Vendor', 'For', 'Phone', 'Rate', 'Booked', 'Notes'], blurb: 'Caterer, decorator, florist, photographer — fills in as decisions become final' },
  runsheet: { title: 'Day-of run sheet', columns: ['Time', 'What', 'Who', 'Where', 'Done'], blurb: 'The wedding day hour by hour — shows in final-week mode' },
  invite: { title: 'Invitation list', columns: ['Name', 'Address', 'Phone', 'Card sent', 'Notes'], blurb: 'Who gets a card and whether it has gone out' },
  shopping: { title: 'Shopping list', columns: ['Item', 'Qty', 'Price (₹)', 'Bought', 'Notes'], blurb: 'Things to buy, how many and what they cost' },
  blank: { title: 'New list', columns: ['Name', 'Notes'], blurb: 'Start with two columns and make your own' }
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
  if (f.thumb) { pic = h('img', { alt: '', loading: 'lazy', 'data-path': f.thumb }); store.url(f.thumb).then(u => { if (u) pic.src = u; }); }
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
        }, h('span', {}, t.title), h('span', { class: 'muted', style: { fontSize: '13px' } }, t.blurb || t.columns.join(' · ')))))
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

// Lists open as their own page in the wedding's Lists tab.
export function openList(listId) {
  const l = store.find('lists', listId); if (!l) return;
  if (current) current.close();
  location.hash = `#/w/${l.wedding_id}/lists?list=${listId}`;
}

/* ---------- The step panel ---------- */
let current = null;
export function openStep(stepId) {
  if (current) current.close();
  const root = h('aside', { class: 'drawer', role: 'dialog', 'aria-label': 'Step details' });
  const shade = h('div', { class: 'drawer-shade', onclick: () => close() });
  const grab = h('div', { class: 'sheet-grab', 'aria-hidden': 'true' });
  document.body.append(shade, root);
  requestAnimationFrame(() => { root.classList.add('open'); shade.classList.add('open'); });
  dragToClose(root, [grab], () => close());
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
      lockBlock = h('div', { class: 'd-card muted' }, 'Final decisions need database update 4. Ask the admin to run it in Supabase.');
    } else if (locked) {
      const finalPic = stepPictureEl(s);
      lockBlock = h('div', { class: 'd-lock on' },
        finalPic,
        h('div', { class: 'd-lock-h' }, h('span', { html: lockIcon(22) }), h('b', {}, 'Final'), h('span', { class: 'ft-sub' }, `by ${store.memberName(s.locked_by) || 'someone'} · ${longDate(String(s.locked_at).slice(0, 10))}`)),
        h('dl', { class: 'd-dl' },
          note.with ? [h('dt', {}, 'With'), h('dd', {}, note.with)] : null,
          note.phone ? [h('dt', {}, 'Phone'), h('dd', {}, h('a', { href: 'tel:' + note.phone.replace(/[^\d+]/g, '') }, note.phone))] : null,
          note.amount ? [h('dt', {}, 'Amount'), h('dd', {}, '₹ ' + note.amount)] : null,
          note.advance ? [h('dt', {}, 'Advance paid'), h('dd', {}, '₹ ' + note.advance)] : null,
          note.notes ? [h('dt', {}, 'Notes'), h('dd', {}, note.notes)] : null),
        store.me.isAdmin
          ? h('button', { type: 'button', class: 'btn ghost small', onclick: async () => { if (await confirmBox('Reopen this decision?', 'It can be edited and changed again. Reopening is recorded in the edit history.', 'Reopen', '')) set({ locked_at: null, lock_note: note }); } }, 'Reopen')
          : h('div', { class: 'ft-sub' }, 'Only the admin can reopen this.'));
    } else if (lockForm) {
      const wWith = h('input', { placeholder: 'Vendor, venue or person', value: note.with || '' });
      const wAmt = h('input', { placeholder: 'e.g. 85000', inputmode: 'decimal', value: note.amount || '' });
      const wAdv = h('input', { placeholder: 'e.g. 20000', inputmode: 'decimal', value: note.advance || '' });
      const wPhone = h('input', { type: 'tel', placeholder: 'Their phone number', value: note.phone || '' });
      let wImage = note.image || null;
      const wPic = h('button', { type: 'button', class: 'btn ghost small', onclick: async () => { const [f] = await pickFiles('image/*', false); if (!f) return; wPic.textContent = 'Uploading…'; try { const r = await uploadFile(f); wImage = r.data.path; wPic.textContent = 'Photo added ✓'; } catch (e) { fail(e); wPic.textContent = 'Add a photo'; } } }, wImage ? 'Change the photo' : 'Add a photo of the choice');
      const wNotes = h('textarea', { rows: 2, placeholder: 'Anything to remember about this deal' }); wNotes.value = note.notes || '';
      lockBlock = h('div', { class: 'd-lock' },
        h('div', { class: 'd-lock-h' }, h('span', { html: lockIcon(20) }), h('b', {}, 'Make this decision final')),
        h('div', { class: 'form-grid' }, field('Who or what it’s with', wWith), field('Phone', wPhone), field('Amount (₹)', wAmt), field('Advance paid (₹)', wAdv), h('div', { class: 'full' }, field('Notes', wNotes)), h('div', { class: 'full' }, h('span', { class: 'ft-sub', style: { display: 'block', marginBottom: '6px' } }, 'A photo shows on the map and in Glimpse.'), wPic)),
        h('div', { style: { display: 'flex', gap: '8px', marginTop: '10px' } },
          h('button', { type: 'button', class: 'btn', style: { background: 'var(--gold)' }, onclick: async () => { lockForm = false; const ln = { ...note, image: wImage, with: wWith.value.trim(), vendor: wWith.value.trim(), phone: wPhone.value.trim(), amount: wAmt.value.trim(), advance: wAdv.value.trim(), notes: wNotes.value }; await store.update('steps', s.id, { locked_at: new Date().toISOString(), status: 'done', lock_note: ln }).then(() => afterFinal(s, ln)).then(() => toast('Final ✓ — vendor saved, balance reminder added if anything is owed')).catch(fail); } }, 'Make it final'),
          h('button', { type: 'button', class: 'btn ghost', onclick: () => { lockForm = false; draw(); } }, 'Cancel')));
    } else {
      lockBlock = h('div', { class: 'd-lock' },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' } },
          isDecider() ? h('button', { type: 'button', class: 'btn', style: { background: 'var(--gold)' }, onclick: () => { lockForm = true; draw(); } }, h('span', { html: lockIcon(18) }), 'Make it final') : h('span', { class: 'ft-sub' }, `Only the Deciders (${deciderNames()}) can make this final.`),
          h('label', { class: 'd-check' }, h('input', { type: 'checkbox', checked: s.gate ? true : null, onchange: (e) => set({ gate: e.target.checked }) }), 'Big decision'),
          h('label', { class: 'd-check' }, h('input', { type: 'checkbox', checked: wantsOptions(s) ? true : null, onchange: (e) => set({ lock_note: { ...(s.lock_note || {}), choose: e.target.checked } }) }), 'Choose between options')),
        h('div', { class: 'ft-sub', style: { marginTop: '6px' } }, 'Make it final once it’s confirmed — a vendor booked, a menu agreed. “Big decision”: one of the main choices — it waits on Today and shows as a gold ◆ on the map. “Choose between options”: it gets a place in Choose so the family can add options and vote.'));
    }

    const owner = personInput(s.owner || '', { disabled: !canEdit ? true : null, onchange: (e) => set({ owner: e.target.value.trim() }) });
    const due = h('input', { type: 'date', value: s.due || '', disabled: !canEdit ? true : null, onchange: (e) => set({ due: e.target.value || null }) });
    const notes = h('textarea', { rows: 3, placeholder: 'Details, decisions, phone numbers…', onchange: (e) => set({ notes: e.target.value }) }); notes.value = s.notes || '';

    const dropZone = h('div', { class: 'd-files' }, files.length ? files.map(f => fileTile(f)) : h('div', { class: 'ft-sub' }, 'No files yet. Add photos, PDFs, quotes, receipts or spreadsheets.'));
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('over'));
    dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.classList.remove('over'); if (e.dataTransfer.files.length) uploadTo(s.wedding_id, s.id, [...e.dataTransfer.files]); });

    root.replaceChildren(
      grab,
      h('div', { class: 'd-top' },
        h('div', { class: 'ft-sub' }, [stage && stage.title, area && area.title].filter(Boolean).join(' › ')),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close', html: ICONS.close, onclick: () => close() })),
      h('div', { class: 'd-body' },
        title,
        h('div', { class: 'd-seg', role: 'group', 'aria-label': 'Status' }, Object.entries(STATUS).map(([k, v]) => h('button', { type: 'button', disabled: !canEdit ? true : null, 'aria-pressed': String(s.status === k), class: s.status === k ? 'on' : '', onclick: () => set({ status: k }) }, v))),
        lockBlock,
        h('div', { class: 'form-grid' }, field('Person in charge', owner), h('div', { class: 'field' }, h('label', {}, 'Due by'), due,
          (() => { const wd = store.find('weddings', s.wedding_id); const sg = !s.due && !locked && canEdit ? suggestDue(s, wd) : null; return sg ? h('button', { type: 'button', class: 'link-btn sugg', onclick: () => set({ due: sg }) }, `Suggested: ${shortDate(sg)} — use it`) : null; })())),
        (() => { const b = stepWaButton(s); return b ? h('div', { class: 'd-wa' }, b) : null; })(),
        /head ?count|guest/i.test(s.title) && guestCount(s.wedding_id) ? h('div', { class: 'd-card' }, `Guest list so far: ${guestCount(s.wedding_id)} people`, h('a', { href: `#/w/${s.wedding_id}/lists`, style: { marginLeft: '8px' }, onclick: () => close() }, 'Open lists →')) : null,
        field('Notes', notes),
        optionsSection(s),
        boardSection(s, area),
        h('section', { class: 'd-sec' },
          h('div', { class: 'd-sec-h' }, h('h3', {}, 'Files'), missing.files ? null : h('button', { type: 'button', class: 'btn small soft', onclick: async () => { const fs = await pickFiles('*/*'); if (fs.length) uploadTo(s.wedding_id, s.id, fs); } }, '+ Upload')),
          missing.files ? h('div', { class: 'ft-sub' }, 'Files need database update 4.') : dropZone),
        h('section', { class: 'd-sec' },
          h('div', { class: 'd-sec-h' }, h('h3', {}, 'Lists'), missing.lists ? null : h('button', { type: 'button', class: 'btn small soft', onclick: () => newList(s.wedding_id, s.id) }, '+ New list')),
          missing.lists ? h('div', { class: 'ft-sub' }, 'Lists need database update 4.') : lists.length ? h('div', {}, lists.map(l => listRow(l))) : h('div', { class: 'ft-sub' }, 'No lists yet. Start a guest list, invitation list or shopping list.')),
        h('div', { class: 'd-foot' },
          h('span', { class: 'ft-sub' }, s.created_by ? 'Added by ' + (store.memberName(s.created_by) || 'someone') : 'From the starting plan'),
          canEdit ? h('button', { type: 'button', class: 'link-btn', onclick: () => { close(); addStepAt(s.area_id, s); } }, '+ Add a step after this') : null,
          canEdit ? h('button', { type: 'button', class: 'link-btn', onclick: () => duplicateStep(s).then(c => { close(); setTimeout(() => openStep(c.id), 80); }).catch(fail) }, 'Duplicate') : null,
          canEdit ? h('button', { type: 'button', class: 'link-btn', style: { color: 'var(--warn)' }, onclick: () => store.remove('steps', s.id).then(() => { toast('Moved to the Bin'); close(); }).catch(fail) }, 'Move step to Bin') : null)));
    // Changes save as you go; the Save button makes that visible (and closes the drawer).
    if (canEdit) root.append(h('div', { class: 'd-save' }, h('span', { class: 'd-saved' }, '✓ Changes save by themselves'),
      h('button', { type: 'button', class: 'btn', onclick: () => { const a = document.activeElement; if (a && root.contains(a)) a.blur(); setTimeout(() => { toast('Saved'); close(); }, 80); } }, 'Save')));
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

// Ideas pinned from the mood board, and the comparison that decides this step.
function stepPictureEl(s) { const p = stepPicture(s), ext = p ? null : previewUrl(s); if (!p && !ext) return null; const im = h('img', { class: 'd-final-pic', alt: '', referrerpolicy: 'no-referrer' }); if (ext) im.src = ext; else { im.dataset.path = p; store.url(p).then(u => { if (u) im.src = u; }); } return im; }
function thumb(path) { const im = h('img', { alt: '', loading: 'lazy', 'data-path': path || null }); if (path) store.url(path, 'small').then(u => { if (u) im.src = u; }); return im; }
// The step's options (vendors, products) — swiped and compared on the Choose tab.
function optionsSection(s) {
  const w = store.find('weddings', s.wedding_id);
  const opts = optionsOf(s.wedding_id, s.id);
  const fresh = pendingFor(s.wedding_id, s.id).length;
  const chosen = opts.find(o => (o.data || {}).status === 'chosen');
  const lead = opts.filter(o => (o.data || {}).status !== 'not').sort((a, b) => votesOf(b).score - votesOf(a).score)[0];
  return h('section', { class: 'd-sec' },
    h('div', { class: 'd-sec-h' }, h('h3', {}, 'Options'),
      h('button', { type: 'button', class: 'btn small soft', onclick: () => { if (current) current.close(); editOption(w, s.id); } }, '+ Add an option')),
    opts.length ? h('a', { class: 'd-opts', href: `#/w/${s.wedding_id}/options?step=${s.id}`, onclick: () => { if (current) current.close(); } },
      h('b', {}, `${opts.length} ${opts.length === 1 ? 'option' : 'options'}`),
      h('span', {}, chosen ? '✓ Chosen: ' + ((chosen.data || {}).title || '') : lead && votesOf(lead).total ? 'Leading: ' + ((lead.data || {}).title || '') : 'No votes yet'),
      fresh ? h('span', { class: 'd-opts-new' }, `${fresh} new for you`) : null,
      h('span', { class: 'd-opts-go' }, 'See, swipe and compare →'))
      : h('div', { class: 'ft-sub' }, 'Add the vendors or designs you’re considering — photos, Instagram links, price, phone — and the family can swipe and compare them.'));
}
function boardSection(s, area) {
  const cards = cardsForStep(s.id);
  const w = store.find('weddings', s.wedding_id);
  const compare = cards.find(c => c.kind === 'compare');
  const others = cards.filter(c => c !== compare);
  const pic = (c) => { const d = c.data || {}; return c.kind === 'image' ? d.path : c.kind === 'gallery' && d.images && d.images[0] ? d.images[0].path : d.thumb || null; };
  return h('section', { class: 'd-sec' },
    h('div', { class: 'd-sec-h' }, h('h3', {}, 'From the board'),
      area ? h('button', { type: 'button', class: 'btn small soft', onclick: () => { if (current) current.close(); openIdeas(w, area); } }, 'See ideas') : null),
    compare ? h('div', { class: 'd-compare' },
      h('div', { class: 'ft-sub' }, 'Decided by: ' + cardTitle(compare)),
      h('div', { class: 'dc-opts' }, (compare.data.options || []).map((o, i) => {
        const v = voteCounts(compare, optionKey(o, i));
        return h('div', { class: 'dc-opt' + (o.chosen ? ' chosen' : '') },
          o.image ? thumb(o.image) : h('span', { class: 'dc-noimg' }),
          h('b', {}, o.title || 'Option ' + String.fromCharCode(65 + i)),
          h('span', { class: 'ft-sub' }, [o.rate ? '₹ ' + o.rate : null, `▲ ${v.up.length} · ▼ ${v.down.length}`].filter(Boolean).join(' · ')),
          o.chosen ? h('span', { class: 'chip lockchip' }, '✓ Chosen') : isDecider() && !s.locked_at ? h('button', { type: 'button', class: 'pill', onclick: () => chooseOption(compare, i) }, 'Choose this') : null);
      }))) : null,
    others.length ? h('div', { class: 'd-pins' }, others.map(c => h('a', { class: 'd-pin', href: `#/w/${c.wedding_id}/board?focus=${c.id}`, onclick: () => { if (current) current.close(); } },
      pic(c) ? thumb(pic(c)) : h('span', { class: 'd-pin-k' }, c.kind), h('span', {}, cardTitle(c))))) : null,
    !cards.length ? h('div', { class: 'ft-sub' }, 'Nothing pinned yet. On the board, tap ⋯ on a card → “Pin to a step” to show it here. Pin a comparison and choosing an option makes this step final.') : null);
}

export function closeDrawer() { if (current) current.close(); }
export function lockIcon(size = 16) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`;
}
