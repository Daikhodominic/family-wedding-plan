import { store } from './store.js?v=56';
import { h, toast, shortDate, daysUntil, ICONS } from './ui.js?v=56';
import { live, ui, render, stepVisible } from './app.js?v=56';
import { editStep } from './pipeline.js?v=56';
import { personInput } from './tools.js?v=56';
import { jobsFor, jobSections, isDone } from './myjobs.js?v=56';

const STATUS = { todo: 'To do', doing: 'In progress', done: 'Done' };
let showDone = false;   // the Done section starts folded
let person = '';        // filter by person in charge
let whose = null;       // 'mine' | 'all' — null until chosen: Mine when you have open jobs here

function fail(e) { console.error(e); toast(e.message || 'That did not save. Check your connection.', 'error'); }

export function renderTodo(root, w, params) {
  if (store.todosMissing) {
    root.append(h('div', { class: 'panel', style: { marginTop: '24px' } }, h('p', { style: { margin: 0 } }, 'The to-do list needs database update 2. Ask the admin to run it in Supabase, then reload.')));
    return;
  }
  const mineHere = store.me ? jobsFor(store.me.name).filter(t => t.wedding_id === w.id) : [];
  const view = whose || (mineHere.some(t => !isDone(t)) ? 'mine' : 'all');
  const nMine = mineHere.filter(t => !isDone(t)).length;
  root.append(h('div', { class: 'jobs-seg d-seg', role: 'radiogroup', 'aria-label': 'Whose jobs' },
    [['mine', `Mine${nMine ? ' · ' + nMine : ''}`], ['all', 'Everyone']].map(([k, l]) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(view === k), class: view === k ? 'on' : '', onclick: () => { whose = k; render(); } }, l))));
  if (view === 'mine') {
    root.append(h('p', { class: 'hint' }, `Steps and to-dos in this wedding with “${store.me.name}” as the person in charge.`));
    if (!mineHere.length) root.append(h('div', { class: 'budget-empty' }, h('h2', {}, 'Nothing with your name on it here yet'), h('p', {}, 'When someone puts you in charge of a step or a to-do, it shows here.'), h('button', { type: 'button', class: 'btn ghost', onclick: () => { whose = 'all'; render(); } }, 'See everyone’s jobs')));
    else root.append(jobSections(mineHere));
    return;
  }
  const all = live(store.rows('todos')).filter(t => t.wedding_id === w.id).sort((a, b) => (a.position || 0) - (b.position || 0));
  const owners = [...new Set(all.map(t => (t.owner || '').trim()).filter(Boolean))].sort();
  if (person && !owners.includes(person)) person = '';
  const mineOnly = (t) => !person || t.owner === person;
  const list = all.filter(t => t.status !== 'done' && mineOnly(t));
  const doneList = all.filter(t => t.status === 'done' && mineOnly(t));
  const openCount = all.filter(t => t.status !== 'done').length;

  // Quick add
  const input = h('input', { placeholder: 'Add a to-do and press Enter…', maxlength: 200, 'aria-label': 'New to-do' });
  const canAdd = store.may('todos', {}) === true;
  const who = personInput(person || '', { placeholder: 'Who (optional)', 'aria-label': 'Person in charge', style: { maxWidth: '200px' } });
  const due = h('input', { type: 'date', 'aria-label': 'Due date', style: { maxWidth: '170px' } });
  const add = async () => {
    const v = input.value.trim(); if (!v) return;
    input.value = '';
    const first = all.length ? Math.min(...all.map(t => t.position || 0)) : 1000;
    await store.insert('todos', { wedding_id: w.id, title: v, owner: who.value.trim(), due: due.value || null, status: 'todo', notes: '', position: first - 1000 }).catch(fail);
    setTimeout(() => { const again = document.querySelector('[aria-label="New to-do"]'); if (again) again.focus(); }, 60);
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });

  const ul = h('ul', { class: 'steps todo-list' }, list.map(t => todoEl(t)));

  // Coming up from the pipeline
  const soon = live(store.rows('steps')).filter(s => s.wedding_id === w.id && s.status !== 'done' && s.due && daysUntil(s.due) <= 14 && stepVisible(s)).sort((a, b) => a.due.localeCompare(b.due));

  root.append(
    h('p', { class: 'hint' }, openCount ? `${openCount} still to do. Quick jobs that don’t need a place in the plan.` : 'All done. Add quick jobs that don’t need a place in the plan.'),
    h('div', { class: 'todo-grid' },
      h('div', { class: 'panel', style: { padding: '18px 20px' } },
        canAdd ? h('div', { class: 'add-line', style: { flexWrap: 'wrap', marginTop: 0 } }, input, who, due, h('button', { class: 'btn small', type: 'button', onclick: add }, 'Add')) : null,
        h('div', { class: 'filters' },
          owners.length ? h('span', { class: 'muted', style: { alignSelf: 'center', fontSize: '13px', margin: '0 4px 0 0' } }, 'Show:') : null,
          owners.length ? [['', 'Anyone'], ...owners.map(o => [o, o])].map(([k, l]) => h('button', { class: 'filter', type: 'button', 'aria-pressed': String(person === k), onclick: () => { person = k; render(); } }, l)) : null),
        list.length ? ul : h('p', { class: 'muted' }, all.length ? (doneList.length ? 'All done! Nothing left on the list.' : 'Nothing here for this person.') : 'No to-dos yet. Type one above, like “Call the caterer about the tasting”.'),
        doneList.length ? h('div', { class: 'done-sec' },
          h('button', { type: 'button', class: 'done-toggle', 'aria-expanded': String(showDone), onclick: () => { showDone = !showDone; render(); } }, (showDone ? '▾ ' : '▸ ') + `Done · ${doneList.length}`),
          showDone ? h('ul', { class: 'steps todo-list done-list' }, doneList.map(t => todoEl(t))) : null) : null,
        list.length ? h('p', { class: 'muted', style: { fontSize: '13px', margin: '10px 0 0' } }, 'Drag to reorder (press and hold on a phone). Tap a to-do to add a person, date or notes.') : null),
      h('aside', { class: 'panel', style: { padding: '18px 20px' } },
        h('h3', { class: 'serif', style: { margin: '0 0 6px', fontSize: '22px', fontWeight: 500 } }, 'Coming up in the plan'),
        h('p', { class: 'muted', style: { margin: '0 0 8px', fontSize: '14px' } }, 'Pipeline steps due in the next two weeks, or overdue.'),
        soon.length ? h('ul', { class: 'feed' }, soon.map(s => h('li', {}, h('a', { class: 'row', href: `#/w/${w.id}?focus=${s.id}`, style: { gridTemplateColumns: 'minmax(0,1fr) auto' } },
          h('span', {}, s.title, s.owner ? h('span', { class: 'muted' }, ' · ' + s.owner) : null),
          h('span', { class: 'time', style: daysUntil(s.due) < 0 ? { color: 'var(--warn)', fontWeight: 500 } : null }, daysUntil(s.due) < 0 ? 'overdue' : shortDate(s.due)))))) :
          h('p', { class: 'muted', style: { margin: 0 } }, 'Nothing due soon. Add due dates to pipeline steps and they’ll show here.'))));

  const S = window.Sortable;
  if (S && list.length > 1) {
    S.create(ul, {
      animation: 160, ghostClass: 'sortable-ghost', chosenClass: 'sortable-chosen', delay: 220, delayOnTouchOnly: true, filter: '.tick', preventOnFilter: false,
      onStart: () => { ui.busy = true; },
      onEnd: (e) => {
        ui.busy = false;
        if (e.oldIndex === e.newIndex) return;
        const ids = [...ul.children].map(c => c.dataset.id);
        const i = ids.indexOf(e.item.dataset.id);
        const pos = (id) => (store.find('todos', id) || {}).position || 0;
        const prev = i > 0 ? pos(ids[i - 1]) : null, next = i < ids.length - 1 ? pos(ids[i + 1]) : null;
        const p = prev === null ? next - 1000 : next === null ? prev + 1000 : (prev + next) / 2;
        store.update('todos', e.item.dataset.id, { position: p }).catch(fail);
      }
    });
  }

  if (params.focus) requestAnimationFrame(() => {
    const el = document.querySelector(`[data-id="${CSS.escape(params.focus)}"]`);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('flash'); }
  });
}

function toastUndo(text, undoFn) {
  const holder = document.getElementById('toasts') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'toasts' }));
  const el = h('div', { class: 'toast with-act' }, text, h('button', { type: 'button', onclick: () => { undoFn(); el.remove(); } }, 'Undo'));
  holder.append(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 500); }, 5000);
}

function todoEl(t) {
  const late = t.due && t.status !== 'done' && daysUntil(t.due) < 0;
  const sub = [t.owner, t.due && !late ? 'due ' + shortDate(t.due) : null].filter(Boolean).join(' · ');
  return h('li', { class: 'step' + (t.status === 'done' ? ' done' : ''), dataset: { id: t.id } },
    h('button', {
      class: 'tick ' + t.status, type: 'button', html: t.status === 'done' ? ICONS.check : '',
      'aria-label': t.status === 'done' ? `Mark “${t.title}” as not done` : `Mark “${t.title}” as done`,
      onclick: () => {
        const was = t.status;
        store.update('todos', t.id, { status: was === 'done' ? 'todo' : 'done' }).then(() => { if (was !== 'done') toastUndo(`Done: ${t.title}`, () => store.update('todos', t.id, { status: was })); }).catch(fail);
      }
    }),
    h('button', { class: 'txt', type: 'button', onclick: () => editStep(t, 'todos') },
      h('span', { class: 't' }, t.title),
      (sub || late) ? h('span', { class: 'sub' }, sub, late ? h('span', { class: 'late' }, (sub ? ' · ' : '') + 'overdue since ' + shortDate(t.due)) : null) : null,
      t.notes ? h('span', { class: 'sub' }, t.notes.length > 90 ? t.notes.slice(0, 88) + '…' : t.notes) : null),
    h('span', { style: { display: 'flex', alignItems: 'center', gap: '4px' } },
      t.status === 'doing' ? h('span', { class: 'chip doing' }, STATUS.doing) : null,
      h('button', { class: 'icon-btn', 'data-edit': '', type: 'button', 'aria-label': `Move “${t.title}” to the Bin`, html: ICONS.trash, style: { color: 'var(--w-muted)' }, onclick: () => store.remove('todos', t.id).then(() => toast('Moved to the Bin')).catch(fail) })));
}
