// Joins the mood board to the plan: pin cards to steps, card status, card → job,
// comparisons that become final decisions, and the follow-ups a decision brings.
import { store } from './store.js?v=29';
import { h, toast, modal, field, confirmBox, shortDate, daysUntil } from './ui.js?v=29';
import { live, stepVisible, wedding, weddings, render } from './app.js?v=29';
import { together } from './history.js?v=29';
import { isDecider, deciderOnly, personInput, share, siteLink } from './tools.js?v=29';

const fail = (e) => { console.error(e); toast(e.message || 'That did not save. Check your connection.', 'error'); };
const byPos = (a, b) => (a.position || 0) - (b.position || 0);
export const STATUS = { idea: 'Idea', shortlisted: 'Shortlisted', chosen: 'Chosen', no: 'Not this' };

// Steps of one wedding, grouped by area, for pickers.
function stepOptions(wid, selected) {
  const stages = live(store.rows('stages')).filter(s => s.wedding_id === wid).sort(byPos);
  const out = [h('option', { value: '' }, '— Not pinned to a step —')];
  for (const st of stages) for (const a of live(store.rows('areas')).filter(x => x.stage_id === st.id).sort(byPos)) {
    const steps = live(store.rows('steps')).filter(s => s.area_id === a.id).sort(byPos);
    if (!steps.length) continue;
    out.push(h('optgroup', { label: `${st.title} › ${a.title}` }, steps.map(s => h('option', { value: s.id, selected: s.id === selected ? true : null }, s.title + (s.locked_at ? ' (final)' : '')))));
  }
  return out;
}
export const cardTitle = (it) => { const d = it.data || {}; return (d.title || d.text || d.caption || d.name || (d.preview && d.preview.title) || d.url || 'Card').toString().slice(0, 80); };
export const cardsForStep = (stepId) => live(store.rows('board_items')).filter(i => i.data && i.data.step_id === stepId && !['shape', 'connector', 'option'].includes(i.kind));
const setData = (it, patch) => store.update('board_items', it.id, { data: { ...(store.find('board_items', it.id) || it).data, ...patch } });

export function pinToStep(it) {
  const sel = h('select', {}, stepOptions(it.wedding_id, it.data && it.data.step_id));
  modal({
    title: 'Pin to a step in the plan',
    body: [h('p', { class: 'muted', style: { margin: 0 } }, 'The card shows on that step’s details, so whoever is doing it sees the ideas. A comparison pinned to a step becomes its decision.'), field('Step', sel)],
    actions: [{ label: 'Save', onClick: () => setData(it, { step_id: sel.value || null }).then(() => toast(sel.value ? 'Pinned to the step' : 'Unpinned')).catch(fail) }]
  });
}

export function setStatus(it, status) {
  if (status === 'chosen' && !deciderOnly('mark something as chosen')) return;
  setData(it, { status: status === 'idea' ? null : status }).catch(fail);
}

// A card becomes a to-do with a person and a date; the card remembers it.
export function makeJob(it) {
  const title = h('input', { value: (it.kind === 'note' ? 'Follow up: ' : '') + cardTitle(it), maxlength: 160 });
  const who = personInput('');
  const due = h('input', { type: 'date' });
  modal({
    title: 'Turn this into a job',
    body: h('div', { class: 'form-grid' }, h('div', { class: 'full' }, field('What needs doing', title)), field('Person in charge', who), field('Due by', due)),
    actions: [{
      label: 'Add to the to-do list', onClick: async () => {
        const t = title.value.trim(); if (!t) return false;
        await together(async () => {
          const todos = live(store.rows('todos') || []).filter(x => x.wedding_id === it.wedding_id);
          const first = todos.length ? Math.min(...todos.map(x => x.position || 0)) : 1000;
          const job = await store.insert('todos', { wedding_id: it.wedding_id, title: t, owner: who.value.trim(), due: due.value || null, status: 'todo', notes: 'From the mood board: ' + cardTitle(it), position: first - 1000 });
          await setData(it, { job_id: job.id });
        }).then(() => toast('Added to the to-do list')).catch(fail);
      }
    }]
  });
}

/* ---------- Vendors list ---------- */
export async function addVendor(wid, { name, forWhat, phone, rate }) {
  if (!name || (store.missing && store.missing.lists)) return;
  let list = live(store.rows('lists') || []).find(l => l.wedding_id === wid && /^vendors?$/i.test(l.title.trim()));
  if (!list) list = await store.insert('lists', { wedding_id: wid, step_id: null, title: 'Vendors', columns: ['Vendor', 'For', 'Phone', 'Rate', 'Booked', 'Notes'] });
  const rows = live(store.rows('list_rows') || []).filter(r => r.list_id === list.id);
  if (rows.some(r => (r.cells || [])[0] === name && (r.cells || [])[1] === forWhat)) return;
  const cols = list.columns || [];
  const cells = cols.map(c => /^vendor|name/i.test(c) ? name : /^for/i.test(c) ? forWhat : /phone/i.test(c) ? (phone || '') : /rate|price|amount/i.test(c) ? (rate || '') : /booked/i.test(c) ? 'Yes' : '');
  const last = rows.length ? Math.max(...rows.map(r => r.position || 0)) : 0;
  await store.insert('list_rows', { list_id: list.id, wedding_id: wid, cells, position: last + 1000 });
}

// After a decision is made final: save the vendor, and add a "pay the balance" job if money is still owed.
export async function afterFinal(step, note) {
  const money = (v) => parseFloat(String(v || '').toLowerCase().replace(/[₹,\s]/g, '').replace(/(lakh|l)$/, 'e5').replace(/k$/, 'e3')) || 0;
  const w = wedding(step.wedding_id);
  try {
    if (note.with) await addVendor(step.wedding_id, { name: note.vendor || note.with, forWhat: step.title, phone: note.phone || '', rate: note.amount || '' });
    const owed = money(note.amount) - money(note.advance);
    if (owed > 0 && !(store.missing && store.missing.todos)) {
      const due = w && w.wedding_date ? (() => { const d = new Date(w.wedding_date + 'T00:00'); d.setDate(d.getDate() - 7); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })() : null;
      await store.insert('todos', { wedding_id: step.wedding_id, title: `Pay the balance for “${step.title}” (₹${Math.round(owed).toLocaleString('en-IN')})`, owner: step.owner || '', due, status: 'todo', notes: note.vendor || note.with ? 'To: ' + (note.vendor || note.with) + (note.phone ? ' · ' + note.phone : '') : '', position: -Date.now() });
    }
  } catch (e) { console.warn(e); }
}

// Choosing an option on a comparison pinned to a step makes the step final.
export async function chooseOption(it, i) {
  if (!deciderOnly('choose between options')) return;
  const d = it.data || {}; const opts = d.options || []; const o = opts[i]; if (!o) return;
  const turningOff = o.chosen;
  const next = opts.map((x, j) => ({ ...x, chosen: j === i ? !x.chosen : false }));
  const step = d.step_id ? store.find('steps', d.step_id) : null;
  if (turningOff || !step || step.deleted_at) {
    await setData(it, { options: next, status: turningOff ? null : 'chosen' }).catch(fail);
    if (!turningOff && !step) toast('Chosen. Pin this comparison to a step (⋯ menu) to make the decision final in the plan.');
    return;
  }
  if (step.locked_at) { await setData(it, { options: next, status: 'chosen' }).catch(fail); toast('Chosen — the step was already final'); return; }
  if (!(await confirmBox(`Make “${o.title || 'this option'}” final?`, `“${step.title}” becomes final with this choice. Its cost goes to the budget, the contact goes to the Vendors list, and a reminder to pay any balance is added.`, 'Make it final', ''))) return;
  const phone = (String(o.contact || '').match(/[+\d][\d\s-]{6,}/) || [''])[0].trim();
  const who = String(o.contact || '').replace(phone, '').replace(/[·,\-–]\s*$/, '').trim();
  const note = { with: o.title + (who ? ' — ' + who : ''), vendor: who || o.title, amount: (o.rate || '').replace(/[^0-9.,klakhKL ]/g, '').trim(), advance: '', notes: o.notes || '', phone, choice: { item_id: it.id, oid: o.oid || 'i' + i, image: o.image || null, title: o.title || '' } };
  await together(async () => {
    await setData(it, { options: next, status: 'chosen' });
    await store.update('steps', step.id, { locked_at: new Date().toISOString(), status: 'done', lock_note: note });
    await afterFinal(step, note);
  }).then(() => toast('Final ✓ — the plan, budget and vendors are updated')).catch(fail);
}

/* ---------- The card's ⋯ menu ---------- */
export function cardMenu(it, w, extra = []) {
  const d = it.data || {};
  const step = d.step_id ? store.find('steps', d.step_id) : null;
  const other = weddings().filter(x => x.id !== it.wedding_id);
  const btn = (label, fn, kind = 'ghost') => h('button', { class: 'btn ' + kind, type: 'button', style: { justifyContent: 'flex-start' }, onclick: () => { m.close(); fn(); } }, label);
  const m = modal({
    title: cardTitle(it),
    body: h('div', { class: 'cmenu' },
      h('div', { class: 'cm-label' }, 'Status'),
      h('div', { class: 'filters', style: { margin: 0 } }, Object.entries(STATUS).map(([k, l]) => h('button', { type: 'button', class: 'filter', 'aria-pressed': String((d.status || 'idea') === k), disabled: k === 'chosen' && !isDecider() ? true : null, title: k === 'chosen' && !isDecider() ? 'Only the Deciders can mark something as chosen' : null, onclick: () => { m.close(); setStatus(it, k); } }, l))),
      h('div', { class: 'cm-label' }, 'Plan'),
      btn(step ? `Pinned to “${step.title}” — change` : 'Pin to a step in the plan…', () => pinToStep(it)),
      step ? btn('Open that step', () => { location.hash = `#/w/${it.wedding_id}/plan?open=${step.id}`; }) : null,
      d.job_id ? btn('Open its job', () => { location.hash = `#/w/${it.wedding_id}/todo?focus=${d.job_id}`; }) : btn('Turn into a job…', () => makeJob(it)),
      h('div', { class: 'cm-label' }, 'More'),
      ...extra.map(([label, fn]) => btn(label, fn)),
      btn('Share…', () => share(`${cardTitle(it)} — ${(w && w.couple) || ''} mood board`, siteLink(`#/w/${it.wedding_id}/board?focus=${it.id}`))),
      other.map(o => btn(`Copy to ${o.couple}’s board`, () => copyCard(it, o.id)))),
  });
}

export async function copyCard(it, toWedding) {
  const { id, created_at, created_by, deleted_at, deleted_by, ...rest } = it; void id; void created_at; void created_by; void deleted_at; void deleted_by;
  const data = { ...(it.data || {}), step_id: null, job_id: null, status: null };
  await store.insert('board_items', { ...rest, wedding_id: toWedding, x: 60, y: 60, data }).then(() => toast('Copied — it’s at the top left of the other board')).catch(fail);
}

/* ---------- Board sections from the plan ---------- */
export async function sectionsFromPlan(w) {
  const items = live(store.rows('board_items')).filter(i => i.wedding_id === w.id);
  const have = new Set(items.filter(i => i.kind === 'label' && i.data && i.data.area_id).map(i => i.data.area_id));
  const stages = live(store.rows('stages')).filter(s => s.wedding_id === w.id).sort(byPos);
  const areas = stages.flatMap(st => live(store.rows('areas')).filter(a => a.stage_id === st.id).sort(byPos)).filter(a => !have.has(a.id));
  if (!areas.length) { toast('Every plan area already has a section'); return; }
  const maxY = Math.max(0, ...items.map(i => (i.y || 0) + 400));
  let n = 0;
  await together(async () => {
    for (const a of areas) {
      const col = n % 4, row = Math.floor(n / 4);
      await store.insert('board_items', { wedding_id: w.id, kind: 'label', x: 40 + col * 420, y: maxY + 40 + row * 520, w: 360, z: 1, data: { text: a.title, area_id: a.id } });
      n++;
    }
  }).then(() => toast(`Added ${n} sections — one for each part of the plan`)).catch(fail);
}
export function sectionFor(areaId) { return live(store.rows('board_items')).find(i => i.kind === 'label' && i.data && i.data.area_id === areaId); }
export async function openIdeas(w, area) {
  let sec = sectionFor(area.id);
  if (!sec) {
    const items = live(store.rows('board_items')).filter(i => i.wedding_id === w.id);
    const maxY = Math.max(0, ...items.map(i => (i.y || 0) + 400));
    sec = await store.insert('board_items', { wedding_id: w.id, kind: 'label', x: 40, y: maxY + 40, w: 360, z: 1, data: { text: area.title, area_id: area.id } }).catch(fail);
  }
  if (sec) location.hash = `#/w/${w.id}/board?focus=${sec.id}`;
}


/* ---------- What a decided step looks like ---------- */
// The picture for a step: the chosen option's photo, a photo added when it was made final,
// or a photo pinned to it from the board (chosen ones first).
export function stepPicture(step) {
  const n = step.lock_note || {};
  if (n.choice && n.choice.image) return n.choice.image;
  if (n.image) return n.image;
  const cards = cardsForStep(step.id);
  const img = (c) => { const d = c.data || {}; return c.kind === 'image' ? d.path : c.kind === 'gallery' && d.images && d.images[0] ? d.images[0].path : d.thumb || null; };
  const chosen = cards.filter(c => c.data && c.data.status === 'chosen').map(img).find(Boolean);
  if (chosen) return chosen;
  const cmp = cards.find(c => c.kind === 'compare');
  if (cmp) { const o = (cmp.data.options || []).find(x => x.chosen && x.image); if (o) return o.image; }
  return cards.map(img).find(Boolean) || null;
}
export function previewUrl(step) {
  const cards = cardsForStep(step.id);
  for (const c of cards) if (c.kind === 'link' && c.data && c.data.preview && c.data.preview.image) return c.data.preview.image;
  return null;
}
