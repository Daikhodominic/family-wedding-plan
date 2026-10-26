// Downloading photos and files: one at a time, or a whole category / board / the files as one .zip.
import { store } from './store.js?v=51';
import { toast } from './ui.js?v=51';
import { makeZip } from './zip.js?v=51';

const extOf = (p) => (/\.(\w{2,5})$/.exec(p || '') || [, 'jpg'])[1].toLowerCase();
const safeName = (s) => String(s || 'photo').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 60) || 'photo';
function saveBlob(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}
async function fetchBlob(path) {
  const url = /^(assets\/|https?:|blob:)/.test(path) ? path : await store.url(path);
  if (!url) throw new Error('missing');
  const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.blob();
}

// One photo or file, full size.
export async function downloadOne(path, name) {
  try { const b = await fetchBlob(path); saveBlob(b, `${safeName(name)}.${extOf(path)}`); }
  catch (e) { toast('That photo could not be downloaded. Check your connection.', 'error'); }
}

// Many: [{ path, name }] → one .zip. Names are made unique inside the zip.
export async function downloadZip(items, zipName) {
  const list = items.filter(x => x && x.path);
  if (!list.length) { toast('No photos to download yet'); return; }
  if (list.length === 1) return downloadOne(list[0].path, list[0].name);
  toast(`Preparing ${list.length} files…`);
  const entries = []; let failed = 0;
  for (let i = 0; i < list.length; i += 4) {
    const chunk = await Promise.all(list.slice(i, i + 4).map(async (x) => { try { return { name: `${safeName(x.name)}.${extOf(x.path)}`, data: await fetchBlob(x.path) }; } catch (e) { failed++; return null; } }));
    entries.push(...chunk.filter(Boolean));
  }
  if (!entries.length) { toast('Nothing could be downloaded. Check your connection.', 'error'); return; }
  saveBlob(await makeZip(entries), `${safeName(zipName)}.zip`);
  toast(failed ? `Downloaded ${entries.length} — ${failed} could not be fetched` : `Downloaded ${entries.length} files`);
}

// Photos of options in a category (each option's photos named after it).
export function optionPhotos(opts) {
  const out = [];
  for (const o of opts) { const d = o.data || {}; (d.images || []).forEach((x, i) => out.push({ path: x.path, name: `${d.title || 'Option'}${(d.images || []).length > 1 ? ' ' + (i + 1) : ''}` }));
    (d.final || []).forEach((v, k) => (v.images || []).forEach((x, i) => out.push({ path: x.path, name: `${d.title || 'Option'} - final v${k + 1}${(v.images || []).length > 1 ? ' ' + (i + 1) : ''}` }))); }
  return out;
}
// Photos and files on a mood board.
export function boardFiles(items) {
  const out = [];
  for (const it of items) { const d = it.data || {}; const t = d.title || d.caption || d.name || it.kind;
    if (d.path) out.push({ path: d.path, name: d.name ? d.name.replace(/\.[^.]+$/, '') : t });
    (d.images || []).forEach((x, i) => out.push({ path: x.path, name: `${t} ${i + 1}` })); }
  return out;
}

// The backup with every photo and file included: backup.json plus a media folder.
export async function backupWithPhotos(json, stamp) {
  const paths = new Set();
  for (const t of ['board_items', 'files', 'steps']) for (const r of store.rows(t) || []) {
    const d = r.data || {}; [r.path, r.thumb, d.path, d.thumb, ...(d.images || []).map(x => x.path), ...((d.final || []).flatMap(v => [...(v.images || []).map(x => x.path), ...(v.docs || []).map(x => x.path)])), r.lock_note && r.lock_note.image].forEach(p => { if (p && !/^(assets\/|https?:)/.test(p)) paths.add(p); });
  }
  toast(`Preparing the backup with ${paths.size} photos and files…`);
  const entries = [{ name: 'backup.json', data: json }]; let failed = 0;
  const arr = [...paths];
  for (let i = 0; i < arr.length; i += 4) {
    const chunk = await Promise.all(arr.slice(i, i + 4).map(async (p) => { try { return { name: 'media/' + p, data: await fetchBlob(p) }; } catch (e) { failed++; return null; } }));
    entries.push(...chunk.filter(Boolean));
  }
  saveBlob(await makeZip(entries), `wedding-war-room-backup-${stamp}.zip`);
  toast(failed ? `Backup downloaded — ${failed} files could not be fetched` : 'Backup with photos downloaded — keep it somewhere safe');
}
