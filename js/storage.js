// Storage for the admin: how much space the photos and files take, what they are, and clearing by kind.
// Supabase's free plan gives 1 GB of file storage. Every photo is kept as a full picture plus a small copy.
import { store } from './store.js?v=52';
import { h, toast, modal } from './ui.js?v=52';
const prettySize = (n) => !n ? '0 KB' : n >= 1024 ** 3 ? (n / 1024 ** 3).toFixed(n >= 10 * 1024 ** 3 ? 0 : 1).replace(/\.0$/, '') + ' GB' : n >= 1024 * 1024 ? (n / 1024 / 1024).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
import { live } from './app.js?v=52';

const LIMIT = 1024 * 1024 * 1024; // 1 GB — Supabase free plan
const KINDS = {
  options: { label: 'Option photos', blurb: 'Photos of the options in Choose (vendors, designs, samples to swipe).' },
  final: { label: 'Final designs', blurb: 'Final versions added after a sample was chosen.' },
  board: { label: 'Mood board', blurb: 'Photos, galleries, videos and files on the mood boards.' },
  files: { label: 'Files', blurb: 'Documents and photos under Lists & files, and on plan steps.' },
  bin: { label: 'In the Bin', blurb: 'Photos and files of things that were deleted. Clearing removes them for good.', clear: true },
  backups: { label: 'Backups', blurb: 'The weekly automatic backups (the newest 8 are kept).' },
  unused: { label: 'Not used anywhere', blurb: 'Left over from uploads that were replaced or never saved. Safe to clear.', clear: true },
  notchosen: { label: 'Options not chosen', blurb: 'Photos of options that lost out, in categories that are final. Clearing deletes those options for good.', clear: true }
};

// Every stored path a row points at (a photo's small copy comes with it).
function pathsOf(t, r) {
  const out = [], add = (p) => { if (p && typeof p === 'string' && !/^(assets\/|https?:)/.test(p)) { out.push(p); if (/~t\.\w+$/.test(p)) out.push(p.replace(/~t\.\w+$/, '~t.small.jpg')); } };
  const d = r.data || {};
  if (t === 'files') { add(r.path); add(r.thumb); }
  if (t === 'board_items') {
    add(d.path); add(d.thumb); (d.images || []).forEach(x => add(x.path));
    (d.final || []).forEach(v => { (v.images || []).forEach(x => add(x.path)); (v.docs || []).forEach(x => { add(x.path); add(x.thumb); }); });
  }
  if (t === 'steps') { const n = r.lock_note || {}; add(n.image); add(n.choice && n.choice.image); }
  return out;
}
function finalPaths(r) { const s = new Set(); for (const v of ((r.data || {}).final || [])) { (v.images || []).forEach(x => { s.add(x.path); s.add(String(x.path).replace(/~t\.\w+$/, '~t.small.jpg')); }); (v.docs || []).forEach(x => { s.add(x.path); if (x.thumb) s.add(x.thumb); }); } return s; }

// Which kind each path belongs to, and which rows to delete if that kind is cleared.
function survey() {
  const kindOf = new Map(), rowsOf = { bin: [], notchosen: [] };
  const put = (p, k) => { if (!kindOf.has(p) || k === 'bin') kindOf.set(p, k); };
  const steps = new Map((store.rows('steps') || []).map(s => [s.id, s]));
  for (const t of ['board_items', 'files', 'steps']) for (const r of store.rows(t) || []) {
    const ps = pathsOf(t, r); if (!ps.length) continue;
    if (r.deleted_at) { ps.forEach(p => put(p, 'bin')); rowsOf.bin.push([t, r]); continue; }
    if (t === 'files') ps.forEach(p => put(p, 'files'));
    else if (t === 'steps') ps.forEach(p => put(p, 'options'));
    else if (r.kind === 'option') {
      const fp = finalPaths(r); const st = steps.get((r.data || {}).step_id);
      const lost = (r.data || {}).status === 'not' && st && st.locked_at;
      ps.forEach(p => put(p, fp.has(p) ? 'final' : lost ? 'notchosen' : 'options'));
      if (lost) rowsOf.notchosen.push([t, r]);
    } else ps.forEach(p => put(p, 'board'));
  }
  return { kindOf, rowsOf };
}

// The files actually in storage, with sizes.
async function listStored() {
  if (store.mode === 'demo') {
    const out = [];
    for (const [p, u] of store.blobs || []) { let size = 0; try { size = (await (await fetch(u)).blob()).size; } catch (e) { /* ignore */ } out.push({ path: p, size }); }
    return out;
  }
  const out = [];
  const walk = async (prefix, depth) => {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await store.sb.storage.from('media').list(prefix, { limit: 1000, offset });
      if (error) throw new Error(error.message);
      for (const o of data || []) {
        const full = prefix ? `${prefix}/${o.name}` : o.name;
        if (o.id === null || !o.metadata) { if (depth < 3) await walk(full, depth + 1); }
        else out.push({ path: full, size: (o.metadata && o.metadata.size) || 0 });
      }
      if (!data || data.length < 1000) break;
    }
  };
  await walk('', 0);
  return out;
}

let cache = null; // { at, files } — the settings page redraws often; the storage is only counted again when asked or after a while
export function storagePanel() {
  const body = h('div', { class: 'stg-body' }, h('p', { class: 'muted', style: { margin: 0 } }, 'Counting…'));
  const panel = h('section', { class: 'panel stg', 'data-fresh': '' }, h('h2', {}, 'Storage'), body);
  const load = async (force) => {
    try {
      if (force || !cache || Date.now() - cache.at > 120000) cache = { at: Date.now(), files: await listStored() };
      const files = cache.files;
      const { kindOf, rowsOf } = survey();
      const sums = Object.fromEntries(Object.keys(KINDS).map(k => [k, { n: 0, size: 0, paths: [] }]));
      let total = 0;
      for (const f of files) { const k = kindOf.get(f.path) || (f.path.startsWith('backups/') ? 'backups' : 'unused'); total += f.size; sums[k].n++; sums[k].size += f.size; sums[k].paths.push(f.path); }
      const pct = Math.min(100, total / LIMIT * 100);
      const clear = async (k) => {
        const s = sums[k], rows = rowsOf[k] || [];
        const tick = h('input', { type: 'checkbox' });
        modal({ title: `Clear “${KINDS[k].label}”?`,
          body: [h('p', { style: { marginTop: 0 } }, `${s.n} ${s.n === 1 ? 'file' : 'files'} · ${prettySize(s.size)}${rows.length ? ` · ${rows.length} ${rows.length === 1 ? 'item' : 'items'} deleted for good` : ''}.`),
            h('p', { class: 'muted' }, KINDS[k].blurb), h('label', { class: 'd-check' }, tick, 'I understand this can’t be undone')],
          actions: [{ label: 'Cancel', kind: 'ghost', onClick: () => { } }, { label: 'Clear it', onClick: async () => {
            if (!tick.checked) { toast('Tick the box to confirm', 'error'); return false; }
            try {
              for (const [t, r] of rows) await store.purge(t, r.id).catch(() => null);
              if (store.mode !== 'demo') for (let i = 0; i < s.paths.length; i += 100) { const { error } = await store.sb.storage.from('media').remove(s.paths.slice(i, i + 100)); if (error) throw new Error(error.message); }
              else for (const p of s.paths) store.blobs.delete(p);
              toast(`Cleared ${prettySize(s.size)}`); load(true);
            } catch (e) { toast(e.message || 'Could not clear', 'error'); return false; }
          } }] });
      };
      body.replaceChildren(
        h('div', { class: 'stg-top' }, h('b', {}, prettySize(total)), ' ', h('span', { class: 'muted' }, `of ${prettySize(LIMIT)} used (Supabase free plan) · ${files.length} files`)),
        h('div', { class: 'stg-bar', role: 'img', 'aria-label': `${pct.toFixed(1)}% used` }, h('i', { style: { width: pct + '%' }, class: pct > 85 ? 'warn' : '' })),
        pct > 85 ? h('p', { class: 'stg-warn' }, 'Storage is nearly full. Clear what’s in the Bin and unused files first.') : null,
        h('div', { class: 'stg-list' }, Object.entries(KINDS).map(([k, K]) => h('div', { class: 'stg-row' },
          h('div', { class: 'stg-tx' }, h('b', {}, K.label), h('span', { class: 'muted' }, K.blurb)),
          h('span', { class: 'stg-n' }, `${prettySize(sums[k].size)} · ${sums[k].n}`),
          K.clear && sums[k].n ? h('button', { type: 'button', class: 'btn ghost small', onclick: () => clear(k) }, 'Clear') : h('span', {})))),
        h('p', { class: 'hint', style: { margin: 0 } }, 'Photos are saved twice — the full picture and a small copy for quick loading. To free space from the mood board or options, delete those items first; they move to the Bin, and clearing the Bin frees the space.'),
        h('button', { type: 'button', class: 'link-btn', onclick: () => load(true) }, 'Count again'));
    } catch (e) { body.replaceChildren(h('p', { class: 'muted' }, 'Could not read the storage: ' + (e.message || e))); }
  };
  load();
  return panel;
}
