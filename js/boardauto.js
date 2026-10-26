// Things the mood board does by itself: tidy up, colours from a photo, rates and
// estimates, "ready to decide?" nudges, favourites, stale cards, and sharing a section.
import { store } from './store.js?v=52';
import { h, toast } from './ui.js?v=52';
import { live } from './app.js?v=52';
import { together } from './history.js?v=52';
import { commentsOf, voteCounts, optionKey } from './feedback.js?v=52';
import { cardTitle } from './decisions.js?v=52';
import { share, siteLink } from './tools.js?v=52';

const fail = (e) => { console.error(e); toast(e.message || 'That did not save. Check your connection.', 'error'); };
const DAY = 86400000;

/* ---------- Rates and estimates ---------- */
// "₹45 per cup", "45/plate", "1.2 lakh", "50k", "Rs 1,200 each" → { n: 45, per: 'cup' }
export function rateOf(text) {
  const t = String(text || '').toLowerCase().replace(/rs\.?|inr|₹/g, ' ');
  const m = /(\d[\d,]*\.?\d*)\s*(lakh|lac|l\b|k\b|cr)?/.exec(t); if (!m) return null;
  let n = parseFloat(m[1].replace(/,/g, '')); if (!isFinite(n)) return null;
  const mult = { lakh: 1e5, lac: 1e5, l: 1e5, k: 1e3, cr: 1e7 }[m[2]] || 1; n *= mult;
  const per = (/(?:per|\/|a|each)\s*([a-z]+)/.exec(t.slice(m.index + m[0].length)) || [])[1] || (/\beach\b/.test(t) ? 'each' : null);
  return { n, per: per && /^(cup|plate|person|head|guest|pax|piece|pc|box|packet|bottle|kg|each|item|card|table|chair|hour|day)s?$/.test(per) ? per : null };
}
export function guestCount(wid) {
  const lists = live(store.rows('lists') || []).filter(l => l.wedding_id === wid && /guest/i.test(l.title));
  let total = 0;
  for (const l of lists) {
    const i = (l.columns || []).findIndex(c => /^(count|people|guests|no\.?)$/i.test(c.trim()));
    const rows = live(store.rows('list_rows') || []).filter(r => r.list_id === l.id);
    total += i >= 0 ? rows.reduce((s, r) => s + (parseFloat((r.cells || [])[i]) || 0), 0) : rows.length;
  }
  return total;
}
const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
// The note under a comparison: cheapest option, and an estimate for the guest count.
export function compareInsight(item) {
  const opts = (item.data && item.data.options) || [];
  const rates = opts.map(o => rateOf(o.rate || o.notes));
  const priced = rates.map((r, i) => r ? { i, ...r } : null).filter(Boolean);
  if (priced.length < 1) return null;
  const cheapest = priced.length > 1 ? priced.reduce((a, b) => b.n < a.n ? b : a) : null;
  const guests = guestCount(item.wedding_id);
  const per = priced.find(p => p.per && !['day', 'hour', 'table', 'chair', 'kg'].includes(p.per));
  const bits = [];
  if (cheapest) bits.push(`Cheapest: ${String.fromCharCode(65 + cheapest.i)}`);
  if (per && guests) bits.push(`For ${guests} guests: ` + priced.filter(p => p.per).map(p => `${String.fromCharCode(65 + p.i)} ≈ ${inr(p.n * guests)}`).join(' · '));
  return bits.length ? { text: bits.join(' · '), cheapest: cheapest ? cheapest.i : -1 } : null;
}

/* ---------- Nudges, favourites, stale ---------- */
export function readyToDecide(item) {
  if (item.kind !== 'compare') return false;
  const opts = (item.data && item.data.options) || [];
  if (opts.some(o => o.chosen)) return false;
  const votes = opts.reduce((t, o, i) => { const v = voteCounts(item, optionKey(o, i)); return t + v.up.length + v.down.length; }, 0);
  const age = Date.now() - new Date(item.created_at || Date.now()).getTime();
  return votes >= 3 && age >= 3 * DAY;
}
export function favScore(item) {
  const rs = (store.rows('reactions') || []).filter(r => r.item_id === item.id);
  return rs.filter(r => r.target === 'card').length + rs.filter(r => r.value === 'up').length;
}
export function isStale(item) {
  if (item.data && item.data.status === 'chosen') return false;
  const last = Math.max(new Date(item.created_at || 0).getTime(),
    ...commentsOf(item.id).map(c => new Date(c.created_at).getTime()),
    ...(store.rows('reactions') || []).filter(r => r.item_id === item.id).map(r => new Date(r.created_at).getTime()),
    ...(store.rows('activity') || []).filter(a => a.entity_id === item.id).map(a => new Date(a.created_at).getTime()));
  return Date.now() - last > 30 * DAY;
}

/* ---------- Sections ---------- */
// A card belongs to the nearest section title above it.
export function sectionOf(item, labels) {
  let best = null, bd = Infinity;
  for (const l of labels) {
    if (l.y > item.y + 30) continue;
    const dx = Math.max(0, l.x - item.x - (item.w || 260) / 2), dy = item.y - l.y;
    const dist = dy + dx * 1.5 + Math.abs((l.x) - item.x) * 0.3;
    if (dist < bd) { bd = dist; best = l; }
  }
  return best;
}
export function shareSection(label) {
  const items = live(store.rows('board_items')).filter(i => i.wedding_id === label.wedding_id && !['shape', 'connector', 'label'].includes(i.kind));
  const labels = live(store.rows('board_items')).filter(i => i.wedding_id === label.wedding_id && i.kind === 'label');
  const mine = items.filter(i => sectionOf(i, labels) === label || (sectionOf(i, labels) && sectionOf(i, labels).id === label.id));
  const w = store.find('weddings', label.wedding_id);
  const lines = mine.slice(0, 15).map(i => `• ${cardTitle(i)}${i.data && i.data.status === 'chosen' ? ' ✓' : ''}`);
  share(`${(label.data && label.data.text) || 'Ideas'} — ${(w && w.couple) || ''}\n${lines.join('\n') || '(nothing here yet)'}`, siteLink(`#/w/${label.wedding_id}/board?focus=${label.id}`));
}

/* ---------- Tidy up ---------- */
// Lays each section out as neat columns under its title: chosen first, then shortlisted,
// ideas, and "not this" last. Cards with no section go into an "Unsorted" area.
const ORDER = { chosen: 0, shortlisted: 1, undefined: 2, null: 2, idea: 2, no: 3 };
export async function tidyUp(w, cardEls) {
  const all = live(store.rows('board_items')).filter(i => i.wedding_id === w.id);
  const labels = all.filter(i => i.kind === 'label').sort((a, b) => (a.y - b.y) || (a.x - b.x));
  const cards = all.filter(i => !['label', 'shape', 'connector'].includes(i.kind));
  if (!cards.length) { toast('Nothing to tidy yet'); return; }
  const size = (it) => { const el = cardEls.get(it.id); return el ? { w: el.offsetWidth, h: el.offsetHeight } : { w: it.w || 260, h: 220 }; };
  const groups = new Map(labels.map(l => [l.id, []])); const loose = [];
  for (const c of cards) { const s = sectionOf(c, labels); if (s) groups.get(s.id).push(c); else loose.push(c); }
  const blocks = labels.map(l => ({ label: l, items: groups.get(l.id) })).filter(b => b.items.length || true);
  if (loose.length) blocks.push({ label: null, items: loose });
  const GAP = 20, COLW = 300, PER_ROW_W = 1500;
  const ops = [];
  let x = 40, y = 90, rowH = 0;
  for (const b of blocks) {
    const items = [...b.items].sort((a, c) => (ORDER[a.data && a.data.status] ?? 2) - (ORDER[c.data && c.data.status] ?? 2) || (a.y - c.y));
    const cols = Math.max(1, Math.min(3, Math.ceil(items.length / 4)));
    const blockW = Math.max(cols * (COLW + GAP), b.label ? (b.label.w || 320) : 320);
    if (x + blockW > PER_ROW_W && x > 40) { x = 40; y += rowH + 60; rowH = 0; }
    let top = y;
    if (b.label) { ops.push([b.label.id, { x, y }]); top += 64; }
    else if (items.length) { /* unsorted: no title, just a column block */ }
    const colY = Array(cols).fill(top);
    for (const it of items) {
      const c = colY.indexOf(Math.min(...colY));
      const sz = size(it);
      const wd = Math.min(sz.w, it.kind === 'compare' || it.kind === 'gallery' ? Math.max(COLW, sz.w) : COLW);
      ops.push([it.id, { x: x + c * (COLW + GAP), y: colY[c], ...(it.kind !== 'compare' && it.kind !== 'gallery' && sz.w > COLW ? { w: COLW } : {}) }]);
      colY[c] += sz.h * (wd / Math.max(1, sz.w)) + GAP;
    }
    rowH = Math.max(rowH, Math.max(...colY) - y);
    x += blockW + 60;
  }
  await together(async () => { for (const [id, patch] of ops) await store.update('board_items', id, patch); }).then(() => toast('Tidied — undo if you liked it better before')).catch(fail);
}

/* ---------- Colours from a photo ---------- */
function colorName(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let hue = 0; if (d) { if (max === r) hue = 60 * (((g - b) / d) % 6); else if (max === g) hue = 60 * ((b - r) / d + 2); else hue = 60 * ((r - g) / d + 4); } if (hue < 0) hue += 360;
  if (l > .9) return 'Ivory'; if (l < .14) return 'Charcoal';
  if (s < .12) return l > .7 ? 'Pearl grey' : l > .45 ? 'Stone' : 'Slate';
  const light = l > .72 ? 'Pale ' : l < .32 ? 'Deep ' : s < .35 ? 'Dusty ' : '';
  const base = hue < 15 || hue >= 345 ? 'rose' : hue < 40 ? (l > .6 ? 'peach' : 'terracotta') : hue < 55 ? (s < .45 ? 'champagne' : 'gold') : hue < 75 ? 'butter' : hue < 160 ? 'sage' : hue < 200 ? 'teal' : hue < 250 ? 'blue' : hue < 290 ? 'lavender' : hue < 330 ? 'mauve' : 'blush';
  return (light + base).replace(/^./, c => c.toUpperCase());
}
export async function paletteFromImage(item, at) {
  const path = item.data && item.data.path;
  const src = path && await store.url(path);
  if (!src) { toast('Could not read that photo', 'error'); return; }
  const img = new Image(); img.crossOrigin = 'anonymous';
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; }).catch(() => null);
  if (!img.naturalWidth) { toast('Could not read that photo', 'error'); return; }
  const c = document.createElement('canvas'); c.width = 60; c.height = Math.max(1, Math.round(60 * img.naturalHeight / img.naturalWidth));
  const x = c.getContext('2d'); x.drawImage(img, 0, 0, c.width, c.height);
  let px; try { px = x.getImageData(0, 0, c.width, c.height).data; } catch (e) { toast('This photo can’t be read for colours', 'error'); return; }
  const pts = []; for (let i = 0; i < px.length; i += 4) if (px[i + 3] > 200) pts.push([px[i], px[i + 1], px[i + 2]]);
  // k-means, 5 colours
  let cent = [0, .2, .4, .6, .8].map(f => pts[Math.floor(f * (pts.length - 1))].slice());
  let assign = new Array(pts.length).fill(0);
  for (let it = 0; it < 10; it++) {
    for (let i = 0; i < pts.length; i++) { let bi = 0, bd = Infinity; for (let k = 0; k < cent.length; k++) { const d = (pts[i][0] - cent[k][0]) ** 2 + (pts[i][1] - cent[k][1]) ** 2 + (pts[i][2] - cent[k][2]) ** 2; if (d < bd) { bd = d; bi = k; } } assign[i] = bi; }
    cent = cent.map((cc, k) => { const m = pts.filter((_, i) => assign[i] === k); if (!m.length) return cc; return [0, 1, 2].map(j => m.reduce((s, p) => s + p[j], 0) / m.length); });
  }
  const counts = cent.map((_, k) => assign.filter(a => a === k).length);
  const hex = (c3) => '#' + c3.map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
  const colors = cent.map((c3, k) => ({ c3, n: counts[k] })).filter(o => o.n).sort((a, b) => b.n - a.n).map(o => ({ hex: hex(o.c3), name: colorName(hex(o.c3)) }));
  const seen = new Set(); const uniq = colors.filter(cl => { if (seen.has(cl.name)) return false; seen.add(cl.name); return true; });
  await store.insert('board_items', { wedding_id: item.wedding_id, kind: 'palette', x: (at && at[0]) || item.x + (item.w || 260) + 24, y: (at && at[1]) || item.y, w: 300, z: (item.z || 1) + 1, data: { title: 'Colours from ' + (cardTitle(item).length > 30 ? 'the photo' : cardTitle(item)), colors: uniq } })
    .then(() => toast('Colours card added next to the photo')).catch(fail);
}

