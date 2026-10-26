// Start a new wedding from an earlier one: its stages, sections and steps (fresh — nothing ticked,
// no names or dates), its big decisions, its lists' columns, and its budget lines with the amounts as a guide.
import { store } from './store.js?v=56';

const live = (t) => (store.rows(t) || []).filter(r => !r.deleted_at);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36));

export function planSize(wid) {
  const st = live('stages').filter(s => s.wedding_id === wid);
  const steps = live('steps').filter(s => s.wedding_id === wid);
  return { stages: st.length, steps: steps.length };
}

export async function copyPlanFrom(src, dst, opts = { lists: true, budget: true }) {
  const stages = live('stages').filter(s => s.wedding_id === src).sort((a, b) => a.position - b.position);
  const areas = live('areas').filter(a => a.wedding_id === src);
  const steps = live('steps').filter(s => s.wedding_id === src);
  const map = new Map();
  const newStages = stages.map(s => { const id = uid(); map.set(s.id, id); return { id, wedding_id: dst, title: s.title, position: s.position }; });
  const newAreas = areas.filter(a => map.has(a.stage_id)).map(a => { const id = uid(); map.set(a.id, id); return { id, wedding_id: dst, stage_id: map.get(a.stage_id), title: a.title, position: a.position }; });
  const newSteps = steps.filter(s => map.has(s.area_id)).map(s => { const id = uid(); map.set(s.id, id); const c = s.lock_note && s.lock_note.choose;
    return { id, wedding_id: dst, area_id: map.get(s.area_id), title: s.title, notes: s.notes || '', owner: '', due: null, status: 'todo', gate: !!s.gate, lock_note: c !== undefined ? { choose: c } : {}, position: s.position }; });
  await store.batch(async () => {
    if (newStages.length) await store.insertMany('stages', newStages);
    if (newAreas.length) await store.insertMany('areas', newAreas);
    if (newSteps.length) await store.insertMany('steps', newSteps);
    if (opts.lists) {
      const lists = live('lists').filter(l => l.wedding_id === src);
      if (lists.length) await store.insertMany('lists', lists.map(l => ({ wedding_id: dst, step_id: map.get(l.step_id) || null, title: l.title, columns: l.columns || ['Name', 'Notes'] })));
    }
    if (opts.budget) {
      const b = live('budgets').find(x => x.id === src);
      const lines = live('budget_areas').filter(a => a.budget_id === src);
      if (b || lines.length) {
        const w = store.find('weddings', dst) || {};
        await store.insert('budgets', { id: dst, wedding_id: dst, title: w.couple || 'Budget', position: w.position || 0, total: b ? b.total || 0 : 0, contingency: b ? b.contingency || 0 : 0 });
        if (lines.length) await store.insertMany('budget_areas', lines.map(a => ({ budget_id: dst, wedding_id: dst, title: a.title, planned: a.planned || 0, position: a.position || 0 })));
      }
    }
  });
  return { stages: newStages.length, sections: newAreas.length, steps: newSteps.length };
}
