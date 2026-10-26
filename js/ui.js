// Small UI helpers shared by every page.
import { listen, onScreen } from './morph.js?v=51';

export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v; // only ever used with our own static markup
    else if (k === 'style' && typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) { if (sv === null || sv === undefined) continue; if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; } }
    else if (k.startsWith('on') && typeof v === 'function') listen(el, k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

export const $ = (s, root = document) => root.querySelector(s);

/* ---------- Dates ---------- */
export function parseDate(s) { if (!s) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
export function daysUntil(s) {
  const d = parseDate(s); if (!d) return null;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((d - t) / 86400000);
}
export function longDate(s) {
  const d = parseDate(s); if (!d) return '';
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
export function fancyDate(s) {
  const d = parseDate(s); if (!d) return '';
  const wd = d.toLocaleDateString('en-IN', { weekday: 'long' });
  const dm = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' });
  return `${wd} · ${dm} ${d.getFullYear()}`;
}
export function shortDate(s) {
  const d = parseDate(s); if (!d) return '';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
export function ago(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + ' min ago';
  if (s < 86400) return Math.floor(s / 3600) + (Math.floor(s / 3600) === 1 ? ' hour ago' : ' hours ago');
  const d = Math.floor(s / 86400);
  if (d === 1) return 'yesterday';
  if (d < 7) return d + ' days ago';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
export function dayHeading(iso) {
  const d = new Date(iso); const t = new Date(); t.setHours(0, 0, 0, 0);
  const dd = new Date(d); dd.setHours(0, 0, 0, 0);
  const diff = Math.round((t - dd) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
}

/* ---------- Toasts ---------- */
export function toast(msg, kind = 'info') {
  let box = $('#toasts');
  if (!box) { box = h('div', { id: 'toasts', 'aria-live': 'polite' }); document.body.append(box); }
  // Small and out of the way at the top corner; quick for "Saved", longer for problems. At most three at once.
  const t = h('div', { class: 'toast ' + kind, text: msg, role: kind === 'error' ? 'alert' : null });
  box.append(t);
  while (box.children.length > 3) box.firstChild.remove();
  const stay = kind === 'error' ? 5200 : Math.min(4200, 1600 + String(msg).length * 28);
  setTimeout(() => t.classList.add('out'), stay);
  setTimeout(() => t.remove(), stay + 400);
}

/* ---------- Modal ---------- */
// Small vibration on phones that support it (Android) — confirms a swipe, a tick, a choice.
export const buzz = (ms = 12) => { try { if (navigator.vibrate && !matchMedia('(prefers-reduced-motion: reduce)').matches) navigator.vibrate(ms); } catch (e) { } };
const isPhone = () => matchMedia('(max-width: 760px)').matches;

// Pull a bottom sheet down to close it (phones).
export function dragToClose(sheet, handleEls, close) {
  let y0 = null, dy = 0;
  const down = (e) => { if (!isPhone() || e.target.closest('button, a, input, textarea, select')) return; y0 = e.clientY; dy = 0; sheet.style.transition = 'none'; };
  const move = (e) => { if (y0 === null) return; dy = Math.max(0, e.clientY - y0); sheet.style.transform = `translateY(${dy}px)`; };
  const up = () => { if (y0 === null) return; y0 = null; sheet.style.transition = ''; if (dy > 90) close(); else sheet.style.transform = ''; };
  for (const el of handleEls) { el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.style.touchAction = 'none'; }
}

export function modal({ title, body, actions = [], wide = false, onClose }) {
  let closed = false;
  const close = () => {
    if (closed) return; closed = true;
    document.removeEventListener('keydown', onKey);
    wrap.classList.add('closing');
    setTimeout(() => wrap.remove(), isPhone() ? 220 : 140);
    onClose && onClose();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const grab = h('div', { class: 'sheet-grab', 'aria-hidden': 'true' });
  const panel = h('div', { class: 'modal' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    grab,
    h('div', { class: 'modal-head' },
      h('h2', { text: title }),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', onclick: close, html: ICONS.close })),
    h('div', { class: 'modal-body' }, body),
    actions.length ? h('div', { class: 'modal-actions' }, actions.map(a => h('button', {
      type: 'button', class: 'btn ' + (a.kind || ''), text: a.label,
      onclick: async (e) => { const r = await a.onClick(e, close); if (r !== false && !a.keepOpen) close(); }
    }))) : null);
  const wrap = h('div', { class: 'modal-wrap', onmousedown: (e) => { if (e.target === wrap) close(); } }, panel);
  document.body.append(wrap);
  dragToClose(panel, [grab, panel.querySelector('.modal-head')], close);
  document.addEventListener('keydown', onKey);
  setTimeout(() => { const f = panel.querySelector('input, textarea, select'); if (f) f.focus(); }, 30);
  return { close, panel };
}

export function confirmBox(title, text, okLabel, kind = 'danger') {
  return new Promise((resolve) => {
    let done = false;
    modal({
      title, body: h('p', { class: 'muted', text }),
      actions: [
        { label: 'Cancel', kind: 'ghost', onClick: () => { done = true; resolve(false); } },
        { label: okLabel, kind, onClick: () => { done = true; resolve(true); } }
      ],
      onClose: () => { if (!done) resolve(false); }
    });
  });
}

export function field(label, input, hint) {
  const id = input.id || ('f-' + Math.random().toString(36).slice(2, 8));
  input.id = id;
  return h('div', { class: 'field' }, h('label', { for: id, text: label }), input, hint ? h('div', { class: 'hint', text: hint }) : null);
}

/* ---------- Files ---------- */
export async function compressImage(file, max = 1800, quality = 0.82) {
  if (!/^image\/(jpeg|png|webp|heic|heif)/i.test(file.type) || file.type === 'image/gif') return file;
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', quality));
  return blob && blob.size < file.size ? blob : file;
}

// A photo goes up twice: the full picture (for opening and swiping) and a small copy for grids and tiles,
// so lists of photos load quickly on phones. Returns the full picture's path.
export async function uploadPhoto(store, file) {
  const [full, small] = await Promise.all([compressImage(file), compressImage(file, 520, 0.74)]);
  const ext = full === file ? ((file.name || '').split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg' : 'jpg';
  return store.uploadPhotoPair(full, small !== file ? small : null, ext);
}

// Instagram posts and reels can be shown in place (public posts only — Instagram's own embed).
// A profile link (instagram.com/name) can't be embedded and stays a link.
export const instaPost = (u) => { const m = /instagram\.com\/(?:[\w.]+\/)?(p|reel|reels|tv)\/([\w-]+)/i.exec(u || ''); return m ? { type: /^reel/i.test(m[1]) ? 'reel' : 'p', id: m[2] } : null; };
export function instaEmbed(u, { tall = false } = {}) {
  const x = instaPost(u); if (!x) return null;
  return h('div', { class: 'ig-embed' + (tall ? ' tall' : '') },
    h('iframe', { src: `https://www.instagram.com/${x.type}/${x.id}/embed/captioned/`, loading: 'lazy', title: 'Instagram post', allow: 'encrypted-media; picture-in-picture', allowfullscreen: true, frameborder: '0', scrolling: 'no', referrerpolicy: 'strict-origin-when-cross-origin' }),
    h('a', { class: 'ig-open', href: u, target: '_blank', rel: 'noopener' }, 'Open in Instagram ↗'));
}

export async function videoThumb(file) {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'metadata';
    v.src = URL.createObjectURL(file);
    const fail = () => resolve(null);
    v.onerror = fail;
    v.onloadeddata = () => { v.currentTime = Math.min(1, (v.duration || 2) / 3); };
    v.onseeked = () => {
      const scale = Math.min(1, 900 / Math.max(v.videoWidth, v.videoHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(v.videoWidth * scale); c.height = Math.round(v.videoHeight * scale);
      c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
      c.toBlob(b => resolve(b), 'image/jpeg', 0.8);
    };
    setTimeout(fail, 8000);
  });
}

export async function pdfThumb(file) {
  try {
    const pdfjs = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const page = await doc.getPage(1);
    const vp0 = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: 700 / vp0.width });
    const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
    await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    const pages = doc.numPages;
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.8));
    return { blob, pages };
  } catch (e) { console.warn('PDF preview failed', e); return null; }
}

export function fileExt(name) { const m = /\.([a-z0-9]{1,6})$/i.exec(name || ''); return m ? m[1].toLowerCase() : 'bin'; }
export function prettySize(n) { if (!n) return ''; if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB'; return (n / 1024 / 1024).toFixed(1) + ' MB'; }

export function youtubeId(url) {
  const m = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/i.exec(url || '');
  return m ? m[1] : null;
}
export function hostOf(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
export function safeUrl(url) {
  try { const u = new URL(url); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch (e) { return ''; }
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('Copied'); }
  catch (e) { toast('Could not copy — press and hold to copy instead'); }
}

// Section heading used across the wedding pages: small caps eyebrow, serif title, optional controls.
export function secHead(eyebrow, title, ...right) {
  return h('div', { class: 'plan-head' }, h('div', { class: 'ph-title' }, h('div', { class: 'eyebrow' }, eyebrow), h('h1', {}, title)), right.length ? h('div', { class: 'ph-right' }, right) : null);
}

/* ---------- Icons (inline stroke SVG) ---------- */
const sv = (p, extra = '') => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${p}</svg>`;
export const ICONS = {
  close: sv('<path d="M6 6l12 12M18 6L6 18"/>'),
  heart: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-7.5-10.6A4.2 4.2 0 0 1 12 7.3a4.2 4.2 0 0 1 7.5 2.6c0 6-7.5 10.6-7.5 10.6z"/></svg>',
  nope: sv('<path d="M7 7l10 10M17 7L7 17"/>'),
  maybe: sv('<path d="M9.2 9a2.9 2.9 0 1 1 4.1 2.6c-.8.4-1.3 1-1.3 1.9v.5M12 17.5v.01"/>'),
  sparkle: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M12 2.5l1.9 6.4 6.6 2.1-6.6 2.1L12 19.5l-1.9-6.4L3.5 11l6.6-2.1z"/></svg>',
  plus: sv('<path d="M12 5v14M5 12h14"/>'),
  chat: sv('<path d="M4.5 19.5l1.2-3.6A8 8 0 1 1 8.6 18.7z"/><path d="M9.3 9.2c.2 1.9 2.4 4.3 4.6 4.8l.9-1.1 1.6.7c-.2 1-1 1.7-2 1.6-3-.3-6.1-3.3-6.3-6.4 0-1 .7-1.7 1.6-1.9l.7 1.5z" stroke-width="1.2"/>'),
  bell: sv('<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2H4.5z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>'),
  grip: sv('<circle cx="9" cy="6" r="1.2" fill="currentColor"/><circle cx="15" cy="6" r="1.2" fill="currentColor"/><circle cx="9" cy="12" r="1.2" fill="currentColor"/><circle cx="15" cy="12" r="1.2" fill="currentColor"/><circle cx="9" cy="18" r="1.2" fill="currentColor"/><circle cx="15" cy="18" r="1.2" fill="currentColor"/>'),
  check: sv('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  trash: sv('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  edit: sv('<path d="M4 20h4L19 9l-4-4L4 16v4z"/>'),
  note: sv('<path d="M5 4h14v11l-5 5H5z"/><path d="M14 20v-5h5"/>'),
  image: sv('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5-5-8 8"/>'),
  link: sv('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  file: sv('<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/>'),
  contact: sv('<circle cx="12" cy="8" r="3.5"/><path d="M5 20c1-4 4-6 7-6s6 2 7 6"/>'),
  compare: sv('<rect x="3" y="5" width="7" height="14" rx="1.5"/><rect x="14" y="5" width="7" height="14" rx="1.5"/>'),
  label: sv('<path d="M4 7h16M4 12h10M4 17h7"/>'),
  palette: sv('<circle cx="12" cy="12" r="9"/><circle cx="8" cy="10" r="1.3" fill="currentColor"/><circle cx="12" cy="7.5" r="1.3" fill="currentColor"/><circle cx="16" cy="10" r="1.3" fill="currentColor"/><path d="M12 21a2.5 2.5 0 0 1 0-5h2"/>'),
  video: sv('<rect x="3" y="5" width="13" height="14" rx="2"/><path d="M16 10l5-3v10l-5-3"/>'),
  play: sv('<path d="M8 5l11 7-11 7z" fill="currentColor"/>'),
  phone: sv('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>'),
  restore: sv('<path d="M4 12a8 8 0 1 0 2.5-5.8L4 8.5"/><path d="M4 4v4.5h4.5"/>'),
  zoomIn: sv('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.3-4.3M11 8v6M8 11h6"/>'),
  zoomOut: sv('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.3-4.3M8 11h6"/>'),
  external: sv('<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>'),
  settings: sv('<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z"/>'),
  back: sv('<path d="M15 5l-7 7 7 7"/>'),
  plan: sv('<path d="M5 6h14M5 12h14M5 18h9"/><circle cx="19" cy="18" r="1.4" fill="currentColor"/>'),
  decide: sv('<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>'),
  board: sv('<rect x="3" y="3" width="8" height="10" rx="1.5"/><rect x="13" y="3" width="8" height="6" rx="1.5"/><rect x="13" y="11" width="8" height="10" rx="1.5"/><rect x="3" y="15" width="8" height="6" rx="1.5"/>'),
  budget: sv('<path d="M7 5h10M7 9.5h10M10 5c3.5 0 5 2 5 4.5S13 14 10 14H7l7 6"/>'),
  folder: sv('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  history: sv('<path d="M4 12a8 8 0 1 0 2.5-5.8L4 8.5"/><path d="M4 4v4.5h4.5M12 8v4.5l3 2"/>'),
  user: sv('<circle cx="12" cy="8" r="3.5"/><path d="M5 20c1-4 4-6 7-6s6 2 7 6"/>'),
  logout: sv('<path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/>'),
  lock: sv('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  comment: sv('<path d="M4 5h16v11H9l-5 4z"/>'),
  overview: sv('<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>'),
  list: sv('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.2" fill="currentColor"/><circle cx="4.5" cy="12" r="1.2" fill="currentColor"/><circle cx="4.5" cy="18" r="1.2" fill="currentColor"/>'),
  undo: sv('<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>'),
  redo: sv('<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>'),
  search: sv('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.3-4.3"/>'),
  crop: sv('<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M2 6h14a2 2 0 0 1 2 2v14"/>'),
  checklist: sv('<path d="M4 6l2 2 3-3M4 13l2 2 3-3M12 7h8M12 14h8M12 20h8"/>'),
  collage: sv('<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="18" height="8" rx="1.5"/>'),
  select: sv('<rect x="4" y="4" width="16" height="16" rx="2" stroke-dasharray="3 3"/>'),
  broom: sv('<path d="M14 4l6 6M12 6l6 6-7 7H5v-6z"/><path d="M9 13l2 2"/>')
};

// A small pop-up menu under a button. items: [{ icon, label, onClick }] (nulls are skipped).
export function popMenu(btn, items, head) {
  btn = onScreen(btn);
  const old = document.querySelector('.menu-pop');
  if (old) { old.remove(); if (old._owner === btn) return; }
  const close = () => { pop.remove(); document.removeEventListener('pointerdown', outside, true); };
  const outside = (e) => { if (!pop.contains(e.target) && !btn.contains(e.target)) close(); };
  const pop = h('div', { class: 'menu-pop', role: 'menu' },
    head ? h('div', { class: 'mp-head' }, h('b', {}, head)) : null,
    items.filter(Boolean).map(it => h(it.href ? 'a' : 'button', { type: it.href ? null : 'button', href: it.href || null, class: 'mi', onclick: () => { close(); if (it.onClick) it.onClick(); } },
      h('span', { class: 'mi-ic', html: ICONS[it.icon] || '' }), h('span', {}, it.label))));
  pop._owner = btn;
  document.body.append(pop);
  const r = btn.getBoundingClientRect();
  pop.style.top = Math.min(r.bottom + 8, innerHeight - pop.offsetHeight - 8) + 'px';
  pop.style.right = Math.max(8, innerWidth - r.right) + 'px';
  setTimeout(() => document.addEventListener('pointerdown', outside, true));
}
