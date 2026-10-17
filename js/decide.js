// Decide and Budget pages. Both read the same data as the plan, so they update live.
import { store } from './store.js?v=11';
import { h, secHead, shortDate, daysUntil, ICONS } from './ui.js?v=11';
import { live, stepVisible } from './app.js?v=11';
import { openStep, lockIcon } from './panel.js?v=11';

const where = (s) => {
  const a = store.find('areas', s.area_id); const st = a && store.find('stages', a.stage_id);
  return [st && st.title, a && a.title].filter(Boolean).join(' › ');
};
const attachedCount = (s) => (store.rows('files') || []).filter(f => f.step_id === s.id && !f.deleted_at).length + (store.rows('lists') || []).filter(l => l.step_id === s.id && !l.deleted_at).length;

export function renderDecide(root, w) {
  const steps = live(store.rows('steps')).filter(s => s.wedding_id === w.id && stepVisible(s));
  const waiting = steps.filter(s => s.gate && !s.locked_at).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
  const locked = steps.filter(s => s.locked_at).sort((a, b) => b.locked_at.localeCompare(a.locked_at));

  root.append(secHead('Lock points', 'Decisions'));
  root.append(h('p', { class: 'hint' }, 'Lock points are the big choices — venue, caterer, menu, dress. Open one to add options, files and notes, then lock it once the family agrees. Only the admin can unlock.'));

  const card = (s) => {
    const late = s.due && daysUntil(s.due) < 0;
    const n = attachedCount(s);
    return h('button', { type: 'button', class: 'dcard', onclick: () => openStep(s.id) },
      h('span', { class: 'dc-where' }, where(s)),
      h('span', { class: 'dc-title' }, s.title),
      h('span', { class: 'dc-meta' },
        [s.owner ? 'With ' + s.owner : null, s.due ? (late ? 'overdue since ' : 'decide by ') + shortDate(s.due) : null, n ? n + ' attached' : null].filter(Boolean).join(' · ') || 'Nobody assigned yet'),
      s.notes ? h('span', { class: 'dc-notes' }, s.notes.length > 140 ? s.notes.slice(0, 138) + '…' : s.notes) : null,
      h('span', { class: 'dc-go' }, 'Open the decision →'));
  };

  root.append(h('section', { class: 'dsec' },
    h('div', { class: 'dsec-h' }, h('h2', {}, 'Waiting on a decision'), h('span', { class: 'count' }, String(waiting.length))),
    waiting.length ? h('div', { class: 'dgrid' }, waiting.map(card))
      : h('p', { class: 'muted' }, 'Nothing waiting. Open any step in the plan and tick “This is a lock point” to bring it here.')));

  root.append(h('section', { class: 'dsec' },
    h('div', { class: 'dsec-h' }, h('h2', {}, 'Decided and locked'), h('span', { class: 'count gold' }, String(locked.length))),
    locked.length ? h('div', { class: 'locked-list' }, locked.map(s => {
      const note = s.lock_note || {};
      return h('button', { type: 'button', class: 'lrow2', onclick: () => openStep(s.id) },
        h('span', { class: 'lk-ic', html: lockIcon(15) }),
        h('span', { class: 'lk-main' }, h('b', {}, s.title), h('span', {}, [note.with, where(s)].filter(Boolean).join(' · '))),
        h('span', { class: 'lk-when' }, 'Locked ' + shortDate(s.locked_at.slice(0, 10))));
    })) : h('p', { class: 'muted' }, 'Nothing locked yet.')));

  root.append(h('aside', { class: 'soon-note' },
    h('span', { class: 'soon-ic', html: ICONS.decide }),
    h('div', {}, h('b', {}, 'Coming next to this page'),
      h('p', {}, 'Options side by side with votes, a family-only discussion, suggestions from the partner family, and a record of every changed decision with the reason.'))));
}
