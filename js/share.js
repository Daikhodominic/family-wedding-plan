// Sharing in and out.
// In:  on an installed phone, the War Room appears in the Share menu (WhatsApp, the gallery, Instagram …).
//      Shared photos and links land on this page, and you choose where they go: a vendor already here,
//      a new option, or a sample for ideas.
// Out: an option's photos (and its name, price and links) can be shared to WhatsApp or any app.
import { store } from './store.js?v=52';
import { h, toast, uploadPhoto, ICONS, buzz } from './ui.js?v=52';
import { live, weddings, wedding, render } from './app.js?v=52';
import { optionsOf, categoriesOf, editOption, photoEl, firstPic } from './swipe.js?v=52';

const SHARE = 'fwp-share';
let shared = null, loading = false, pickW = null, busy = false;

async function readShared() {
  if (!('caches' in window)) return { files: [], text: '', url: '' };
  const cc = await caches.open(SHARE);
  const m = await cc.match('shared/meta'); if (!m) return { files: [], text: '', url: '' };
  const meta = await m.json();
  const files = [];
  for (const f of meta.files || []) { const r = await cc.match(f.key); if (r) { const b = await r.blob(); files.push(new File([b], f.name, { type: f.type || b.type })); } }
  return { ...meta, files };
}
async function clearShared() { try { const cc = await caches.open(SHARE); for (const k of await cc.keys()) await cc.delete(k); } catch (e) { /* ignore */ } shared = null; }
const linksIn = (s) => [...new Set([(s.url || ''), ...String(s.text || '').match(/https?:\/\/\S+/g) || []].map(x => x.trim()).filter(Boolean))];

async function uploadAll(files) {
  const imgs = [];
  for (const f of files.filter(f => /^image\//.test(f.type))) { try { imgs.push({ path: await uploadPhoto(store, f) }); } catch (e) { toast(e.message || 'A photo did not upload', 'error'); } }
  return imgs;
}

export function renderShare() {
  const root = h('main', { class: 'wrap share-page', 'data-fresh': '' });
  if (!shared && !loading) { loading = true; readShared().then(s => { shared = s; loading = false; render(); }).catch(() => { shared = { files: [] }; loading = false; render(); }); }
  root.append(h('div', { class: 'eyebrow' }, 'Shared to the War Room'), h('h1', { class: 'page-title' }, 'Where should this go?'));
  if (!shared) { root.append(h('p', { class: 'muted' }, 'Opening what you shared…')); return root; }
  const imgs = (shared.files || []).filter(f => /^image\//.test(f.type));
  const links = linksIn(shared);
  if (!imgs.length && !links.length && !(shared.text || '').trim()) {
    root.append(h('p', { class: 'muted' }, 'Nothing arrived. On your phone, choose photos in WhatsApp or the gallery, tap Share, then pick “War Room”.'), h('a', { class: 'btn', href: '#/home' }, 'Home'));
    return root;
  }
  const urls = imgs.map(f => URL.createObjectURL(f));
  root.append(h('div', { class: 'sh-got' },
    imgs.length ? h('div', { class: 'sh-pics' }, urls.slice(0, 12).map(u => h('img', { src: u, alt: '' })), imgs.length > 12 ? h('span', { class: 'sh-more' }, `+${imgs.length - 12}`) : null) : null,
    h('p', { class: 'sh-sum' }, [imgs.length ? `${imgs.length} ${imgs.length === 1 ? 'photo' : 'photos'}` : null, links.length ? `${links.length} ${links.length === 1 ? 'link' : 'links'}` : null].filter(Boolean).join(' · ')),
    (shared.text || '').trim() && !links.includes((shared.text || '').trim()) ? h('p', { class: 'sh-text' }, shared.text.slice(0, 300)) : null));
  const ws = weddings();
  const w = pickW && wedding(pickW) || (ws.length === 1 ? ws[0] : null);
  root.append(h('div', { class: 'sh-step' }, h('b', {}, '1. Which wedding?'),
    h('div', { class: 'lchips' }, ws.map(x => h('button', { type: 'button', class: 'lchip' + (w && w.id === x.id ? ' on' : ''), onclick: () => { pickW = x.id; render(); } }, x.couple)))));
  if (!w) return root;
  const done = async (hash) => { await clearShared(); buzz(14); location.hash = hash; };
  const addTo = async (o) => {
    if (busy) return; busy = true; toast(`Adding to ${(o.data || {}).title || 'the option'}…`);
    try {
      const add = await uploadAll(imgs);
      const cur = store.find('board_items', o.id) || o; const d = cur.data || {};
      await store.update('board_items', o.id, { data: { ...d, images: [...(d.images || []), ...add], links: [...new Set([...(d.links || []), ...links])] } });
      toast(`Added ${add.length ? add.length + ' photos' : 'the link'} to ${d.title || 'the option'}`);
      await done(`#/w/${w.id}/options?step=${d.step_id}`);
    } catch (e) { toast(e.message || 'That did not save', 'error'); } finally { busy = false; }
  };
  const asNew = async (sample) => {
    if (busy) return; busy = true;
    try {
      const add = await uploadAll(imgs);
      editOption(w, null, null, { images: add, links, notes: links.length ? '' : (shared.text || '').trim(), sample, onSaved: () => done(`#/w/${w.id}/choose`) });
    } finally { busy = false; }
  };
  const cats = categoriesOf(w).filter(c => optionsOf(w.id, c.step.id).length);
  root.append(h('div', { class: 'sh-step' }, h('b', {}, '2. Add it to…'),
    h('div', { class: 'sh-new' },
      h('button', { type: 'button', class: 'btn', onclick: () => asNew(false) }, '+ A new option to vote on'),
      h('button', { type: 'button', class: 'btn ghost', onclick: () => asNew(true) }, 'A sample for ideas (mood board)')),
    cats.length ? h('p', { class: 'muted', style: { margin: '14px 0 6px' } }, 'Or add the photos to a vendor that’s already here:') : null,
    cats.map(c => h('section', { class: 'sh-cat' }, h('h3', {}, c.step.title),
      h('div', { class: 'sh-opts' }, optionsOf(w.id, c.step.id).map(o => h('button', { type: 'button', class: 'sh-opt', onclick: () => addTo(o) },
        firstPic(o) ? photoEl(firstPic(o), '') : h('span', { class: 'sh-ph' }, ((o.data || {}).title || '?').slice(0, 2)),
        h('span', { class: 'sh-on' }, (o.data || {}).title || 'Option', (o.data || {}).rate ? h('small', {}, (o.data || {}).rate) : null))))))));
  root.append(h('button', { type: 'button', class: 'link-btn', style: { marginTop: '18px' }, onclick: async () => { await clearShared(); location.hash = '#/home'; } }, 'Discard what was shared'));
  return root;
}

/* ---------- Out: share an option's photos to WhatsApp or any app ---------- */
export const canShareFiles = () => !!(navigator.canShare && navigator.share);
export async function shareOption(o, stepTitle) {
  const d = o.data || {};
  const text = [`*${d.title || 'Option'}*${stepTitle ? ' — ' + stepTitle : ''}`, d.rate || '', ...(d.links || [])].filter(Boolean).join('\n');
  const paths = (d.images || []).map(x => x.path).slice(0, 10);
  try {
    if (canShareFiles() && paths.length) {
      toast('Getting the photos ready…');
      const files = [];
      for (const [i, p] of paths.entries()) { const u = await store.url(p); if (!u) continue; const b = await (await fetch(u)).blob(); files.push(new File([b], `${(d.title || 'photo').replace(/[^\w -]+/g, '')}-${i + 1}.jpg`, { type: b.type || 'image/jpeg' })); }
      if (files.length && navigator.canShare({ files })) { await navigator.share({ files, text }); return; }
    }
    if (navigator.share) { await navigator.share({ text }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
}
