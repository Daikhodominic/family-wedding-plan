// Adding and removing things anywhere in the plan: between two steps, at the end of an area,
// a new area in a stage, a new stage. Used by the Map view and the step drawer.
import { store } from './store.js?v=39';
import { h, toast, modal, field, confirmBox } from './ui.js?v=39';

const live = (rows) => rows.filter(r => !r.deleted_at);
const byPos = (a, b) => (a.position || 0) - (b.position || 0);
const fail = (e) => { console.error(e); toast(e.message || 'That did not save. Check your connection.', 'error'); };

export function askTitle(title, placeholder, okLabel = 'Add') {
  return new Promise((resolve) => {
    const input = h('input', { placeholder, maxlength: 160 });
    let done = false;
    modal({
      title, body: field('Name', input),
      actions: [{ label: 'Cancel', kind: 'ghost', onClick: () => { done = true; resolve(null); } },
        { label: okLabel, onClick: () => { const v = input.value.trim(); if (!v) { input.focus(); return false; } done = true; resolve(v); } }],
      onClose: () => { if (!done) resolve(null); }
    });
    setTimeout(() => input.focus(), 50);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const b = [...document.querySelectorAll('.modal-actions .btn')].pop(); if (b) b.click(); } });
  });
}

// A new step in an area, placed right after `afterStep` (or at the end when it's null).
export async function addStepAt(areaId, afterStep = null) {
  const area = store.find('areas', areaId); if (!area) return;
  const steps = live(store.rows('steps')).filter(s => s.area_id === areaId).sort(byPos);
  let pos;
  if (!afterStep) pos = (steps.length ? steps[steps.length - 1].position || 0 : 0) + 1000;
  else { const i = steps.findIndex(s => s.id === afterStep.id); const a = steps[i] ? steps[i].position || 0 : 0; const b = steps[i + 1] ? steps[i + 1].position || 0 : a + 2000; pos = (a + b) / 2; }
  const title = await askTitle(afterStep ? `New step after “${afterStep.title}”` : `New step in ${area.title}`, 'e.g. Book the tasting');
  if (!title) return;
  await store.insert('steps', { wedding_id: area.wedding_id, area_id: areaId, title, position: pos, status: 'todo', owner: '', notes: '' }).then(() => toast('Added')).catch(fail);
}

export async function addAreaTo(stage) {
  const title = await askTitle(`New area in ${stage.title}`, 'e.g. Bridal shower');
  if (!title) return;
  const last = live(store.rows('areas')).filter(a => a.stage_id === stage.id).sort(byPos).pop();
  await store.insert('areas', { wedding_id: stage.wedding_id, stage_id: stage.id, title, position: (last ? last.position || 0 : 0) + 1000 }).then(() => toast('Area added')).catch(fail);
}

export async function addStageTo(weddingId) {
  const title = await askTitle('New stage', 'e.g. Engagement');
  if (!title) return;
  const last = live(store.rows('stages')).filter(s => s.wedding_id === weddingId).sort(byPos).pop();
  await store.insert('stages', { wedding_id: weddingId, title, position: (last ? last.position || 0 : 0) + 1000 }).then(() => toast('Stage added')).catch(fail);
}

export async function removeArea(area) {
  const steps = live(store.rows('steps')).filter(s => s.area_id === area.id);
  const others = steps.filter(s => s.created_by && store.me && s.created_by !== store.me.id);
  const names = [...new Set(others.map(s => store.memberName(s.created_by) || 'someone else'))];
  const ok = await confirmBox(`Remove “${area.title}”?`,
    `The area and its ${steps.length} ${steps.length === 1 ? 'step' : 'steps'} move to the Bin, where anyone can restore them.` + (others.length ? ` ${others.length} of these steps were added by ${names.join(', ')}.` : ''), 'Move to the Bin');
  if (!ok) return;
  await store.remove('areas', area.id).then(() => toast('Moved to the Bin')).catch(fail);
}
