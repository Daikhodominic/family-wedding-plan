import { store } from './store.js?v=12';
import { h, $, toast, modal, field, daysUntil, fancyDate, shortDate, ago, ICONS, confirmBox } from './ui.js?v=12';
import { renderPipeline, renderPlanHead } from './pipeline.js?v=12';
import { renderBoard } from './board.js?v=12';
import { renderTodo } from './todo.js?v=12';
import { renderFiles } from './files.js?v=12';
import { renderDecide } from './decide.js?v=12';
import { renderWeddingBudget, renderFamilyBudget } from './budget.js?v=12';
import { clearPage, clearAll } from './clear.js?v=12';
import { undoButtons } from './history.js?v=12';
import { downloadBackup } from './tools.js?v=12';
import { renderMyJobs, myOpenJobs } from './myjobs.js?v=12';
import { renderOverview, editDate } from './overview.js?v=12';
import { renderLists } from './lists.js?v=12';
import { planOf } from './map.js?v=12';
import { openStep } from './panel.js?v=12';
import { renderActivity, renderBin, renderSettings, describe, linkFor } from './extras.js?v=12';

const app = document.getElementById('app');

/* ---------- Themes ----------
   Each wedding re-points the --w-* tokens. "gold" is the accent metal:
   antique gold for Charani's dusty blue, rose gold for Elow's Chateau Rose. */
export const THEMES = {
  blue: { bg: '#F8F5EF', surface: '#FFFEFB', ink: '#25303B', muted: '#66717C', line: '#E7E0D3', soft: '#EAEFF4', accent: '#2C4562', accentInk: '#FFFFFF', light: '#AFBEC8', deep: '#223650', gold: '#A87C22', goldLine: '#D9C597', goldFill: '#F6EBCF', deco: 'blue' },
  rose: { bg: '#F9F3EE', surface: '#FFFDFB', ink: '#3A2A30', muted: '#7D6A6F', line: '#EDDDD4', soft: '#F5E7E3', accent: '#6B3247', accentInk: '#FFFFFF', light: '#D9AFA6', deep: '#5A2536', gold: '#A46E55', goldLine: '#DFBCA9', goldFill: '#F7E5DA', deco: 'rose' }
};
export function themeOf(w) {
  const base = THEMES[w && w.theme] || THEMES.blue;
  return { ...base, ...((w && w.theme_custom) || {}) };
}
const TOKEN = { bg: '--w-bg', surface: '--w-surface', ink: '--w-ink', muted: '--w-muted', line: '--w-line', soft: '--w-soft', accent: '--w-accent', accentInk: '--w-accent-ink', light: '--w-light', deep: '--w-deep', gold: '--gold', goldLine: '--gold-line', goldFill: '--gold-fill' };
function applyTheme(t) {
  const el = document.body;
  for (const [k, v] of Object.entries(TOKEN)) { if (t && t[k]) el.style.setProperty(v, t[k]); else el.style.removeProperty(v); }
  el.dataset.theme = t ? t.deco : '';
}

/* ---------- Routing ---------- */
export function parseRoute() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  const params = Object.fromEntries(new URLSearchParams(query));
  return { parts, params };
}
export const go = (hash) => { if (location.hash === hash) render(); else location.hash = hash; };

export const weddings = () => store.rows('weddings').filter(w => !w.deleted_at).sort((a, b) => (a.position || 0) - (b.position || 0));
export const wedding = (id) => store.rows('weddings').find(w => w.id === id);
export const live = (rows) => rows.filter(r => !r.deleted_at);
const firstName = (w) => (w.couple || '').split('&')[0].trim();
const initials = (w) => { const [a, b] = (w.monogram || '').split('&'); return [(a || '').trim(), (b || '').trim()]; };

export function stepVisible(s) {
  const a = store.find('areas', s.area_id);
  if (!a || a.deleted_at) return false;
  const st = store.find('stages', a.stage_id);
  return !!(st && !st.deleted_at);
}

/* ---------- Shared pieces ---------- */
function unread() {
  if (!store.me) return [];
  return store.rows('activity').filter(a => a.id > store.me.lastSeen && a.actor !== store.me.id);
}

// Monogram: a navy medallion with a gilded wreath (blue themes) or a wax seal (rose themes).
export function monogram(w, size = 'lg') {
  const t = themeOf(w);
  const [a, b] = initials(w);
  const letters = h('span', { class: 'mono-letters' }, a, h('span', { class: 'amp' }, '&'), b);
  if (t.deco === 'rose') {
    return h('span', { class: 'medal seal-m ' + size, 'aria-hidden': 'true' },
      h('span', { class: 'wax' }, h('span', { class: 'ring' }), h('span', { class: 'ring2' }), letters));
  }
  return h('span', { class: 'medal disc ' + size, 'aria-hidden': 'true' },
    h('img', { class: 'wreath', src: 'assets/wreath_blue.svg', alt: '' }), letters);
}

function avatarMenu(btn) {
  const old = document.querySelector('.menu-pop');
  if (old) { old.remove(); return; }
  const n = unread().length;
  const close = () => { pop.remove(); document.removeEventListener('pointerdown', outside, true); };
  const outside = (e) => { if (!pop.contains(e.target) && e.target !== btn && !btn.contains(e.target)) close(); };
  const item = (icon, label, onClick, extra) => h('button', { type: 'button', class: 'mi', onclick: () => { close(); onClick(); } }, h('span', { class: 'mi-ic', html: ICONS[icon] }), h('span', {}, label), extra || null);
  const pop = h('div', { class: 'menu-pop', role: 'menu' },
    h('div', { class: 'mp-head' }, h('b', {}, store.me.name), h('span', {}, store.me.isAdmin ? 'Admin' : 'Family')),
    item('check', 'My jobs', () => go('#/me'), myOpenJobs().length ? h('span', { class: 'badge' }, String(myOpenJobs().length)) : null),
    item('history', 'Edit history', () => go('#/history'), n ? h('span', { class: 'badge' }, String(n)) : null),
    item('budget', 'Family budget', () => go('#/budget')),
    item('trash', 'Bin', () => go('#/bin')),
    store.me.isAdmin ? item('settings', 'Settings', () => go('#/settings')) : null,
    item('folder', 'Download a backup', downloadBackup),
    ...pageClearItems(item),
    store.me.isAdmin ? item('broom', 'Clear all and start over…', () => { const { parts } = parseRoute(); clearAll(parts[0] === 'w' ? { weddingId: parts[1] } : {}); }) : null,
    item('user', 'Change your name', profileMenu),
    store.mode === 'demo' ? item('restore', 'Reset the sample', () => store.resetDemo()) : null,
    store.mode === 'live' ? item('logout', 'Sign out of this device', async () => { if (await confirmBox('Sign out?', 'You will need the family passcode to come back in on this device.', 'Sign out')) { await store.signOut(); location.hash = '#/'; location.reload(); } }) : null);
  document.body.append(pop);
  const r = btn.getBoundingClientRect();
  pop.style.top = Math.min(r.bottom + 8, innerHeight - pop.offsetHeight - 8) + 'px';
  pop.style.right = Math.max(8, innerWidth - r.right) + 'px';
  setTimeout(() => document.addEventListener('pointerdown', outside, true));
}

// "Clear this page" for whoever is looking at a wedding's section.
function pageClearItems(item) {
  const { parts } = parseRoute();
  if (parts[0] !== 'w' || !wedding(parts[1])) return [];
  const sub = parts[2] || 'overview';
  const section = sub;
  const names = { plan: 'the plan', todo: 'the to-do list', board: 'the mood board', files: 'files and lists', budget: 'the budget' };
  if (!names[section]) return [];
  return [item('broom', 'Clear ' + names[section] + '…', () => clearPage(parts[1], section === 'budget' ? 'budget' : section))];
}

function avatar() {
  const n = unread().length;
  const b = h('button', { class: 'avatar', type: 'button', 'aria-label': 'Menu: edit history, bin, settings, your name', onclick: (e) => avatarMenu(e.currentTarget) },
    (store.me.name || '?').trim().charAt(0).toUpperCase(), n ? h('span', { class: 'avatar-dot', 'aria-hidden': 'true' }) : null);
  return b;
}

function profileMenu() {
  const name = h('input', { value: store.me.name, maxlength: 60, autocomplete: 'name' });
  modal({
    title: 'Your name',
    body: [field('This is how your changes are signed', name)],
    actions: [{ label: 'Save', onClick: async () => { const v = name.value.trim(); if (!v) return false; await store.rename(v); toast('Saved'); render(); } }]
  });
}

function demoFlag() {
  if (store.mode !== 'demo') return null;
  return h('div', { class: 'demo-flag' }, 'Preview with sample data — changes stay in this browser only. ',
    h('button', { type: 'button', onclick: () => store.resetDemo() }, 'Reset the sample'));
}

function frame() {
  return [h('span', { class: 'frame f1', 'aria-hidden': 'true' }), h('span', { class: 'frame f2', 'aria-hidden': 'true' })];
}

/* ---------- Landing ---------- */
function renderLanding() {
  return h('div', { class: 'landing' },
    frame(),
    h('img', { class: 'bq l', src: 'assets/lush_blue.svg', alt: '', 'aria-hidden': 'true' }),
    h('img', { class: 'bq r', src: 'assets/lush_rose.svg', alt: '', 'aria-hidden': 'true' }),
    h('div', { class: 'land-inner' },
      h('h1', { class: 'foil' }, 'The Wedding', h('br'), 'War Room'),
      h('p', { class: 'land-sub' }, 'Because “we’ll figure it out” is not a plan'),
      h('a', { class: 'enter', href: '#/home' }, 'Step inside')));
}

/* ---------- Choose a wedding ---------- */
function todayLabel() {
  return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

function emblem(w) {
  const t = themeOf(w);
  const days = daysUntil(w.wedding_date);
  const plan = planOf(w);
  return h('a', { class: 'emb ' + t.deco, href: '#/w/' + w.id, 'aria-label': 'Open ' + w.couple, style: { '--e-deep': t.deep, '--e-gold': t.gold } },
    monogram(w, 'xl'),
    h('span', { class: 'emb-name' }, w.couple),
    h('span', { class: 'emb-date' }, w.wedding_date ? fancyDate(w.wedding_date) : `${w.date_note || 'Date'} · date to be fixed`),
    h('span', { class: 'emb-meta' },
      w.wedding_date && days !== null ? h('span', {}, h('b', {}, String(Math.max(0, days))), days === 0 ? ' today' : days < 0 ? ' married' : days === 1 ? ' day to go' : ' days to go') : null,
      plan.total ? h('span', { class: 'emb-prog' }, h('i', { style: { width: plan.pct + '%' } })) : null,
      plan.total ? h('span', {}, plan.pct + '% there') : null));
}

export function feedList(items, { compact = false } = {}) {
  return h('ul', { class: 'feed' + (compact ? ' compact' : '') }, items.map(a => {
    const d = describe(a);
    const isNew = store.me && a.id > store.me.lastSeen && a.actor !== store.me.id;
    const w = a.wedding_id && wedding(a.wedding_id);
    return h('li', {}, h('a', { class: 'row' + (isNew && !compact ? ' unread' : ''), href: linkFor(a) },
      h('span', { class: 'dot', style: w ? { background: themeOf(w).accent } : null }),
      h('span', { class: 'ftxt' }, h('strong', {}, a.actor_name || 'Someone'), ' ', d.text,
        w ? h('span', { class: 'muted' }, ' · ' + firstName(w)) : null,
        !compact && d.changes.length ? h('span', { class: 'changes' }, d.changes) : null),
      h('span', { class: 'time' }, ago(a.created_at))));
  }));
}

function waitingDecisions() {
  return live(store.rows('steps')).filter(s => s.gate && !s.locked_at && stepVisible(s) && wedding(s.wedding_id) && !wedding(s.wedding_id).deleted_at)
    .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
}
function comingUp() {
  const steps = live(store.rows('steps')).filter(s => !s.locked_at && s.status !== 'done' && s.due && stepVisible(s)).map(s => ({ ...s, kind: 'step' }));
  const todos = store.missing && store.missing.todos ? [] : live(store.rows('todos') || []).filter(t => t.status !== 'done' && t.due).map(t => ({ ...t, kind: 'todo' }));
  return [...steps, ...todos].filter(x => wedding(x.wedding_id) && !wedding(x.wedding_id).deleted_at && daysUntil(x.due) <= 45).sort((a, b) => a.due.localeCompare(b.due));
}
const stepLink = (s) => s.kind === 'todo' ? `#/w/${s.wedding_id}/todo?focus=${s.id}` : `#/w/${s.wedding_id}/plan?open=${s.id}`;

function greeting() {
  const jobs = myOpenJobs();
  const late = jobs.filter(t => t.due && daysUntil(t.due) < 0).length;
  const week = jobs.filter(t => t.due && daysUntil(t.due) >= 0 && daysUntil(t.due) <= 7).length;
  const first = (store.me.name || '').split(/\s+/)[0];
  return h('a', { class: 'greet', href: '#/me' },
    h('span', {}, `Hi ${first}`),
    jobs.length ? h('b', {}, ` · ${jobs.length} ${jobs.length === 1 ? 'job' : 'jobs'} for you`) : h('span', { class: 'muted' }, ' · nothing on your list'),
    late ? h('span', { class: 'neg' }, ` · ${late} overdue`) : week ? h('span', {}, ` · ${week} this week`) : null,
    jobs.length ? h('span', { class: 'greet-go' }, ' →') : null);
}

function renderHome() {
  applyTheme(null);
  const ws = weddings();
  const fresh = unread();
  const waiting = waitingDecisions();
  const soon = comingUp();
  const top = store.rows('activity')[0];

  const changes = h('section', { class: 'hcard changes-card', 'aria-label': 'New since you last looked' },
    fresh.length
      ? [h('div', { class: 'hc-head' },
          h('b', {}, `${fresh.length} new since you last looked`),
          h('button', { type: 'button', class: 'gotit', onclick: async () => { await store.markSeen(top.id); toast('All caught up'); render(); } }, 'Got it')),
        h('div', { class: 'hc-scroll' }, feedList(fresh.slice(0, 12), { compact: true }))]
      : [h('div', { class: 'hc-head' }, h('b', {}, 'You’re all caught up')),
        h('p', { class: 'muted hc-empty' }, 'Nothing new since you last looked. Changes other people make will appear here until you tap Got it.')],
    h('a', { class: 'hc-foot', href: '#/history' }, 'Edit history →'));

  const decide = h('section', { class: 'hcol', 'aria-label': 'Waiting on a decision' },
    h('div', { class: 'hc-label' }, `Waiting on a decision · ${waiting.length}`),
    waiting.length ? waiting.slice(0, 3).map(s => {
      const a = store.find('areas', s.area_id); const w = wedding(s.wedding_id);
      return h('a', { class: 'hrow', href: `#/w/${s.wedding_id}/plan?open=${s.id}` }, h('b', {}, s.title), h('span', {}, `${firstName(w)} · ${a ? a.title : ''}${s.due ? ' · by ' + shortDate(s.due) : ''}`));
    }) : h('p', { class: 'muted hc-empty' }, 'No open lock points. Mark a step as a lock point and it shows here until it’s locked.'),
    waiting.length > 3 ? h('span', { class: 'hc-more' }, `+ ${waiting.length - 3} more`) : null);

  const coming = h('section', { class: 'hcol', 'aria-label': 'Coming up' },
    h('div', { class: 'hc-label' }, 'Coming up'),
    soon.length ? soon.slice(0, 3).map(s => {
      const w = wedding(s.wedding_id); const late = daysUntil(s.due) < 0;
      return h('a', { class: 'hrow', href: stepLink(s) }, h('b', {}, s.title), h('span', { class: late ? 'late' : '' }, `${firstName(w)}${s.owner ? ' · ' + s.owner : ''} · ${late ? 'overdue since ' : ''}${shortDate(s.due)}`));
    }) : h('p', { class: 'muted hc-empty' }, 'Nothing due in the next few weeks. Give steps a due date and they’ll appear here.'),
    ws.length ? h('a', { class: 'hrow budget-link', href: '#/budget' }, h('span', {}, 'Family budget'), h('span', {}, 'open →')) : null);

  return h('div', { class: 'home' },
    demoFlag(),
    h('div', { class: 'home-stage' },
      frame(),
      h('img', { class: 'hb l', src: 'assets/lush_blue.svg', alt: '', 'aria-hidden': 'true' }),
      h('img', { class: 'hb r', src: 'assets/lush_rose.svg', alt: '', 'aria-hidden': 'true' }),
      h('header', { class: 'home-top' },
        h('a', { class: 'brand', href: '#/' }, 'The Wedding War Room'),
        greeting(),
        h('span', { class: 'home-top-r' }, h('span', { class: 'today' }, todayLabel()), undoButtons(), avatar())),
      h('section', { class: 'emblems' + (ws.length > 2 ? ' many' : '') },
        ws.length ? ws.flatMap((w, i) => i ? [h('span', { class: 'divider', 'aria-hidden': 'true' }, h('span'), h('i', {}, '✦'), h('span')), emblem(w)] : [emblem(w)])
          : h('p', { class: 'muted' }, store.me.isAdmin ? h('span', {}, 'No weddings yet. ', h('a', { href: '#/settings' }, 'Add one in Settings')) : 'No weddings yet.')),
      h('main', { class: 'home-row' }, changes, decide, coming)));
}

/* ---------- Wedding space ---------- */
const TABS = [['overview', 'Overview', 'overview'], ['plan', 'Plan', 'plan'], ['decide', 'Decide', 'decide'], ['board', 'Board', 'board'], ['lists', 'Lists', 'list'], ['budget', 'Budget', 'budget'], ['files', 'Files', 'folder']];
const tabOf = (t, params = {}) => !t ? (params.focus ? 'plan' : 'overview') : t === 'todo' ? 'plan' : t;

function renderSpace(id, sub, params) {
  const w = wedding(id);
  if (!w || w.deleted_at) { applyTheme(null); return h('div', { class: 'page' }, pageBar(), h('div', { class: 'wrap' }, h('p', {}, 'That wedding was not found. ', h('a', { href: '#/home' }, 'Go back')))); }
  const t = themeOf(w);
  applyTheme(t);
  const tab = tabOf(sub, params);
  const days = daysUntil(w.wedding_date);
  const others = weddings().filter(x => x.id !== id);
  const nWait = waitingDecisions().filter(s => s.wedding_id === id).length;
  const when = w.wedding_date
    ? `${new Date(w.wedding_date + 'T00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}${days !== null && days >= 0 ? ` · ${days} ${days === 1 ? 'day' : 'days'}` : ''}`
    : `${w.date_note || 'Date'} · to be fixed`;
  const link = (k) => '#/w/' + id + (k === 'overview' ? '' : '/' + k);

  const root = h('div', { class: 'space deco-' + t.deco + (tab === 'board' ? ' on-board' : '') });
  root.append(
    demoFlag() || '',
    h('header', { class: 'shead' },
      h('div', { class: 'wrap shead-in' },
        h('a', { href: '#/home', class: 'shead-mono', 'aria-label': 'Back to both weddings' }, monogram(w, 'sm')),
        h('div', { class: 'shead-names' },
          h('a', { href: link('plan'), class: 'shead-couple' }, w.couple),
          h('span', { class: 'shead-sub' }, store.me.isAdmin ? h('button', { type: 'button', class: 'date-btn', title: 'Set or change the wedding date', onclick: () => editDate(w) }, when) : when,
            others.length ? others.map(o => h('span', {}, ' · ', h('a', { href: '#/w/' + o.id + (sub && sub !== 'todo' ? '/' + sub : '') }, 'switch to ' + firstName(o)))) : null,
            store.me.isAdmin && !w.wedding_date ? h('span', {}, ' · ', h('button', { type: 'button', class: 'date-btn', onclick: () => editDate(w) }, 'set the date')) : null)),
        h('nav', { class: 'snav', 'aria-label': 'Sections' }, TABS.map(([k, label, icon]) =>
          h('a', { href: link(k), 'aria-current': tab === k ? 'page' : null },
            h('span', { class: 'snav-ic', html: ICONS[icon] }), h('span', { class: 'snav-t' }, label),
            k === 'decide' && nWait ? h('span', { class: 'nbadge' }, String(nWait)) : null))),
        undoButtons(),
        avatar())),
    h('div', { class: 'shead-rule', 'aria-hidden': 'true' }),
    h('img', { class: 'space-flora', src: t.deco === 'rose' ? 'assets/lush_rose.svg' : 'assets/lush_blue.svg', alt: '', 'aria-hidden': 'true' }));

  const body = h('div', { class: tab === 'board' ? 'board-wrap' : 'wrap sbody' });
  root.append(body);
  if (tab === 'board') renderBoard(body, w, params);
  else if (tab === 'decide') renderDecide(body, w, params);
  else if (tab === 'budget') renderWeddingBudget(body, w, params);
  else if (tab === 'files') renderFiles(body, w, params);
  else if (tab === 'lists') renderLists(body, w, params);
  else if (tab === 'overview') renderOverview(body, w, params);
  else if (sub === 'todo') { renderPlanHead(body, w, 'todo'); renderTodo(body, w, params); }
  else renderPipeline(body, w, params);

  if (params.open) {
    const sid = params.open;
    history.replaceState(null, '', location.pathname + location.search + '#/w/' + id + (sub ? '/' + sub : ''));
    setTimeout(() => openStep(sid), 60);
  }
  return root;
}

/* ---------- Family-wide pages ---------- */
function pageBar() {
  return h('header', { class: 'pbar' },
    h('div', { class: 'wrap pbar-in' },
      h('a', { class: 'brand', href: '#/home' }, h('span', { class: 'pbar-back', html: ICONS.back }), 'The Wedding War Room'),
      h('nav', { class: 'pnav', 'aria-label': 'Weddings' }, weddings().map(w => h('a', { href: '#/w/' + w.id, style: { color: themeOf(w).deep } }, w.couple))),
      undoButtons(),
      avatar()));
}
function familyPage(content) {
  applyTheme(null);
  return h('div', { class: 'page' }, demoFlag(), pageBar(), h('div', { class: 'shead-rule', 'aria-hidden': 'true' }), content);
}

/* ---------- Gate ---------- */
function renderGate() {
  applyTheme(null);
  const err = h('div', { class: 'err', role: 'alert' });
  const pass = h('input', { type: 'password', autocomplete: 'current-password', required: true });
  const name = h('input', { autocomplete: 'name', maxlength: 60, required: true, placeholder: 'e.g. Aunty Ela' });
  const btn = h('button', { class: 'enter solid', type: 'submit' }, 'Come in');
  const form = h('form', {
    onsubmit: async (e) => {
      e.preventDefault(); err.textContent = ''; btn.disabled = true; btn.textContent = 'Checking…';
      try { await store.join(pass.value, name.value.trim()); location.hash = '#/home'; await boot(); }
      catch (x) { err.textContent = x.message; btn.disabled = false; btn.textContent = 'Come in'; }
    }
  }, field('Family passcode', pass), field('Your name', name, 'So everyone knows who added what.'), err, btn);

  const aErr = h('div', { class: 'err', role: 'alert' });
  const email = h('input', { type: 'email', autocomplete: 'email' });
  const pw = h('input', { type: 'password', autocomplete: 'current-password' });
  const adminForm = h('form', {
    hidden: true,
    onsubmit: async (e) => {
      e.preventDefault(); aErr.textContent = '';
      try { await store.adminSignIn(email.value.trim(), pw.value); location.hash = '#/home'; await boot(); }
      catch (x) { aErr.textContent = x.message; }
    }
  }, field('Admin email', email), field('Password', pw), aErr, h('button', { class: 'enter solid', type: 'submit' }, 'Sign in as admin'));

  return h('div', { class: 'landing gate-page' },
    frame(),
    h('img', { class: 'bq l', src: 'assets/lush_blue.svg', alt: '', 'aria-hidden': 'true' }),
    h('img', { class: 'bq r', src: 'assets/lush_rose.svg', alt: '', 'aria-hidden': 'true' }),
    h('div', { class: 'gate-card' },
      h('div', { class: 'land-eyebrow' }, 'Family only'),
      h('h1', { class: 'foil' }, 'Come inside'),
      h('div', { class: 'flourish', 'aria-hidden': 'true' }, h('span'), h('i', {}, '✦'), h('span')),
      h('p', { class: 'land-sub' }, 'Enter the family passcode to see and add to the plans.'),
      form,
      h('button', { class: 'link-btn gate-switch', type: 'button', onclick: (e) => { adminForm.hidden = !adminForm.hidden; form.hidden = !adminForm.hidden; e.currentTarget.textContent = adminForm.hidden ? 'Admin sign-in' : 'Family passcode instead'; } }, 'Admin sign-in'),
      adminForm,
      h('a', { class: 'gate-back', href: '#/' }, '← Back')));
}

/* ---------- Render loop ---------- */
let pending = false;
export function render() {
  const { parts, params } = parseRoute();
  const key = parts.join('/');
  document.title = 'The Wedding War Room';
  let view;
  document.documentElement.style.background = '';
  if (!parts.length) { applyTheme(null); view = renderLanding(); }
  else if (!booted) { view = h('div', { class: 'loading' }, 'Opening the plans…'); }
  else if (!store.me) view = renderGate();
  else if (parts[0] === 'w') { view = renderSpace(parts[1], parts[2], params); const w = wedding(parts[1]); if (w) document.title = w.couple + ' · The Wedding War Room'; }
  else if (parts[0] === 'activity' || parts[0] === 'history') view = familyPage(renderActivity());
  else if (parts[0] === 'bin') view = familyPage(renderBin());
  else if (parts[0] === 'budget') view = familyPage(renderFamilyBudget(params));
  else if (parts[0] === 'me') view = familyPage(renderMyJobs());
  else if (parts[0] === 'settings') view = familyPage(renderSettings());
  else view = renderHome();
  document.body.dataset.page = !parts.length ? 'landing' : !store.me ? 'gate' : parts[0] === 'w' ? 'space' : parts[0] === 'home' || !['activity', 'history', 'bin', 'settings', 'budget', 'me'].includes(parts[0]) ? 'home' : 'page';
  const keepScroll = app.dataset.view === key ? window.scrollY : 0;
  app.dataset.view = key;
  const boardView = $('.board-view');
  const boardScroll = boardView ? [boardView.scrollLeft, boardView.scrollTop] : null;
  const pop = document.querySelector('.menu-pop'); if (pop) pop.remove();
  app.replaceChildren(view);
  window.scrollTo(0, keepScroll);
  const nb = $('.board-view');
  if (nb && boardScroll && !params.focus) { nb.scrollLeft = boardScroll[0]; nb.scrollTop = boardScroll[1]; }
}

// Re-render on data changes, but never while someone is typing or dragging.
export const ui = { busy: false };
function scheduleRender() {
  if (pending) return;
  pending = true;
  const tryRender = () => {
    const a = document.activeElement;
    const typing = a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && app.contains(a);
    if (ui.busy || typing || document.querySelector('.modal-wrap') || document.querySelector('.menu-pop')) { setTimeout(tryRender, 600); return; }
    pending = false; render();
  };
  requestAnimationFrame(tryRender);
}

// The landing page needs no data, so it shows instantly while the plans load behind it.
let booted = false;
const onLandingNow = () => !parseRoute().parts.length;
async function boot() {
  booted = false;
  render();
  try {
    const state = await store.init();
    booted = true;
    if (state !== 'ready') { if (!onLandingNow()) render(); return; }
    await store.loadAll();
  } catch (e) {
    console.error(e);
    app.replaceChildren(h('div', { class: 'landing' }, h('div', { class: 'gate-card' }, h('h1', { class: 'foil' }, 'Could not open the plans'), h('p', { class: 'land-sub' }, e.message || 'Check your internet connection and reload the page.'), h('button', { class: 'enter solid', onclick: () => location.reload() }, 'Try again'))));
    return;
  }
  booted = true;
  if (!onLandingNow()) render();
}

store.onChange(() => scheduleRender());
window.addEventListener('hashchange', () => { document.querySelectorAll('.modal-wrap').forEach(m => m.remove()); render(); });
boot();
