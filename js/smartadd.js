// Smart add: one bar for links, messages, photos and screenshots. Each wedding has its own.
// 1. Fixed rules read what they can be sure of (smartparse.js).
// 2. If the family's AI is set up, it reads links, Instagram business profiles and screenshots, and fills
//    only what the rules left empty. Only vendor content is sent; nothing is looked up by name.
// 3. Each vendor is matched to one already here (same phone, Instagram or name) and placed in a step.
//    Anything it isn't sure about waits in the Inbox, and corrections teach it for next time.
import { store } from './store.js?v=50';
import { h, toast, modal, uploadPhoto, ICONS, buzz } from './ui.js?v=50';
import { live, render, wedding, weddings, stepVisible } from './app.js?v=50';
import * as P from './smartparse.js?v=50';

/* ---------- Settings (per wedding, on this device) ---------- */
const MODES = { ask: 'Always ask', sure: 'File when sure', all: 'File everything' };
const KEY = (k, wid) => `fwp-smart-${k}-${wid}`;
const get = (k, wid, d) => { try { const v = localStorage.getItem(KEY(k, wid)); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
const put = (k, wid, v) => { try { localStorage.setItem(KEY(k, wid), JSON.stringify(v)); } catch (e) { /* ignore */ } };
export const modeOf = (wid) => get('mode', wid, 'sure');
const SURE = 0.72; // at or above this, "File when sure" files it straight away

// Learning: words from a vendor (its name, handle, kind) → the step the family put it in.
const STOP = new Set('the and for with from your our this that wedding events event studio official india photos'.split(' '));
function learn(wid, v, stepId) {
  const L = get('learn', wid, {});
  const ws = String([v.name, v.handle, P.kindLabel(v.kind)].join(' ')).toLowerCase().match(/[a-z]{4,}/g) || [];
  for (const w of ws) if (!STOP.has(w)) L[w] = stepId;
  const keys = Object.keys(L); if (keys.length > 400) for (const k of keys.slice(0, keys.length - 400)) delete L[k];
  put('learn', wid, L);
}

/* ---------- Steps a vendor can go in ---------- */
function stepsOf(w) {
  const stages = live(store.rows('stages')).filter(s => s.wedding_id === w.id);
  const areas = live(store.rows('areas')).filter(a => a.wedding_id === w.id);
  return live(store.rows('steps')).filter(s => s.wedding_id === w.id && stepVisible(s) && !s.locked_at).map(s => {
    const a = areas.find(x => x.id === s.area_id) || {}; const st = stages.find(x => x.id === a.stage_id) || {};
    return { id: s.id, title: s.title, area: a.title || '', stage: st.title || '', pos: [st.position || 0, a.position || 0, s.position || 0] };
  }).sort((a, b) => a.pos[0] - b.pos[0] || a.pos[1] - b.pos[1] || a.pos[2] - b.pos[2]);
}
const optionsIn = (wid) => live(store.rows('board_items')).filter(i => i.kind === 'option' && i.wedding_id === wid);
export const inboxOf = (wid) => optionsIn(wid).filter(o => (o.data || {}).inbox);

/* ---------- Pictures ---------- */
function loadImg(file) { return new Promise((res, rej) => { const u = URL.createObjectURL(file); const i = new Image(); i.onload = () => res({ i, u }); i.onerror = rej; i.src = u; }); }
async function smallB64(file, max = 1024) {
  const { i, u } = await loadImg(file); const s = Math.min(1, max / Math.max(i.width, i.height));
  const c = document.createElement('canvas'); c.width = Math.round(i.width * s); c.height = Math.round(i.height * s);
  c.getContext('2d').drawImage(i, 0, 0, c.width, c.height); URL.revokeObjectURL(u);
  return { b64: c.toDataURL('image/jpeg', 0.8).split(',')[1], mime: 'image/jpeg', w: i.width, h: i.height };
}
const isScreenshot = (m) => m && m.h / m.w > 1.75; // a phone screenshot is tall and thin
// Cut a box (0–1000 scale) out of a picture, on the phone.
async function crop(file, box) {
  const { i, u } = await loadImg(file);
  const [y0, x0, y1, x1] = box.map(n => Math.max(0, Math.min(1000, n)) / 1000);
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round((x1 - x0) * i.width)); c.height = Math.max(1, Math.round((y1 - y0) * i.height));
  c.getContext('2d').drawImage(i, x0 * i.width, y0 * i.height, c.width, c.height, 0, 0, c.width, c.height); URL.revokeObjectURL(u);
  const b = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
  return new File([b], 'crop.jpg', { type: 'image/jpeg' });
}
// Without the AI: take off the phone's status bar and the app's bottom bar.
const trimScreenshot = (file) => crop(file, [45, 0, 925, 1000]);

/* ---------- Location: distance from the venue (OpenStreetMap) ---------- */
const geoCache = new Map();
async function geocode(q) {
  q = String(q || '').trim(); if (!q) return null;
  if (geoCache.has(q)) return geoCache.get(q);
  try {
    const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=' + encodeURIComponent(q), { headers: { 'Accept-Language': 'en' } });
    const j = await r.json(); const g = j && j[0] ? { lat: +j[0].lat, lon: +j[0].lon, name: j[0].display_name } : null;
    geoCache.set(q, g); return g;
  } catch (e) { return null; }
}
async function venueOf(w) {
  const v = get('venue', w.id, null); if (!v || !v.q) return null;
  if (v.lat) return v;
  const g = await geocode(v.q); if (g) { const x = { q: v.q, lat: g.lat, lon: g.lon }; put('venue', w.id, x); return x; }
  return null;
}

/* ---------- Reading ---------- */
// Everything found, before anything is saved: [{ v (what was read), files, stepId, sure, match, other }]
async function readAll(w, text, files, say) {
  const pieces = P.splitVendors(text);
  let found = pieces.map(p => P.readPiece(p));
  const links = [...new Set(found.flatMap(v => v.links))];
  const metas = await Promise.all(files.map(f => smallB64(f).catch(() => null)));
  const steps = stepsOf(w);
  let ai = null, extra = null;
  const wantAI = store.mode !== 'demo' && (files.length || links.length || found.some(v => !v.name || !v.kind));
  if (wantAI) {
    say('Reading the links and pictures…');
    try {
      let clean = text; for (const u of String(text).match(/\bhttps?:\/\/\S+/g) || []) clean = clean.replace(u, P.cleanLink(u.replace(/[.,;:!?…)\]]+$/, '')));
      extra = await store.smartAdd({ text: clean.slice(0, 8000), links, images: metas.filter(Boolean).map(m => ({ b64: m.b64, mime: m.mime })), categories: steps.map(s => ({ id: s.id, title: `${s.title} (${s.area})` })) });
      ai = extra && extra.ai && extra.ai.vendors || null;
    } catch (e) { extra = { note: e.message }; }
  }
  // The AI fills only what the rules left empty. Its vendors that the rules didn't see are added.
  const fill = (v, a) => {
    if ((!v.name || v.nameFromHandle) && a.name) { v.name = a.name; v.nameFromHandle = false; } // a name made up from a handle gives way to a real one
    if (!v.phone && a.phone) { v.phone = P.phonesIn(a.phone)[0] || ''; if (v.phone) v.phones = [v.phone]; }
    if (!v.handle && a.instagram) { v.handle = a.instagram.replace(/^@/, '').toLowerCase(); v.handles = [v.handle]; v.links.push('https://www.instagram.com/' + v.handle); }
    if (a.website && !v.links.some(l => l.includes(a.website.replace(/^https?:\/\//, '').split('/')[0]))) v.links.push(P.cleanLink(a.website));
    if (!v.emails.length && a.email) v.emails = [a.email];
    if (!v.price && a.price_value) v.price = { value: Math.round(a.price_value), text: a.price_text || '', per: /per\s+\w+/i.test(a.price_text || '') ? (a.price_text.match(/per\s+\w+/i) || [''])[0].toLowerCase() : '' };
    if (!v.location && a.location) v.location = a.location;
    if (!v.kind && a.kind) { const k = P.kindOf(a.kind); v.kind = k.kind; v.kindSure = k.sure * 0.9; }
    v.notes = v.notes || a.notes || '';
    v.aiStep = a.category_id && steps.some(s => s.id === a.category_id) ? a.category_id : null;
    v.aiSure = typeof a.confidence === 'number' ? a.confidence : 0;
    v.imageIdx = Array.isArray(a.images) ? a.images : null; v.crops = Array.isArray(a.crops) ? a.crops : [];
  };
  if (ai) for (const a of ai) {
    const x = { name: a.name, phones: a.phone ? P.phonesIn(a.phone) : [], handles: a.instagram ? [a.instagram.replace(/^@/, '').toLowerCase()] : [] };
    const v = found.find(f => P.sameVendor(f, x));
    if (v) fill(v, a); else { const n = P.readPiece(''); n.text = [a.name, a.notes].filter(Boolean).join('\n'); fill(n, a); found.push(n); }
  }
  // Instagram profiles read through Meta: name, bio, website and a few photos.
  const igPhotos = [];
  for (const p of (extra && extra.instagram) || []) {
    const v = found.find(f => (f.handles || []).includes(String(p.handle).toLowerCase())); if (!v) continue;
    if (p.unavailable) { v.igNote = p.unavailable; continue; }
    if ((!v.name || v.nameFromHandle) && p.name) { v.name = p.name; v.nameFromHandle = false; }
    if (p.bio) { v.notes = v.notes || p.bio.slice(0, 300); if (!v.phone) { const ph = P.phonesIn(p.bio)[0]; if (ph) { v.phone = ph; v.phones = [ph]; } } if (!v.kind) { const k = P.kindOf(p.bio); v.kind = k.kind; v.kindSure = k.sure; } }
    if (p.website && !v.links.includes(P.cleanLink(p.website))) v.links.push(P.cleanLink(p.website));
    for (const ph of p.photos || []) igPhotos.push({ v, ph });
  }
  for (const s of (extra && extra.sites) || []) {
    const v = found.find(f => f.links.includes(s.url)) || (found.length === 1 ? found[0] : null); if (!v) continue;
    if (!v.name && s.title) v.name = s.title.split(/[|–—-]/)[0].trim().slice(0, 60);
    if (!v.phone && s.phones && s.phones[0]) { v.phone = P.phonesIn(s.phones[0])[0] || ''; if (v.phone) v.phones = [v.phone]; }
    if (!v.notes && s.description) v.notes = s.description.slice(0, 300);
    if (!v.kind) { const k = P.kindOf([s.title, s.description].join(' ')); v.kind = k.kind; v.kindSure = k.sure; }
  }
  // Photos only, no words at all: one vendor holding the photos.
  if (!found.length && files.length) found.push(Object.assign(P.readPiece(''), { name: '' }));
  // Pictures: the AI says whose they are; otherwise all go to the only vendor, or to the first.
  const out = [];
  for (const v of found) out.push({ v, files: [], igPhotos: igPhotos.filter(x => x.v === v).map(x => x.ph) });
  for (let i = 0; i < files.length; i++) {
    const owner = out.find(o => o.v.imageIdx && o.v.imageIdx.includes(i)) || out[0];
    if (!owner) continue;
    const crops = (owner.v.crops || []).filter(c => c.image === i && Array.isArray(c.box) && c.box.length === 4);
    if (crops.length) for (const c of crops) owner.files.push(await crop(files[i], c.box).catch(() => files[i]));
    else owner.files.push(isScreenshot(metas[i]) ? await trimScreenshot(files[i]).catch(() => files[i]) : files[i]);
  }
  // Where each goes, how sure, and whether it's someone already here.
  const learned = get('learn', w.id, {});
  const venue = await venueOf(w);
  const here = optionsIn(w.id), elsewhere = live(store.rows('board_items')).filter(i => i.kind === 'option' && i.wedding_id !== w.id && wedding(i.wedding_id));
  const asV = (o) => { const d = o.data || {}; return { name: d.title, phones: [d.phone].filter(Boolean), handles: (d.links || []).map(P.igHandleOf).filter(Boolean) }; };
  for (const o of out) {
    const v = o.v;
    const pl = P.placeIn(steps, [v.name, v.handle, v.text, v.notes].join(' '), v.kind, learned);
    o.stepId = pl.why === 'like before' ? pl.stepId : (v.aiStep && v.aiSure >= pl.sure ? v.aiStep : pl.stepId) || v.aiStep || null;
    const kindPart = v.kind ? Math.max(v.kindSure, 0.5) : 0;
    o.sure = !o.stepId ? 0 : Math.min(1, Math.max(pl.sure * (0.6 + 0.4 * kindPart), v.aiSure || 0) * (v.name ? 1 : 0.6));
    o.match = here.find(x => P.sameVendor(v, asV(x))) || null;
    o.matchHow = o.match ? P.sameVendor(v, asV(o.match)) : '';
    o.other = o.match ? null : elsewhere.find(x => P.sameVendor(v, asV(x))) || null;
    if (venue && v.location) { const g = await geocode(v.location + ', India'); if (g) v.km = P.km(venue, g); }
  }
  // Repeats within this one paste are merged.
  for (let i = out.length - 1; i > 0; i--) { const j = out.slice(0, i).findIndex(o => P.sameVendor(o.v, out[i].v)); if (j >= 0) { out[j].files.push(...out[i].files); out.splice(i, 1); } }
  return { out, note: extra && extra.note, used: extra && extra.used };
}

/* ---------- Saving ---------- */
const b64File = (p, i) => { const bin = atob(p.b64); const a = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) a[k] = bin.charCodeAt(k); return new File([a], `instagram-${i}.jpg`, { type: p.mime || 'image/jpeg' }); };
async function save(w, o, { inbox = false } = {}) {
  const v = o.v;
  const images = [];
  for (const f of o.files) images.push({ path: await uploadPhoto(store, f) });
  for (const [i, p] of (o.igPhotos || []).entries()) { try { images.push({ path: await uploadPhoto(store, b64File(p, i)), from: p.permalink }); } catch (e) { /* skip */ } }
  const smart = { kind: v.kind || '', location: v.location || '', km: v.km ?? null, email: (v.emails || [])[0] || '', added: new Date().toISOString() };
  const rate = v.price ? P.priceLabel(v.price) : '';
  const phone = v.phone ? P.prettyPhone(v.phone) : '';
  if (o.match && o.useMatch !== false) {
    const cur = store.find('board_items', o.match.id) || o.match; const d = cur.data || {};
    await store.update('board_items', cur.id, { data: { ...d, phone: d.phone || phone, rate: d.rate || rate, notes: d.notes || v.notes || '', links: [...new Set([...(d.links || []), ...v.links])], images: [...(d.images || []), ...images], smart: { ...(d.smart || {}), ...Object.fromEntries(Object.entries(smart).filter(([, x]) => x)) } } });
    return 'updated';
  }
  const data = { step_id: o.stepId || o.guess || null, title: v.name || 'New vendor', rate, phone, notes: v.notes || '', links: v.links, images, status: 'open', smart };
  if (inbox || !o.stepId) data.inbox = true;
  await store.insert('board_items', { wedding_id: w.id, kind: 'option', x: 0, y: 0, w: 280, z: 1, data });
  return data.inbox ? 'inbox' : 'added';
}

/* ---------- The review sheet ---------- */
function review(w, res, onDone) {
  const steps = stepsOf(w);
  const { out } = res;
  const stepLabel = (id) => { const s = steps.find(x => x.id === id); return s ? `${s.title}` : 'Not sure yet — Inbox'; };
  const cards = out.map((o, i) => {
    const v = o.v;
    o.keep = true;
    if (!o.match && o.sure < SURE && o.stepId) { o.guess = o.stepId; o.stepId = null; }
    const sel = h('select', { 'aria-label': 'Where it goes', onchange: (e) => { o.stepId = e.target.value || null; o.sure = o.stepId ? 1 : 0; o.corrected = true; } },
      h('option', { value: '' }, 'Not sure — the Inbox'),
      groupBy(steps).map(([stage, list]) => h('optgroup', { label: stage }, list.map(s => h('option', { value: s.id, selected: s.id === o.stepId ? true : null }, `${s.title} · ${s.area}`)))));
    const name = h('input', { value: v.name || '', placeholder: 'Vendor name', maxlength: 120, oninput: (e) => { v.name = e.target.value; } });
    const pics = o.files.map(f => h('img', { src: URL.createObjectURL(f), alt: '' })).concat((o.igPhotos || []).map(p => h('img', { src: `data:${p.mime};base64,${p.b64}`, alt: '' })));
    const chips = [
      v.phone ? h('span', { class: 'sa-chip' }, '📞 ' + P.prettyPhone(v.phone)) : null,
      v.price ? h('span', { class: 'sa-chip' }, P.priceLabel(v.price)) : null,
      v.handle ? h('span', { class: 'sa-chip ig' }, '@' + v.handle) : null,
      ...v.links.filter(l => P.linkKind(l) !== 'instagram').slice(0, 3).map(l => h('span', { class: 'sa-chip' }, P.linkKind(l) === 'map' ? '📍 Map' : new URL(l).hostname.replace(/^www\./, ''))),
      v.location ? h('span', { class: 'sa-chip' }, '📍 ' + v.location + (v.km != null ? ` · ${v.km} km from the venue` : '')) : null,
      (v.emails || [])[0] ? h('span', { class: 'sa-chip' }, v.emails[0]) : null];
    const sure = o.match ? 'match' : o.sure >= SURE ? 'sure' : 'check';
    const useOther = o.other ? h('button', { type: 'button', class: 'btn ghost small', onclick: (e) => {
      const d = o.other.data || {}; if (!v.phone && d.phone) { v.phone = P.phonesIn(d.phone)[0] || ''; }
      if (!v.price && d.rate) v.price = P.pricesIn(d.rate)[0] || null; for (const l of d.links || []) if (!v.links.includes(l)) v.links.push(l);
      if (!v.notes && d.notes) v.notes = d.notes; e.currentTarget.textContent = '✓ Their details added'; e.currentTarget.disabled = true;
    } }, `Use their details from ${(wedding(o.other.wedding_id) || {}).couple}`) : null;
    const keep = h('input', { type: 'checkbox', checked: true, onchange: (e) => { o.keep = e.target.checked; card.classList.toggle('off', !o.keep); } });
    const card = h('div', { class: 'sa-card ' + sure },
      h('div', { class: 'sa-top' }, h('label', { class: 'sa-keep' }, keep), name,
        h('span', { class: 'sa-badge ' + sure }, sure === 'match' ? 'Already here' : sure === 'sure' ? 'Sure' : 'Check this')),
      pics.length ? h('div', { class: 'sa-pics' }, pics) : null,
      h('div', { class: 'sa-chips' }, chips.filter(Boolean).length ? chips : h('span', { class: 'muted' }, 'Only a name so far — add a phone or link later.')),
      v.notes ? h('p', { class: 'sa-notes' }, v.notes) : null,
      o.match ? h('label', { class: 'd-check' }, h('input', { type: 'checkbox', checked: true, onchange: (e) => { o.useMatch = e.target.checked; sel.disabled = o.useMatch; } }),
        `Add to “${(o.match.data || {}).title}” (same ${o.matchHow}) instead of a new option`) : null,
      h('div', { class: 'sa-where' }, h('span', { class: 'muted' }, 'Goes in'), sel),
      o.guess ? h('button', { type: 'button', class: 'link-btn sa-guess', onclick: (e) => { o.stepId = o.guess; o.corrected = true; sel.value = o.guess; e.currentTarget.remove(); } }, `Best guess: ${stepLabel(o.guess)} — use it`) : null,
      useOther, v.igNote ? h('p', { class: 'hint', style: { margin: 0 } }, 'Instagram: ' + v.igNote) : null);
    if (o.match) sel.disabled = true;
    return card;
  });
  const m = modal({
    title: out.length === 1 ? 'Found 1 vendor' : `Found ${out.length} vendors`, wide: true,
    body: [res.note ? h('p', { class: 'hint', style: { marginTop: 0 } }, 'Read with the fixed rules only (' + res.note.replace(/\.$/, '') + ').') : res.used ? h('p', { class: 'hint', style: { marginTop: 0 } }, 'Read with the rules first, then the AI for anything they missed. Check the ones marked “Check this”.') : null,
      h('div', { class: 'sa-list' }, cards)],
    actions: [{ label: 'Cancel', kind: 'ghost', onClick: () => { } }, { label: out.length === 1 ? 'Add it' : 'Add them', onClick: async () => {
      const keep = out.filter(o => o.keep); if (!keep.length) return;
      toast('Saving…'); let n = { added: 0, inbox: 0, updated: 0 };
      try {
        for (const o of keep) { if (o.corrected && o.stepId) learn(w.id, o.v, o.stepId); n[await save(w, o, { inbox: !o.stepId })]++; }
        buzz(14); toast(summary(n)); onDone && onDone();
      } catch (e) { toast(e.message || 'That did not save', 'error'); return false; }
    } }]
  });
  return m;
}
const summary = (n) => [n.added ? `${n.added} added` : '', n.updated ? `${n.updated} updated` : '', n.inbox ? `${n.inbox} in the Inbox` : ''].filter(Boolean).join(' · ') || 'Nothing added';
function groupBy(steps) { const g = new Map(); for (const s of steps) { const k = s.stage || 'Plan'; if (!g.has(k)) g.set(k, []); g.get(k).push(s); } return [...g]; }

/* ---------- The bar ---------- */
let draft = {}, pending = {}; // per wedding: typed text, attached files
export function smartBar(w) {
  const files = pending[w.id] || (pending[w.id] = []);
  const box = h('textarea', { class: 'sa-input', rows: 1, placeholder: 'Smart add — paste a vendor’s message, Instagram or website link, or add screenshots…', 'aria-label': 'Smart add' });
  box.value = draft[w.id] || '';
  const grow = () => { box.style.height = 'auto'; box.style.height = Math.min(220, box.scrollHeight) + 'px'; };
  box.addEventListener('input', () => { draft[w.id] = box.value; grow(); });
  requestAnimationFrame(grow);
  const tray = h('div', { class: 'sa-tray' });
  const drawTray = () => tray.replaceChildren(...files.map((f, i) => h('span', { class: 'sa-thumb' }, h('img', { src: URL.createObjectURL(f), alt: '' }), h('button', { type: 'button', 'aria-label': 'Remove', onclick: () => { files.splice(i, 1); drawTray(); } }, '×'))));
  drawTray();
  const addFiles = (list) => { for (const f of list) if (/^image\//.test(f.type)) files.push(f); drawTray(); };
  box.addEventListener('paste', (e) => { const fs = [...(e.clipboardData && e.clipboardData.files || [])]; if (fs.length) { e.preventDefault(); addFiles(fs); } });
  const pick = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true, onchange: (e) => { addFiles([...e.target.files]); e.target.value = ''; } });
  const status = h('span', { class: 'sa-status', 'aria-live': 'polite' });
  const go = async () => {
    const text = box.value.trim(); if (!text && !files.length) { box.focus(); return; }
    const may = store.may('board_items', {}); if (may !== true) return toast(may === 'view' ? 'You can look, comment and vote. Ask the admin to add vendors.' : 'You can work on Lists & files. Ask the admin to add vendors.', 'error');
    run.disabled = true; status.textContent = 'Reading…';
    try {
      const res = await readAll(w, text, [...files], (s) => { status.textContent = s; });
      if (!res.out.length) { status.textContent = ''; toast('Couldn’t find a vendor in that. Try adding a name, phone or link.', 'error'); return; }
      const clear = () => { draft[w.id] = ''; files.length = 0; render(); };
      const mode = modeOf(w.id);
      const sure = res.out.filter(o => o.match ? true : o.sure >= SURE);
      if (mode === 'all' || (mode === 'sure' && sure.length === res.out.length)) {
        const n = { added: 0, inbox: 0, updated: 0 };
        for (const o of res.out) n[await save(w, o, { inbox: o.sure < SURE && !o.match })]++; // unsure ones keep their guess, in the Inbox
        buzz(14); toast(summary(n)); clear();
      } else if (mode === 'sure' && sure.length) {
        const n = { added: 0, inbox: 0, updated: 0 };
        for (const o of sure) n[await save(w, o)]++;
        toast(summary(n) + ' — check the rest');
        res.out = res.out.filter(o => !sure.includes(o)); review(w, res, clear);
        draft[w.id] = ''; files.length = 0;
      } else review(w, res, clear);
      status.textContent = '';
    } catch (e) { status.textContent = ''; toast(e.message || 'Smart add couldn’t read that', 'error'); }
    finally { run.disabled = false; }
  };
  box.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); go(); } });
  const run = h('button', { type: 'button', class: 'btn sa-go', onclick: go }, 'Add');
  const n = inboxOf(w.id).length;
  const bar = h('section', { class: 'sa-bar', 'data-fresh': '' },
    h('div', { class: 'sa-row' },
      h('span', { class: 'sa-ic', html: ICONS.sparkle, 'aria-hidden': 'true' }), box,
      h('button', { type: 'button', class: 'icon-btn sa-pic', 'aria-label': 'Add photos or screenshots', html: ICONS.image, onclick: () => pick.click() }), pick,
      run),
    tray,
    h('div', { class: 'sa-foot' }, status,
      n ? h('a', { class: 'sa-inbox-link', href: '#sa-inbox', onclick: (e) => { e.preventDefault(); const el = document.getElementById('sa-inbox'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, `Inbox · ${n}`) : null,
      h('button', { type: 'button', class: 'link-btn', onclick: () => settings(w) }, MODES[modeOf(w.id)] + ' ▾')));
  bar.addEventListener('dragover', (e) => { e.preventDefault(); bar.classList.add('drop'); });
  bar.addEventListener('dragleave', () => bar.classList.remove('drop'));
  bar.addEventListener('drop', (e) => { e.preventDefault(); bar.classList.remove('drop'); addFiles([...(e.dataTransfer.files || [])]); const t = e.dataTransfer.getData('text'); if (t) { box.value = (box.value ? box.value + '\n' : '') + t; draft[w.id] = box.value; grow(); } });
  return bar;
}

function settings(w) {
  let mode = modeOf(w.id);
  const venue = h('input', { value: (get('venue', w.id, null) || {}).q || '', placeholder: 'e.g. Hotel Japfu, Kohima', maxlength: 120 });
  const seg = h('div', { class: 'd-seg', role: 'radiogroup' });
  const draw = () => seg.replaceChildren(...Object.entries(MODES).map(([k, l]) => h('button', { type: 'button', class: mode === k ? 'on' : '', onclick: () => { mode = k; draw(); } }, l)));
  draw();
  const learned = Object.keys(get('learn', w.id, {})).length;
  modal({ title: `Smart add · ${w.couple}`, body: [
    h('p', { class: 'muted', style: { marginTop: 0 } }, 'When it reads a message, link or screenshot:'), seg,
    h('ul', { class: 'hint' }, h('li', {}, 'Always ask — you check every vendor before it’s added.'), h('li', {}, 'File when sure — the sure ones go straight in; you check the rest.'), h('li', {}, 'File everything — all go in; anything unsure waits in the Inbox.')),
    h('div', { class: 'field' }, h('label', {}, 'The venue (for “km from the venue”)'), venue, h('div', { class: 'hint' }, 'Uses OpenStreetMap. Only the vendor’s town or address is looked up.')),
    learned ? h('p', { class: 'hint' }, `It has learned from ${learned} corrections in this wedding. `, h('button', { type: 'button', class: 'link-btn', onclick: (e) => { put('learn', w.id, {}); e.currentTarget.parentNode.textContent = 'Forgotten.'; } }, 'Forget them')) : null,
    h('p', { class: 'hint' }, store.mode === 'demo' ? 'In the sample, only the fixed rules run. With the family’s AI set up, it also reads links, Instagram business profiles and screenshots.' : 'Links, Instagram business profiles and screenshots are read by the family’s AI when the admin has set it up.')],
  actions: [{ label: 'Cancel', kind: 'ghost', onClick: () => { } }, { label: 'Save', onClick: () => { put('mode', w.id, mode); const q = venue.value.trim(); const old = get('venue', w.id, null); if (!old || old.q !== q) put('venue', w.id, q ? { q } : null); render(); } }] });
}

/* ---------- The Inbox ---------- */
export function inboxSection(w) {
  const items = inboxOf(w.id); if (!items.length) return null;
  const steps = stepsOf(w);
  return h('section', { class: 'sa-inbox', id: 'sa-inbox' },
    h('h2', { class: 'cat-h' }, `Inbox · ${items.length}`, h('span', { class: 'muted', style: { fontSize: '14px', fontWeight: 400, marginLeft: '10px' } }, 'Smart add wasn’t sure where these go')),
    h('div', { class: 'sa-ilist' }, items.map(o => {
      const d = o.data || {}; const guess = steps.find(s => s.id === d.step_id);
      const place = async (stepId) => { learn(w.id, { name: d.title, handle: (d.links || []).map(P.igHandleOf).find(Boolean), kind: (d.smart || {}).kind }, stepId); const { inbox, ...rest } = d; await store.update('board_items', o.id, { data: { ...rest, step_id: stepId } }).then(() => toast('Moved — it’ll remember for next time')).catch(e => toast(e.message, 'error')); };
      const sel = h('select', { 'aria-label': 'Put it in', onchange: (e) => e.target.value && place(e.target.value) },
        h('option', { value: '' }, 'Put it in…'), groupBy(steps).map(([stage, list]) => h('optgroup', { label: stage }, list.map(s => h('option', { value: s.id }, `${s.title} · ${s.area}`)))));
      return h('div', { class: 'sa-irow' },
        h('div', { class: 'sa-itx' }, h('b', {}, d.title || 'New vendor'), h('span', { class: 'muted' }, [d.phone, d.rate, (d.smart || {}).location].filter(Boolean).join(' · ') || 'No details yet')),
        guess ? h('button', { type: 'button', class: 'btn small', onclick: () => place(guess.id) }, '→ ' + guess.title) : null,
        sel,
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Delete', html: ICONS.trash, onclick: () => store.remove('board_items', o.id).then(() => toast('Moved to the Bin')) }));
    })));
}
