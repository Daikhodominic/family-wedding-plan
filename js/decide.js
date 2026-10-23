// Decide and Budget pages. Both read the same data as the plan, so they update live.
import { store } from './store.js?v=33';
import { h, secHead, shortDate, daysUntil, ICONS } from './ui.js?v=33';
import { live, stepVisible } from './app.js?v=33';
import { openStep, lockIcon } from './panel.js?v=33';
import { cardsForStep } from './decisions.js?v=33';
import { voteCounts, optionKey } from './feedback.js?v=33';

const where = (s) => {
  const a = store.find('areas', s.area_id); const st = a && store.find('stages', a.stage_id);
  return [st && st.title, a && a.title].filter(Boolean).join(' › ');
};
const attachedCount = (s) => (store.rows('files') || []).filter(f => f.step_id === s.id && !f.deleted_at).length + (store.rows('lists') || []).filter(l => l.step_id === s.id && !l.deleted_at).length;

export function renderDecide(root, w) {
  const steps = live(store.rows('steps')).filter(s => s.wedding_id === w.id && stepVisible(s));
  const waiting = steps.filter(s => s.gate && !s.locked_at).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
  const locked = steps.filter(s => s.locked_at).sort((a, b) => b.locked_at.localeCompare(a.locked_at));

  root.append(secHead('Big decisions', 'Decisions'));
  root.append(h('p', { class: 'hint' }, 'Big decisions are the main choices — venue, caterer, menu, dress. Open one to add options, files and notes. Once agreed, a Decider makes it final. Only the admin can reopen it.'));

  const card = (s) => {
    const late = s.due && daysUntil(s.due) < 0;
    const n = attachedCount(s);
    return h('button', { type: 'button', class: 'dcard', onclick: () => openStep(s.id) },
      h('span', { class: 'dc-where' }, where(s)),
      h('span', { class: 'dc-title' }, s.title),
      h('span', { class: 'dc-meta' },
        [s.owner ? 'With ' + s.owner : null, s.due ? (late ? 'overdue since ' : 'decide by ') + shortDate(s.due) : null, n ? n + ' attached' : null].filter(Boolean).join(' · ') || 'Nobody assigned yet'),
      s.notes ? h('span', { class: 'dc-notes' }, s.notes.length > 140 ? s.notes.slice(0, 138) + '…' : s.notes) : null,
      (() => { const c = cardsForStep(s.id).find(x => x.kind === 'compare'); if (!c) return null; const os = c.data.options || [];
        return h('span', { class: 'dc-votes' }, os.map((o, i) => { const v = voteCounts(c, optionKey(o, i)); return h('span', {}, `${o.title || String.fromCharCode(65 + i)}: ▲${v.up.length} ▼${v.down.length}`); })); })(),
      h('span', { class: 'dc-go' }, 'Open the decision →'));
  };

  root.append(h('section', { class: 'dsec' },
    h('div', { class: 'dsec-h' }, h('h2', {}, 'Waiting on a decision'), h('span', { class: 'count' }, String(waiting.length))),
    waiting.length ? h('div', { class: 'dgrid' }, waiting.map(card))
      : h('p', { class: 'muted' }, 'Nothing waiting. Open any step in the plan and tick “Big decision” to bring it here.')));

  root.append(h('section', { class: 'dsec' },
    h('div', { class: 'dsec-h' }, h('h2', {}, 'Decided and final'), h('span', { class: 'count gold' }, String(locked.length))),
    locked.length ? h('div', { class: 'locked-list' }, locked.map(s => {
      const note = s.lock_note || {};
      return h('button', { type: 'button', class: 'lrow2', onclick: () => openStep(s.id) },
        h('span', { class: 'lk-ic', html: lockIcon(15) }),
        h('span', { class: 'lk-main' }, h('b', {}, s.title), h('span', {}, [note.with, where(s)].filter(Boolean).join(' · '))),
        h('span', { class: 'lk-when' }, 'Final · ' + shortDate(s.locked_at.slice(0, 10))));
    })) : h('p', { class: 'muted' }, 'Nothing final yet.')));

  root.append(h('aside', { class: 'soon-note' },
    h('span', { class: 'soon-ic', html: ICONS.decide }),
    h('div', {}, h('b', {}, 'Coming next to this page'),
      h('p', {}, 'Options side by side with votes, a family-only discussion, suggestions from the partner family, and a record of every changed decision with the reason.'))));
}
