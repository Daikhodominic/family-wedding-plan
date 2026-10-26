// The Files tab: every file and list for one wedding, in one place.
import { store } from './store.js?v=51';
import { h, secHead } from './ui.js?v=51';
import { render } from './app.js?v=51';
import { fileTile, listRow, uploadTo, newList } from './panel.js?v=51';
import { pickFiles } from './board.js?v=51';
import { downloadZip } from './downloads.js?v=51';

let filter = 'all';
const live = (rows) => rows.filter(r => !r.deleted_at);

export function renderFiles(root, w, params = {}, opts = {}) {
  if (store.missing && store.missing.files) {
    root.append(h('div', { class: 'panel', style: { marginTop: '24px' } }, h('p', { style: { margin: 0 } }, 'Files and lists need database update 4. Ask the admin to run it in Supabase, then reload.')));
    return;
  }
  const files = live(store.rows('files')).filter(f => f.wedding_id === w.id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const lists = live(store.rows('lists')).filter(l => l.wedding_id === w.id).sort((a, b) => a.title.localeCompare(b.title));
  const isPhoto = (f) => /^(image|video)\//.test(f.mime);
  const shown = files.filter(f => filter === 'all' || (filter === 'photos' ? isPhoto(f) : filter === 'docs' ? !isPhoto(f) : false));

  const drop = h('div', { class: 'd-files' }, shown.length ? shown.map(f => fileTile(f, { showStep: true })) : h('p', { class: 'muted', style: { margin: 0 } }, files.length ? 'Nothing with this filter.' : 'No files yet. Upload invitations, quotes, receipts, photos or spreadsheets — everyone in the family can open and download them.'));
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files.length) uploadTo(w.id, null, [...e.dataTransfer.files]); });

  const filesPanel = h('section', { class: 'panel', id: 'files' },
      h('div', { class: 'd-sec-h', style: { marginBottom: '6px', flexWrap: 'wrap', gap: '8px' } }, h('h3', { class: 'serif', style: { margin: 0, fontWeight: 500, fontSize: '24px' } }, 'Files'),
        h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' } },
          h('div', { class: 'filters', style: { margin: 0 } }, [['all', `All (${files.length})`], ['photos', 'Photos and videos'], ['docs', 'Documents']].map(([k, l]) =>
            h('button', { class: 'filter', type: 'button', 'aria-pressed': String(filter === k), onclick: () => { filter = k; render(); } }, l))),
          h('button', { class: 'btn small', type: 'button', onclick: async () => { const fs = await pickFiles('*/*'); if (fs.length) uploadTo(w.id, null, fs); } }, '+ Upload files'),
          shown.length ? h('button', { class: 'btn small ghost', type: 'button', onclick: () => downloadZip(shown.map(f => ({ path: f.path, name: (f.name || f.title || 'file').replace(/\.[^.]+$/, '') })), `${w.couple} files`) }, '⬇ Download all') : null)),
      drop);
  if (opts.embedded) { root.append(filesPanel); return; }
  root.append(h('div', { class: 'files-page' },
    secHead('Shared with the family', 'Files and lists',
      h('button', { class: 'btn', type: 'button', onclick: async () => { const fs = await pickFiles('*/*'); if (fs.length) uploadTo(w.id, null, fs); } }, '+ Upload files'),
      h('button', { class: 'btn ghost', type: 'button', onclick: () => newList(w.id, null) }, '+ New list')),
    h('section', { class: 'panel' },
      h('div', { class: 'd-sec-h', style: { marginBottom: '6px' } }, h('h3', { class: 'serif', style: { margin: 0, fontWeight: 500, fontSize: '24px' } }, 'Lists'), h('span', { class: 'ft-sub' }, 'Guest lists, invitation lists, shopping lists — download any of them for Excel')),
      lists.length ? h('div', {}, lists.map(l => listRow(l, { showStep: true }))) : h('p', { class: 'muted', style: { margin: 0 } }, 'No lists yet. Start one with “New list”, or from a step in the pipeline.')),
    h('section', { class: 'panel' },
      h('div', { class: 'd-sec-h', style: { marginBottom: '6px', flexWrap: 'wrap', gap: '8px' } }, h('h3', { class: 'serif', style: { margin: 0, fontWeight: 500, fontSize: '24px' } }, 'Files'),
        h('div', { class: 'filters', style: { margin: 0 } }, [['all', `All (${files.length})`], ['photos', 'Photos and videos'], ['docs', 'Documents']].map(([k, l]) =>
          h('button', { class: 'filter', type: 'button', 'aria-pressed': String(filter === k), onclick: () => { filter = k; render(); } }, l)))),
      h('p', { class: 'ft-sub', style: { margin: '0 0 10px' } }, 'Drag files here from your computer, or use Upload. Files added to a step show which step they belong to.'),
      drop)));
}
