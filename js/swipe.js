// Options to choose between, swiped like cards.
// An option is a board item of kind 'option' (data: step_id, title, rate, notes, phone, links[], images[], status).
// Votes are reactions with target 'swipe' and value love | no — open to everyone. (Older 'maybe' votes count as not voted yet.)
import { store } from './store.js?v=53';
import { h, toast, modal, field, ICONS, compressImage, uploadPhoto, confirmBox, hostOf, safeUrl, buzz, pdfThumb, fileExt, shortDate, instaEmbed, instaPost } from './ui.js?v=53';
import { live, wedding, weddings, themeOf, stepVisible, render, ui } from './app.js?v=53';
import { isDecider, personInput } from './tools.js?v=53';
import { suggestDue } from './planauto.js?v=53';
import { downloadOne, downloadZip, optionPhotos } from './downloads.js?v=53';
import { addVendor } from './decisions.js?v=53';
import { pickFiles, fetchPreview } from './board.js?v=53';
import { chooseTabs } from './tabs.js?v=53';
import { areaIcon } from './areaicons.js?v=53';
import { smartBar, inboxSection } from './smartadd.js?v=53';
import { renderGlimpse } from './glimpse.js?v=53';
import { planOf } from './map.js?v=53';
import { waButton, optionMessage, swipeMessage, vendorMessage } from './nudge.js?v=53';
import { sampleRows, isSample } from './samples.js?v=53';

const VOTES = ['love', 'no'];
const fail = (e) => { console.error(e); const m = (e && e.message) || ''; toast(/kind_check/.test(m) ? 'Options need database update 12 — run it in Supabase, then try again.' : (m || 'That did not save. Check your connection.'), 'error'); };
const byPos = (a, b) => (a.position || 0) - (b.position || 0);

/* ---------- Data ---------- */
export const isOption = (i) => i && i.kind === 'option';
export const optionsOf = (wid, stepId) => live(store.rows('board_items')).filter(i => isOption(i) && !(i.data || {}).inbox && (!wid || i.wedding_id === wid) && (!stepId || (i.data || {}).step_id === stepId));
const reactions = (o) => (store.rows('reactions') || []).filter(r => r.item_id === o.id && r.target === 'swipe');
export function votesOf(o) {
  const v = { love: [], maybe: [], no: [] };
  for (const r of reactions(o)) if (v[r.value]) v[r.value].push(r.user_name || store.memberName(r.created_by) || 'Someone');
  v.score = v.love.length * 2 - v.no.length;
  v.total = v.love.length + v.no.length;
  return v;
}
// Votes show at once; saving happens in the background (pendingVotes holds them until it's done).
const pendingVotes = new Map();
export const myVote = (o) => { if (pendingVotes.has(o.id)) return pendingVotes.get(o.id); const r = reactions(o).find(x => x.created_by === store.me.id && x.value !== 'maybe'); return r ? r.value : null; };
function undoVote(o, redraw) {
  pendingVotes.set(o.id, null); redraw();
  const mine = reactions(o).filter(r => r.created_by === store.me.id);
  store.batch(async () => { for (const r of mine) await store.del('reactions', r.id); }).then(() => pendingVotes.delete(o.id)).catch((e) => { pendingVotes.delete(o.id); fail(e); redraw(); });
}
function quickVote(o, value, redraw) {
  pendingVotes.set(o.id, value);
  vote(o, value).then(() => pendingVotes.delete(o.id)).catch((e) => { pendingVotes.delete(o.id); fail(e); redraw(); });
}
const stepOf = (o) => store.find('steps', (o.data || {}).step_id);
const isOpen = (o) => { const s = stepOf(o); const d = o.data || {}; return d.status !== 'not' && d.status !== 'chosen' && !(s && s.locked_at); };
const newestFirst = (a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''));
export const pendingFor = (wid, stepId) => (store.missing && store.missing.reactions) ? [] : optionsOf(wid, stepId).filter(o => isOpen(o) && !myVote(o) && (!stepId || true)).sort(newestFirst);

export async function vote(o, value) {
  if (store.missing && store.missing.reactions) { toast('Voting needs database update 6.', 'error'); return; }
  const mine = reactions(o).filter(r => r.created_by === store.me.id);
  await store.batch(async () => {
    for (const r of mine) await store.del('reactions', r.id);
    if (!mine.some(r => r.value === value)) await store.insert('reactions', { wedding_id: o.wedding_id, item_id: o.id, target: 'swipe', value, user_name: store.me.name });
  });
}

// The categories of a wedding: big decisions, plus any step that has options, in plan order.
// Does this step have a place in Choose? Set in the step ("Choose between options"); older plans: every big decision did.
export const wantsOptions = (s) => { const c = s.lock_note && s.lock_note.choose; return c === undefined ? !!s.gate : !!c; };
export function categoriesOf(w) {
  const plan = planOf(w); const out = [];
  for (const st of plan.stages) for (const a of st.areas) for (const s of a.steps) {
    const n = optionsOf(w.id, s.id).length;
    if (wantsOptions(s) || n) out.push({ step: s, area: a, stage: st, n });
  }
  return out;
}

/* ---------- Pictures ---------- */
export { img as photoEl };
// Tiles and grids use the small copy; the swipe card and the full-screen viewer use the full picture.
function img(path, cls, alt = '', big = /\b(lb-img|sw-img)\b/.test(cls || '')) {
  const el = h('img', { class: cls, alt, loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer', draggable: 'false' });
  if (/^https?:/.test(path || '')) el.src = path; else if (path) { el.dataset.path = path; store.url(path, big ? null : 'small').then(u => { if (u) el.src = u; }); }
  return el;
}
export const firstPic = (o) => { const d = o.data || {}; return (d.images && d.images[0] && d.images[0].path) || null; };
const initials = (t) => (t || '?').split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase();
export function placeholder(o, cls) { return h('div', { class: cls + ' ph' }, h('span', {}, initials((o.data || {}).title))); }

// Full-screen photo viewer with next / previous.
export function lightbox(paths, start = 0) {
  if (!paths.length) return;
  let i = start;
  const pic = h('div', { class: 'lb-pic' });
  const count = h('span', { class: 'lb-count' });
  const show = () => { pic.replaceChildren(img(paths[i], 'lb-img')); count.textContent = `${i + 1} / ${paths.length}`; };
  const wrap = h('div', { class: 'lightbox', role: 'dialog', 'aria-label': 'Photos', tabindex: '-1' },
    h('button', { type: 'button', class: 'lb-x', 'aria-label': 'Close', html: ICONS.close, onclick: () => close() }),
    h('button', { type: 'button', class: 'lb-dl', 'aria-label': 'Download this photo', title: 'Download this photo', onclick: () => downloadOne(paths[i], `photo ${i + 1}`) }, '⬇'),
    paths.length > 1 ? h('button', { type: 'button', class: 'lb-nav prev', 'aria-label': 'Previous photo', onclick: () => { i = (i - 1 + paths.length) % paths.length; show(); } }, '‹') : null,
    pic,
    paths.length > 1 ? h('button', { type: 'button', class: 'lb-nav next', 'aria-label': 'Next photo', onclick: () => { i = (i + 1) % paths.length; show(); } }, '›') : null,
    count);
  const key = (e) => { if (e.key === 'Escape') close(); if (e.key === 'ArrowRight' && paths.length > 1) { i = (i + 1) % paths.length; show(); } if (e.key === 'ArrowLeft' && paths.length > 1) { i = (i - 1 + paths.length) % paths.length; show(); } };
  const close = () => { wrap.remove(); document.removeEventListener('keydown', key, true); };
  document.addEventListener('keydown', key, true);
  wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target === pic) close(); });
  show(); document.body.append(wrap); wrap.focus();
}

/* ---------- Links ---------- */
// Which service a link is, so its chip can wear that service's colour.
const brandOf = (u) => { const host = hostOf(u) || ''; return /instagram\.com/.test(host) ? 'b-instagram' : /facebook\.com|fb\.com/.test(host) ? 'b-facebook' : /youtube\.com|youtu\.be/.test(host) ? 'b-youtube' : /maps\.|goo\.gl/.test(host) ? 'b-maps' : /wa\.me|whatsapp/.test(host) ? 'b-whatsapp' : ''; };
const linkLabel = (u) => { const host = hostOf(u); if (/instagram\.com/.test(host)) return 'Instagram'; if (/facebook\.com|fb\.com/.test(host)) return 'Facebook'; if (/youtube\.com|youtu\.be/.test(host)) return 'YouTube'; if (/maps\.|goo\.gl/.test(host)) return 'Map'; if (/wa\.me|whatsapp/.test(host)) return 'WhatsApp'; return host || 'Link'; };
function linkTile(u) {
  const safe = safeUrl(u); if (!safe) return null;
  if (instaPost(safe)) return instaEmbed(safe); // the post itself, right here
  const pic = h('span', { class: 'lt-pic ' + brandOf(u) }, linkLabel(u).slice(0, 1));
  const title = h('span', { class: 'lt-t' }, linkLabel(u));
  const sub = h('span', { class: 'lt-s' }, u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60));
  fetchPreview(safe).then(p => { if (!p) return; if (p.image) pic.replaceChildren(img(p.image, 'lt-img')); if (p.title) title.textContent = p.title.slice(0, 70); });
  return h('a', { class: 'link-tile', href: safe, target: '_blank', rel: 'noopener' }, pic, h('span', { class: 'lt-txt' }, title, sub));
}
const waLink = (phone) => { const d = String(phone || '').replace(/[^\d]/g, ''); return d ? 'https://wa.me/' + (d.length === 10 ? '91' + d : d) : null; };

/* ---------- One option, in full ---------- */
// One option in full: the profile view (photos, details, votes and the actions).
export function openOption(o) { openProfile(o); }
const closeAll = () => document.querySelectorAll('.modal-wrap').forEach(m => m.remove());

// Add more photos to a vendor straight from its card (pick many at once from the phone's gallery).
async function addPhotosTo(o) {
  const files = await pickFiles('image/*', true); if (!files.length) return;
  toast(`Adding ${files.length} ${files.length === 1 ? 'photo' : 'photos'}…`);
  const added = [];
  for (const f of files) { try { added.push({ path: await uploadPhoto(store, f) }); } catch (e) { fail(e); } }
  if (!added.length) return;
  const cur = store.find('board_items', o.id) || o;
  await store.update('board_items', o.id, { data: { ...(cur.data || {}), images: [...((cur.data || {}).images || []), ...added] } }).then(() => toast(`${added.length} ${added.length === 1 ? 'photo' : 'photos'} added`)).catch(fail);
}

/* ---------- Mood-board cards become options ----------
   Comparisons used to live as cards on the mood board with ▲/▼ votes. Options in Choose
   now do that job (swipe, compare, choose), so cards are sent there instead. */
/* ---------- Category: pick one or type a new one, with when it happens and who is in charge ----------
   Typing a name that isn't in the plan yet makes a new step there (marked a big decision so it shows in Choose).
   Changing "When" or "In charge" for an existing category updates that step in the plan too. */
const byPosition = (a, b) => (a.position || 0) - (b.position || 0);
export const peopleNames = () => [...new Set([...(store.rows('members') || []).map(m => m.name), ...live(store.rows('steps')).map(x => x.owner)].map(x => String(x || '').trim()).filter(x => x && x !== 'You'))].sort((a, b) => a.localeCompare(b));
const stageOfStep = (st) => { const a = st && store.find('areas', st.area_id); return a ? store.find('stages', a.stage_id) : null; };
let cfN = 0;
export function categoryFields(w, stepId) {
  const n = ++cfN;
  const stages = live(store.rows('stages')).filter(x => x.wedding_id === w.id).sort(byPosition);
  const areasIn = (sid) => live(store.rows('areas')).filter(a => a.stage_id === sid).sort(byPosition);
  const cats = categoriesOf(w).map(c => c.step);
  const steps = [...cats, ...live(store.rows('steps')).filter(x => x.wedding_id === w.id && stepVisible(x) && !cats.some(c => c.id === x.id)).sort((a, b) => a.title.localeCompare(b.title))];
  const cur = stepId ? store.find('steps', stepId) : null;
  const cat = h('input', { value: cur ? cur.title : '', list: 'cf-cats-' + n, placeholder: 'Pick one, or type a new one — e.g. Make-up artist', maxlength: 120, autocomplete: 'off' });
  const when = h('select', {}, stages.length ? stages.map(st => h('option', { value: st.id }, st.title)) : h('option', { value: '' }, 'Before'));
  const area = h('select', {});
  const who = personInput(cur ? cur.owner || '' : '', { placeholder: 'One or more people' });
  const due = h('input', { type: 'date', value: cur && cur.due ? cur.due : '' });
  // Dates are never filled in for you — a suggestion shows as a button you can tap.
  const sugg = h('button', { type: 'button', class: 'link-btn sugg cf-sugg', hidden: true });
  const showSugg = () => {
    sugg.hidden = true; if (due.value) return;
    const t = cat.value.trim(); if (!t) return;
    const aid = area.value && area.value !== '__new' ? area.value : (areasIn(when.value)[0] || {}).id;
    const sg = suggestDue({ title: t, area_id: aid }, w); if (!sg) return;
    sugg.textContent = `Suggested: ${new Date(sg + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} — use it`;
    sugg.onclick = () => { due.value = sg; sugg.hidden = true; };
    sugg.hidden = false;
  };
  due.addEventListener('change', showSugg);
  const note = h('p', { class: 'hint cf-note', style: { margin: '-4px 0 0' } });
  const areaField = field('Section', area, 'Where it sits in the plan, inside the stage chosen in “When”.');
  let matched = cur, startStage = cur ? stageOfStep(cur) : null;
  const fillAreas = () => {
    const as = areasIn(when.value);
    const keep = matched && store.find('areas', matched.area_id);
    const stName = (stages.find(x => x.id === when.value) || {}).title || 'Before';
    area.replaceChildren(...as.map(a => h('option', { value: a.id, selected: keep && keep.id === a.id ? true : null }, `${stName} › ${a.title}`)), h('option', { value: '__new', selected: !as.length || (!keep && !as.some(a => /^choices$/i.test(a.title))) ? true : null }, `${stName} › + a new section called “Choices”`));
    const ch = as.find(a => /^choices$/i.test(a.title)); if (ch && !(keep && keep.stage_id === when.value)) area.value = ch.id;
  };
  const sync = (fromTyping) => {
    const t = cat.value.trim().toLowerCase();
    const m = t ? steps.find(x => x.title.trim().toLowerCase() === t) : null;
    if (fromTyping && m && m !== matched) { who.value = m.owner || ''; due.value = m.due || ''; }
    matched = m;
    if (m) { const st = stageOfStep(m); if (fromTyping && st) when.value = st.id; startStage = st; }
    if (!m && startStage === null && stages[0] && fromTyping) { /* a new name: keep whatever stage is picked */ }
    fillAreas();
    const moving = m && startStage && when.value !== startStage.id;
    areaField.hidden = !!m && !moving;
    const st = stages.find(x => x.id === when.value);
    showSugg();
    note.textContent = !t ? '' : m ? (moving ? `It moves to ${st ? st.title : 'that stage'} in the plan.` : `In the plan under ${st ? st.title : '—'}${store.find('areas', m.area_id) ? ' · ' + store.find('areas', m.area_id).title : ''}.`) : `New category — it is added to the plan under ${st ? st.title : 'Before'}.`;
  };
  cat.addEventListener('input', () => sync(true)); cat.addEventListener('change', () => sync(true));
  when.addEventListener('change', () => sync(false));
  if (cur) { const st = stageOfStep(cur); if (st) when.value = st.id; }
  sync(false);
  const mainEl = h('div', { class: 'cf' }, field('Category', cat), note, h('datalist', { id: 'cf-cats-' + n }, steps.map(x => h('option', { value: x.title }))));
  const extraEl = h('div', { class: 'cf' }, h('div', { class: 'cf-row' }, field('When', when), field('In charge', who), h('div', { class: 'field' }, field('Due by', due), sugg)), areaField);
  const el = h('div', { class: 'cf' }, mainEl, extraEl);
  // Makes or updates the step, and gives back its id (null if the category is empty).
  const resolve = async () => {
    const title = cat.value.replace(/\s+/g, ' ').trim();
    if (!title) { toast('Pick or type a category', 'error'); cat.focus(); return null; }
    sync(false);
    const owner = who.value.trim(), dueV = due.value || null;
    let stageId = when.value;
    if (!stageId) { const st = await store.insert('stages', { wedding_id: w.id, title: 'Before', position: 1000 }); stageId = st.id; }
    const areaFor = async () => {
      if (area.value && area.value !== '__new') return area.value;
      const as = areasIn(stageId); const ch = as.find(a => /^choices$/i.test(a.title)); if (ch) return ch.id;
      const a = await store.insert('areas', { wedding_id: w.id, stage_id: stageId, title: 'Choices', position: ((as[as.length - 1] || {}).position || 0) + 1000 }); return a.id;
    };
    const endOf = (aid) => (live(store.rows('steps')).filter(x => x.area_id === aid).reduce((mx, x) => Math.max(mx, x.position || 0), 0)) + 1000;
    if (matched) {
      const patch = {};
      if (owner !== (matched.owner || '')) patch.owner = owner;
      if ((dueV || null) !== (matched.due || null)) patch.due = dueV;
      const st = stageOfStep(matched);
      if (st && st.id !== stageId) { const aid = await areaFor(); patch.area_id = aid; patch.position = endOf(aid); }
      if (Object.keys(patch).length) await store.update('steps', matched.id, patch);
      return matched.id;
    }
    const aid = await areaFor();
    const row = await store.insert('steps', { wedding_id: w.id, area_id: aid, title, notes: '', owner, due: dueV, status: 'todo', position: endOf(aid), gate: true });
    return row.id;
  };
  return { el, mainEl, extraEl, resolve, focus: () => cat.focus() };
}

export function pickCategory(w, title = 'Which category?', hint = '') {
  return new Promise((resolve) => {
    const cf = categoryFields(w);
    let done = false;
    modal({ title, body: [hint ? h('p', { class: 'muted', style: { marginTop: 0 } }, hint) : null, cf.el].filter(Boolean),
      onClose: () => { if (!done) resolve(null); },
      actions: [{ label: 'Send to Choose', onClick: async () => { let id; try { id = await cf.resolve(); } catch (e) { fail(e); return false; } if (!id) return false; done = true; resolve(id); } }] });
  });
}
export async function cardsToOptions(w, rows) {
  const stepId = await pickCategory(w, 'Send to Choose as options', 'Each one becomes an option everyone can swipe, compare and vote on.');
  if (!stepId) return 0;
  const opts = [];
  for (const it of rows) {
    const d = it.data || {};
    if (it.kind === 'compare') {
      for (const o of d.options || []) opts.push({ title: o.title || 'Option', rate: o.rate ? (/^\s*₹/.test(o.rate) ? o.rate : '₹' + o.rate) : '', notes: o.notes || '', phone: o.contact || '', links: [], images: o.image ? [{ path: o.image }] : [], status: o.chosen ? 'chosen' : 'open' });
    } else {
      const images = it.kind === 'image' && d.path ? [{ path: d.path }] : it.kind === 'gallery' ? (d.images || []).map(x => ({ path: x.path })) : d.thumb ? [{ path: d.thumb }] : [];
      opts.push({ title: d.title || d.caption || (d.text || '').split('\n')[0].slice(0, 80) || (it.kind === 'link' ? hostOf(d.url || '') : 'Option'), rate: d.rate || '', notes: it.kind === 'note' ? d.text || '' : d.caption || '', phone: d.phone || '', links: d.url ? [d.url] : [], images, status: 'open' });
    }
  }
  if (!opts.length) return 0;
  await store.batch(async () => {
    await store.insertMany('board_items', opts.map(o => ({ wedding_id: w.id, kind: 'option', x: 0, y: 0, w: 280, z: 1, data: { step_id: stepId, ...o } })));
    await store.removeMany('board_items', rows.map(r => r.id));
  }).catch(fail);
  toast(`${opts.length} ${opts.length === 1 ? 'option' : 'options'} added to Choose — the cards went to the Bin`);
  return opts.length;
}

/* ---------- Add or edit an option ---------- */
// A sample for ideas: a mood-board card (one photo, or a gallery of several), pinned to the category if one was given.
async function addSampleToBoard(w, cf, { title, notes, links, images }) {
  if (!images.length) { toast('Add at least one photo for the mood board', 'error'); return false; }
  const catInput = (cf.mainEl || cf.el).querySelector('input'); const catTyped = catInput && catInput.value.trim();
  let sid = null;
  if (catTyped) { try { sid = await store.batch(() => cf.resolve()); } catch (e) { fail(e); return false; } }
  const items = live(store.rows('board_items')).filter(i => i.wedding_id === w.id && i.kind !== 'option');
  const y = items.reduce((m, i) => Math.max(m, (i.y || 0) + (i.h || 260)), 40) + 40;
  const z = items.reduce((m, i) => Math.max(m, i.z || 1), 1) + 1;
  const data = images.length === 1
    ? { path: images[0].path, title, caption: notes, links, step_id: sid, sample: false }
    : { title, layout: 'grid', caption: notes, links, step_id: sid, images: images.map(x => ({ path: x.path, caption: '' })) };
  try {
    await store.insert('board_items', { wedding_id: w.id, kind: images.length === 1 ? 'image' : 'gallery', x: 40, y, w: images.length === 1 ? 260 : 340, z, data });
    toast(sid ? 'Added to the mood board, under this category' : 'Added to the mood board');
  } catch (e) { fail(e); return false; }
}

// What we've learnt from earlier options: vendors (name → phone, links, rate) and the last category used.
function knownVendors() {
  const m = new Map();
  for (const o of live(store.rows('board_items')).filter(isOption).sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))) {
    const d = o.data || {}; const t = (d.title || '').replace(/^Sample:\s*/, '').trim(); if (!t || d.sample) continue;
    const k = t.toLowerCase(); const prev = m.get(k) || {};
    m.set(k, { title: t, phone: d.phone || prev.phone || '', links: (d.links || []).length ? d.links : prev.links || [], rate: d.rate || prev.rate || '' });
  }
  return m;
}
const LAST_CAT = (wid) => 'fwp-last-cat-' + wid;
const lastCategory = (w) => { try { const id = localStorage.getItem(LAST_CAT(w.id)); const st = id && store.find('steps', id); return st && !st.deleted_at && !st.locked_at ? st.id : null; } catch (e) { return null; } };

export function editOption(w, stepId, item, preset = {}) {
  const d = { links: [], images: [], ...((item && item.data) || {}), ...(item ? {} : { images: preset.images || [], links: preset.links || [], notes: preset.notes || '' }) };
  const cf = categoryFields(w, stepId || d.step_id || (!item ? lastCategory(w) : null));
  const vendors = knownVendors();
  const dlId = 'oe-vendors-' + Math.random().toString(36).slice(2, 7);
  const name = h('input', { value: d.title || '', placeholder: 'e.g. Lens & Light Studio', maxlength: 120, list: dlId, autocomplete: 'off' });
  const rate = h('input', { value: d.rate || '', placeholder: 'e.g. ₹85,000 · church + reception', maxlength: 160 });
  const notes = h('textarea', { placeholder: 'Who they are, their style, what’s included…' }, d.notes || '');
  const phone = h('input', { value: d.phone || '', placeholder: 'Phone or WhatsApp number', inputmode: 'tel', maxlength: 40 });
  const links = h('textarea', { placeholder: 'One link per line — Instagram, website, Facebook, Google Maps…', rows: 3 }, (d.links || []).join('\n'));
  const known = h('p', { class: 'hint oe-known', hidden: true });
  // Picking a vendor we've seen before fills in their phone, links and rate (only where still empty).
  name.addEventListener('change', () => {
    const v = vendors.get(name.value.trim().toLowerCase()); known.hidden = true; if (!v || item) return;
    const filled = [];
    if (!phone.value && v.phone) { phone.value = v.phone; filled.push('phone'); }
    if (!links.value.trim() && v.links.length) { links.value = v.links.join('\n'); filled.push('links'); }
    if (!rate.value && v.rate) { rate.value = v.rate; filled.push('price'); }
    if (filled.length) { known.textContent = `Seen before — filled in their ${filled.join(', ')}. Change anything that’s different.`; known.hidden = false; }
  });
  let images = [...(d.images || [])];
  let split = false; // several new photos: one option, or one option each?
  const thumbs = h('div', { class: 'oe-thumbs' });
  const status = h('span', { class: 'hint', style: { margin: 0 } });
  const splitBox = h('div', { class: 'oe-split', hidden: true });
  const drawSplit = () => {
    splitBox.hidden = !!item || images.length < 2;
    splitBox.replaceChildren(h('span', { class: 'oe-split-q' }, `These ${images.length} photos are…`),
      h('div', { class: 'd-seg', role: 'radiogroup' },
        h('button', { type: 'button', class: split ? '' : 'on', 'aria-pressed': String(!split), onclick: () => { split = false; drawSplit(); } }, 'One option', h('small', {}, 'views of the same thing, or one vendor’s work')),
        h('button', { type: 'button', class: split ? 'on' : '', 'aria-pressed': String(split), onclick: () => { split = true; drawSplit(); } }, 'Separate options', h('small', {}, `${images.length} choices, one photo each`))));
  };
  const drawThumbs = () => { thumbs.replaceChildren(...images.map((x, i) => h('span', { class: 'oe-th' + (i === 0 ? ' cover' : '') }, img(x.path, ''),
    i === 0 ? h('span', { class: 'oe-cover' }, 'Cover') : h('button', { type: 'button', class: 'oe-mk', title: 'Make this the cover photo', onclick: () => { images.unshift(...images.splice(i, 1)); drawThumbs(); } }, '★'),
    h('button', { type: 'button', class: 'oe-x', 'aria-label': 'Remove this photo', onclick: () => { images.splice(i, 1); drawThumbs(); } }, '×'))),
    h('button', { type: 'button', class: 'oe-add', onclick: () => addPhotos() }, '+ Photos')); drawSplit(); };
  const addPhotos = async (files) => {
    files = files || await pickFiles('image/*', true);
    if (!files.length) return;
    status.textContent = `Adding ${files.length} ${files.length === 1 ? 'photo' : 'photos'}…`;
    await Promise.all(files.map(async (f) => { try { const path = await uploadPhoto(store, f); images.push({ path }); drawThumbs(); } catch (e) { fail(e); } }));
    status.textContent = images.length ? `${images.length} ${images.length === 1 ? 'photo' : 'photos'} — the first is the cover; tap ★ to change it` : '';
  };
  drawThumbs();
  // New items can be an option to vote on, or just a sample for ideas — that goes on the mood board, under the category.
  let asSample = !!preset.sample;
  const priceF = field('Price or quote', rate), phoneF = field('Phone', phone);
  const modeBox = item ? null : h('div', { class: 'oe-mode d-seg', role: 'radiogroup', 'aria-label': 'Add as' });
  const drawMode = () => {
    if (!modeBox) return;
    modeBox.replaceChildren(
      h('button', { type: 'button', class: asSample ? '' : 'on', 'aria-pressed': String(!asSample), onclick: () => { asSample = false; drawMode(); } }, 'An option to vote on', h('small', {}, 'goes into the swipe deck')),
      h('button', { type: 'button', class: asSample ? 'on' : '', 'aria-pressed': String(asSample), onclick: () => { asSample = true; drawMode(); } }, 'A sample for ideas', h('small', {}, 'goes on the mood board — nothing to choose')));
    priceF.hidden = phoneF.hidden = asSample; splitBox.classList.toggle('off', asSample);
    const sv = document.querySelector('.modal .modal-actions .btn:not(.ghost)'); if (sv && sv.closest('.modal') && sv.closest('.modal').contains(modeBox)) sv.textContent = asSample ? 'Add to the mood board' : 'Save option';
  };
  // The short version first — what goes on the card; everything else folds away under "More details".
  const more = h('details', { class: 'oe-more' }, h('summary', {}, 'More details — when, who’s in charge, links, phone, notes'),
    cf.extraEl,
    field('Links', links, 'Instagram, website, Facebook… one per line. A link to one Instagram post shows the post itself.'),
    field('About them', notes), phoneF);
  if (item || (d.links || []).length || d.notes) more.open = true;
  const body = h('div', { class: 'oe-form' },
    modeBox,
    cf.mainEl, field('Name', name), known, h('datalist', { id: dlId }, [...vendors.values()].map(v => h('option', { value: v.title }))), priceF,
    h('div', { class: 'field' }, h('label', {}, 'Photos — their work, samples, front and back, price lists'), thumbs, status, splitBox),
    more);
  drawMode();
  body.addEventListener('paste', (e) => { const fs = [...(e.clipboardData && e.clipboardData.files || [])].filter(f => f.type.startsWith('image/')); if (fs.length) { e.preventDefault(); addPhotos(fs); } });
  body.addEventListener('dragover', (e) => e.preventDefault());
  body.addEventListener('drop', (e) => { const fs = [...(e.dataTransfer && e.dataTransfer.files || [])].filter(f => f.type.startsWith('image/')); if (fs.length) { e.preventDefault(); addPhotos(fs); } });
  modal({
    title: item ? 'Edit option' : 'Add an option', wide: true, body,
    actions: [{ label: 'Cancel', kind: 'ghost', onClick: () => { } }, {
      label: item ? 'Save' : 'Save option', onClick: async () => {
        if (!name.value.trim() && !images.length) { toast('Give it a name or a photo', 'error'); name.focus(); return false; }
        const title = name.value.trim();
        if (asSample) { const r = await addSampleToBoard(w, cf, { title, notes: notes.value.trim(), links: links.value.split(/\s*\n\s*/).map(x => x.trim()).filter(Boolean), images }); if (r !== false && preset.onSaved) setTimeout(preset.onSaved, 50); return r; }
        let sid; try { sid = await store.batch(() => cf.resolve()); } catch (e) { fail(e); return false; }
        if (!sid) return false;
        // Same vendor already in this category? Ask before adding a second copy.
        if (!item && title && optionsOf(w.id, sid).some(o => ((o.data || {}).title || '').trim().toLowerCase() === title.toLowerCase())
          && !(await confirmBox(`“${title}” is already in this category`, 'Add it again anyway? To add more of their photos, open the one that’s there and tap “+ Add photos”.', 'Add it anyway'))) return false;
        const base = { ...d, step_id: sid, title, rate: rate.value.trim(), notes: notes.value.trim(), phone: phone.value.trim(),
          links: links.value.split(/\s*\n\s*/).map(x => x.trim()).filter(Boolean), images, status: d.status || 'open' };
        try {
          if (item) await store.update('board_items', item.id, { data: base });
          else if (split && images.length > 1) await store.insertMany('board_items', images.map((im, i) => ({ wedding_id: w.id, kind: 'option', x: 0, y: 0, w: 280, z: 1, data: { ...base, title: `${title || 'Option'} ${i + 1}`, images: [im] } })));
          else await store.insert('board_items', { wedding_id: w.id, kind: 'option', x: 0, y: 0, w: 280, z: 1, data: base });
          try { localStorage.setItem(LAST_CAT(w.id), sid); } catch (e) { /* ignore */ }
          if (preset.onSaved) setTimeout(preset.onSaved, 50);
          toast(item ? 'Saved' : split && images.length > 1 ? `${images.length} options added` : 'Added — the family will see it in New for you');
        } catch (e) { fail(e); return false; }
      }
    }]
  });
}

/* ---------- Final designs ----------
   Samples are swiped on; once one is chosen, the real thing (the printer's proof, the finished dress …) is added
   as its final design. Each upload is a new version — the latest is the cover in Glimpse, Choose and the plan;
   earlier versions and the chosen sample stay underneath. Stored on the chosen option as data.final. */
export function chosenOf(step) { return step ? optionsOf(step.wedding_id, step.id).find(o => (o.data || {}).status === 'chosen') || null : null; }
export function finalOf(step) {
  const o = chosenOf(step); const v = o ? ((o.data || {}).final || []) : [];
  return { option: o, versions: v, latest: v[v.length - 1] || null };
}
export function addFinal(o) {
  const d = o.data || {}; const s = stepOf(o);
  const note = h('input', { placeholder: 'e.g. Second proof from the printer', maxlength: 140 });
  const files = []; const list = h('div', { class: 'fd-picked' });
  const drawList = () => list.replaceChildren(...files.map((f, i) => h('span', { class: 'fd-chip' }, f.name, h('button', { type: 'button', 'aria-label': 'Remove', onclick: () => { files.splice(i, 1); drawList(); } }, '×'))));
  const pick = h('button', { type: 'button', class: 'btn ghost', onclick: async () => { const fs = await pickFiles('image/*,application/pdf', true); files.push(...fs); drawList(); } }, '+ Photos or a PDF');
  const n = (d.final || []).length;
  modal({ title: n ? 'Add a newer version' : 'Add the final design',
    body: [h('p', { class: 'muted', style: { marginTop: 0 } }, `For ${s ? s.title : 'this'}: the chosen sample was “${d.title || 'Option'}”. Add photos or a PDF of the final version — it becomes the picture everyone sees.`),
      h('div', { class: 'field' }, pick, list), field('Note (optional)', note)],
    actions: [{ label: 'Cancel', kind: 'ghost', onClick: () => { } }, { label: n ? 'Add version ' + (n + 1) : 'Add the final design', onClick: async () => {
      if (!files.length) { toast('Pick photos or a PDF first', 'error'); return false; }
      toast('Uploading…');
      try {
        const images = [], docs = [];
        for (const f of files) {
          if (/^image\//.test(f.type)) images.push({ path: await uploadPhoto(store, f) });
          else { const path = await store.uploadBlob(f, fileExt(f.name)); let thumb = null; if (/pdf/.test(f.type) || /\.pdf$/i.test(f.name)) { const t = await pdfThumb(f).catch(() => null); if (t && t.blob) thumb = await store.uploadBlob(t.blob, 'jpg'); } docs.push({ path, name: f.name, thumb }); }
        }
        const cur = store.find('board_items', o.id) || o; const cd = cur.data || {};
        const version = { images, docs, note: note.value.trim(), at: new Date().toISOString(), by: store.me.name };
        await store.update('board_items', o.id, { data: { ...cd, final: [...(cd.final || []), version] } });
        toast(n ? `Version ${n + 1} added` : 'Final design added');
      } catch (e) { fail(e); return false; }
    } }] });
}
const versionPics = (v) => [...(v.images || []).map(x => x.path), ...(v.docs || []).filter(x => x.thumb).map(x => x.thumb)];
function finalBlock(w, step) {
  const { option, versions, latest } = finalOf(step);
  if (!option) return null;
  const d = option.data || {};
  if (!latest) return h('section', { class: 'fd-block empty' },
    h('div', { class: 'fd-h' }, h('span', { class: 'fd-tag sample' }, 'Sample chosen'), h('b', {}, d.title || 'Option')),
    h('p', { class: 'muted', style: { margin: 0 } }, 'When the final version arrives — the printer’s proof, the finished piece — add it here. It becomes the picture in Glimpse and the plan.'),
    h('button', { type: 'button', class: 'btn', onclick: () => addFinal(option) }, '+ Add the final design'));
  const pics = versionPics(latest);
  return h('section', { class: 'fd-block' },
    h('div', { class: 'fd-h' }, h('span', { class: 'fd-tag' }, 'Final design' + (versions.length > 1 ? ' · version ' + versions.length : '')), h('span', { class: 'muted' }, `${latest.by || 'Someone'} · ${shortDate(latest.at.slice(0, 10))}`)),
    latest.note ? h('p', { style: { margin: 0 } }, latest.note) : null,
    pics.length ? h('div', { class: 'fd-pics' }, pics.map((p, i) => h('button', { type: 'button', class: 'fd-ph', onclick: () => lightbox(pics, i) }, img(p, '')))) : null,
    (latest.docs || []).length ? h('div', { class: 'fd-docs' }, latest.docs.map(x => h('button', { type: 'button', class: 'btn ghost small', onclick: async () => { const u = await store.url(x.path); if (u) window.open(u, '_blank', 'noopener'); } }, '📄 ' + x.name))) : null,
    h('p', { class: 'hint', style: { margin: 0 } }, `Started from the sample “${d.title || 'Option'}”.`),
    h('div', { class: 'fd-acts' }, h('button', { type: 'button', class: 'btn ghost small', onclick: () => addFinal(option) }, '+ A newer version'),
      versions.length > 1 ? h('details', { class: 'fd-old' }, h('summary', {}, `Earlier versions (${versions.length - 1})`),
        versions.slice(0, -1).reverse().map((v, k) => h('div', { class: 'fd-ver' }, h('span', { class: 'muted' }, `Version ${versions.length - 1 - k} · ${v.by || ''} · ${shortDate(v.at.slice(0, 10))}${v.note ? ' — ' + v.note : ''}`),
          h('div', { class: 'fd-pics small' }, versionPics(v).map((p, i, all) => h('button', { type: 'button', class: 'fd-ph', onclick: () => lightbox(all, i) }, img(p, ''))))))) : null));
}

// Delete an option (it goes to the Bin and can be brought back). Says so when someone else added it.
export async function deleteOption(o) {
  const d = o.data || {}; const by = store.memberName(o.created_by);
  const theirs = o.created_by && o.created_by !== store.me.id && by;
  if (!(await confirmBox(`Delete “${d.title || 'this option'}”?`, (theirs ? `${by} added it. ` : '') + 'It goes to the Bin, with its votes — anyone can bring it back from there.', 'Delete'))) return;
  store.remove('board_items', o.id).then(() => toast('Moved to the Bin')).catch(fail);
}

/* ---------- Swipe again ----------
   For you: your votes in this category are cleared so its options come back in your deck.
   For a decided category (admin): it reopens for a new round — the earlier choice and its votes are kept as "Round 1". */
export async function swipeAgain(w, step) {
  const opts = optionsOf(w.id, step.id);
  if (step.locked_at) {
    if (!store.me.isAdmin) { toast('Only the admin can reopen a final decision', 'error'); return; }
    const ch = chosenOf(step);
    if (!(await confirmBox(`Start a new round for “${step.title}”?`, `${ch ? `“${(ch.data || {}).title}” stays visible as Round 1’s choice. ` : ''}Everyone can swipe and vote again, and new options can be added. A Decider chooses again at the end.`, 'Start a new round'))) return;
    const rounds = [...((step.lock_note || {}).rounds || []), { at: new Date().toISOString(), chosen: ch ? { id: ch.id, title: (ch.data || {}).title || '' } : null, votes: Object.fromEntries(opts.map(o => { const v = votesOf(o); return [o.id, { love: v.love.length, no: v.no.length }]; })) }];
    try {
      await store.batch(async () => {
        for (const o of opts) await store.update('board_items', o.id, { data: { ...(o.data || {}), status: 'open', round1: (o.data || {}).status === 'chosen' ? 'chosen' : undefined } });
        for (const o of opts) for (const r of (store.rows('reactions') || []).filter(r => r.item_id === o.id && r.target === 'swipe')) await store.del('reactions', r.id);
        await store.update('steps', step.id, { locked_at: null, status: 'doing', lock_note: { ...(step.lock_note || {}), rounds } });
      });
      toast('New round started — everyone can swipe again');
      location.hash = `#/w/${w.id}/swipe?step=${step.id}`;
    } catch (e) { fail(e); }
    return;
  }
  const mine = opts.flatMap(o => (store.rows('reactions') || []).filter(r => r.item_id === o.id && r.target === 'swipe' && r.created_by === store.me.id));
  try { await store.batch(async () => { for (const r of mine) await store.del('reactions', r.id); }); } catch (e) { fail(e); return; }
  location.hash = `#/w/${w.id}/swipe?step=${step.id}`;
}
export const roundsOf = (step) => ((step && step.lock_note) || {}).rounds || [];

/* ---------- Choosing (Deciders) ---------- */
export async function chooseOption(o) {
  if (!isDecider(o.wedding_id)) { toast('Only this wedding’s Deciders can make a choice final', 'error'); return; }
  const s = stepOf(o); const d = o.data || {};
  if (!s) { toast('This option isn’t in a category', 'error'); return; }
  if (!(await confirmBox(`Make “${d.title || 'this option'}” final for ${s.title}?`, 'The step becomes final, the other options are marked “not chosen” (they stay visible), and it’s added to the vendor list.', 'Make it final', ''))) return;
  try {
    await store.batch(async () => { for (const x of optionsOf(o.wedding_id, s.id)) await store.update('board_items', x.id, { data: { ...(x.data || {}), status: x.id === o.id ? 'chosen' : 'not' } }); });
    const note = { with: d.title || '', vendor: d.title || '', amount: d.rate || '', phone: d.phone || '', choice: { item_id: o.id, image: firstPic(o), title: d.title || '' } };
    await store.update('steps', s.id, { locked_at: new Date().toISOString(), status: 'done', lock_note: note });
    await addVendor(o.wedding_id, { name: d.title || '', forWhat: s.title, phone: d.phone || '', rate: d.rate || '' }).catch(() => { });
    buzz(30); toast(`✓ ${d.title} is final for ${s.title}`);
  } catch (e) { fail(e); }
}

/* ---------- Compare 2–3 side by side ---------- */
export function openCompare(list) {
  const cols = list.map(o => {
    const d = o.data || {}; const v = votesOf(o); const pics = (d.images || []).map(x => x.path);
    return h('div', { class: 'cmp-col' + (d.status === 'chosen' ? ' chosen' : '') },
      h('div', { class: 'cmp-pics' }, pics.length ? pics.slice(0, 4).map((p, i) => h('button', { type: 'button', onclick: () => lightbox(pics, i), 'aria-label': 'Open photo' }, img(p, ''))) : placeholder(o, 'cmp-ph')),
      pics.length > 4 ? h('button', { type: 'button', class: 'link-btn', onclick: () => lightbox(pics, 4) }, `+ ${pics.length - 4} more photos`) : null,
      h('h3', {}, d.title || 'Option'),
      h('div', { class: 'cmp-rate' }, d.rate || '—'),
      h('div', { class: 'cmp-votes' }, `♥ ${v.love.length} · ✕ ${v.no.length}`),
      d.notes ? h('p', { class: 'cmp-notes' }, d.notes) : h('p', { class: 'cmp-notes muted' }, 'No details yet.'),
      (d.links || []).length ? h('div', { class: 'cmp-links' }, (d.links || []).map(u => safeUrl(u) ? h('a', { href: safeUrl(u), target: '_blank', rel: 'noopener', class: 'chip-link ' + brandOf(u) }, linkLabel(u)) : null)) : null,
      d.phone ? h('a', { class: 'cmp-phone', href: 'tel:' + d.phone.replace(/[^\d+]/g, '') }, '☏ ' + d.phone) : null,
      h('div', { class: 'cmp-acts' },
        h('button', { type: 'button', class: 'btn small ghost', onclick: () => openOption(o) }, 'See everything'),
        isDecider(o.wedding_id) && isOpen(o) ? h('button', { type: 'button', class: 'btn small', onclick: () => { closeAll(); chooseOption(o); } }, 'Make it final') : null));
  });
  modal({ title: 'Compare', wide: true, body: h('div', { class: 'cmp-grid n' + list.length }, cols) });
}

/* ---------- The swipe deck ---------- */
// Your votes this visit, newest last, so Undo can step back through several cards.
const undoStack = [];
function deckCard(o, rest, onVote) {
  const d = o.data || {}; const w = wedding(o.wedding_id); const s = stepOf(o);
  const pics = (d.images || []).map(x => x.path);
  let pi = 0;
  const photo = h('div', { class: 'sw-photo' });
  const dots = h('div', { class: 'sw-dots' });
  const count = h('span', { class: 'sw-count-pic' });
  const showPic = () => {
    photo.replaceChildren(pics.length ? img(pics[pi], 'sw-img', d.title || '') : placeholder(o, 'sw-img'));
    dots.replaceChildren(...(pics.length > 1 ? pics.map((_, i) => h('span', { class: i === pi ? 'on' : i < pi ? 'seen' : '' })) : []));
    count.textContent = pics.length > 1 ? `${pi + 1} / ${pics.length}` : '';
    if (pics[pi + 1]) store.url(pics[pi + 1]).then(u => { if (u) { const im = new Image(); im.src = u; } }); // next photo ready before the tap
  };
  showPic();
  const v = votesOf(o);
  const card = h('article', { class: 'sw-card', tabindex: '0', 'aria-label': `${d.title || 'Option'}${s ? ' for ' + s.title : ''}` },
    h('div', { class: 'sw-top' }, photo, dots, count,
      h('span', { class: 'sw-cat' }, s ? s.title : 'Option'),
      w ? h('span', { class: 'sw-w', style: { '--wc': themeOf(w).accent } }, w.monogram || w.couple) : null,
      d.rate ? h('span', { class: 'sw-rate' }, d.rate) : null,
      h('span', { class: 'sw-stamp love' }, 'LOVE IT'), h('span', { class: 'sw-stamp no' }, 'NOT THIS')),
    h('div', { class: 'sw-body' },
      h('h2', {}, d.title || 'Option'),
      d.notes ? h('p', { class: 'sw-notes' }, d.notes) : null,
      h('div', { class: 'sw-meta' },
        pics.length > 1 ? h('span', { class: 'chip-link' }, `${pics.length} photos`) : null,
        (d.links || []).slice(0, 2).map(u => h('span', { class: 'chip-link ' + brandOf(u) }, linkLabel(u))),
        v.total ? h('span', { class: 'sw-sofar' }, `♥ ${v.love.length} · ✕ ${v.no.length} so far`) : null),
      h('button', { type: 'button', class: 'sw-more', onclick: (e) => { e.stopPropagation(); openProfile(o, onVote); } }, h('span', { class: 'sw-more-ar', 'aria-hidden': 'true' }, '⌃'), pics.length > 1 ? `Swipe up for all ${pics.length} photos and details` : 'Swipe up for the details')));
  // Like Bumble: sideways decides (a light push in the general direction is enough), up opens the whole profile.
  // The card follows the finger and tilts; let go early and it springs back. Tap the photo's sides for more photos.
  const W = () => card.offsetWidth || 340;
  let sx = 0, sy = 0, dx = 0, dy = 0, dragging = false, moved = false, raf = 0, lastX = 0, lastY = 0, lastT = 0, vx = 0, vy = 0, tilt = 1, crossed = '';
  const under = () => card.parentElement && card.parentElement.querySelector('.sw-under:not(.two)');
  const FAR = () => Math.min(90, W() * .22);
  const decide = () => {
    if (-dy > Math.abs(dx) * 1.2 && -dy > 56) return 'up';
    if (Math.abs(dx) > FAR() && Math.abs(dx) > Math.abs(dy) * .8) return dx > 0 ? 'love' : 'no';
    return '';
  };
  const paint = () => {
    raf = 0;
    const up = -dy > Math.abs(dx) * 1.2;
    card.style.transform = up ? `translate3d(0, ${dy * .5}px, 0)` : `translate3d(${dx}px, ${dy * .3}px, 0) rotate(${(dx / W()) * 16 * tilt}deg)`;
    const px = Math.min(1, Math.abs(dx) / FAR());
    card.querySelector('.sw-stamp.love').style.opacity = !up && dx > 0 ? px : 0;
    card.querySelector('.sw-stamp.no').style.opacity = !up && dx < 0 ? px : 0;
    card.classList.toggle('peek', up && -dy > 30);
    const u = under(); if (u) { const k = up ? 0 : px; u.style.transform = `scale(${.95 + k * .05})`; u.style.opacity = String(.6 + k * .4); }
    const dd = decide(); if (dd && dd !== crossed && dd !== 'up') buzz(8); crossed = dd;
  };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(paint); };
  const settle = () => {
    card.classList.remove('dragging', 'peek'); card.style.transform = '';
    card.querySelectorAll('.sw-stamp').forEach(x => { x.style.opacity = 0; });
    const u = under(); if (u) { u.style.transform = ''; u.style.opacity = ''; }
    crossed = '';
  };
  card.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, a') || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const r = card.getBoundingClientRect();
    tilt = (e.clientY - r.top) < r.height * .5 ? 1 : -1; // grabbed low? it tips the other way
    dragging = true; ui.busy = true; moved = false; sx = lastX = e.clientX; sy = lastY = e.clientY; lastT = e.timeStamp; dx = dy = vx = vy = 0;
    card.setPointerCapture(e.pointerId);
  });
  card.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    dx = e.clientX - sx; dy = e.clientY - sy;
    if (dy > 0) dy *= .3; // pulling down resists
    const dt = Math.max(1, e.timeStamp - lastT); vx = vx * .5 + ((e.clientX - lastX) / dt) * .5; vy = vy * .5 + ((e.clientY - lastY) / dt) * .5;
    lastX = e.clientX; lastY = e.clientY; lastT = e.timeStamp;
    if (!moved && Math.hypot(dx, dy) > 10) { moved = true; card.classList.add('dragging'); }
    if (moved) { e.preventDefault(); schedule(); }
  });
  const end = (e) => {
    if (!dragging) return; dragging = false; ui.busy = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (!moved) {
      settle();
      const r = photo.getBoundingClientRect();
      if (e.clientY <= r.bottom && pics.length > 1) { const x = (e.clientX - r.left) / r.width; if (x < .35) { pi = (pi - 1 + pics.length) % pics.length; showPic(); return; } if (x > .65) { pi = (pi + 1) % pics.length; showPic(); return; } }
      openProfile(o, onVote); return;
    }
    let dd = decide();
    // a quick flick counts even if it was short
    if (!dd && Math.abs(vx) > .35 && Math.abs(dx) > 28 && Math.abs(vx) > Math.abs(vy)) dd = vx > 0 ? 'love' : 'no';
    if (!dd && vy < -.35 && dy < -28 && -vy > Math.abs(vx)) dd = 'up';
    card.classList.remove('dragging');
    if (dd === 'up') { settle(); openProfile(o, onVote); return; }
    if (dd) { onVote(dd); return; }
    settle(); // springs back with a little bounce
  };
  card.addEventListener('pointerup', end); card.addEventListener('pointercancel', end);
  card._vote = onVote; card._open = () => openProfile(o, onVote);
  return card;
}

/* ---------- The profile: every photo and detail of one option, Bumble style ----------
   Scroll down through it; push sideways (or use the buttons) to decide. */
export function openProfile(o, onVote) {
  const old = document.querySelector('.pf-wrap'); if (old) old.remove();
  const cur = store.find('board_items', o.id) || o; const d = cur.data || {}; const w = wedding(cur.wedding_id); const s = stepOf(cur);
  const pics = (d.images || []).map(x => x.path);
  const v = votesOf(cur); const mine = myVote(cur);
  const cover = pics[0];
  const rest = pics.slice(1);
  const close = () => { wrap.classList.add('out'); document.removeEventListener('keydown', key, true); setTimeout(() => wrap.remove(), 200); };
  const decideNow = (value) => { close(); if (onVote) onVote(value); else quickVote(cur, value, () => render()); };
  const gallery = rest.length ? h('div', { class: 'pf-gal n' + Math.min(rest.length, 4) }, rest.map((p, i) => h('button', { type: 'button', class: 'pf-ph', 'aria-label': `Photo ${i + 2} of ${pics.length}`, onclick: () => lightbox(pics, i + 1) }, img(p, '')))) : null;
  const sheet = h('div', { class: 'pf-sheet' },
    h('div', { class: 'pf-hero', onclick: () => cover && lightbox(pics, 0) }, cover ? img(cover, 'sw-img', d.title || '') : placeholder(cur, 'sw-img'),
      h('div', { class: 'pf-hero-tx' }, h('span', { class: 'pf-cat' }, [s ? s.title : 'Option', w ? w.couple : ''].filter(Boolean).join(' · ')), h('h2', {}, d.title || 'Option'), d.rate ? h('span', { class: 'pf-rate' }, d.rate) : null),
      pics.length > 1 ? h('span', { class: 'pf-count' }, `${pics.length} photos`) : null),
    h('div', { class: 'pf-body' },
      d.notes ? h('p', { class: 'pf-notes' }, d.notes) : null,
      gallery ? h('h3', { class: 'pf-h' }, rest.length === 1 ? 'One more photo' : `${rest.length} more photos`) : null,
      gallery,
      (d.links || []).length ? h('div', { class: 'od-links' }, (d.links || []).map(linkTile)) : null,
      d.phone ? h('div', { class: 'od-phone' }, h('a', { class: 'btn small ghost', href: 'tel:' + d.phone.replace(/[^\d+]/g, '') }, '☏ ' + d.phone), waLink(d.phone) ? waButton({ label: 'Ask them on WhatsApp', phone: d.phone, cls: 'ghost', text: () => vendorMessage(cur, s && s.title) }) : null) : null,
      h('p', { class: 'pf-who' }, v.total ? VOTES.filter(k => v[k].length).map(k => `${{ love: '♥', no: '✕' }[k]} ${v[k].join(', ')}`).join('  ·  ') : 'No votes yet — be the first.'),
      h('p', { class: 'pf-by' }, 'Added by ' + (store.memberName(cur.created_by) || 'someone') + (d.status === 'chosen' ? ' · ✓ Chosen' : d.status === 'not' ? ' · Not chosen' : '')),
      h('div', { class: 'od-acts pf-acts' },
        isDecider(cur.wedding_id) && s && !s.locked_at && isOpen(cur) ? h('button', { type: 'button', class: 'btn', onclick: () => { close(); chooseOption(cur); } }, 'Make it final') : null,
        isOpen(cur) ? waButton({ label: 'Share with the family', text: () => optionMessage(cur, s && s.title) }) : null,
        pics.length ? h('button', { type: 'button', class: 'btn small wa-btn', onclick: () => import('./share.js?v=53').then(m => m.shareOption(cur, s && s.title)) }, h('span', { class: 'wa-ic', html: ICONS.chat }), 'Send the photos') : null,
        h('button', { type: 'button', class: 'btn ghost small', onclick: () => { close(); addPhotosTo(cur); } }, '+ Add photos'),
        h('button', { type: 'button', class: 'btn ghost small', onclick: () => { close(); editOption(w, d.step_id, cur); } }, 'Edit'),
        h('button', { type: 'button', class: 'btn ghost small', onclick: () => { close(); import('./versions.js?v=53').then(m => m.openHistory('option', cur)); } }, '↺ History'),
        pics.length ? h('button', { type: 'button', class: 'btn ghost small', onclick: () => downloadZip(optionPhotos([cur]), d.title || 'Option') }, '⬇ Photos') : null,
        h('button', { type: 'button', class: 'btn ghost small', style: { color: 'var(--warn)' }, onclick: () => { close(); deleteOption(cur); } }, 'Delete'))));
  const bar = h('div', { class: 'pf-bar' },
    h('button', { type: 'button', class: 'sw-btn no' + (mine === 'no' ? ' on' : ''), 'aria-label': 'Not this', html: ICONS.nope, onclick: () => decideNow('no') }),
    h('button', { type: 'button', class: 'pf-close', onclick: close }, 'Back'),
    h('button', { type: 'button', class: 'sw-btn love' + (mine === 'love' ? ' on' : ''), 'aria-label': 'Love it', html: ICONS.heart, onclick: () => decideNow('love') }));
  const wrap = h('div', { class: 'pf-wrap', role: 'dialog', 'aria-label': d.title || 'Option' },
    h('button', { type: 'button', class: 'pf-x', 'aria-label': 'Close', html: ICONS.close, onclick: close }), sheet, bar);
  // Sideways push on the profile decides too; up and down just scroll.
  let sx = 0, sy = 0, dx = 0, on = false, horiz = null;
  sheet.addEventListener('pointerdown', (e) => { if (e.target.closest('a, button.btn, .od-links')) return; on = true; horiz = null; sx = e.clientX; sy = e.clientY; dx = 0; });
  sheet.addEventListener('pointermove', (e) => {
    if (!on) return; const mx = e.clientX - sx, my = e.clientY - sy;
    if (horiz === null && Math.hypot(mx, my) > 10) horiz = Math.abs(mx) > Math.abs(my) * 1.3;
    if (!horiz) return; dx = mx; sheet.style.transform = `translate3d(${dx}px,0,0) rotate(${dx / 40}deg)`; sheet.dataset.lean = dx > 0 ? 'love' : 'no';
  });
  let swallow = false; // a sideways push isn't also a tap on the photo underneath
  const up = () => { if (!on) return; on = false; if (horiz) swallow = true; if (horiz && Math.abs(dx) > 70) { decideNow(dx > 0 ? 'love' : 'no'); return; } sheet.style.transform = ''; delete sheet.dataset.lean; };
  sheet.addEventListener('click', (e) => { if (swallow) { swallow = false; e.stopPropagation(); e.preventDefault(); } }, true);
  sheet.addEventListener('pointerup', up); sheet.addEventListener('pointercancel', up);
  const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } else if (e.key === 'ArrowRight') decideNow('love'); else if (e.key === 'ArrowLeft') decideNow('no'); };
  document.addEventListener('keydown', key, true);
  document.body.append(wrap);
  requestAnimationFrame(() => wrap.classList.add('in'));
}

export function renderSwipe(root, opts = {}) {
  const redraw = () => { if (!root.isConnected) return; root.replaceChildren(); renderSwipe(root, opts); };
  const w = opts.weddingId ? wedding(opts.weddingId) : null;
  const step = opts.stepId ? store.find('steps', opts.stepId) : null;
  const list = pendingFor(w && w.id, step && step.id);
  const all = (w ? optionsOf(w.id, step && step.id) : optionsOf(null)).filter(isOpen);
  const back = step ? `#/w/${step.wedding_id}/options?step=${step.id}` : w ? `#/w/${w.id}/choose` : '#/home';
  const head = h('div', { class: 'sw-head' },
    h('a', { class: 'sw-back', href: back, 'aria-label': 'Back', html: ICONS.back }),
    h('div', {}, h('div', { class: 'eyebrow' }, step ? 'Swipe · ' + (w ? w.couple : '') : w ? 'New for you · ' + w.couple : 'New for you'), h('h1', { class: 'sw-title' }, step ? step.title : 'What do you think?')),
    list.length ? h('span', { class: 'sw-count' }, `${list.length} to go`) : null);
  root.append(head);
  if (!list.length) {
    root.append(h('section', { class: 'sw-done' },
      h('div', { class: 'sw-done-mark', 'aria-hidden': 'true' }, '✓'),
      h('h2', {}, all.length ? 'You’re up to date' : 'Nothing to look at yet'),
      h('p', { class: 'muted' }, all.length ? 'You’ve given your opinion on everything new. The Deciders will choose — you can still change your votes in each category.' : 'When anyone adds options — a photographer, rings, cards, a caterer — they show up here for everyone to swipe.'),
      h('div', { class: 'sw-done-acts' },
        undoStack.length ? h('button', { type: 'button', class: 'btn ghost', onclick: () => { const lv = undoStack.pop(); undoVote(lv.o, redraw); } }, '↶ Undo last') : null,
        w ? h('a', { class: 'btn', href: `#/w/${w.id}/choose` }, 'See all categories') : weddings().map(x => h('a', { class: 'btn ghost', href: `#/w/${x.id}/choose` }, (x.couple || '').split('&')[0].trim() + '’s choices')),
        w ? h('button', { type: 'button', class: 'btn ghost', onclick: () => editOption(w, step && step.id) }, '+ Add an option') : null),
      all.length ? h('div', { class: 'sw-done-wa' }, h('span', { class: 'muted' }, 'Get the others to vote too:'), waButton({ label: 'Ask the family on WhatsApp', small: false, text: () => swipeMessage(w && w.id, all.length) })) : null));
    return;
  }
  const o = list[0];
  let done = false;
  const doVote = (value) => {
    if (done) return; done = true;
    buzz(value === 'love' ? 18 : 10);
    const c = root.querySelector('.sw-card'); if (c) { c.classList.add('fly-' + value); }
    undoStack.push({ o, v: value }); if (undoStack.length > 30) undoStack.shift();
    quickVote(o, value, redraw);
    setTimeout(redraw, 230); // the next card appears while the vote saves
  };
  const stage = h('div', { class: 'sw-stage' },
    list[2] ? h('div', { class: 'sw-under two' }) : null,
    list[1] ? h('div', { class: 'sw-under' }) : null,
    deckCard(o, list.length, doVote));
  root.append(stage,
    h('div', { class: 'sw-actions' },
      h('button', { type: 'button', class: 'sw-btn no', 'aria-label': 'Not this', html: ICONS.nope, onclick: () => doVote('no') }),
      h('button', { type: 'button', class: 'sw-btn undo', 'aria-label': 'Undo the last swipe', title: 'Undo the last swipe', disabled: undoStack.length ? null : true, onclick: () => { const lv = undoStack.pop(); if (lv) undoVote(lv.o, redraw); } }, '↶'),
      h('button', { type: 'button', class: 'sw-btn love', 'aria-label': 'Love it', html: ICONS.heart, onclick: () => doVote('love') })),
    h('p', { class: 'sw-hint' }, 'Push right to love it, left for not this, up to see everything. Tap the photo’s sides for more photos.'));
}
document.addEventListener('keydown', (e) => {
  const c = document.querySelector('.sw-card'); if (!c || document.querySelector('.modal-wrap, .lightbox')) return;
  if (/input|textarea|select/i.test((e.target && e.target.tagName) || '')) return;
  if (document.querySelector('.pf-wrap')) return;
  const map = { ArrowRight: 'love', ArrowLeft: 'no' };
  if (map[e.key] && c._vote) { e.preventDefault(); c._vote(map[e.key]); }
  else if (e.key === 'ArrowUp' && c._open) { e.preventDefault(); c._open(); }
  else if ((e.key === 'Backspace' || e.key === 'z') && undoStack.length) { e.preventDefault(); const b = document.querySelector('.sw-btn.undo'); if (b) b.click(); }
});

/* ---------- "New for you" strip (home and overview) ---------- */
export function newForYou(weddingId) {
  const list = pendingFor(weddingId);
  if (!list.length) return null;
  const href = weddingId ? `#/w/${weddingId}/swipe` : '#/swipe';
  const cats = [...new Set(list.map(o => (stepOf(o) || {}).title).filter(Boolean))];
  return h('a', { class: 'nfy', href },
    h('span', { class: 'nfy-stack' }, list.slice(0, 3).reverse().map((o, i) => h('span', { class: 'nfy-card c' + i }, firstPic(o) ? img(firstPic(o), '') : placeholder(o, 'nfy-ph')))),
    h('span', { class: 'nfy-txt' },
      h('span', { class: 'eyebrow' }, 'New for you'),
      h('b', {}, `${list.length} ${list.length === 1 ? 'thing' : 'things'} to look at`),
      h('span', { class: 'nfy-cats' }, cats.slice(0, 4).join(' · ') + (cats.length > 4 ? ` +${cats.length - 4}` : ''))),
    h('span', { class: 'btn nfy-go' }, 'Start swiping'));
}

/* ---------- Sample options (placeholder pictures) to try swiping ---------- */
export function sampleButton(w) {
  const mine = live(store.rows('board_items')).filter(o => o.wedding_id === w.id && isSample(o));
  if (mine.length) return h('button', { type: 'button', class: 'btn ghost', title: 'Moves the sample options to the Bin', onclick: async () => {
    if (!(await confirmBox('Remove the samples?', `${mine.length} sample options move to the Bin. Real options stay.`, 'Remove samples'))) return;
    await store.batch(() => store.removeMany('board_items', mine.map(o => o.id), new Date().toISOString())).then(() => toast('Samples removed')).catch(fail);
  } }, `Remove samples (${mine.length})`);
  return h('button', { type: 'button', class: 'btn ghost', title: 'Adds example options with pictures so everyone can try swiping', onclick: async () => {
    const steps = live(store.rows('steps')).filter(s => s.wedding_id === w.id && stepVisible(s));
    const rows = sampleRows(w.id, steps, {});
    if (!rows.length) return toast('No matching steps yet — load the checklist first', 'error');
    await store.batch(() => store.insertMany('board_items', rows)).then(() => toast(`${rows.length} sample options added — try swiping`)).catch(fail);
  } }, '+ Sample options to try');
}

/* ---------- Choose: every category of a wedding ---------- */
export function renderChoose(root, w, params = {}) {
  if (params.view === 'glimpse') {
    root.append(h('header', { class: 'ch-head' }, h('h1', { class: 'ed-h ch-title' }, h('span', { class: 'ed-caps' }, 'At a'), ' ', h('span', { class: 'ed-script' }, 'glance'))), chooseTabs(w, 'glimpse'));
    renderGlimpse(root, w); return;
  }
  const ed = document.body.dataset.look === 'ed';
  const nOpen = optionsOf(w.id).filter(isOpen).length;
  root.append(h('header', { class: 'ch-head' },
    h('h1', { class: 'ed-h ch-title' }, h('span', { class: 'ed-caps' }, 'Choose'), ' ', h('span', { class: 'ed-script' }, 'together')),
    h('div', { class: 'ch-acts' },
      h('button', { type: 'button', class: 'btn', onclick: () => editOption(w) }, '+ Add an option'),
      nOpen ? waButton({ label: 'Ask the family to vote', small: false, cls: 'ghost', text: () => swipeMessage(w.id, nOpen) }) : null)));
  root.append(chooseTabs(w, 'vote'), smartBar(w));
  const cats = categoriesOf(w);
  if (!cats.length) { root.append(h('p', { class: 'ed-empty' }, 'No choices yet. Add an option, or mark a step in the plan as “Choose between options”.')); const ib = inboxSection(w); if (ib) root.append(ib); return; }

  // The next thing to vote on, big — love it, not this, or see everything about it.
  const queue = pendingFor(w.id);
  if (queue.length) {
    const o = queue[0], d = o.data || {}, st = stepOf(o), pic = firstPic(o), v = votesOf(o);
    const loves = v.love.filter(n => n !== store.me.name);
    const after = () => { buzz(14); };
    root.append(h('section', { class: 'ch-next', 'aria-label': 'Next to vote on' },
      h('small', { class: 'ch-k' }, `New for you · 1 of ${queue.length}`),
      h('button', { type: 'button', class: 'ch-pic', 'aria-label': 'See everything about ' + (d.title || 'this option'), onclick: () => openProfile(o) },
        pic ? img(pic, 'ch-img', d.title || '', true) : h('span', { class: 'ch-ph', html: ICONS.image })),
      h('div', { class: 'ch-tx' },
        st ? h('small', { class: 'ch-cat' }, st.title) : null,
        h('b', {}, d.title || 'Option'),
        h('span', {}, [d.rate, (d.smart || {}).location].filter(Boolean).join(' · ') || ((d.images || []).length > 1 ? `${d.images.length} photos` : ''))),
      h('div', { class: 'ch-btns' },
        h('button', { type: 'button', class: 'ch-b', 'aria-label': 'Not this', onclick: () => vote(o, 'no').then(after) }, h('span', { html: ICONS.close })),
        h('button', { type: 'button', class: 'ch-b love', 'aria-label': 'Love it', onclick: () => vote(o, 'love').then(after) }, h('span', { html: ICONS.heart })),
        h('button', { type: 'button', class: 'ch-b', 'aria-label': 'See everything about it', onclick: () => openProfile(o) }, h('span', { html: ICONS.back, class: 'up' }))),
      h('p', { class: 'ch-foot' }, loves.length ? `♥ ${loves.slice(0, 2).join(' and ')}${loves.length > 2 ? ` and ${loves.length - 2} more` : ''} love it · ` : '',
        h('a', { href: `#/w/${w.id}/swipe` }, queue.length > 1 ? `Swipe through all ${queue.length} →` : 'Open the swipe view →'))));
  }

  const open = cats.filter(c => !c.step.locked_at && c.n), empty = cats.filter(c => !c.step.locked_at && !c.n), done = cats.filter(c => c.step.locked_at);
  const arch = ({ step, area, n }) => {
    const opts = optionsOf(w.id, step.id);
    const chosen = opts.find(o => (o.data || {}).status === 'chosen');
    const ranked = opts.filter(isOpen).sort((a, b) => votesOf(b).score - votesOf(a).score);
    const lead = ranked[0] && votesOf(ranked[0]).love.length ? ranked[0] : null;
    const show = chosen || lead || opts.find(firstPic);
    const fresh = pendingFor(w.id, step.id).length;
    const p = show && firstPic(show);
    return h('a', { class: 'ed-arch', href: `#/w/${w.id}/options?step=${step.id}` },
      h('span', { class: 'ed-arch-pic' + (p ? '' : ' empty') }, p ? (() => { const el = img(p, ''); el.loading = 'eager'; const off = () => { const box = el.parentNode; if (box && el.isConnected !== false) { box.classList.add('empty'); el.replaceWith(h('span', { class: 'ed-arch-ic', html: areaIcon(area.title + ' ' + step.title) })); } }; el.addEventListener('error', off); if (!/^(https?:|assets\/)/.test(p)) store.url(p, 'small').then(u => { if (!u) setTimeout(off); }); return el; })() : h('span', { class: 'ed-arch-ic', html: areaIcon(area.title + ' ' + step.title) }),
        fresh ? h('span', { class: 'ed-badge' }, `${fresh} new`) : null,
        step.locked_at ? h('span', { class: 'ed-badge done' }, '✓ Final') : null),
      h('b', {}, step.title),
      h('small', {}, step.locked_at ? ((step.lock_note && (step.lock_note.with || step.lock_note.vendor)) || 'Decided') : lead ? `Leading: ${(lead.data || {}).title}` : `${n} ${n === 1 ? 'option' : 'options'}${step.owner ? ' · ' + step.owner.split(/[,&]/)[0].trim() : ''}`));
  };
  if (open.length) root.append(h('section', { class: 'ed-band ch-band' }, h('div', { class: 'ed-band-in' },
    h('h2', { class: 'ed-h' }, h('span', { class: 'ed-caps' }, 'All the'), ' ', h('span', { class: 'ed-script' }, 'choices')),
    h('p', { class: 'ed-band-sub' }, `${open.length} still open · the family votes, the Deciders choose`),
    h('div', { class: 'ed-arches grid' }, open.map(arch)))));
  if (empty.length) root.append(h('section', { class: 'ch-waiting' },
    h('h2', { class: 'ed-h small' }, h('span', { class: 'ed-caps' }, 'Waiting for'), ' ', h('span', { class: 'ed-script' }, 'ideas')),
    h('div', { class: 'ch-chips' }, empty.map(({ step }) => h('button', { type: 'button', class: 'ch-chip', title: 'Add an option for ' + step.title, onclick: () => editOption(w, step.id) }, '+ ' + step.title)))));
  if (done.length) root.append(h('section', { class: 'ch-done' },
    h('h2', { class: 'ed-h small' }, h('span', { class: 'ed-caps' }, 'Already'), ' ', h('span', { class: 'ed-script' }, 'decided')),
    h('div', { class: 'ed-arches small' }, done.map(arch))));
  const inbox = inboxSection(w); if (inbox) root.append(inbox);
  void ed;
}

/* ---------- One category: its options, votes, compare, inspiration ---------- */
const picking = new Set();
// The line under a category's name: when it happens, who is in charge, when it's due — tap to change.
function catMeta(w, step) {
  const st = stageOfStep(step);
  const bits = [st ? st.title : null, step.owner ? 'In charge: ' + step.owner : 'Nobody in charge yet', step.due ? 'Due ' + new Date(step.due + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : null].filter(Boolean);
  return h('div', { class: 'cat-meta' }, bits.map((b, i) => h('span', { class: 'cm-bit' + (i === 1 && !step.owner ? ' none' : '') }, b)),
    h('button', { type: 'button', class: 'link-btn cm-edit', onclick: () => editCategory(w, step) }, 'Change'));
}
export function editCategory(w, step) {
  const cf = categoryFields(w, step.id);
  const title = cf.el.querySelector('input');
  modal({ title: 'This category', body: [cf.el, h('p', { class: 'hint', style: { margin: 0 } }, 'Renaming here renames the step in the plan. Changes show for everyone straight away.')],
    actions: [{ label: 'Cancel', kind: 'ghost', onClick: () => { } }, { label: 'Save', onClick: async () => {
      const newTitle = title.value.replace(/\s+/g, ' ').trim();
      if (!newTitle) { toast('Give the category a name', 'error'); return false; }
      try {
        await store.batch(async () => {
          // A new name for this same category renames the step rather than making another one.
          if (newTitle.toLowerCase() !== step.title.trim().toLowerCase()) {
            if (live(store.rows('steps')).some(x => x.wedding_id === w.id && x.id !== step.id && x.title.trim().toLowerCase() === newTitle.toLowerCase())) throw new Error('Another step already has that name — pick a different one.');
            await store.update('steps', step.id, { title: newTitle });
            title.value = step.title; // so the rest below updates this same step
          }
          await cf.resolve();
        });
        toast('Saved');
      } catch (e) { fail(e); return false; }
    } }] });
}

export function renderOptions(root, w, stepId) {
  const step = store.find('steps', stepId);
  if (!step || step.deleted_at) { root.append(h('p', {}, 'That category was not found. ', h('a', { href: `#/w/${w.id}/choose` }, 'Back to Choose'))); return; }
  const area = store.find('areas', step.area_id);
  const opts = optionsOf(w.id, step.id).sort((a, b) => ((b.data || {}).status === 'chosen') - ((a.data || {}).status === 'chosen') || votesOf(b).score - votesOf(a).score || newestFirst(a, b));
  const fresh = pendingFor(w.id, step.id).length;
  for (const id of [...picking]) if (!opts.some(o => o.id === id)) picking.delete(id);
  root.append(h('div', { class: 'ph-row' },
    h('div', {}, h('a', { class: 'back-link', href: `#/w/${w.id}/choose` }, '‹ Choose'), h('div', { class: 'eyebrow' }, area ? area.title : 'Category'), h('h1', { class: 'page-title' }, step.title),
      step.locked_at ? h('p', { class: 'final-line' }, '✓ Final — ' + ((step.lock_note && (step.lock_note.with || step.lock_note.vendor)) || 'decided')) : null,
      catMeta(w, step)),
    h('div', { class: 'ph-right' },
      fresh ? h('a', { class: 'btn', href: `#/w/${w.id}/swipe?step=${step.id}` }, `Swipe · ${fresh} new`) : null,
      h('button', { type: 'button', class: fresh ? 'btn ghost' : 'btn', onclick: () => editOption(w, step.id) }, '+ Add an option'),
      opts.some(o => ((o.data || {}).images || []).length) ? h('button', { type: 'button', class: 'btn ghost', title: 'Download all the photos in this category as one .zip', onclick: () => downloadZip(optionPhotos(opts), step.title) }, '⬇ Photos') : null,
      opts.length && !fresh && (!step.locked_at || store.me.isAdmin) ? h('button', { type: 'button', class: 'btn ghost', onclick: () => swipeAgain(w, step) }, step.locked_at ? '↻ New round' : '↻ Swipe again') : null,
      opts.length >= 2 ? h('button', { type: 'button', class: 'btn ghost', onclick: () => { const sel = opts.filter(o => picking.has(o.id)); openCompare(sel.length >= 2 ? sel : opts.filter(isOpen).slice(0, 3)); } }, picking.size >= 2 ? `Compare ${picking.size}` : 'Compare the top 3') : null)));
  { const fb = finalBlock(w, step); if (fb) root.append(fb); }
  if (!opts.length) root.append(h('div', { class: 'opt-empty' }, h('p', {}, 'No options yet. Add the photographers, shops or designs you’re considering — with their photos, Instagram links, price and phone.'), h('button', { type: 'button', class: 'btn', onclick: () => editOption(w, step.id) }, '+ Add the first option')));
  else root.append(h('section', { class: 'opt-grid' }, opts.map(o => {
    const d = o.data || {}; const v = votesOf(o); const mine = myVote(o); const pics = (d.images || []).length;
    const max = Math.max(1, v.total);
    return h('article', { class: 'opt-card' + (d.status === 'chosen' ? ' chosen' : d.status === 'not' ? ' not' : '') },
      h('button', { type: 'button', class: 'oc-pic', onclick: () => openOption(o), 'aria-label': 'Open ' + (d.title || 'option') }, firstPic(o) ? img(firstPic(o), '') : placeholder(o, 'oc-ph'), pics > 1 ? h('span', { class: 'oc-n' }, `${pics} photos`) : null, d.status === 'chosen' ? h('span', { class: 'oc-chosen' }, '✓ Chosen') : null),
      h('div', { class: 'oc-body' },
        h('button', { type: 'button', class: 'oc-del', 'aria-label': 'Delete ' + (d.title || 'this option'), title: 'Delete', html: ICONS.trash, onclick: () => deleteOption(o) }),
        h('label', { class: 'oc-pick', title: 'Pick to compare' }, h('input', { type: 'checkbox', checked: picking.has(o.id) ? true : null, onchange: (e) => { if (e.target.checked) picking.add(o.id); else picking.delete(o.id); render(); } }), 'Compare'),
        h('b', { class: 'oc-t' }, d.title || 'Option'),
        d.rate ? h('span', { class: 'oc-rate' }, d.rate) : null,
        h('div', { class: 'oc-bar', role: 'img', 'aria-label': `${v.love.length} love it, ${v.no.length} not this` },
          h('span', { class: 'love', style: { width: (v.love.length / max * 100) + '%' } }), h('span', { class: 'no', style: { width: (v.no.length / max * 100) + '%' } })),
        h('span', { class: 'oc-who', title: VOTES.filter(k => v[k].length).map(k => `${k}: ${v[k].join(', ')}`).join(' · ') }, v.total ? `♥ ${v.love.length} · ✕ ${v.no.length}${v.love.length ? ' — ' + v.love.slice(0, 3).join(', ') : ''}` : 'No votes yet'),
        h('div', { class: 'oc-acts' },
          VOTES.map(k => h('button', { type: 'button', class: 'mini-vote ' + k + (mine === k ? ' on' : ''), 'aria-label': { love: 'Love it', no: 'Not this' }[k], 'aria-pressed': mine === k ? 'true' : 'false', html: { love: ICONS.heart, no: ICONS.nope }[k], onclick: () => vote(o, k).catch(fail) })),
          isDecider(w.id) && isOpen(o) && !step.locked_at ? h('button', { type: 'button', class: 'btn small', onclick: () => chooseOption(o) }, 'Make it final') : null)));
  })));
  // Inspiration: mood-board cards pinned to this step.
  const insp = live(store.rows('board_items')).filter(i => i.wedding_id === w.id && !isOption(i) && (i.data || {}).step_id === step.id);
  root.append(h('section', { class: 'insp' },
    h('div', { class: 'insp-h' }, h('h2', {}, 'Inspiration'), h('a', { class: 'link-btn', href: `#/w/${w.id}/board` }, 'Open the mood board →')),
    insp.length ? h('div', { class: 'insp-row' }, insp.map(i => { const d = i.data || {}; const p = d.path || (d.images && d.images[0] && d.images[0].path) || d.thumb || (d.preview && d.preview.image);
      return h('a', { class: 'insp-card', href: `#/w/${w.id}/board?focus=${i.id}` }, p ? img(p, '') : h('span', { class: 'insp-ph' }, (d.title || d.text || i.kind).slice(0, 40))); }))
      : h('p', { class: 'muted', style: { margin: 0 } }, 'Ideas and looks you like, before you’re choosing between real vendors. Pin a mood-board card to this step and it shows here.')));
}
