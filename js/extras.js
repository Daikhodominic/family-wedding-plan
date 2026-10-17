import { store } from './store.js?v=7';
import { h, toast, field, confirmBox, ago, dayHeading, shortDate, longDate } from './ui.js?v=7';
import { weddings, wedding, themeOf, feedList, render, THEMES } from './app.js?v=7';

const NOUN = { stages: 'stage', areas: 'area', steps: 'step', todos: 'to-do', weddings: 'wedding space', board_items: 'card', files: 'file', lists: 'list' };
const CARD = { note: 'note', image: 'photo', video: 'video', file: 'document', link: 'link', contact: 'contact', compare: 'comparison', label: 'section title', palette: 'colours', shape: 'drawing', connector: 'connection' };
const FIELD = {
  title: 'name', owner: 'person in charge', due: 'due date', status: 'status', notes: 'notes', area_id: 'area', stage_id: 'stage',
  couple: 'couple names', monogram: 'monogram', wedding_date: 'wedding date', date_note: 'date note', theme: 'theme', theme_custom: 'theme colours',
  text: 'text', caption: 'caption', rate: 'rate', phone: 'phone', role: 'role', url: 'address', options: 'options', colors: 'colours',
  tint: 'colour', path: 'file', thumb: 'picture', kind: 'type'
};
const STATUS = { todo: 'To do', doing: 'In progress', done: 'Done' };

function nounFor(a) {
  if (a.entity === 'board_items') {
    const row = store.find('board_items', a.entity_id);
    return row ? CARD[row.kind] || 'card' : 'card';
  }
  return NOUN[a.entity] || 'item';
}
function show(v, key) {
  if (v === null || v === undefined || v === '') return '(empty)';
  if (key === 'status') return STATUS[v] || v;
  if (key === 'due' || key === 'wedding_date') return /^\d{4}-\d{2}-\d{2}$/.test(v) ? shortDate(v) : v;
  if (key === 'area_id') { const r = store.find('areas', v); return r ? r.title : 'another area'; }
  if (key === 'stage_id') { const r = store.find('stages', v); return r ? r.title : 'another stage'; }
  if (typeof v === 'object') return null;
  const s = String(v);
  return s.length > 60 ? s.slice(0, 57) + '…' : s;
}

export function describe(a) {
  const noun = nounFor(a);
  const name = a.label ? `“${a.label.length > 70 ? a.label.slice(0, 67) + '…' : a.label}”` : '';
  const changes = [];
  let text;
  switch (a.action) {
    case 'create': text = `added ${noun === 'wedding details' ? '' : 'a ' + noun} ${name}`; break;
    case 'remove': text = `moved ${noun === 'card' ? 'a card' : 'the ' + noun} ${name} to the Bin`; break;
    case 'restore': text = `restored ${noun === 'card' ? 'a card' : 'the ' + noun} ${name}`; break;
    case 'purge': text = `deleted ${noun === 'card' ? 'a card' : 'the ' + noun} ${name} for good`; break;
    default: {
      const ch = a.changes || {};
      const keys = Object.keys(ch);
      if (ch.locked_at && ch.locked_at.new && !ch.locked_at.old) {
        const ln = (ch.lock_note && ch.lock_note.new) || {};
        text = `locked ${name}` + (ln.with ? ` with ${ln.with}` : '') + (ln.amount ? ` for ₹${ln.amount}` : '');
        return { text: text.replace(/\s+/g, ' ').trim(), changes };
      } else if (ch.locked_at && !ch.locked_at.new && ch.locked_at.old) {
        return { text: `unlocked ${name}`, changes };
      } else if (keys.length === 1 && keys[0] === 'gate') {
        return { text: ch.gate.new ? `marked ${name} as a lock point` : `removed the lock point from ${name}`, changes };
      } else if (keys.length === 1 && keys[0] === 'status') {
        text = ch.status.new === 'done' ? `marked ${name} as done` : `set ${name} to ${STATUS[ch.status.new] || ch.status.new}`;
      } else if (keys.length === 1 && keys[0] === 'area_id') {
        text = `moved ${name} to ${show(ch.area_id.new, 'area_id')}`;
      } else if (keys.length === 1 && keys[0] === 'chosen') {
        text = `changed the choice on ${name}`;
      } else {
        text = `changed ${keys.map(k => FIELD[k] || k).join(', ')} on ${noun === 'card' ? 'a card' : 'the ' + noun} ${name}`;
      }
      for (const k of keys) {
        const o = show(ch[k].old, k), n = show(ch[k].new, k);
        if (o === null || n === null) continue;
        changes.push(h('span', { style: { display: 'block' } }, (FIELD[k] || k) + ': ', h('s', {}, o), ' → ', n));
      }
    }
  }
  return { text: text.replace(/\s+/g, ' ').trim(), changes };
}

export function linkFor(a) {
  const w = a.wedding_id;
  const row = store.find(a.entity, a.entity_id);
  if (a.action === 'purge' || !row) return '#/activity';
  if (row.deleted_at) return '#/bin';
  if (a.entity === 'weddings') return '#/w/' + a.entity_id;
  if (row.wedding_id && (store.find('weddings', row.wedding_id) || {}).deleted_at) return '#/bin';
  if (a.entity === 'board_items') return `#/w/${w}/board?focus=${a.entity_id}`;
  if (a.entity === 'todos') return `#/w/${w}/todo?focus=${a.entity_id}`;
  if (a.entity === 'files' || a.entity === 'lists') return row.step_id && store.find('steps', row.step_id) ? `#/w/${w}?focus=${row.step_id}` : `#/w/${w}/files`;
  if (a.entity === 'steps') {
    const area = store.find('areas', row.area_id);
    if (!area || area.deleted_at || (store.find('stages', area.stage_id) || {}).deleted_at) return '#/bin';
  }
  if (a.entity === 'areas' && (store.find('stages', row.stage_id) || {}).deleted_at) return '#/bin';
  return `#/w/${w}?focus=${a.entity_id}`;
}

/* ---------- Activity ---------- */
let actFilter = 'all';
export function renderActivity() {
  const all = store.rows('activity');
  const list = all.filter(a => actFilter === 'all' || a.wedding_id === actFilter);
  const newCount = all.filter(a => a.id > store.me.lastSeen && a.actor !== store.me.id).length;
  const box = h('div', { class: 'panel' });
  if (!list.length) box.append(h('p', { class: 'muted' }, 'No changes yet.'));
  let day = null; let chunk = [];
  const flush = () => { if (chunk.length) { box.append(h('div', { class: 'day-h' }, day), feedList(chunk)); chunk = []; } };
  for (const a of list) { const d = dayHeading(a.created_at); if (d !== day) { flush(); day = d; } chunk.push(a); }
  flush();
  const top = all[0];
  if (top) setTimeout(() => store.markSeen(top.id), 1500);
  return h('main', { class: 'wrap', style: { paddingBottom: '60px' } },
    h('div', { class: 'eyebrow' }, 'Both weddings'), h('h1', { class: 'page-title' }, 'Edit history'),
    h('p', { class: 'muted', style: { margin: 0 } }, newCount ? `${newCount} new since your last visit, highlighted below. Tap any change to see it.` : 'Every change across both weddings. Tap any change to see it.'),
    h('div', { class: 'filters', role: 'group', 'aria-label': 'Filter' },
      [['all', 'Both weddings'], ...weddings().map(w => [w.id, w.couple])].map(([k, l]) =>
        h('button', { class: 'filter', type: 'button', 'aria-pressed': String(actFilter === k), onclick: () => { actFilter = k; render(); } }, l))),
    box);
}

/* ---------- Bin ---------- */
export function renderBin() {
  const rows = [];
  for (const t of ['weddings', 'stages', 'areas', 'steps', 'todos', 'board_items', 'files', 'lists']) for (const r of (store.rows(t) || [])) if (r.deleted_at) rows.push({ t, r });
  rows.sort((a, b) => new Date(b.r.deleted_at) - new Date(a.r.deleted_at));
  const label = ({ t, r }) => {
    if (t === 'board_items') { const d = r.data || {}; return `${(CARD[r.kind] || 'card').replace(/^./, c => c.toUpperCase())}${d.title || d.text ? ': ' + (d.title || d.text).slice(0, 80) : ''}`; }
    const n = NOUN[t]; return `${n[0].toUpperCase() + n.slice(1)}: ${r.title || r.couple}`;
  };
  const context = ({ t, r }) => {
    const w = store.find('weddings', r.wedding_id);
    const bits = [t === 'weddings' ? 'the whole space, with its plan, to-dos and board' : w ? w.couple + (w.deleted_at ? ' (removed)' : '') : ''];
    if (t === 'steps') { const a = store.find('areas', r.area_id); if (a) bits.push('in ' + a.title); }
    if (t === 'areas') { const s = store.find('stages', r.stage_id); if (s) bits.push('in ' + s.title); }
    if (t === 'stages') { const n = store.rows('areas').filter(a => a.stage_id === r.id && !a.deleted_at).length; if (n) bits.push(`with ${n} ${n === 1 ? 'area' : 'areas'} inside`); }
    const who = store.memberName(r.deleted_by);
    bits.push(`removed ${who ? 'by ' + who + ' ' : ''}${ago(r.deleted_at)}`);
    return bits.filter(Boolean).join(' · ');
  };
  const list = h('div', { class: 'panel' });
  if (!rows.length) list.append(h('p', { class: 'muted' }, 'The Bin is empty.'));
  for (const it of rows) {
    list.append(h('div', { class: 'bin-row' },
      h('div', {}, h('div', { style: { fontWeight: 500 } }, label(it)), h('div', { class: 'muted', style: { fontSize: '14px' } }, context(it))),
      h('div', { class: 'acts' },
        it.t === 'weddings' && !store.me.isAdmin ? h('span', { class: 'muted', style: { fontSize: '13px' } }, 'Only the admin can restore a whole space') :
        h('button', { class: 'btn soft small', type: 'button', onclick: () => restoreWithParents(it.t, it.r).then(() => toast('Restored')).catch(e => toast(e.message, 'error')) }, 'Restore'),
        store.me.isAdmin ? h('button', {
          class: 'btn ghost small', type: 'button', style: { color: 'var(--warn)' }, onclick: async () => {
            if (!(await confirmBox('Delete for good?', `“${label(it)}” will be gone for everyone and can't be restored.`, 'Delete for good'))) return;
            store.purge(it.t, it.r.id).then(() => toast('Deleted')).catch(e => toast(e.message, 'error'));
          }
        }, 'Delete for good') : null)));
  }
  const emptyAll = store.me.isAdmin && rows.length ? h('button', {
    class: 'btn ghost small', type: 'button', style: { color: 'var(--warn)' }, onclick: async () => {
      if (!(await confirmBox('Empty the Bin?', `All ${rows.length} items will be deleted for everyone and can't be restored.`, 'Delete everything in the Bin'))) return;
      const order = ['files', 'lists', 'board_items', 'todos', 'steps', 'areas', 'stages', 'weddings'];
      for (const t of order) for (const it of rows.filter(x => x.t === t)) { if (store.find(t, it.r.id)) await store.purge(t, it.r.id).catch(e => toast(e.message, 'error')); }
      toast('The Bin is empty');
    }
  }, 'Empty the Bin') : null;
  return h('main', { class: 'wrap', style: { paddingBottom: '60px' } },
    h('div', { style: { display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px' } }, h('div', {}, h('div', { class: 'eyebrow' }, 'Anyone can restore'), h('h1', { class: 'page-title' }, 'Bin')), emptyAll),
    h('p', { class: 'muted', style: { marginTop: 0 } }, store.me.isAdmin ? 'Anyone can restore things from here. Only you, as admin, can delete them for good.' : 'Anything removed waits here. Anyone can restore it; only the admin can delete it for good.'),
    list);
}

// Restoring something inside a removed area or stage brings the parents back too.
async function restoreWithParents(t, r) {
  const chain = [];
  if (t === 'steps') { const a = store.find('areas', r.area_id); if (a) { chain.push(['areas', a]); const s = store.find('stages', a.stage_id); if (s) chain.push(['stages', s]); } }
  if (t === 'areas') { const s = store.find('stages', r.stage_id); if (s) chain.push(['stages', s]); }
  const w = store.find('weddings', r.wedding_id);
  if (w && w.deleted_at && store.me.isAdmin) chain.push(['weddings', w]);
  for (const [pt, pr] of chain.reverse()) if (pr.deleted_at) await store.restore(pt, pr.id);
  await store.restore(t, r.id);
}

/* ---------- Settings (admin) ---------- */
async function moveWedding(w, dir) {
  const list = weddings();
  const i = list.findIndex(x => x.id === w.id), j = i + dir;
  if (j < 0 || j >= list.length) return;
  const other = list[j];
  const a = w.position || i + 1, b = other.position || j + 1;
  try { await store.update('weddings', w.id, { position: b === a ? a + dir : b }); await store.update('weddings', other.id, { position: a }); }
  catch (e) { toast(e.message, 'error'); }
}

export function renderSettings() {
  if (!store.me.isAdmin) return h('main', { class: 'wrap' }, h('p', {}, 'Only the admin can open settings.'));
  const cards = weddings().map(w => {
    const t = themeOf(w);
    const couple = h('input', { value: w.couple, maxlength: 80 });
    const mono = h('input', { value: w.monogram, maxlength: 9, placeholder: 'e.g. C&A' });
    const date = h('input', { type: 'date', value: w.wedding_date || '' });
    const note = h('input', { value: w.date_note || '', placeholder: 'e.g. February – March 2027' });
    const theme = h('select', {}, Object.keys(THEMES).map(k => h('option', { value: k, selected: w.theme === k ? true : null }, k === 'blue' ? 'Dusty blue (floral wreath)' : 'Rose & mauve (wax seal)')));
    const accent = h('input', { type: 'color', value: t.accent });
    const bg = h('input', { type: 'color', value: t.bg });
    const light = h('input', { type: 'color', value: t.light });
    return h('section', { class: 'panel' },
      h('h2', { class: 'serif', style: { margin: '0 0 12px', fontWeight: 500, fontSize: '26px' } }, w.couple),
      h('div', { class: 'form-grid' },
        h('div', { class: 'full' }, field('Couple names', couple)),
        field('Monogram', mono), field('Wedding date', date, w.wedding_date ? longDate(w.wedding_date) : 'Leave empty until it’s fixed'),
        h('div', { class: 'full' }, field('When it’s roughly happening (shown until the date is set)', note)),
        h('div', { class: 'full' }, field('Theme', theme)),
        field('Main colour', accent), field('Background', bg), field('Soft colour', light)),
      h('div', { style: { display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' } },
        h('button', {
          class: 'btn', type: 'button', style: { background: t.accent }, onclick: async () => {
            const base = THEMES[theme.value];
            const custom = {};
            if (accent.value.toLowerCase() !== base.accent.toLowerCase()) custom.accent = accent.value;
            if (bg.value.toLowerCase() !== base.bg.toLowerCase()) custom.bg = bg.value;
            if (light.value.toLowerCase() !== base.light.toLowerCase()) custom.light = light.value;
            try {
              await store.update('weddings', w.id, { couple: couple.value.trim() || w.couple, monogram: mono.value.trim(), wedding_date: date.value || null, date_note: note.value.trim(), theme: theme.value, theme_custom: custom });
              toast('Saved');
            } catch (e) { toast(e.message, 'error'); }
          }
        }, 'Save'),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => { accent.value = THEMES[theme.value].accent; bg.value = THEMES[theme.value].bg; light.value = THEMES[theme.value].light; } }, 'Use the theme’s own colours')),
      h('div', { style: { display: 'flex', gap: '8px', marginTop: '18px', paddingTop: '14px', borderTop: '1px solid var(--line-soft)', flexWrap: 'wrap', alignItems: 'center' } },
        h('span', { class: 'muted', style: { fontSize: '14px', marginRight: 'auto' } }, 'Order on the home page'),
        h('button', { class: 'btn ghost small', type: 'button', 'aria-label': 'Move earlier', onclick: () => moveWedding(w, -1) }, '← Earlier'),
        h('button', { class: 'btn ghost small', type: 'button', 'aria-label': 'Move later', onclick: () => moveWedding(w, 1) }, 'Later →'),
        h('button', {
          class: 'btn ghost small', type: 'button', style: { color: 'var(--warn)' }, onclick: async () => {
            if (!(await confirmBox(`Remove ${w.couple}?`, 'The whole space (plan, to-dos and mood board) moves to the Bin. You can restore it from there.', 'Move to Bin'))) return;
            store.remove('weddings', w.id).then(() => toast('Moved to the Bin')).catch(e => toast(e.message, 'error'));
          }
        }, 'Remove this space')));
  });

  // Add a new wedding or event space
  const nCouple = h('input', { maxlength: 80, placeholder: 'e.g. Engagement of …  or  Name & Name' });
  const nMono = h('input', { maxlength: 9, placeholder: 'e.g. A&B' });
  const nDate = h('input', { type: 'date' });
  const nTheme = h('select', {}, h('option', { value: 'blue' }, 'Dusty blue (floral wreath)'), h('option', { value: 'rose' }, 'Rose & mauve (wax seal)'));
  const nTpl = h('input', { type: 'checkbox', checked: true, id: 'new-tpl', style: { width: 'auto' } });
  const addSpace = h('section', { class: 'panel' },
    h('h2', { class: 'serif', style: { margin: '0 0 6px', fontWeight: 500, fontSize: '26px' } }, 'Add a wedding or event'),
    h('p', { class: 'muted', style: { marginTop: 0 } }, 'Gives it its own arch on the home page, with a pipeline, to-do list and mood board.'),
    h('div', { class: 'form-grid' }, h('div', { class: 'full' }, field('Names or title', nCouple)), field('Monogram', nMono), field('Date (if fixed)', nDate), h('div', { class: 'full' }, field('Theme', nTheme))),
    h('label', { for: 'new-tpl', style: { display: 'flex', gap: '8px', alignItems: 'center', margin: '12px 0' } }, nTpl, 'Start with the Before / During / After plan'),
    h('button', {
      class: 'btn', type: 'button', style: { background: '#2F2B2C' }, onclick: async () => {
        const name = nCouple.value.trim(); if (!name) return toast('Add the names or a title first', 'error');
        const slug = (name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'space') + '-' + Math.random().toString(36).slice(2, 6);
        const pos = Math.max(0, ...store.rows('weddings').map(x => x.position || 0)) + 1;
        try {
          await store.insert('weddings', { id: slug, couple: name, monogram: nMono.value.trim(), wedding_date: nDate.value || null, date_note: nDate.value ? '' : 'Date to be fixed', theme: nTheme.value, theme_custom: {}, position: pos });
          if (nTpl.checked) await store.addTemplate(slug);
          toast('Added'); location.hash = '#/w/' + slug;
        } catch (e) { toast(e.message.includes('policy') || e.message.includes('row-level') ? 'Run database update 2 in Supabase first.' : e.message, 'error'); }
      }
    }, 'Add this space'));
  cards.push(addSpace);

  const p1 = h('input', { type: 'password', autocomplete: 'new-password' });
  const p2 = h('input', { type: 'password', autocomplete: 'new-password' });
  const pass = h('section', { class: 'panel' },
    h('h2', { class: 'serif', style: { margin: '0 0 6px', fontWeight: 500, fontSize: '26px' } }, 'Family passcode'),
    h('p', { class: 'muted', style: { marginTop: 0 } }, 'Changing it does not sign out people who are already in. New devices will need the new passcode.'),
    h('div', { class: 'form-grid' }, field('New passcode', p1), field('Type it again', p2)),
    h('button', {
      class: 'btn', type: 'button', style: { marginTop: '14px', background: '#2F2B2C' }, onclick: async () => {
        if (p1.value.length < 4) return toast('Use at least 4 characters', 'error');
        if (p1.value !== p2.value) return toast('The two passcodes don’t match', 'error');
        try { await store.setPasscode(p1.value); p1.value = p2.value = ''; toast('Passcode changed'); } catch (e) { toast(e.message, 'error'); }
      }
    }, 'Change passcode'));

  const people = h('section', { class: 'panel' },
    h('h2', { class: 'serif', style: { margin: '0 0 6px', fontWeight: 500, fontSize: '26px' } }, 'Who has joined'),
    h('p', { class: 'muted', style: { marginTop: 0, fontSize: '14px' } }, 'Removing someone signs them out of the plans. They can come back only with the passcode — change it too if they shouldn’t.'),
    h('div', {}, store.rows('members').map(m => h('div', { class: 'bin-row' },
      h('span', {}, m.name, m.is_admin ? h('span', { class: 'muted' }, ' · admin') : null),
      m.is_admin ? h('span') : h('button', {
        class: 'btn ghost small', type: 'button', style: { color: 'var(--warn)' }, onclick: async () => {
          if (!(await confirmBox(`Remove ${m.name}?`, 'They will no longer see or change the plans on their devices.', 'Remove'))) return;
          store.removeMember(m.user_id).then(() => toast('Removed')).catch(e => toast(e.message, 'error'));
        }
      }, 'Remove')))));

  return h('main', { class: 'wrap', style: { paddingBottom: '60px' } },
    h('div', { class: 'eyebrow' }, 'Admin only'), h('h1', { class: 'page-title' }, 'Settings'),
    h('p', { class: 'muted', style: { marginTop: 0 } }, 'Only you can see this page.'),
    h('div', { class: 'settings-grid' }, cards),
    h('div', { class: 'settings-grid' }, pass, people));
}
