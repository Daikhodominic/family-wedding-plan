// Automatic backups: once a week, the admin's phone or laptop quietly saves a copy of everything
// (plan, lists, votes, budget, comments) into the family's storage. The newest 8 are kept.
// Settings → Backups lists them, to download or to make one now.
import { store } from './store.js?v=55';
import { h, toast } from './ui.js?v=55';
import { backupJson } from './tools.js?v=55';

const KEY = 'fwp-auto-backup-at', WEEK = 7 * 24 * 3600 * 1000, KEEP = 8;
const pad = (n) => String(n).padStart(2, '0');
const stampName = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}-${pad(d.getMinutes())}.json`; }; // local time, so the list reads naturally

export async function backupNow({ quiet = false } = {}) {
  await store.saveBackup(stampName(), backupJson());
  try { localStorage.setItem(KEY, String(Date.now())); } catch (e) { /* ignore */ }
  const all = await store.listBackups().catch(() => []);
  if (all.length > KEEP) await store.removeBackups(all.slice(KEEP).map(b => b.path)).catch(() => null);
  if (!quiet) toast('Backup saved');
}
// Called once after the plans load. Only the admin's device does it, and only when a week has passed.
export function autoBackup() {
  if (!store.me || !store.me.isAdmin || store.mode !== 'live') return;
  let last = 0; try { last = Number(localStorage.getItem(KEY)) || 0; } catch (e) { /* ignore */ }
  if (Date.now() - last < WEEK) return;
  setTimeout(() => backupNow({ quiet: true }).then(() => toast('Weekly backup saved')).catch(e => console.warn('backup', e)), 8000);
}

let cache = null;
export function backupsPanel() {
  const body = h('div', { class: 'bk-body' }, h('p', { class: 'muted', style: { margin: 0 } }, 'Looking…'));
  const panel = h('section', { class: 'panel bk', 'data-fresh': '' }, h('h2', {}, 'Backups'), body);
  const draw = (list) => {
    let last = 0; try { last = Number(localStorage.getItem(KEY)) || 0; } catch (e) { /* ignore */ }
    body.replaceChildren(
      h('p', { class: 'muted', style: { margin: 0 } }, `A copy of everything is saved automatically every week, from your device, and the newest ${KEEP} are kept. ${last ? 'Last one: ' + new Date(last).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) + '.' : 'None yet.'} Photos aren’t inside these — use “Download a backup → With all photos” for that.`),
      list.length ? h('ul', { class: 'bk-list' }, list.map(b => h('li', {}, h('span', {}, b.name.replace(/\.json$/, '').replace(/^(\d{4})-(\d\d)-(\d\d)-(\d\d)-(\d\d)$/, '$3/$2/$1 $4:$5')), h('small', {}, b.size ? Math.max(1, Math.round(b.size / 1024)) + ' KB' : ''),
        h('button', { type: 'button', class: 'btn ghost small', onclick: async () => { const u = store.mode === 'demo' ? store.blobs.get(b.path) : await store.downloadUrl(b.path, 'wedding-war-room-' + b.name); if (u) { const a = h('a', { href: u, download: 'wedding-war-room-' + b.name }); document.body.append(a); a.click(); a.remove(); } } }, 'Download')))) : h('p', { class: 'muted', style: { margin: 0 } }, 'No backups saved yet.'),
      h('button', { type: 'button', class: 'btn small', onclick: async (e) => { e.currentTarget.disabled = true; try { await backupNow(); cache = null; load(); } catch (err) { toast(err.message || 'Could not save the backup', 'error'); } } }, 'Back up now'));
  };
  panel.append(nightlyPart());
  const load = () => store.listBackups().then(l => { cache = l; draw(l); }).catch(e => body.replaceChildren(h('p', { class: 'muted' }, 'Could not list the backups: ' + (e.message || e))));
  if (cache) draw(cache); else load();
  return panel;
}

// Nightly copies, made by Supabase at 3 am even when nobody opens the app (database update 15).
function nightlyPart() {
  const box = h('div', { class: 'bk-night' }, h('h3', {}, 'Every night'), h('p', { class: 'muted', style: { margin: 0 } }, 'Looking…'));
  const when = (iso) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  const save = async (b) => {
    try {
      const j = await store.nightlyBackup(b.id); if (!j) throw new Error('Not found');
      const u = URL.createObjectURL(new Blob([JSON.stringify(j, null, 1)], { type: 'application/json' }));
      const a = h('a', { href: u, download: `wedding-war-room-nightly-${String(b.taken_at).slice(0, 10)}.json` }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
    } catch (e) { toast(e.message || 'Could not download it', 'error'); }
  };
  const draw = (list) => {
    const head = box.firstChild;
    if (list === null) { box.replaceChildren(head, h('p', { class: 'muted', style: { margin: 0 } }, 'Not switched on yet. Run database update 15 in Supabase (SQL Editor) and a copy of everything is saved every night at 3 am, even when nobody opens the app.')); return; }
    box.replaceChildren(head,
      h('p', { class: 'muted', style: { margin: 0 } }, `Supabase saves a copy of everything at 3 am every night, even when nobody opens the app. The newest 14 are kept. ${list.length ? 'Last one: ' + when(list[0].taken_at) + '.' : ''}`),
      list.length ? h('ul', { class: 'bk-list' }, list.map(b => h('li', {}, h('span', {}, when(b.taken_at)), h('small', {}, `${b.rows_total} rows · ${Math.max(1, b.size_kb)} KB`),
        h('button', { type: 'button', class: 'btn ghost small', onclick: () => save(b) }, 'Download')))) : null,
      h('button', { type: 'button', class: 'btn ghost small', onclick: async (e) => { e.currentTarget.disabled = true; try { await store.nightlyNow(); toast('Copy saved'); load(); } catch (err) { toast(err.message || 'Could not make a copy', 'error'); } } }, 'Make a copy now'));
  };
  const load = () => store.nightlyBackups().then(draw).catch(e => box.replaceChildren(box.firstChild, h('p', { class: 'muted' }, 'Could not list them: ' + (e.message || e))));
  load();
  return box;
}
