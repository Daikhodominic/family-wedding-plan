// The first page of each wedding: what's happening, what's next, who is doing what.
import { store } from './store.js?v=11';
import { h, toast, modal, field, daysUntil, fancyDate, shortDate, ago, ICONS } from './ui.js?v=11';
import { live, stepVisible, feedList, themeOf } from './app.js?v=11';
import { openStep, lockIcon } from './panel.js?v=11';
import { planOf, journeyBar } from './map.js?v=11';
import { listSummary } from './lists.js?v=11';
import { budgetMath, inr } from './budget.js?v=11';
import { editStep } from './pipeline.js?v=11';

const fail = (e) => { console.error(e); toast(e.message || 'That did not save. Check your connection.', 'error'); };
const done = (t) => t.status === 'done' || !!t.locked_at;

// Setting or changing the wedding date (admin).
export function editDate(w) {
  if (!store.me.isAdmin) { toast('Only the admin can change the date'); return; }
  const date = h('input', { type: 'date', value: w.wedding_date || '' });
  const note = h('input', { value: w.date_note || '', maxlength: 60, placeholder: 'e.g. End of February 2027' });
  modal({
    title: 'Wedding date',
    body: [field('Date', date, 'Leave empty if it isn’t fixed yet.'), field('Until then, show', note, 'Shown instead of the date while it’s still being decided.')],
    actions: [
      w.wedding_date ? { label: 'Clear the date', kind: 'ghost', onClick: () => store.update('weddings', w.id, { wedding_date: null }).then(() => toast('Date cleared')).catch(fail) } : null,
      { label: 'Save', onClick: () => store.update('weddings', w.id, { wedding_date: date.value || null, date_note: note.value.trim() }).then(() => toast('Saved — the countdown is updated everywhere')).catch(fail) }].filter(Boolean)
  });
}

function tasksOf(w) {
  const steps = live(store.rows('steps')).filter(s => s.wedding_id === w.id && stepVisible(s)).map(s => {
    const a = store.find('areas', s.area_id);
    return { ...s, kind: 'step', where: a ? a.title : '' };
  });
  const todos = (store.missing && store.missing.todos) ? [] : live(store.rows('todos') || []).filter(t => t.wedding_id === w.id).map(t => ({ ...t, kind: 'todo', where: 'To-do list' }));
  return [...steps, ...todos];
}
const openTask = (t) => t.kind === 'todo' ? editStep(store.find('todos', t.id), 'todos') : openStep(t.id);

function taskRow(t, { showOwner = true } = {}) {
  const late = !done(t) && t.due && daysUntil(t.due) < 0;
  const bits = [showOwner ? (t.owner || 'nobody yet') : null, t.where, t.due ? (late ? 'overdue since ' + shortDate(t.due) : done(t) ? null : 'due ' + shortDate(t.due)) : null].filter(Boolean);
  return h('button', { type: 'button', class: 'orow' + (late ? ' late' : '') + (t.status === 'doing' ? ' doing' : ''), onclick: () => openTask(t) },
    h('span', { class: 'o-dot ' + (t.locked_at ? 'locked' : t.status) }),
    h('span', { class: 'o-main' }, h('b', {}, t.title), h('span', {}, bits.join(' · '))));
}

function block(title, items, empty, opts = {}) {
  return h('section', { class: 'oblock' + (opts.cls ? ' ' + opts.cls : '') },
    h('div', { class: 'ob-h' }, h('h2', {}, title), items.length ? h('span', { class: 'count' + (opts.countCls ? ' ' + opts.countCls : '') }, String(items.length)) : null),
    items.length ? h('div', { class: 'olist' }, items.slice(0, opts.limit || 6).map(t => taskRow(t, opts)), items.length > (opts.limit || 6) ? h('a', { class: 'o-more', href: opts.more || '#' }, `See all ${items.length} →`) : null)
      : h('p', { class: 'muted o-empty' }, empty));
}

export function renderOverview(root, w) {
  const t = themeOf(w);
  const days = daysUntil(w.wedding_date);
  const plan = planOf(w);
  const all = tasksOf(w);
  const open = all.filter(x => !done(x));
  const overdue = open.filter(x => x.due && daysUntil(x.due) < 0).sort((a, b) => a.due.localeCompare(b.due));
  const doing = open.filter(x => x.status === 'doing' && !overdue.includes(x));
  const soon = open.filter(x => x.due && daysUntil(x.due) >= 0 && daysUntil(x.due) <= 21 && x.status !== 'doing').sort((a, b) => a.due.localeCompare(b.due));
  const waiting = open.filter(x => x.kind === 'step' && x.gate);
  const finished = all.filter(done).length;

  // Header: date, countdown, progress
  root.append(h('section', { class: 'ohero' },
    h('div', { class: 'oh-when' },
      h('div', { class: 'eyebrow' }, 'The big day'),
      store.me.isAdmin
        ? h('button', { type: 'button', class: 'oh-date', onclick: () => editDate(w), title: 'Change the date' }, w.wedding_date ? fancyDate(w.wedding_date) : (w.date_note || 'Date not fixed yet'), h('span', { class: 'oh-edit', html: ICONS.edit }))
        : h('div', { class: 'oh-date' }, w.wedding_date ? fancyDate(w.wedding_date) : (w.date_note || 'Date not fixed yet')),
      w.wedding_date && days !== null
        ? h('div', { class: 'oh-count' }, h('b', {}, String(Math.max(0, days))), h('span', {}, days === 0 ? 'Today!' : days < 0 ? 'Married!' : days === 1 ? 'day to go' : 'days to go'))
        : h('div', { class: 'oh-count tbd' }, store.me.isAdmin ? h('button', { type: 'button', class: 'btn small', onclick: () => editDate(w) }, 'Set the date') : h('span', {}, 'The countdown starts once the date is fixed'))),
    h('div', { class: 'oh-stats' },
      h('div', { class: 'ost' }, h('b', {}, String(finished)), h('span', {}, 'done')),
      h('div', { class: 'ost' }, h('b', {}, String(doing.length)), h('span', {}, 'in progress')),
      h('div', { class: 'ost' }, h('b', {}, String(open.length - doing.length)), h('span', {}, 'still to do')),
      h('div', { class: 'ost' + (overdue.length ? ' warn' : '') }, h('b', {}, String(overdue.length)), h('span', {}, 'overdue')),
      h('div', { class: 'ost gold' }, h('b', {}, String(plan.locked)), h('span', {}, 'locked')))));
  root.append(journeyBar(w, plan, { onPick: (areaId) => { location.hash = `#/w/${w.id}/plan?focus=${areaId}`; } }));

  // Who is doing what
  const people = new Map();
  for (const x of open) {
    const key = (x.owner || '').trim();
    const k = key.toLowerCase() || '~';
    if (!people.has(k)) people.set(k, { name: key || 'Not assigned yet', list: [] });
    people.get(k).list.push(x);
  }
  const ppl = [...people.entries()].sort((a, b) => (a[0] === '~') - (b[0] === '~') || b[1].list.length - a[1].list.length);
  const whoEl = h('section', { class: 'oblock who' },
    h('div', { class: 'ob-h' }, h('h2', {}, 'Who is doing what'), h('span', { class: 'ob-sub' }, 'Open jobs, by the person in charge')),
    ppl.length ? h('div', { class: 'who-grid' }, ppl.map(([k, p]) => {
      const late = p.list.filter(x => x.due && daysUntil(x.due) < 0).length;
      const sorted = [...p.list].sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
      return h('div', { class: 'person' + (k === '~' ? ' nobody' : '') },
        h('div', { class: 'p-h' }, h('span', { class: 'p-av' }, k === '~' ? '?' : p.name.charAt(0).toUpperCase()), h('b', {}, p.name),
          h('span', { class: 'p-n' }, `${p.list.length} open`, late ? h('span', { class: 'neg' }, ` · ${late} overdue`) : null)),
        h('div', { class: 'olist' }, sorted.slice(0, 4).map(x => taskRow(x, { showOwner: false })), sorted.length > 4 ? h('span', { class: 'o-more' }, `+ ${sorted.length - 4} more`) : null));
    })) : h('p', { class: 'muted o-empty' }, 'Nothing open. Give steps and to-dos a “person in charge” and they appear here.'));

  // Recently done (from the edit history)
  const recent = store.rows('activity').filter(a => a.wedding_id === w.id && a.changes && ((a.changes.status && a.changes.status.new === 'done') || (a.changes.locked_at && a.changes.locked_at.new))).slice(0, 6);

  // Lists and money at a glance
  const lists = (store.missing && store.missing.lists) ? [] : live(store.rows('lists') || []).filter(l => l.wedding_id === w.id).sort((a, b) => a.title.localeCompare(b.title));
  const listsEl = h('section', { class: 'oblock' },
    h('div', { class: 'ob-h' }, h('h2', {}, 'Lists'), h('a', { class: 'ob-link', href: `#/w/${w.id}/lists` }, 'All lists →')),
    lists.length ? h('div', { class: 'olist' }, lists.slice(0, 6).map(l => { const s = listSummary(l); return h('a', { class: 'orow', href: `#/w/${w.id}/lists?list=${l.id}` }, h('span', { class: 'o-dot list', html: '' }), h('span', { class: 'o-main' }, h('b', {}, l.title), h('span', {}, s.join(' · ')))); }))
      : h('p', { class: 'muted o-empty' }, 'No lists yet. Start a guest list, gifts, vehicles or songs in the Lists tab.'));
  let moneyEl = null;
  if (!(store.missing && store.missing.budgets)) {
    const m = budgetMath(w.id);
    const next = m.owing[0];
    moneyEl = h('section', { class: 'oblock' },
      h('div', { class: 'ob-h' }, h('h2', {}, 'Money'), h('a', { class: 'ob-link', href: `#/w/${w.id}/budget` }, 'Budget →')),
      m.b ? h('div', { class: 'omoney' },
        h('div', {}, h('span', {}, 'Overall cost'), h('b', {}, inr(m.committed)), h('small', {}, 'of ' + inr(m.T))),
        h('div', {}, h('span', {}, 'Still to pay'), h('b', {}, inr(m.toPay)), h('small', {}, next ? `next: ${next.title}${next.due ? ' · ' + shortDate(next.due) : ''}` : 'nothing due')),
        m.overTotal > 0 || m.contLeft < 0 ? h('div', { class: 'neg', style: { gridColumn: '1 / -1', fontSize: '13px' } }, 'Over budget — see the Budget page') : null)
        : h('p', { class: 'muted o-empty' }, 'The budget isn’t set up yet.'));
  }

  root.append(h('div', { class: 'ogrid' },
    h('div', { class: 'ocol' },
      overdue.length ? block('Overdue', overdue, '', { cls: 'warnblock', countCls: 'warn', more: `#/w/${w.id}/plan` }) : null,
      block('Happening now', doing, 'Nothing marked “in progress”. Open a step and set it to In progress when someone starts on it.', { more: `#/w/${w.id}/plan` }),
      block('Coming up · next 3 weeks', soon, 'Nothing due in the next three weeks.', { more: `#/w/${w.id}/plan` }),
      whoEl),
    h('div', { class: 'ocol' },
      block('Waiting on a decision', waiting, 'No open lock points.', { countCls: 'gold', more: `#/w/${w.id}/decide`, limit: 5 }),
      h('section', { class: 'oblock' },
        h('div', { class: 'ob-h' }, h('h2', {}, 'Recently done'), h('a', { class: 'ob-link', href: '#/history' }, 'Edit history →')),
        recent.length ? feedList(recent, { compact: true }) : h('p', { class: 'muted o-empty' }, 'Things ticked off or locked will show here.')),
      listsEl, moneyEl)));
  void t; void ago; void lockIcon;
}
