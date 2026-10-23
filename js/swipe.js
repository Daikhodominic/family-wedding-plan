// Options to choose between, swiped like cards.
// An option is a board item of kind 'option' (data: step_id, title, rate, notes, phone, links[], images[], status).
// Votes are reactions with target 'swipe' and value love | maybe | no — open to everyone.
import { store } from './store.js?v=43';
import { h, toast, modal, field, ICONS, compressImage, confirmBox, hostOf, safeUrl, buzz } from './ui.js?v=43';
import { live, wedding, weddings, themeOf, stepVisible, render, ui } from './app.js?v=43';
import { isDecider } from './tools.js?v=43';
import { addVendor } from './decisions.js?v=43';
import { pickFiles, fetchPreview } from './board.js?v=43';
import { planOf } from './map.js?v=43';
import { waButton, optionMessage, swipeMessage, vendorMessage } from './nudge.js?v=43';
import { sampleRows, isSample } from './samples.js?v=43';

const VOTES = ['love', 'maybe', 'no'];
const fail = (e) => { console.error(e); const m = (e && e.message) || ''; toast(/kind_check/.test(m) ? 'Options need database update 12 — run it in Supabase, then try again.' : (m || 'That did not save. Check your connection.'), 'error'); };
const byPos = (a, b) => (a.position || 0) - (b.position || 0);

/* ---------- Data ---------- */
export const isOption = (i) => i && i.kind === 'option';
export const optionsOf = (wid, stepId) => live(store.rows('board_items')).filter(i => isOption(i) && (!wid || i.wedding_id === wid) && (!stepId || (i.data || {}).step_id === stepId));
const reactions = (o) => (store.rows('reactions') || []).filter(r => r.item_id === o.id && r.target === 'swipe');
export function votesOf(o) {
  const v = { love: [], maybe: [], no: [] };
  for (const r of reactions(o)) if (v[r.value]) v[r.value].push(r.user_name || store.memberName(r.created_by) || 'Someone');
  v.score = v.love.length * 2 + v.maybe.length - v.no.length;
  v.total = v.love.length + v.maybe.length + v.no.length;
  return v;
}
// Votes show at once; saving happens in the background (pendingVotes holds them until it's done).
const pendingVotes = new Map();
export const myVote = (o) => { if (pendingVotes.has(o.id)) return pendingVotes.get(o.id); const r = reactions(o).find(x => x.created_by === store.me.id); return r ? r.value : null; };
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
export function categoriesOf(w) {
  const plan = planOf(w); const out = [];
  for (const st of plan.stages) for (const a of st.areas) for (const s of a.steps) {
    const n = optionsOf(w.id, s.id).length;
    if (s.gate || n) out.push({ step: s, area: a, stage: st, n });
  }
  return out;
}

/* ---------- Pictures ---------- */
function img(path, cls, alt = '') {
  const el = h('img', { class: cls, alt, loading: 'lazy', referrerpolicy: 'no-referrer', draggable: 'false' });
  if (/^https?:/.test(path || '')) el.src = path; else if (path) store.url(path).then(u => { if (u) el.src = u; });
  return el;
}
const firstPic = (o) => { const d = o.data || {}; return (d.images && d.images[0] && d.images[0].path) || null; };
const initials = (t) => (t || '?').split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase();
function placeholder(o, cls) { return h('div', { class: cls + ' ph' }, h('span', {}, initials((o.data || {}).title))); }

// Full-screen photo viewer with next / previous.
export function lightbox(paths, start = 0) {
  if (!paths.length) return;
  let i = start;
  const pic = h('div', { class: 'lb-pic' });
  const count = h('span', { class: 'lb-count' });
  const show = () => { pic.replaceChildren(img(paths[i], 'lb-img')); count.textContent = `${i + 1} / ${paths.length}`; };
  const wrap = h('div', { class: 'lightbox', role: 'dialog', 'aria-label': 'Photos', tabindex: '-1' },
    h('button', { type: 'button', class: 'lb-x', 'aria-label': 'Close', html: ICONS.close, onclick: () => close() }),
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
const linkLabel = (u) => { const host = hostOf(u); if (/instagram\.com/.test(host)) return 'Instagram'; if (/facebook\.com|fb\.com/.test(host)) return 'Facebook'; if (/youtube\.com|youtu\.be/.test(host)) return 'YouTube'; if (/maps\.|goo\.gl/.test(host)) return 'Map'; if (/wa\.me|whatsapp/.test(host)) return 'WhatsApp'; return host || 'Link'; };
function linkTile(u) {
  const safe = safeUrl(u); if (!safe) return null;
  const pic = h('span', { class: 'lt-pic' }, linkLabel(u).slice(0, 1));
  const title = h('span', { class: 'lt-t' }, linkLabel(u));
  const sub = h('span', { class: 'lt-s' }, u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60));
  fetchPreview(safe).then(p => { if (!p) return; if (p.image) pic.replaceChildren(img(p.image, 'lt-img')); if (p.title) title.textContent = p.title.slice(0, 70); });
  return h('a', { class: 'link-tile', href: safe, target: '_blank', rel: 'noopener' }, pic, h('span', { class: 'lt-txt' }, title, sub));
}
const waLink = (phone) => { const d = String(phone || '').replace(/[^\d]/g, ''); return d ? 'https://wa.me/' + (d.length === 10 ? '91' + d : d) : null; };

/* ---------- One option, in full ---------- */
export function openOption(o) {
  const w = wedding(o.wedding_id); const d = o.data || {}; const s = stepOf(o);
  const draw = () => {
    const cur = store.find('board_items', o.id); if (!cur || cur.deleted_at) return [h('p', {}, 'This option was removed.')];
    const dd = cur.data || {}; const v = votesOf(cur); const mine = myVote(cur);
    const pics = (dd.images || []).map(x => x.path);
    const can = isDecider(cur.wedding_id) && s && !s.locked_at && isOpen(cur);
    return [
      pics.length ? h('div', { class: 'od-gallery' }, pics.map((p, i) => h('button', { type: 'button', class: 'od-ph', onclick: () => lightbox(pics, i), 'aria-label': `Photo ${i + 1} of ${pics.length}` }, img(p, '')))) : null,
      h('div', { class: 'od-info' },
        h('div', { class: 'od-cat' }, [s ? s.title : 'Option', w ? w.couple : ''].filter(Boolean).join(' · ')),
        dd.rate ? h('div', { class: 'od-rate' }, dd.rate) : null,
        dd.notes ? h('p', { class: 'od-notes' }, dd.notes) : null,
        dd.phone ? h('div', { class: 'od-phone' }, h('a', { class: 'btn small ghost', href: 'tel:' + dd.phone.replace(/[^\d+]/g, '') }, '☏ ' + dd.phone), waLink(dd.phone) ? waButton({ label: 'Ask them on WhatsApp', phone: dd.phone, cls: 'ghost', text: () => vendorMessage(cur, s && s.title) }) : null) : null,
        (dd.links || []).length ? h('div', { class: 'od-links' }, (dd.links || []).map(linkTile)) : null,
        h('div', { class: 'od-votes' },
          VOTES.map(k => h('button', { type: 'button', class: 'vote-btn ' + k + (mine === k ? ' on' : ''), onclick: () => vote(cur, k).catch(fail) }, h('span', { class: 'vb-ic', html: { love: ICONS.heart, maybe: ICONS.maybe, no: ICONS.nope }[k] }), { love: 'Love it', maybe: 'Maybe', no: 'Not this' }[k], h('b', {}, String(v[k].length))))),
        v.total ? h('p', { class: 'od-who' }, VOTES.filter(k => v[k].length).map(k => `${{ love: '♥', maybe: '?', no: '✕' }[k]} ${v[k].join(', ')}`).join('  ·  ')) : h('p', { class: 'od-who' }, 'No votes yet.'),
        h('p', { class: 'od-by' }, 'Added by ' + (store.memberName(cur.created_by) || 'someone') + (dd.status === 'chosen' ? ' · ✓ Chosen' : dd.status === 'not' ? ' · Not chosen' : '')),
        h('div', { class: 'od-acts' },
          can ? h('button', { type: 'button', class: 'btn', onclick: () => { closeAll(); chooseOption(cur); } }, 'Choose this — make it final') : null,
          isOpen(cur) ? waButton({ label: 'Share with the family', text: () => optionMessage(cur, s && s.title) }) : null,
          h('button', { type: 'button', class: 'btn ghost small', onclick: () => addPhotosTo(cur) }, '+ Add photos'),
          h('button', { type: 'button', class: 'btn ghost small', onclick: () => { closeAll(); editOption(w, dd.step_id, cur); } }, 'Edit'),
          (cur.created_by === store.me.id || store.me.isAdmin) ? h('button', { type: 'button', class: 'btn ghost small', style: { color: 'var(--warn)' }, onclick: () => { closeAll(); store.remove('board_items', cur.id).then(() => toast('Moved to the Bin')).catch(fail); } }, 'Remove') : null))];
  };
  const body = h('div', { class: 'opt-detail' }, draw());
  const off = store.onChange(() => body.replaceChildren(...draw()));
  modal({ title: d.title || 'Option', wide: true, body, onClose: off });
}
const closeAll = () => document.querySelectorAll('.modal-wrap').forEach(m => m.remove());

// Add more photos to a vendor straight from its card (pick many at once from the phone's gallery).
async function addPhotosTo(o) {
  const files = await pickFiles('image/*', true); if (!files.length) return;
  toast(`Adding ${files.length} ${files.length === 1 ? 'photo' : 'photos'}…`);
  const added = [];
  for (const f of files) { try { const blob = await compressImage(f); added.push({ path: await store.uploadBlob(blob, 'jpg') }); } catch (e) { fail(e); } }
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
  const who = h('input', { list: 'cf-people-' + n, placeholder: 'Who is handling it', maxlength: 80, autocomplete: 'off', value: cur ? cur.owner || '' : '' });
  const due = h('input', { type: 'date', value: cur && cur.due ? cur.due : '' });
  const note = h('p', { class: 'hint cf-note', style: { margin: '-4px 0 0' } });
  const areaField = field('Part of the plan', area);
  let matched = cur, startStage = cur ? stageOfStep(cur) : null;
  const fillAreas = () => {
    const as = areasIn(when.value);
    const keep = matched && store.find('areas', matched.area_id);
    area.replaceChildren(...as.map(a => h('option', { value: a.id, selected: keep && keep.id === a.id ? true : null }, a.title)), h('option', { value: '__new', selected: !as.length || (!keep && !as.some(a => /^choices$/i.test(a.title))) ? true : null }, '+ A new part called “Choices”'));
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
    note.textContent = !t ? '' : m ? (moving ? `It moves to ${st ? st.title : 'that part'} in the plan.` : `In the plan under ${st ? st.title : '—'}${store.find('areas', m.area_id) ? ' · ' + store.find('areas', m.area_id).title : ''}.`) : `New category — it is added to the plan under ${st ? st.title : 'Before'}.`;
  };
  cat.addEventListener('input', () => sync(true)); cat.addEventListener('change', () => sync(true));
  when.addEventListener('change', () => sync(false));
  if (cur) { const st = stageOfStep(cur); if (st) when.value = st.id; }
  sync(false);
  const el = h('div', { class: 'cf' },
    field('Category', cat), note,
    h('div', { class: 'cf-row' }, field('When', when), field('In charge', who), field('Due by', due)),
    areaField,
    h('datalist', { id: 'cf-cats-' + n }, steps.map(x => h('option', { value: x.title }))),
    h('datalist', { id: 'cf-people-' + n }, peopleNames().map(x => h('option', { value: x }))));
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
  return { el, resolve, focus: () => cat.focus() };
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
export function editOption(w, stepId, item) {
  const d = { links: [], images: [], ...((item && item.data) || {}) };
  const cf = categoryFields(w, stepId || d.step_id);
  const name = h('input', { value: d.title || '', placeholder: 'e.g. Lens & Light Studio', maxlength: 120 });
  const rate = h('input', { value: d.rate || '', placeholder: 'e.g. ₹85,000 · church + reception', maxlength: 160 });
  const notes = h('textarea', { placeholder: 'Who they are, their style, what’s included…' }, d.notes || '');
  const phone = h('input', { value: d.phone || '', placeholder: 'Phone or WhatsApp number', inputmode: 'tel', maxlength: 40 });
  const links = h('textarea', { placeholder: 'One link per line — Instagram, website, Facebook, Google Maps…', rows: 3 }, (d.links || []).join('\n'));
  let images = [...(d.images || [])];
  const thumbs = h('div', { class: 'oe-thumbs' });
  const status = h('span', { class: 'hint', style: { margin: 0 } });
  const drawThumbs = () => thumbs.replaceChildren(...images.map((x, i) => h('span', { class: 'oe-th' }, img(x.path, ''),
    h('button', { type: 'button', class: 'oe-x', 'aria-label': 'Remove this photo', onclick: () => { images.splice(i, 1); drawThumbs(); } }, '×'))),
    h('button', { type: 'button', class: 'oe-add', onclick: () => addPhotos() }, '+ Photos'));
  const addPhotos = async (files) => {
    files = files || await pickFiles('image/*', true);
    if (!files.length) return;
    status.textContent = `Adding ${files.length} ${files.length === 1 ? 'photo' : 'photos'}…`;
    for (const f of files) {
      try { const blob = await compressImage(f); const path = await store.uploadBlob(blob, 'jpg'); images.push({ path }); drawThumbs(); }
      catch (e) { fail(e); }
    }
    status.textContent = images.length ? `${images.length} ${images.length === 1 ? 'photo' : 'photos'}` : '';
  };
  drawThumbs();
  const body = h('div', { class: 'oe-form' },
    cf.el, field('Name', name), field('Price or quote', rate),
    h('div', { class: 'field' }, h('label', {}, 'Photos — their work, samples, price lists, screenshots'), thumbs, status),
    field('Links', links, 'Instagram posts often don’t preview — add screenshots of their best work too.'),
    field('About them', notes), field('Phone', phone));
  body.addEventListener('paste', (e) => { const fs = [...(e.clipboardData && e.clipboardData.files || [])].filter(f => f.type.startsWith('image/')); if (fs.length) { e.preventDefault(); addPhotos(fs); } });
  body.addEventListener('dragover', (e) => e.preventDefault());
  body.addEventListener('drop', (e) => { const fs = [...(e.dataTransfer && e.dataTransfer.files || [])].filter(f => f.type.startsWith('image/')); if (fs.length) { e.preventDefault(); addPhotos(fs); } });
  modal({
    title: item ? 'Edit option' : 'Add an option', wide: true, body,
    actions: [{ label: 'Cancel', kind: 'ghost', onClick: () => { } }, {
      label: item ? 'Save' : 'Add option', onClick: async () => {
        if (!name.value.trim() && !images.length) { toast('Give it a name or a photo', 'error'); name.focus(); return false; }
        let sid; try { sid = await store.batch(() => cf.resolve()); } catch (e) { fail(e); return false; }
        if (!sid) return false;
        const data = { ...d, step_id: sid, title: name.value.trim(), rate: rate.value.trim(), notes: notes.value.trim(), phone: phone.value.trim(),
          links: links.value.split(/\s*\n\s*/).map(x => x.trim()).filter(Boolean), images, status: d.status || 'open' };
        try {
          if (item) await store.update('board_items', item.id, { data });
          else await store.insert('board_items', { wedding_id: w.id, kind: 'option', x: 0, y: 0, w: 280, z: 1, data });
          toast(item ? 'Saved' : 'Added — the family will see it in New for you');
        } catch (e) { fail(e); return false; }
      }
    }]
  });
}

/* ---------- Choosing (Deciders) ---------- */
export async function chooseOption(o) {
  if (!isDecider(o.wedding_id)) { toast('Only this wedding’s Deciders can make a choice final', 'error'); return; }
  const s = stepOf(o); const d = o.data || {};
  if (!s) { toast('This option isn’t in a category', 'error'); return; }
  if (!(await confirmBox(`Choose “${d.title || 'this option'}” for ${s.title}?`, 'The step becomes final, the other options are marked “not chosen” (they stay visible), and it’s added to the vendor list.', 'Choose it', ''))) return;
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
      h('div', { class: 'cmp-votes' }, `♥ ${v.love.length} · ? ${v.maybe.length} · ✕ ${v.no.length}`),
      d.notes ? h('p', { class: 'cmp-notes' }, d.notes) : h('p', { class: 'cmp-notes muted' }, 'No details yet.'),
      (d.links || []).length ? h('div', { class: 'cmp-links' }, (d.links || []).map(u => safeUrl(u) ? h('a', { href: safeUrl(u), target: '_blank', rel: 'noopener', class: 'chip-link' }, linkLabel(u)) : null)) : null,
      d.phone ? h('a', { class: 'cmp-phone', href: 'tel:' + d.phone.replace(/[^\d+]/g, '') }, '☏ ' + d.phone) : null,
      h('div', { class: 'cmp-acts' },
        h('button', { type: 'button', class: 'btn small ghost', onclick: () => openOption(o) }, 'See everything'),
        isDecider(o.wedding_id) && isOpen(o) ? h('button', { type: 'button', class: 'btn small', onclick: () => { closeAll(); chooseOption(o); } }, 'Choose this') : null));
  });
  modal({ title: 'Compare', wide: true, body: h('div', { class: 'cmp-grid n' + list.length }, cols) });
}

/* ---------- The swipe deck ---------- */
let lastVote = null;
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
      h('span', { class: 'sw-stamp love' }, 'LOVE IT'), h('span', { class: 'sw-stamp no' }, 'NOT THIS'), h('span', { class: 'sw-stamp maybe' }, 'MAYBE')),
    h('div', { class: 'sw-body' },
      h('h2', {}, d.title || 'Option'),
      d.notes ? h('p', { class: 'sw-notes' }, d.notes) : null,
      h('div', { class: 'sw-meta' },
        (d.links || []).slice(0, 3).map(u => h('span', { class: 'chip-link' }, linkLabel(u))),
        pics.length > 1 ? h('span', { class: 'chip-link' }, `${pics.length} photos`) : null,
        v.total ? h('span', { class: 'sw-sofar' }, `♥ ${v.love.length} · ? ${v.maybe.length} · ✕ ${v.no.length} so far`) : null),
      h('button', { type: 'button', class: 'link-btn sw-more', onclick: (e) => { e.stopPropagation(); openOption(o); } }, 'See everything — photos, links, bio →')));
  // Swiping, the way Tinder does it: the card stays glued to the finger, tilts from where
  // you grabbed it, and the stamp fades in as you go. Sideways = love it / not this, up = maybe.
  // Past the line (or a quick flick) it flies off; let go early and it springs back.
  // Tap the left or right of the photo to see the vendor's other photos.
  const W = () => card.offsetWidth || 340;
  let sx = 0, sy = 0, dx = 0, dy = 0, dragging = false, moved = false, raf = 0, lastX = 0, lastY = 0, lastT = 0, vx = 0, vy = 0, tilt = 1, crossed = '';
  const under = () => card.parentElement && card.parentElement.querySelector('.sw-under:not(.two)');
  const decide = () => {
    const far = W() * .38;
    if (-dy > Math.abs(dx) * 1.1 && -dy > 120) return 'maybe';
    if (Math.abs(dx) > far) return dx > 0 ? 'love' : 'no';
    return '';
  };
  const paint = () => {
    raf = 0;
    card.style.transform = `translate3d(${dx}px, ${dy}px, 0) rotate(${(dx / W()) * 18 * tilt}deg)`;
    const px = Math.min(1, Math.abs(dx) / (W() * .38)), py = Math.min(1, Math.max(0, -dy) / 120);
    const up = -dy > Math.abs(dx) * 1.1;
    card.querySelector('.sw-stamp.love').style.opacity = !up && dx > 0 ? px : 0;
    card.querySelector('.sw-stamp.no').style.opacity = !up && dx < 0 ? px : 0;
    card.querySelector('.sw-stamp.maybe').style.opacity = up ? py : 0;
    const u = under(); if (u) { const k = Math.max(px, up ? py : 0); u.style.transform = `scale(${.95 + k * .05})`; u.style.opacity = String(.6 + k * .4); }
    const d = decide(); if (d && d !== crossed) buzz(8); crossed = d;
  };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(paint); };
  const settle = () => {
    card.classList.remove('dragging'); card.style.transform = '';
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
    if (dy > 0) dy *= .35; // pulling down resists
    const dt = Math.max(1, e.timeStamp - lastT); vx = vx * .5 + ((e.clientX - lastX) / dt) * .5; vy = vy * .5 + ((e.clientY - lastY) / dt) * .5;
    lastX = e.clientX; lastY = e.clientY; lastT = e.timeStamp;
    if (!moved && Math.hypot(dx, dy) > 8) { moved = true; card.classList.add('dragging'); }
    if (moved) { e.preventDefault(); schedule(); }
  });
  const end = (e) => {
    if (!dragging) return; dragging = false; ui.busy = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (!moved) {
      settle();
      const r = photo.getBoundingClientRect();
      if (e.clientY <= r.bottom && pics.length > 1) { const x = (e.clientX - r.left) / r.width; if (x < .35) { pi = (pi - 1 + pics.length) % pics.length; showPic(); return; } if (x > .65) { pi = (pi + 1) % pics.length; showPic(); return; } }
      openOption(o); return;
    }
    let d = decide();
    const flick = .9;
    if (!d && Math.abs(vx) > flick && Math.abs(dx) > 60 && Math.abs(vx) > Math.abs(vy)) d = vx > 0 ? 'love' : 'no';
    if (!d && vy < -flick && dy < -60 && -vy > Math.abs(vx)) d = 'maybe';
    card.classList.remove('dragging');
    if (d) { onVote(d); return; }
    settle(); // springs back with a little bounce
  };
  card.addEventListener('pointerup', end); card.addEventListener('pointercancel', end);
  card._vote = onVote;
  return card;
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
        lastVote ? h('button', { type: 'button', class: 'btn ghost', onclick: () => { const lv = lastVote; lastVote = null; undoVote(lv.o, redraw); } }, '↶ Undo last') : null,
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
    lastVote = { o, v: value };
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
      h('button', { type: 'button', class: 'sw-btn maybe', 'aria-label': 'Maybe', html: ICONS.maybe, onclick: () => doVote('maybe') }),
      h('button', { type: 'button', class: 'sw-btn love', 'aria-label': 'Love it', html: ICONS.heart, onclick: () => doVote('love') })),
    h('p', { class: 'sw-hint' }, 'Swipe right to love it, left for not this, up for maybe — or use ← ↑ →. Tap the photo’s sides to see more photos.',
      lastVote ? h('button', { type: 'button', class: 'link-btn', style: { marginLeft: '8px' }, onclick: () => { const lv = lastVote; lastVote = null; undoVote(lv.o, redraw); } }, '↶ Undo') : null));
}
document.addEventListener('keydown', (e) => {
  const c = document.querySelector('.sw-card'); if (!c || document.querySelector('.modal-wrap, .lightbox')) return;
  if (/input|textarea|select/i.test((e.target && e.target.tagName) || '')) return;
  const map = { ArrowRight: 'love', ArrowLeft: 'no', ArrowUp: 'maybe' };
  if (map[e.key] && c._vote) { e.preventDefault(); c._vote(map[e.key]); }
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
function sampleButton(w) {
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
export function renderChoose(root, w) {
  root.append(h('div', { class: 'ph-row' },
    h('div', {}, h('h1', { class: 'page-title' }, 'Choose'), h('p', { class: 'ph-sub' }, 'Everything waiting to be chosen, and what the family thinks.')),
    h('div', { class: 'ph-right' },
      h('button', { type: 'button', class: 'btn', onclick: () => editOption(w) }, '+ Add an option'),
      (() => { const n = optionsOf(w.id).filter(isOpen).length; return n ? waButton({ label: 'Ask the family to vote', small: false, cls: 'ghost', text: () => swipeMessage(w.id, n) }) : null; })(),
      h('a', { class: 'btn ghost', href: `#/w/${w.id}/board` }, 'Mood board'),
      store.me.isAdmin ? sampleButton(w) : null)));
  const nfy = newForYou(w.id); if (nfy) root.append(nfy);
  const cats = categoriesOf(w);
  if (!cats.length) { root.append(h('p', { class: 'muted' }, 'No categories yet. Mark a step in the plan as a big decision, or add an option to any step.')); return; }
  const tile = ({ step, area, stage, n }) => {
    const opts = optionsOf(w.id, step.id);
    const chosen = opts.find(o => (o.data || {}).status === 'chosen');
    const ranked = opts.filter(isOpen).sort((a, b) => votesOf(b).score - votesOf(a).score);
    const lead = ranked[0] && votesOf(ranked[0]).total ? ranked[0] : null;
    const fresh = pendingFor(w.id, step.id).length;
    const show = chosen || lead || opts[0];
    return h('a', { class: 'cat-tile' + (step.locked_at ? ' final' : '') + (!n ? ' empty' : ''), href: `#/w/${w.id}/options?step=${step.id}` },
      h('span', { class: 'ct-pic' }, show && firstPic(show) ? img(firstPic(show), '') : h('span', { class: 'ct-ph' }, step.locked_at ? '✓' : n ? initials(step.title) : '+')),
      fresh ? h('span', { class: 'ct-new' }, `${fresh} new`) : null,
      h('span', { class: 'ct-body' },
        h('span', { class: 'ct-area' }, [stage && stage.title, area.title].filter(Boolean).join(' · ')),
        h('b', {}, step.title),
        step.owner ? h('span', { class: 'ct-who' }, 'In charge: ' + step.owner) : null,
        h('span', { class: 'ct-sub' }, step.locked_at ? '✓ ' + ((step.lock_note && (step.lock_note.with || step.lock_note.vendor)) || 'Final') : n ? `${n} ${n === 1 ? 'option' : 'options'}${lead ? ' · leading: ' + (lead.data || {}).title : ''}` : 'No options yet — add one')));
  };
  const open = cats.filter(c => !c.step.locked_at && c.n), empty = cats.filter(c => !c.step.locked_at && !c.n), done = cats.filter(c => c.step.locked_at);
  if (open.length) root.append(h('section', { class: 'cat-grid' }, open.map(tile)));
  if (empty.length) root.append(h('section', { class: 'cat-empty' },
    h('h2', { class: 'cat-h' }, 'Still needs options'),
    h('div', { class: 'cat-chips' }, empty.map(({ step }) => h('button', { type: 'button', class: 'lchip', title: 'Add an option for ' + step.title, onclick: () => editOption(w, step.id) }, '+ ' + step.title)))));
  if (done.length) root.append(h('h2', { class: 'cat-h' }, `Decided · ${done.length}`), h('section', { class: 'cat-grid' }, done.map(tile)));
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
      opts.length >= 2 ? h('button', { type: 'button', class: 'btn ghost', onclick: () => { const sel = opts.filter(o => picking.has(o.id)); openCompare(sel.length >= 2 ? sel : opts.filter(isOpen).slice(0, 3)); } }, picking.size >= 2 ? `Compare ${picking.size}` : 'Compare the top 3') : null)));
  if (!opts.length) root.append(h('div', { class: 'opt-empty' }, h('p', {}, 'No options yet. Add the photographers, shops or designs you’re considering — with their photos, Instagram links, price and phone.'), h('button', { type: 'button', class: 'btn', onclick: () => editOption(w, step.id) }, '+ Add the first option')));
  else root.append(h('section', { class: 'opt-grid' }, opts.map(o => {
    const d = o.data || {}; const v = votesOf(o); const mine = myVote(o); const pics = (d.images || []).length;
    const max = Math.max(1, v.total);
    return h('article', { class: 'opt-card' + (d.status === 'chosen' ? ' chosen' : d.status === 'not' ? ' not' : '') },
      h('button', { type: 'button', class: 'oc-pic', onclick: () => openOption(o), 'aria-label': 'Open ' + (d.title || 'option') }, firstPic(o) ? img(firstPic(o), '') : placeholder(o, 'oc-ph'), pics > 1 ? h('span', { class: 'oc-n' }, `${pics} photos`) : null, d.status === 'chosen' ? h('span', { class: 'oc-chosen' }, '✓ Chosen') : null),
      h('div', { class: 'oc-body' },
        h('label', { class: 'oc-pick', title: 'Pick to compare' }, h('input', { type: 'checkbox', checked: picking.has(o.id) ? true : null, onchange: (e) => { if (e.target.checked) picking.add(o.id); else picking.delete(o.id); render(); } }), 'Compare'),
        h('b', { class: 'oc-t' }, d.title || 'Option'),
        d.rate ? h('span', { class: 'oc-rate' }, d.rate) : null,
        h('div', { class: 'oc-bar', role: 'img', 'aria-label': `${v.love.length} love it, ${v.maybe.length} maybe, ${v.no.length} not this` },
          h('span', { class: 'love', style: { width: (v.love.length / max * 100) + '%' } }), h('span', { class: 'maybe', style: { width: (v.maybe.length / max * 100) + '%' } }), h('span', { class: 'no', style: { width: (v.no.length / max * 100) + '%' } })),
        h('span', { class: 'oc-who', title: VOTES.filter(k => v[k].length).map(k => `${k}: ${v[k].join(', ')}`).join(' · ') }, v.total ? `♥ ${v.love.length} · ? ${v.maybe.length} · ✕ ${v.no.length}${v.love.length ? ' — ' + v.love.slice(0, 3).join(', ') : ''}` : 'No votes yet'),
        h('div', { class: 'oc-acts' },
          VOTES.map(k => h('button', { type: 'button', class: 'mini-vote ' + k + (mine === k ? ' on' : ''), 'aria-label': { love: 'Love it', maybe: 'Maybe', no: 'Not this' }[k], 'aria-pressed': mine === k ? 'true' : 'false', html: { love: ICONS.heart, maybe: ICONS.maybe, no: ICONS.nope }[k], onclick: () => vote(o, k).catch(fail) })),
          isDecider(w.id) && isOpen(o) && !step.locked_at ? h('button', { type: 'button', class: 'btn small', onclick: () => chooseOption(o) }, 'Choose') : null)));
  })));
  // Inspiration: mood-board cards pinned to this step.
  const insp = live(store.rows('board_items')).filter(i => i.wedding_id === w.id && !isOption(i) && (i.data || {}).step_id === step.id);
  root.append(h('section', { class: 'insp' },
    h('div', { class: 'insp-h' }, h('h2', {}, 'Inspiration'), h('a', { class: 'link-btn', href: `#/w/${w.id}/board` }, 'Open the mood board →')),
    insp.length ? h('div', { class: 'insp-row' }, insp.map(i => { const d = i.data || {}; const p = d.path || (d.images && d.images[0] && d.images[0].path) || d.thumb || (d.preview && d.preview.image);
      return h('a', { class: 'insp-card', href: `#/w/${w.id}/board?focus=${i.id}` }, p ? img(p, '') : h('span', { class: 'insp-ph' }, (d.title || d.text || i.kind).slice(0, 40))); }))
      : h('p', { class: 'muted', style: { margin: 0 } }, 'Ideas and looks you like, before you’re choosing between real vendors. Pin a mood-board card to this step and it shows here.')));
}
