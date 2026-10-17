import { store } from './store.js';
import { h, modal, field, toast, confirmBox, shortDate, daysUntil, ICONS } from './ui.js';
import { live, ui } from './app.js';

const STATUS = { todo: 'To do', doing: 'In progress', done: 'Done' };
const byPos = (a, b) => (a.position || 0) - (b.position || 0);

function fail(e) { console.error(e); toast(e.message || 'That did not save. Check your connection.', 'error'); }

function newPosition(listEl, id, rows) {
  const ids = [...listEl.children].map(c => c.dataset.id).filter(Boolean);
  const i = ids.indexOf(id);
  const pos = (x) => { const r = rows.find(r => r.id === x); return r ? r.position || 0 : 0; };
  const prev = i > 0 ? pos(ids[i - 1]) : null;
  const next = i < ids.length - 1 ? pos(ids[i + 1]) : null;
  if (prev === null && next === null) return 1000;
  if (prev === null) return next - 1000;
  if (next === null) return prev + 1000;
  return (prev + next) / 2;
}

function renameBox(title, current, onSave) {
  const input = h('input', { value: current, maxlength: 120 });
  modal({
    title, body: field('Name', input),
    actions: [{ label: 'Save', onClick: async () => { const v = input.value.trim(); if (!v) return false; await onSave(v).catch(fail); } }]
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); input.closest('.modal').querySelector('.modal-actions .btn').click(); } });
}

function menu(items) {
  return h('button', {
    class: 'icon-btn menu-btn', type: 'button', 'aria-label': 'More options',
    html: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/></svg>',
    onclick: () => {
      const m = modal({
        title: items.title,
        body: h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
          items.list.map(it => h('button', { class: 'btn ' + (it.kind || 'ghost'), type: 'button', style: { justifyContent: 'flex-start' }, onclick: () => { m.close(); it.onClick(); } }, it.label)))
      });
    }
  });
}

export function editStep(step, table = 'steps') {
  const title = h('textarea', { rows: 2, style: { minHeight: '60px' } }); title.value = step.title;
  const owner = h('input', { value: step.owner || '', placeholder: 'Who is handling it', maxlength: 60 });
  const due = h('input', { type: 'date', value: step.due || '' });
  const status = h('select', {}, Object.entries(STATUS).map(([k, v]) => h('option', { value: k, selected: step.status === k ? true : null }, v)));
  const notes = h('textarea', { placeholder: 'Details, phone numbers, decisions…' }); notes.value = step.notes || '';
  modal({
    title: table === 'todos' ? 'To-do' : 'Step',
    body: h('div', { class: 'form-grid' },
      h('div', { class: 'full' }, field('What needs doing', title)),
      field('Person in charge', owner), field('Due by', due), field('Status', status),
      h('div', { class: 'full' }, field('Notes', notes))),
    actions: [
      { label: 'Move to Bin', kind: 'ghost', onClick: async () => { await store.remove(table, step.id).then(() => toast('Moved to the Bin')).catch(fail); } },
      {
        label: 'Save', onClick: async () => {
          const patch = { title: title.value.trim() || step.title, owner: owner.value.trim(), due: due.value || null, status: status.value, notes: notes.value };
          const changed = Object.keys(patch).some(k => (patch[k] || '') !== (step[k] || ''));
          if (changed) await store.update(table, step.id, patch).catch(fail);
        }
      }
    ]
  });
}

export function renderPipeline(root, w, params) {
  const stages = live(store.rows('stages')).filter(s => s.wedding_id === w.id).sort(byPos);
  const areasAll = live(store.rows('areas')).filter(a => a.wedding_id === w.id);
  const stepsAll = live(store.rows('steps')).filter(s => s.wedding_id === w.id);
  const visibleAreaIds = new Set(areasAll.filter(a => stages.some(s => s.id === a.stage_id)).map(a => a.id));
  const visSteps = stepsAll.filter(s => visibleAreaIds.has(s.area_id));
  const done = visSteps.filter(s => s.status === 'done').length;

  root.append(h('div', { class: 'pipeline-head' },
    h('h2', {}, 'The plan, start to finish'),
    h('div', { class: 'progress' },
      h('span', { class: 'bar', role: 'img', 'aria-label': `${done} of ${visSteps.length} steps done` }, h('i', { style: { width: (visSteps.length ? done / visSteps.length * 100 : 0) + '%' } })),
      `${done} of ${visSteps.length} done`)));
  root.append(h('p', { class: 'muted', style: { margin: '-6px 0 14px', fontSize: '14px' } }, 'Tap a step to edit it. Drag by the dots to reorder; on a phone, press and hold a step to move it.'));

  const stagesEl = h('div', { class: 'stages' });
  for (const st of stages) {
    const areas = areasAll.filter(a => a.stage_id === st.id).sort(byPos);
    const stepCount = visSteps.filter(s => areas.some(a => a.id === s.area_id)).length;
    const areasEl = h('div', { class: 'areas', dataset: { stage: st.id } });
    for (const a of areas) areasEl.append(areaEl(a, visSteps.filter(s => s.area_id === a.id).sort(byPos), w));

    const addArea = h('button', {
      class: 'dashed', type: 'button', onclick: () => {
        const input = h('input', { placeholder: 'e.g. Decorations', maxlength: 120 });
        modal({
          title: `New area in ${st.title}`, body: field('Area name', input),
          actions: [{
            label: 'Add area', onClick: async () => {
              const v = input.value.trim(); if (!v) return false;
              const last = areas.length ? areas[areas.length - 1].position : 0;
              await store.insert('areas', { wedding_id: w.id, stage_id: st.id, title: v, position: last + 1000 }).catch(fail);
            }
          }]
        });
      }
    }, '+ Add an area');

    stagesEl.append(h('section', { class: 'stage', dataset: { id: st.id } },
      h('div', { class: 'stage-h' },
        h('button', { class: 'icon-btn grip stage-grip', type: 'button', 'aria-label': 'Drag to reorder stage', html: ICONS.grip }),
        h('h3', { onclick: () => renameBox('Rename stage', st.title, v => store.update('stages', st.id, { title: v })) }, st.title),
        h('span', { class: 'meta' }, `${areas.length} ${areas.length === 1 ? 'area' : 'areas'} · ${stepCount} steps`),
        menu({
          title: st.title, list: [
            { label: 'Rename', onClick: () => renameBox('Rename stage', st.title, v => store.update('stages', st.id, { title: v })) },
            {
              label: 'Move this stage to the Bin', kind: 'danger', onClick: async () => {
                if (await confirmBox(`Remove “${st.title}”?`, 'Its areas and steps go with it. Anyone can bring it back from the Bin.', 'Move to Bin'))
                  store.remove('stages', st.id).then(() => toast('Moved to the Bin')).catch(fail);
              }
            }
          ]
        })),
      areasEl, addArea));
  }
  stagesEl.append(h('div', { class: 'new-stage' },
    h('button', {
      class: 'link-btn', type: 'button', style: { textAlign: 'left' }, onclick: () => {
        const input = h('input', { placeholder: 'e.g. Engagement', maxlength: 60 });
        modal({
          title: 'New stage', body: field('Stage name', input),
          actions: [{
            label: 'Add stage', onClick: async () => {
              const v = input.value.trim(); if (!v) return false;
              const last = stages.length ? stages[stages.length - 1].position : 0;
              await store.insert('stages', { wedding_id: w.id, title: v, position: last + 1000 }).catch(fail);
            }
          }]
        });
      }
    }, '+ Add a stage'),
    h('span', {}, 'Removed stages wait in the Bin until the admin deletes them.')));
  root.append(stagesEl);

  // Drag and drop
  const S = window.Sortable;
  if (S) {
    const common = { animation: 160, ghostClass: 'sortable-ghost', chosenClass: 'sortable-chosen', onStart: () => { ui.busy = true; } };
    S.create(stagesEl, {
      ...common, handle: '.stage-grip', draggable: '.stage', direction: 'horizontal',
      onEnd: (e) => {
        ui.busy = false; const id = e.item.dataset.id;
        if (e.oldIndex === e.newIndex) return;
        store.update('stages', id, { position: newPosition(stagesEl, id, store.rows('stages')) }).catch(fail);
      }
    });
    stagesEl.querySelectorAll('.areas').forEach(list => S.create(list, {
      ...common, group: 'areas-' + w.id, handle: '.area-grip', draggable: '.area',
      onEnd: (e) => {
        ui.busy = false; const id = e.item.dataset.id;
        if (e.from === e.to && e.oldIndex === e.newIndex) return;
        store.update('areas', id, { stage_id: e.to.dataset.stage, position: newPosition(e.to, id, store.rows('areas')) }).catch(fail);
      }
    }));
    stagesEl.querySelectorAll('.steps').forEach(list => S.create(list, {
      ...common, group: 'steps-' + w.id, draggable: '.step', delay: 220, delayOnTouchOnly: true, filter: '.tick', preventOnFilter: false,
      onEnd: (e) => {
        ui.busy = false; const id = e.item.dataset.id;
        if (e.from === e.to && e.oldIndex === e.newIndex) return;
        store.update('steps', id, { area_id: e.to.dataset.area, position: newPosition(e.to, id, store.rows('steps')) }).catch(fail);
      }
    }));
  }

  if (params.focus) {
    requestAnimationFrame(() => {
      const el = root.querySelector(`[data-id="${CSS.escape(params.focus)}"]`);
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }); el.classList.add('flash'); }
    });
  }
}

function areaEl(a, steps, w) {
  const done = steps.filter(s => s.status === 'done').length;
  const list = h('ul', { class: 'steps', dataset: { area: a.id } }, steps.map(stepEl));
  const input = h('input', { placeholder: 'Add a step…', maxlength: 200, 'aria-label': `Add a step to ${a.title}` });
  const add = async () => {
    const v = input.value.trim(); if (!v) return;
    input.value = '';
    const last = steps.length ? steps[steps.length - 1].position : 0;
    await store.insert('steps', { wedding_id: w.id, area_id: a.id, title: v, position: last + 1000, status: 'todo', owner: '', notes: '' }).catch(fail);
    setTimeout(() => { const again = document.querySelector(`[aria-label="Add a step to ${CSS.escape(a.title)}"]`); if (again) again.focus(); }, 50);
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
  input.addEventListener('blur', () => { if (input.value.trim()) add(); });
  return h('div', { class: 'area', dataset: { id: a.id } },
    h('div', { class: 'area-h' },
      h('button', { class: 'icon-btn grip area-grip', type: 'button', 'aria-label': 'Drag to move area', html: ICONS.grip }),
      h('h4', { onclick: () => renameBox('Rename area', a.title, v => store.update('areas', a.id, { title: v })) }, a.title),
      h('span', { class: 'meta' }, steps.length ? `${done} of ${steps.length}` : ''),
      menu({
        title: a.title, list: [
          { label: 'Rename', onClick: () => renameBox('Rename area', a.title, v => store.update('areas', a.id, { title: v })) },
          { label: 'Move this area to the Bin', kind: 'danger', onClick: () => store.remove('areas', a.id).then(() => toast('Moved to the Bin')).catch(fail) }
        ]
      })),
    list,
    h('div', { class: 'add-line' }, input));
}

function stepEl(s) {
  const late = s.due && s.status !== 'done' && daysUntil(s.due) < 0;
  const sub = [s.owner, s.due ? (late ? null : 'due ' + shortDate(s.due)) : null].filter(Boolean).join(' · ');
  return h('li', { class: 'step' + (s.status === 'done' ? ' done' : ''), dataset: { id: s.id } },
    h('button', {
      class: 'tick ' + s.status, type: 'button',
      'aria-label': s.status === 'done' ? `Mark “${s.title}” as not done` : `Mark “${s.title}” as done`,
      html: s.status === 'done' ? ICONS.check : '',
      onclick: () => store.update('steps', s.id, { status: s.status === 'done' ? 'todo' : 'done' }).catch(fail)
    }),
    h('button', { class: 'txt', type: 'button', onclick: () => editStep(s) },
      h('span', { class: 't' }, s.title),
      (sub || late) ? h('span', { class: 'sub' }, sub, late ? h('span', { class: 'late' }, (sub ? ' · ' : '') + 'overdue since ' + shortDate(s.due)) : null) : null),
    s.status !== 'todo' ? h('span', { class: 'chip ' + s.status }, STATUS[s.status]) : h('span'));
}
