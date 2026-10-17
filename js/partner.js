// The partner families' view: a link with no passcode. They see their wedding's mood board
// (no prices, rates or phone numbers), what's been decided (no amounts) and how far along
// it is — and can react, vote and send suggestions, which the family sees.
// Security lives in the database (update 9): partners only ever receive partner_data().
import { store } from './store.js?v=18';
import { h, toast, fancyDate, daysUntil, shortDate, ICONS } from './ui.js?v=18';
import { live, themeOf, monogram, applyTheme, render } from './app.js?v=18';
import { EMOJI } from './feedback.js?v=18';

const fail = (e) => { console.error(e); toast(e.message || 'That didn’t work. Check your connection.', 'error'); };
let state = { token: null, data: null, mode: null, loading: false, error: null };

/* ---------- Building the same cleaned-up data locally (family preview and sample) ---------- */
function localData(wid, asName) {
  const w = store.find('weddings', wid);
  const strip = (d) => { const { phone, rate, job_id, role, ...rest } = d || {}; void phone; void rate; void job_id; void role; return rest; };
  const board = live(store.rows('board_items')).filter(b => b.wedding_id === wid && !['contact', 'shape', 'connector'].includes(b.kind))
    .sort((a, b) => (a.y - b.y) || (a.x - b.x))
    .map(b => ({ id: b.id, kind: b.kind, x: b.x, y: b.y, w: b.w, z: b.z, data: b.kind === 'compare' ? { ...strip(b.data), options: (b.data.options || []).map(({ rate, contact, notes, ...o }) => (void rate, void contact, void notes, o)) } : strip(b.data) }));
  const steps = live(store.rows('steps')).filter(s => s.wedding_id === wid && s.locked_at);
  const decisions = steps.map(s => { const a = store.find('areas', s.area_id); const st = a && store.find('stages', a.stage_id); const n = s.lock_note || {};
    return a && st && !a.deleted_at && !st.deleted_at ? { id: s.id, title: s.title, area: a.title, stage: st.title, locked_at: s.locked_at, with: String(n.with || '').split(' — ')[0], choice: n.choice ? { ...n.choice, item_id: undefined } : null, image: n.image || null } : null; }).filter(Boolean);
  const allSteps = live(store.rows('steps')).filter(s => s.wedding_id === wid && (() => { const a = store.find('areas', s.area_id); const st = a && store.find('stages', a.stage_id); return a && st && !a.deleted_at && !st.deleted_at; })());
  const groups = new Map();
  for (const r of (store.rows('reactions') || []).filter(r => r.wedding_id === wid)) {
    const k = r.item_id + '|' + r.target + '|' + r.value;
    const g = groups.get(k) || { item_id: r.item_id, target: r.target, value: r.value, n: 0, mine: false };
    g.n++; if (r.created_by === (state.mode === 'demo' ? 'demo-partner' : '')) g.mine = true; groups.set(k, g);
  }
  return {
    me: asName, wedding: w && { id: w.id, couple: w.couple, monogram: w.monogram, wedding_date: w.wedding_date, date_note: w.date_note, theme: w.theme, theme_custom: w.theme_custom },
    board, decisions,
    progress: { total: allSteps.length, done: allSteps.filter(s => s.status === 'done' || s.locked_at).length, final: steps.length },
    reactions: [...groups.values()],
    my_suggestions: live(store.rows('comments') || []).filter(c => c.wedding_id === wid && c.created_by === 'demo-partner').map(c => ({ id: c.id, item_id: c.item_id, body: c.body, created_at: c.created_at }))
  };
}

/* ---------- Loading ---------- */
async function load(token) {
  state = { ...state, token, loading: true, error: null };
  try {
    if (token.startsWith('preview-')) { state.mode = 'preview'; state.data = localData(token.slice(8), store.me ? store.me.name : 'Preview'); }
    else if (store.mode === 'demo') { const l = (store.rows('partner_links') || []).find(x => x.token === token); state.mode = 'demo'; state.data = localData(l ? l.wedding_id : (token.replace(/^demo-/, '') || 'charani'), 'Example partner'); }
    else {
      state.mode = 'live';
      const sb = store.sb;
      let { data: sess } = await sb.auth.getSession();
      if (!sess.session) { const r = await sb.auth.signInAnonymously(); if (r.error) throw new Error('Could not open the link. Please try again in a moment.'); }
      const res = await sb.rpc('partner_data');
      if (res.error) { state.data = null; state.needName = true; }
      else { state.data = res.data; state.needName = false; }
    }
  } catch (e) { state.error = e.message; }
  state.loading = false;
  render();
}
async function join(name) {
  const r = await store.sb.rpc('join_partner', { p_token: state.token, p_name: name });
  if (r.error) { toast(r.error.message.includes('no longer') ? r.error.message : 'That link didn’t work. Ask the family for a new one.', 'error'); return; }
  await load(state.token);
}
async function react(itemId, target, value) {
  if (state.mode === 'preview') { toast('This is a preview of what the partner family sees'); return; }
  if (state.mode === 'demo') {
    const mine = (store.rows('reactions') || []).filter(r => r.item_id === itemId && r.target === target && r.created_by === 'demo-partner');
    const same = mine.find(r => r.value === value);
    store.cache.reactions = store.cache.reactions.filter(r => !(r.created_by === 'demo-partner' && r.item_id === itemId && r.target === target && (r.value === value || (['up', 'down'].includes(value) && ['up', 'down'].includes(r.value)))));
    if (!same) store.cache.reactions.push({ id: 'p' + Date.now(), wedding_id: state.data.wedding.id, item_id: itemId, target, value, user_name: 'Example partner', created_by: 'demo-partner', from_partner: true, created_at: new Date().toISOString() });
    store.save(); state.data = localData(state.data.wedding.id, state.data.me); render(); return;
  }
  const r = await store.sb.rpc('partner_react', { p_item: itemId, p_target: target, p_value: value });
  if (r.error) return fail(r.error);
  const res = await store.sb.rpc('partner_data'); if (!res.error) { state.data = res.data; render(); }
}
async function suggest(itemId, body) {
  if (!body.trim()) return false;
  if (state.mode === 'preview') { toast('This is a preview of what the partner family sees'); return false; }
  if (state.mode === 'demo') {
    store.cache.comments.push({ id: 'pc' + Date.now(), wedding_id: state.data.wedding.id, item_id: itemId, kind: 'suggestion', body, title: body.slice(0, 120), author_name: 'Example partner', created_by: 'demo-partner', from_partner: true, created_at: new Date().toISOString(), deleted_at: null });
    store.save(); state.data = localData(state.data.wedding.id, state.data.me); toast('Sent to the family'); render(); return true;
  }
  const r = await store.sb.rpc('partner_suggest', { p_item: itemId, p_body: body });
  if (r.error) { fail(r.error); return false; }
  toast('Sent to the family — thank you!');
  const res = await store.sb.rpc('partner_data'); if (!res.error) { state.data = res.data; render(); }
  return true;
}

/* ---------- Pieces ---------- */
function pic(path, cls = '') {
  const im = h('img', { class: cls, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' });
  if (!path) return null;
  if (/^https?:/.test(path)) im.src = path; else store.url(path).then(u => { if (u) im.src = u; else im.remove(); });
  return im;
}
const count = (itemId, target, value) => (state.data.reactions || []).find(r => r.item_id === itemId && r.target === target && r.value === value) || { n: 0, mine: false };
function reactBar(it) {
  return h('div', { class: 'pv-react' }, EMOJI.slice(0, 4).map(e => { const c = count(it.id, 'card', e); return h('button', { type: 'button', class: 'rx' + (c.mine ? ' mine' : ''), 'aria-label': 'React ' + e, onclick: () => react(it.id, 'card', e) }, e, c.n ? h('span', {}, String(c.n)) : null); }),
    h('button', { type: 'button', class: 'cbtn', onclick: (e) => { const box = e.currentTarget.closest('.pv-card').querySelector('.pv-suggest'); box.hidden = !box.hidden; if (!box.hidden) box.querySelector('textarea').focus(); } }, h('span', { html: ICONS.comment }), 'Suggest'));
}
function suggestBox(itemId) {
  const ta = h('textarea', { rows: 2, placeholder: 'Your suggestion about this…', maxlength: 2000 });
  return h('div', { class: 'pv-suggest', hidden: true }, ta, h('button', { type: 'button', class: 'btn small', onclick: async () => { if (await suggest(itemId, ta.value)) ta.value = ''; } }, 'Send to the family'));
}
function cardView(it) {
  const d = it.data || {};
  let body = null;
  if (it.kind === 'image') body = [pic(d.path, 'pv-img'), d.title || d.caption ? h('p', { class: 'pv-cap' }, d.title || d.caption) : null];
  else if (it.kind === 'video') body = [pic(d.thumb, 'pv-img'), h('p', { class: 'pv-cap' }, d.title || 'Video')];
  else if (it.kind === 'gallery') body = [h('div', { class: 'gal gal-' + (d.layout || 'grid') + ' n' + Math.min((d.images || []).length, 6) }, (d.images || []).map(x => h('span', { class: 'gal-i' }, pic(x.path)))), d.title ? h('p', { class: 'pv-cap' }, d.title) : null];
  else if (it.kind === 'note') body = h('p', { class: 'pv-note' }, d.text || '');
  else if (it.kind === 'link') body = [d.preview && d.preview.image ? pic(d.preview.image, 'pv-img') : d.thumb ? pic(d.thumb, 'pv-img') : null, h('a', { class: 'pv-link', href: d.url, target: '_blank', rel: 'noopener' }, d.title || (d.preview && d.preview.title) || d.url)];
  else if (it.kind === 'palette') body = [h('p', { class: 'pv-cap' }, d.title || 'Colours'), h('div', { class: 'pal' }, (d.colors || []).map(c => h('div', {}, h('span', { class: 'sw', style: { background: c.hex } }), c.name)))];
  else if (it.kind === 'checklist') body = [h('p', { class: 'pv-cap' }, d.title || 'Checklist'), h('ul', { class: 'ck' }, (d.items || []).map(x => h('li', { class: x.done ? 'done' : '' }, h('span', { class: 'ck-tick', html: x.done ? ICONS.check : '' }), h('span', {}, x.text))))];
  else if (it.kind === 'file') body = [pic(d.thumb, 'pv-img'), h('p', { class: 'pv-cap' }, d.title || d.name || 'Document')];
  else if (it.kind === 'compare') body = [h('p', { class: 'pv-cap' }, d.title || 'Which one?'),
    h('div', { class: 'pv-opts' }, (d.options || []).map((o, i) => { const key = o.oid || 'i' + i; const up = count(it.id, key, 'up'), dn = count(it.id, key, 'down');
      return h('div', { class: 'pv-opt' + (o.chosen ? ' chosen' : '') }, o.image ? pic(o.image) : h('span', { class: 'pv-noimg' }), h('b', {}, o.title || 'Option ' + String.fromCharCode(65 + i)),
        o.chosen ? h('span', { class: 'chip lockchip' }, '✓ Chosen') : null,
        h('span', { class: 'votes' },
          h('button', { type: 'button', class: 'vote up' + (up.mine ? ' mine' : ''), onclick: () => react(it.id, key, 'up') }, '▲', h('span', {}, String(up.n))),
          h('button', { type: 'button', class: 'vote down' + (dn.mine ? ' mine' : ''), onclick: () => react(it.id, key, 'down') }, '▼', h('span', {}, String(dn.n))))); }))];
  if (!body) return null;
  return h('article', { class: 'pv-card ' + it.kind + (d.status === 'chosen' ? ' chosen' : '') + (it.kind === 'note' ? ' tint-' + (d.tint || 'yellow') : '') }, d.status === 'chosen' ? h('span', { class: 'ribbon-chosen' }, '✓ Chosen') : null, body, reactBar(it), suggestBox(it.id));
}

/* ---------- The page ---------- */
export function renderPartner(token) {
  if (state.token !== token && !state.loading) { state = { token, data: null, mode: null, loading: true }; load(token); }
  if (state.loading || (!state.data && !state.needName && !state.error)) return h('div', { class: 'loading' }, 'Opening the wedding plans…');
  if (state.error) return h('div', { class: 'landing' }, h('div', { class: 'gate-card' }, h('h1', { class: 'foil' }, 'Sorry'), h('p', { class: 'land-sub' }, state.error)));
  if (state.needName) {
    const name = h('input', { placeholder: 'e.g. Adahrii’s mother', maxlength: 60, autocomplete: 'name' });
    return h('div', { class: 'landing gate-page' },
      h('div', { class: 'gate-card' },
        h('div', { class: 'land-eyebrow' }, 'You’re invited to have a look'),
        h('h1', { class: 'foil' }, 'Welcome'),
        h('p', { class: 'land-sub' }, 'See the ideas and what’s been decided so far, react to what you love and send your suggestions.'),
        h('form', { onsubmit: (e) => { e.preventDefault(); if (name.value.trim()) join(name.value.trim()); } }, h('label', { class: 'field' }, h('label', {}, 'Your name'), name), h('button', { class: 'enter solid', type: 'submit' }, 'Come in'))));
  }
  const D = state.data, w = D.wedding;
  if (!w) return h('div', { class: 'loading' }, 'This wedding isn’t available.');
  const t = themeOf(w); applyTheme(t);
  const days = daysUntil(w.wedding_date);
  const pct = D.progress && D.progress.total ? Math.round(D.progress.done / D.progress.total * 100) : 0;
  // Board in sections (section titles start a new group)
  const groups = []; let cur = { title: 'Ideas we’re gathering', items: [] }; groups.push(cur);
  for (const it of D.board) { if (it.kind === 'label') { cur = { title: (it.data && it.data.text) || 'Ideas', items: [] }; groups.push(cur); } else cur.items.push(it); }
  const general = h('textarea', { rows: 3, maxlength: 2000, placeholder: 'Anything you’d like the family to think about — a date, a vendor, an idea…' });
  return h('div', { class: 'pview deco-' + t.deco },
    h('div', { class: 'pv-banner' }, state.mode === 'preview' ? 'Preview — this is exactly what the partner family sees. Prices, phone numbers, the budget, lists and family comments are hidden.' : `Hello ${D.me || ''} · tap ♥ on anything you love, ▲ to vote, and “Suggest” to send the family your ideas`),
    h('header', { class: 'pv-hero' },
      h('img', { class: 'hb l', src: t.deco === 'rose' ? 'assets/lush_rose.svg' : 'assets/lush_blue.svg', alt: '', 'aria-hidden': 'true' }),
      h('img', { class: 'hb r', src: t.deco === 'rose' ? 'assets/lush_rose.svg' : 'assets/lush_blue.svg', alt: '', 'aria-hidden': 'true', style: { transform: 'scaleX(-1)' } }),
      monogram(w, 'lg'),
      h('h1', {}, w.couple),
      h('div', { class: 'emb-date' }, w.wedding_date ? fancyDate(w.wedding_date) : (w.date_note || 'Date to be fixed')),
      h('div', { class: 'pv-stats' },
        w.wedding_date && days !== null && days >= 0 ? h('div', {}, h('b', {}, String(days)), h('span', {}, days === 1 ? 'day to go' : 'days to go')) : null,
        h('div', {}, h('b', {}, pct + '%'), h('span', {}, 'ready'), h('i', { class: 'emb-prog' }, h('i', { style: { width: pct + '%' } }))),
        h('div', {}, h('b', {}, String((D.progress && D.progress.final) || 0)), h('span', {}, 'decided')))),
    h('main', { class: 'wrap pv-main' },
      D.decisions.length ? h('section', {}, h('div', { class: 'pv-h' }, h('div', { class: 'eyebrow' }, 'Decided so far'), h('h2', {}, 'What’s been made final')),
        h('div', { class: 'gl-grid' }, D.decisions.map(dc => h('article', { class: 'gl-tile' },
          pic((dc.choice && dc.choice.image) || dc.image, 'gl-pic') || h('div', { class: 'gl-pic ph' }, h('span', {}, dc.area)),
          h('div', { class: 'gl-body' }, h('span', { class: 'gl-area' }, dc.area), h('h3', {}, (dc.choice && dc.choice.title) || dc.title), dc.choice && dc.choice.title ? h('span', { class: 'gl-step' }, dc.title) : null, dc.with && !(dc.choice && dc.with === dc.choice.title) ? h('span', { class: 'gl-with' }, dc.with) : null, h('span', { class: 'gl-when' }, '✓ Final · ' + shortDate(String(dc.locked_at).slice(0, 10)))))))) : null,
      groups.filter(g => g.items.length).map(g => h('section', {}, h('div', { class: 'pv-h' }, h('div', { class: 'eyebrow' }, 'Mood board'), h('h2', {}, g.title)), h('div', { class: 'pv-masonry' }, g.items.map(cardView).filter(Boolean)))),
      !D.board.length ? h('p', { class: 'muted', style: { textAlign: 'center' } }, 'The family hasn’t added ideas yet — check back soon.') : null,
      h('section', { class: 'pv-general' }, h('h2', {}, 'Leave a suggestion'), h('p', { class: 'muted' }, 'The whole family sees your suggestions.'), general,
        h('button', { type: 'button', class: 'btn', onclick: async () => { if (await suggest(null, general.value)) general.value = ''; } }, 'Send to the family'),
        (D.my_suggestions || []).length ? h('div', { class: 'pv-mine' }, h('div', { class: 'eyebrow' }, 'You’ve sent'), D.my_suggestions.slice(-6).reverse().map(s => h('p', {}, '“' + s.body + '”'))) : null)));
}
export const resetPartner = () => { state = { token: null, data: null, mode: null, loading: false, error: null }; };
