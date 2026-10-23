// "My jobs": everything with your name on it, across both weddings.
import { store } from './store.js?v=32';
import { h, daysUntil, shortDate, secHead } from './ui.js?v=32';
import { live, stepVisible, wedding, themeOf } from './app.js?v=32';
import { openStep } from './panel.js?v=32';
import { editStep } from './pipeline.js?v=32';
import { samePerson, icsFile } from './tools.js?v=32';

const done = (t) => t.status === 'done' || !!t.locked_at;

// The name a job's "person in charge" belongs to: a family member's name when it matches one.
export function canonical(owner) {
  const o = (owner || '').trim(); if (!o) return '';
  const m = (store.rows('members') || []).find(x => samePerson(x.name, o));
  return m ? m.name.trim() : o;
}

export function jobsFor(name) {
  const steps = live(store.rows('steps')).filter(s => stepVisible(s) && samePerson(s.owner, name)).map(s => ({ ...s, kind: 'step', where: (store.find('areas', s.area_id) || {}).title || '' }));
  const todos = (store.missing && store.missing.todos) ? [] : live(store.rows('todos') || []).filter(t => samePerson(t.owner, name)).map(t => ({ ...t, kind: 'todo', where: 'To-do list' }));
  return [...steps, ...todos].filter(t => { const w = wedding(t.wedding_id); return w && !w.deleted_at; });
}
export function myOpenJobs() { return store.me ? jobsFor(store.me.name).filter(t => !done(t)) : []; }

const open = (t) => t.kind === 'todo' ? editStep(store.find('todos', t.id), 'todos') : openStep(t.id);

function row(t) {
  const w = wedding(t.wedding_id); const th = themeOf(w);
  const late = t.due && !done(t) && daysUntil(t.due) < 0;
  return h('button', { type: 'button', class: 'orow' + (late ? ' late' : ''), onclick: () => open(t) },
    h('span', { class: 'o-dot ' + (t.locked_at ? 'locked' : t.status) }),
    h('span', { class: 'o-main' }, h('b', {}, t.title),
      h('span', {}, h('span', { class: 'wtag', style: { color: th.deep, borderColor: th.goldLine } }, (w.couple || '').split('&')[0].trim()), ' ', [t.where, t.due ? (late ? 'overdue since ' : done(t) ? 'was due ' : 'due ') + shortDate(t.due) : 'no due date'].filter(Boolean).join(' · '))));
}

export function renderMyJobs() {
  const me = store.me;
  const all = jobsFor(me.name);
  const openJobs = all.filter(t => !done(t));
  const by = (a, b) => (a.due || '9999').localeCompare(b.due || '9999');
  const overdue = openJobs.filter(t => t.due && daysUntil(t.due) < 0).sort(by);
  const week = openJobs.filter(t => t.due && daysUntil(t.due) >= 0 && daysUntil(t.due) <= 7).sort(by);
  const later = openJobs.filter(t => t.due && daysUntil(t.due) > 7).sort(by);
  const nodate = openJobs.filter(t => !t.due);
  const finished = all.filter(done);
  const sec = (title, list, cls = '') => list.length ? h('section', { class: 'oblock ' + cls }, h('div', { class: 'ob-h' }, h('h2', {}, title), h('span', { class: 'count' + (cls ? ' warn' : '') }, String(list.length))), h('div', { class: 'olist' }, list.map(row))) : null;
  const wrap = h('main', { class: 'wrap sbody' },
    secHead('Everything with your name on it', 'My jobs',
      openJobs.some(t => t.due) ? h('button', { class: 'btn ghost', type: 'button', onclick: () => icsFile(openJobs.filter(t => t.due).map(t => ({ id: t.id, date: t.due, title: t.title, notes: (wedding(t.wedding_id) || {}).couple })), 'my-wedding-jobs') }, 'Add to my calendar') : null),
    h('p', { class: 'hint' }, `Jobs where the person in charge is “${me.name}”. If something’s missing, ask whoever added it to put your name on it — or change your name from the menu to match.`));
  if (!openJobs.length) wrap.append(h('div', { class: 'budget-empty' }, h('h2', {}, finished.length ? 'All done — thank you!' : 'Nothing with your name on it yet'), h('p', {}, finished.length ? `You’ve finished ${finished.length} ${finished.length === 1 ? 'job' : 'jobs'}.` : 'When someone puts you in charge of a step or a to-do, it shows up here.')));
  wrap.append(h('div', { class: 'ocol', style: { maxWidth: '820px' } },
    sec('Overdue', overdue, 'warnblock'), sec('This week', week), sec('Later', later), sec('No date yet', nodate),
    finished.length ? h('details', { class: 'oblock' }, h('summary', { class: 'done-toggle' }, `Done · ${finished.length}`), h('div', { class: 'olist' }, finished.map(row))) : null));
  return wrap;
}
