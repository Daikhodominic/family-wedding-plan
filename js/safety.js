// Guard rails for big actions: never quietly remove what other people added.
// "Others" = rows created by someone other than the person doing the action.
import { store, nowIso } from './store.js?v=39';
import { h } from './ui.js?v=39';

const NOUNS = { stages: ['stage', 'stages'], areas: ['area', 'areas'], steps: ['step', 'steps'], todos: ['to-do', 'to-dos'], board_items: ['card', 'cards'], files: ['file', 'files'], lists: ['list', 'lists'], budget_areas: ['budget area', 'budget areas'], budget_items: ['payment', 'payments'], comments: ['comment', 'comments'] };

export const byOthers = (r) => !!(r && r.created_by && store.me && r.created_by !== store.me.id);

// groups: [[table, rows], ...] → { n, people: [[name, 'Elow: 4 steps, 2 cards'], ...] }
export function othersSummary(groups) {
  const per = new Map();
  let n = 0;
  for (const [t, rows] of groups) for (const r of rows) {
    if (!byOthers(r)) continue;
    n++;
    const name = store.memberName(r.created_by) || 'Someone else';
    if (!per.has(name)) per.set(name, {});
    const c = per.get(name); c[t] = (c[t] || 0) + 1;
  }
  const people = [...per.entries()].map(([name, c]) => `${name}: ${Object.entries(c).map(([t, k]) => `${k} ${(NOUNS[t] || [t, t])[k === 1 ? 0 : 1]}`).join(', ')}`);
  return { n, people };
}

// A warning block with a "keep them" tick box (ticked by default). Returns { el, keep() }.
export function othersGate(groups, verb = 'be moved to the Bin') {
  const s = othersSummary(groups);
  if (!s.n) return { el: null, keep: () => false, n: 0 };
  const box = h('input', { type: 'checkbox', checked: true });
  const el = h('div', { class: 'others-gate', role: 'alert' },
    h('b', {}, `${s.n} ${s.n === 1 ? 'thing was' : 'things were'} added by other people`),
    h('ul', {}, s.people.map(p => h('li', {}, p))),
    h('label', { class: 'd-check' }, box, 'Keep what others added'),
    h('span', { class: 'hint', style: { margin: 0 } }, `If you untick this, their things will ${verb} too.`));
  return { el, keep: () => box.checked, n: s.n };
}

export const withoutOthers = (groups) => groups.map(([t, rows]) => [t, rows.filter(r => !byOthers(r))]);

// Put other people's plan steps (whose area is gone) into one area so nothing is lost.
async function rehome(weddingId, stepRows, title) {
  if (!stepRows.length) return;
  const liveStages = store.rows('stages').filter(s => s.wedding_id === weddingId && !s.deleted_at).sort((a, b) => (a.position || 0) - (b.position || 0));
  let stage = liveStages[0];
  if (!stage) stage = await store.insert('stages', { wedding_id: weddingId, title: 'Before', position: 1000 });
  let area = store.rows('areas').find(a => a.wedding_id === weddingId && a.stage_id === stage.id && a.title === title && !a.deleted_at);
  if (!area) area = await store.insert('areas', { wedding_id: weddingId, stage_id: stage.id, title, position: 500 });
  await store.patchMany('steps', stepRows.map(s => s.id), { area_id: area.id, deleted_at: null, deleted_by: null });
}

// Bring back only what others added from a group of binned rows ([{ t, r }]).
export async function bringBackOthers(items, title = 'Brought back from the old plan') {
  const mine = items.filter(it => byOthers(it.r));
  const liveArea = (id) => { const a = store.find('areas', id); return a && !a.deleted_at; };
  const liveStage = (id) => { const s = store.find('stages', id); return s && !s.deleted_at; };
  let n = 0;
  // Stages and areas other people made come back with everything inside them.
  for (const it of mine.filter(x => x.t === 'stages')) {
    await store.restoreMany('stages', [it.r.id]); n++;
    const areas = items.filter(x => x.t === 'areas' && x.r.stage_id === it.r.id).map(x => x.r.id);
    if (areas.length) await store.restoreMany('areas', areas);
    const steps = items.filter(x => x.t === 'steps' && areas.includes(x.r.area_id)).map(x => x.r.id);
    if (steps.length) await store.restoreMany('steps', steps);
  }
  for (const it of mine.filter(x => x.t === 'areas')) {
    if (!store.find('areas', it.r.id).deleted_at) continue;
    const patch = { deleted_at: null, deleted_by: null };
    if (!liveStage(it.r.stage_id)) {
      const first = store.rows('stages').filter(s => s.wedding_id === it.r.wedding_id && !s.deleted_at).sort((a, b) => (a.position || 0) - (b.position || 0))[0];
      if (first) patch.stage_id = first.id;
    }
    await store.patchMany('areas', [it.r.id], patch); n++;
    const steps = items.filter(x => x.t === 'steps' && x.r.area_id === it.r.id).map(x => x.r.id);
    if (steps.length) await store.restoreMany('steps', steps);
  }
  // Single steps: back in their area if it still exists, otherwise gathered into one area.
  const loose = mine.filter(x => x.t === 'steps' && store.find('steps', x.r.id) && store.find('steps', x.r.id).deleted_at);
  const home = loose.filter(x => liveArea(x.r.area_id));
  if (home.length) await store.restoreMany('steps', home.map(x => x.r.id));
  const byWedding = new Map();
  for (const x of loose.filter(x => !liveArea(x.r.area_id))) { if (!byWedding.has(x.r.wedding_id)) byWedding.set(x.r.wedding_id, []); byWedding.get(x.r.wedding_id).push(x.r); }
  for (const [wid, rows] of byWedding) await rehome(wid, rows, title);
  n += loose.length;
  // Everything else simply comes back.
  const rest = mine.filter(x => !['stages', 'areas', 'steps'].includes(x.t));
  const tables = [...new Set(rest.map(x => x.t))];
  for (const t of tables) { const ids = rest.filter(x => x.t === t).map(x => x.r.id); await store.restoreMany(t, ids); n += ids.length; }
  return n;
}

// Used by the checklist loader: other people's steps in the old plan move into the new plan instead of the Bin.
export async function keepOthersSteps(weddingId, stepRows) { await rehome(weddingId, stepRows, 'Kept from the old plan'); return stepRows.length; }
// After a clear that kept other people's things: anything left without a home gets one.
export async function rescueOrphans(weddingId) {
  const live = (t) => store.rows(t).filter(r => r.wedding_id === weddingId && !r.deleted_at);
  const liveIds = (t) => new Set(live(t).map(r => r.id));
  let stages = liveIds('stages');
  const lostAreas = live('areas').filter(a => !stages.has(a.stage_id));
  if (lostAreas.length) {
    let first = live('stages').sort((a, b) => (a.position || 0) - (b.position || 0))[0];
    if (!first) first = await store.insert('stages', { wedding_id: weddingId, title: 'Before', position: 1000 });
    await store.patchMany('areas', lostAreas.map(a => a.id), { stage_id: first.id });
  }
  const areas = liveIds('areas');
  const lostSteps = live('steps').filter(st => !areas.has(st.area_id));
  if (lostSteps.length) await rehome(weddingId, lostSteps, 'Kept from the old plan');
}
export { nowIso };
