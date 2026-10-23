// Start fresh. Everyone can clear the page they're on; the admin can clear everything.
// Cleared things go to the Bin together (same timestamp), so they can be restored together.
import { store, nowIso } from './store.js?v=35';
import { h, toast, modal, field } from './ui.js?v=35';
import { weddings, wedding } from './app.js?v=35';
import { together } from './history.js?v=35';
import { othersGate, withoutOthers, rescueOrphans } from './safety.js?v=35';

const liveRows = (t, pred) => (store.rows(t) || []).filter(r => !r.deleted_at && pred(r));

export const SECTIONS = {
  plan: { label: 'Plan', what: 'stages, areas and steps', rows: (wid) => [['stages', liveRows('stages', r => r.wedding_id === wid)], ['areas', liveRows('areas', r => r.wedding_id === wid)], ['steps', liveRows('steps', r => r.wedding_id === wid)]] },
  todo: { label: 'To-do list', what: 'to-dos', rows: (wid) => [['todos', liveRows('todos', r => r.wedding_id === wid)]] },
  board: { label: 'Mood board', what: 'cards, drawings and connections', rows: (wid) => [['board_items', liveRows('board_items', r => r.wedding_id === wid)]] },
  files: { label: 'Files and lists', what: 'files and lists', rows: (wid) => [['files', liveRows('files', r => r.wedding_id === wid)], ['lists', liveRows('lists', r => r.wedding_id === wid)]] },
  budget: { label: 'Budget', what: 'budget areas and payments', rows: (bid) => [['budget_areas', liveRows('budget_areas', r => r.budget_id === bid)], ['budget_items', liveRows('budget_items', r => r.budget_id === bid)]] }
};
const count = (groups) => groups.reduce((t, [, rows]) => t + rows.length, 0);

async function run(groups, forGood) {
  const ts = nowIso();
  let n = 0;
  await store.batch(() => together(async () => {   // one Undo brings the whole page back
    for (const [t, rows] of groups) {
      if (!rows.length) continue;
      if (forGood) { for (const r of rows) { if (store.find(t, r.id)) await store.purge(t, r.id); n++; } }
      else { await store.removeMany(t, rows.map(r => r.id), ts); n += rows.length; }
    }
  }));
  return n;
}

// Everyone: clear the section you're looking at.
export function clearPage(weddingId, section) {
  const sec = SECTIONS[section]; const w = wedding(weddingId);
  if (!sec || !w) return;
  const groups = sec.rows(weddingId);
  const n = count(groups);
  if (!n) { toast('This page is already empty'); return; }
  const gate = othersGate(groups);
  modal({
    title: `Clear the ${sec.label.toLowerCase()}?`,
    body: [h('p', { class: 'muted', style: { margin: 0 } }, `All ${n} ${sec.what} on ${w.couple}’s ${sec.label.toLowerCase()} move to the Bin, so the page starts empty. Anyone can bring them all back from the Bin with one tap.`), gate.el],
    actions: [{ label: 'Cancel', kind: 'ghost', onClick: () => { } }, {
      label: 'Clear this page', kind: 'danger', onClick: async () => {
        try { const keep = gate.keep(); const k = await run(keep ? withoutOthers(groups) : groups, false); if (keep && gate.n) await rescueOrphans(weddingId); toast(`Cleared ${k} — restore them together from the Bin`); } catch (e) { toast(e.message, 'error'); }
      }
    }]
  });
}

// Admin: clear any or all sections of any or all weddings, plus shared home costs.
export function clearAll(preset = {}) {
  if (!store.me.isAdmin) return;
  const ws = weddings();
  const wBoxes = ws.map(w => ({ w, box: h('input', { type: 'checkbox', checked: !preset.weddingId || preset.weddingId === w.id ? true : null }) }));
  const shared = h('input', { type: 'checkbox', checked: !preset.weddingId ? true : null });
  const sBoxes = Object.entries(SECTIONS).map(([k, s]) => ({ k, s, box: h('input', { type: 'checkbox', checked: !preset.section || preset.section === k ? true : null }) }));
  const forGood = h('input', { type: 'checkbox' });
  const typed = h('input', { placeholder: 'Type CLEAR', autocomplete: 'off', autocapitalize: 'characters' });
  const summary = h('p', { class: 'hint', style: { margin: 0 } });
  const collect = () => {
    const groups = [];
    for (const { w, box } of wBoxes) if (box.checked) for (const { k, s, box: sb } of sBoxes) if (sb.checked) groups.push(...s.rows(k === 'budget' ? w.id : w.id));
    const budgetOn = sBoxes.find(x => x.k === 'budget').box.checked;
    if (shared.checked && budgetOn) groups.push(...SECTIONS.budget.rows('shared'));
    return groups;
  };
  const gateBox = h('div');
  let gate = { keep: () => false };
  const refresh = () => { gate = othersGate(collect(), forGood.checked ? 'be deleted for good' : 'move to the Bin'); gateBox.replaceChildren(...(gate.el ? [gate.el] : [])); const n = count(gate.keep() ? withoutOthers(collect()) : collect()); summary.textContent = n ? `${n} things will ${forGood.checked ? 'be deleted for good' : 'move to the Bin'}.` : 'Nothing to clear with these choices.'; };
  [...wBoxes.map(x => x.box), ...sBoxes.map(x => x.box), shared, forGood].forEach(b => b.addEventListener('change', refresh));
  refresh();
  modal({
    title: 'Clear all and start over', wide: true,
    body: [
      h('p', { class: 'muted', style: { margin: 0 } }, 'Only you, as admin, can do this. Settings, names, themes, dates and family members stay as they are.'),
      h('div', { class: 'clear-grid' },
        h('fieldset', {}, h('legend', {}, 'Which weddings'), wBoxes.map(({ w, box }) => h('label', { class: 'd-check' }, box, w.couple)),
          h('label', { class: 'd-check' }, shared, 'Shared home costs (budget only)')),
        h('fieldset', {}, h('legend', {}, 'What to clear'), sBoxes.map(({ s, box }) => h('label', { class: 'd-check' }, box, `${s.label} — ${s.what}`)))),
      h('label', { class: 'd-check danger-check' }, forGood, 'Delete for good instead of moving to the Bin (can’t be undone)'),
      gateBox,
      summary,
      field('To confirm, type CLEAR', typed)],
    actions: [{ label: 'Cancel', kind: 'ghost', onClick: () => { } }, {
      label: 'Clear', kind: 'danger', onClick: async () => {
        if (typed.value.trim().toUpperCase() !== 'CLEAR') { typed.focus(); toast('Type CLEAR to confirm', 'error'); return false; }
        const groups = gate.keep() ? withoutOthers(collect()) : collect();
        if (!count(groups)) return false;
        toast('Clearing…');
        try { const k = await run(groups, forGood.checked); if (gate.keep() && gate.n) for (const { w, box } of wBoxes) if (box.checked) await rescueOrphans(w.id); toast(forGood.checked ? `Deleted ${k} for good` : `Cleared ${k} — restore them together from the Bin`); }
        catch (e) { toast(e.message, 'error'); }
      }
    }]
  });
}
