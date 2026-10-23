// Options to choose between, swiped like cards.
// An option is a board item of kind 'option' (data: step_id, title, rate, notes, phone, links[], images[], status).
// Votes are reactions with target 'swipe' and value love | maybe | no — open to everyone.
import { store } from './store.js?v=28';
import { h, toast, modal, field, ICONS, compressImage, confirmBox, hostOf, safeUrl } from './ui.js?v=28';
import { live, wedding, weddings, themeOf, stepVisible, render } from './app.js?v=28';
import { isDecider } from './tools.js?v=28';
import { addVendor } from './decisions.js?v=28';
import { pickFiles, fetchPreview } from './board.js?v=28';
import { planOf } from './map.js?v=28';

const VOTES = ['love', 'maybe', 'no'];
const fail = (e) => { console.error(e); toast(e.message || 'That did not save. Check your connection.', 'error'); };
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
export const myVote = (o) => { const r = reactions(o).find(x => x.created_by === store.me.id); return r ? r.value : null; };
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
        dd.phone ? h('div', { class: 'od-phone' }, h('a', { class: 'btn small ghost', href: 'tel:' + dd.phone.replace(/[^\d+]/g, '') }, '☏ ' + dd.phone), waLink(dd.phone) ? h('a', { class: 'btn small ghost', href: waLink(dd.phone), target: '_blank', rel: 'noopener' }, 'WhatsApp') : null) : null,
        (dd.links || []).length ? h('div', { class: 'od-links' }, (dd.links || []).map(linkTile)) : null,
        h('div', { class: 'od-votes' },
          VOTES.map(k => h('button', { type: 'button', class: 'vote-btn ' + k + (mine === k ? ' on' : ''), onclick: () => vote(cur, k).catch(fail) }, { love: '♥ Love it', maybe: '? Maybe', no: '✕ Not this' }[k], h('b', {}, String(v[k].length))))),
        v.total ? h('p', { class: 'od-who' }, VOTES.filter(k => v[k].length).map(k => `${{ love: '♥', maybe: '?', no: '✕' }[k]} ${v[k].join(', ')}`).join('  ·  ')) : h('p', { class: 'od-who' }, 'No votes yet.'),
        h('p', { class: 'od-by' }, 'Added by ' + (store.memberName(cur.created_by) || 'someone') + (dd.status === 'chosen' ? ' · ✓ Chosen' : dd.status === 'not' ? ' · Not chosen' : '')),
        h('div', { class: 'od-acts' },
          can ? h('button', { type: 'button', class: 'btn', onclick: () => { closeAll(); chooseOption(cur); } }, 'Choose this — make it final') : null,
          h('button', { type: 'button', class: 'btn ghost small', onclick: () => { closeAll(); editOption(w, dd.step_id, cur); } }, 'Edit'),
          (cur.created_by === store.me.id || store.me.isAdmin) ? h('button', { type: 'button', class: 'btn ghost small', style: { color: 'var(--warn)' }, onclick: () => { closeAll(); store.remove('board_items', cur.id).then(() => toast('Moved to the Bin')).catch(fail); } }, 'Remove') : null))];
  };
  const body = h('div', { class: 'opt-detail' }, draw());
  const off = store.onChange(() => body.replaceChildren(...draw()));
  modal({ title: d.title || 'Option', wide: true, body, onClose: off });
}
const closeAll = () => document.querySelectorAll('.modal-wrap').forEach(m => m.remove());

/* ---------- Add or edit an option ---------- */
export function editOption(w, stepId, item) {
  const d = { links: [], images: [], ...((item && item.data) || {}) };
  const cats = categoriesOf(w);
  const allSteps = live(store.rows('steps')).filter(s => s.wedding_id === w.id && stepVisible(s));
  const cat = h('select', {},
    h('option', { value: '' }, 'Choose a category…'),
    h('optgroup', { label: 'Big decisions' }, cats.map(c => h('option', { value: c.step.id, selected: c.step.id === (stepId || d.step_id) ? true : null }, c.step.title))),
    h('optgroup', { label: 'Any other step' }, allSteps.filter(s => !cats.some(c => c.step.id === s.id)).sort((a, b) => a.title.localeCompare(b.title)).map(s => h('option', { value: s.id, selected: s.id === (stepId || d.step_id) ? true : null }, s.title))));
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
    field('Category', cat), field('Name', name), field('Price or quote', rate),
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
        if (!cat.value) { toast('Choose a category first', 'error'); cat.focus(); return false; }
        if (!name.value.trim() && !images.length) { toast('Give it a name or a photo', 'error'); name.focus(); return false; }
        const data = { ...d, step_id: cat.value, title: name.value.trim(), rate: rate.value.trim(), notes: notes.value.trim(), phone: phone.value.trim(),
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
    toast(`✓ ${d.title} is final for ${s.title}`);
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
  const showPic = () => {
    photo.replaceChildren(pics.length ? img(pics[pi], 'sw-img', d.title || '') : placeholder(o, 'sw-img'));
    dots.replaceChildren(...(pics.length > 1 ? pics.map((_, i) => h('span', { class: i === pi ? 'on' : '' })) : []));
  };
  showPic();
  const v = votesOf(o);
  const card = h('article', { class: 'sw-card', tabindex: '0', 'aria-label': `${d.title || 'Option'}${s ? ' for ' + s.title : ''}` },
    h('div', { class: 'sw-top' }, photo, dots,
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
  // Drag to vote; tap the sides of the photo to flip photos, the middle to open it.
  let sx = 0, sy = 0, dx = 0, dy = 0, dragging = false, moved = false;
  const setT = () => { card.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx / 18}deg)`; card.dataset.lean = dx > 40 ? 'love' : dx < -40 ? 'no' : dy < -50 ? 'maybe' : ''; };
  card.addEventListener('pointerdown', (e) => { if (e.target.closest('button, a')) return; dragging = true; moved = false; sx = e.clientX; sy = e.clientY; dx = dy = 0; card.setPointerCapture(e.pointerId); card.classList.add('dragging'); });
  card.addEventListener('pointermove', (e) => { if (!dragging) return; dx = e.clientX - sx; dy = e.clientY - sy; if (Math.abs(dx) + Math.abs(dy) > 8) moved = true; setT(); });
  const end = (e) => {
    if (!dragging) return; dragging = false; card.classList.remove('dragging');
    if (!moved) {
      card.style.transform = ''; card.dataset.lean = '';
      const r = photo.getBoundingClientRect();
      if (e.clientY <= r.bottom && pics.length > 1) { const x = (e.clientX - r.left) / r.width; if (x < .33) { pi = (pi - 1 + pics.length) % pics.length; showPic(); return; } if (x > .67) { pi = (pi + 1) % pics.length; showPic(); return; } }
      openOption(o); return;
    }
    if (dx > 110) onVote('love'); else if (dx < -110) onVote('no'); else if (dy < -110) onVote('maybe');
    else { card.style.transform = ''; card.dataset.lean = ''; }
  };
  card.addEventListener('pointerup', end); card.addEventListener('pointercancel', end);
  card._vote = onVote;
  return card;
}

export function renderSwipe(root, opts = {}) {
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
        lastVote ? h('button', { type: 'button', class: 'btn ghost', onclick: () => { const lv = lastVote; lastVote = null; vote(lv.o, lv.v).catch(fail); } }, '↶ Undo last') : null,
        w ? h('a', { class: 'btn', href: `#/w/${w.id}/choose` }, 'See all categories') : weddings().map(x => h('a', { class: 'btn ghost', href: `#/w/${x.id}/choose` }, (x.couple || '').split('&')[0].trim() + '’s choices')),
        w ? h('button', { type: 'button', class: 'btn ghost', onclick: () => editOption(w, step && step.id) }, '+ Add an option') : null)));
    return;
  }
  const o = list[0];
  const doVote = (value) => {
    const c = root.querySelector('.sw-card'); if (c) { c.classList.add('fly-' + value); }
    lastVote = { o, v: value };
    setTimeout(() => vote(o, value).catch(fail), 180);
  };
  const stage = h('div', { class: 'sw-stage' },
    list[2] ? h('div', { class: 'sw-under two' }) : null,
    list[1] ? h('div', { class: 'sw-under' }) : null,
    deckCard(o, list.length, doVote));
  root.append(stage,
    h('div', { class: 'sw-actions' },
      h('button', { type: 'button', class: 'sw-btn no', 'aria-label': 'Not this', onclick: () => doVote('no') }, '✕'),
      h('button', { type: 'button', class: 'sw-btn maybe', 'aria-label': 'Maybe', onclick: () => doVote('maybe') }, '?'),
      h('button', { type: 'button', class: 'sw-btn love', 'aria-label': 'Love it', onclick: () => doVote('love') }, '♥')),
    h('p', { class: 'sw-hint' }, 'Swipe right to love it, left for not this, up for maybe — or use ← ↑ →. Tap the photo’s sides to see more photos.',
      lastVote ? h('button', { type: 'button', class: 'link-btn', style: { marginLeft: '8px' }, onclick: () => { const lv = lastVote; lastVote = null; vote(lv.o, lv.v).catch(fail); } }, '↶ Undo') : null));
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

/* ---------- Choose: every category of a wedding ---------- */
export function renderChoose(root, w) {
  root.append(h('div', { class: 'ph-row' },
    h('div', {}, h('h1', { class: 'page-title' }, 'Choose'), h('p', { class: 'ph-sub' }, 'Everything waiting to be chosen, and what the family thinks.')),
    h('div', { class: 'ph-right' },
      h('button', { type: 'button', class: 'btn', onclick: () => editOption(w) }, '+ Add an option'),
      h('a', { class: 'btn ghost', href: `#/w/${w.id}/board` }, 'Mood board'))));
  const nfy = newForYou(w.id); if (nfy) root.append(nfy);
  const cats = categoriesOf(w);
  if (!cats.length) { root.append(h('p', { class: 'muted' }, 'No categories yet. Mark a step in the plan as a big decision, or add an option to any step.')); return; }
  const tile = ({ step, area, n }) => {
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
        h('span', { class: 'ct-area' }, area.title),
        h('b', {}, step.title),
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
export function renderOptions(root, w, stepId) {
  const step = store.find('steps', stepId);
  if (!step || step.deleted_at) { root.append(h('p', {}, 'That category was not found. ', h('a', { href: `#/w/${w.id}/choose` }, 'Back to Choose'))); return; }
  const area = store.find('areas', step.area_id);
  const opts = optionsOf(w.id, step.id).sort((a, b) => ((b.data || {}).status === 'chosen') - ((a.data || {}).status === 'chosen') || votesOf(b).score - votesOf(a).score || newestFirst(a, b));
  const fresh = pendingFor(w.id, step.id).length;
  for (const id of [...picking]) if (!opts.some(o => o.id === id)) picking.delete(id);
  root.append(h('div', { class: 'ph-row' },
    h('div', {}, h('a', { class: 'back-link', href: `#/w/${w.id}/choose` }, '‹ Choose'), h('div', { class: 'eyebrow' }, area ? area.title : 'Category'), h('h1', { class: 'page-title' }, step.title),
      step.locked_at ? h('p', { class: 'final-line' }, '✓ Final — ' + ((step.lock_note && (step.lock_note.with || step.lock_note.vendor)) || 'decided')) : null),
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
          VOTES.map(k => h('button', { type: 'button', class: 'mini-vote ' + k + (mine === k ? ' on' : ''), 'aria-label': { love: 'Love it', maybe: 'Maybe', no: 'Not this' }[k], 'aria-pressed': mine === k ? 'true' : 'false', onclick: () => vote(o, k).catch(fail) }, { love: '♥', maybe: '?', no: '✕' }[k])),
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
