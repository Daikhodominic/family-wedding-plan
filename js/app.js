import { store, onStatus, syncState, outboxItems } from './store.js?v=48';
import { h, $, toast, modal, field, daysUntil, fancyDate, shortDate, ago, ICONS, confirmBox } from './ui.js?v=48';
import { renderPipeline, renderPlanHead } from './pipeline.js?v=48';
import { renderBoard } from './board.js?v=48';
import { renderTodo } from './todo.js?v=48';
import { renderFiles } from './files.js?v=48';
import { renderWeddingBudget, renderFamilyBudget } from './budget.js?v=48';
import { clearPage, clearAll } from './clear.js?v=48';
import { undoButtons } from './history.js?v=48';
import { downloadBackup } from './tools.js?v=48';
import { renderMyJobs, myOpenJobs } from './myjobs.js?v=48';
import { maybeWelcome, openTour, tip, helpButton, toggleEasy, easyOn, applyEasy } from './guide.js?v=48';
import { announcementBars } from './planauto.js?v=48';
import { renderPartner } from './partner.js?v=48';
import { renderOverview, editDate } from './overview.js?v=48';
import { renderSwipe, renderChoose, renderOptions, newForYou } from './swipe.js?v=48';
import { renderLists } from './lists.js?v=48';
import { planOf } from './map.js?v=48';
import { openStep, closeDrawer } from './panel.js?v=48';
import { waNumber } from './nudge.js?v=48';
import { notifySupported, notifyOn, notifySettings, startNotifier } from './notify.js?v=48';
import { renderActivity, renderBin, renderSettings, describe, linkFor } from './extras.js?v=48';
import { morphInto, onScreen } from './morph.js?v=48';
import { renderShare } from './share.js?v=48';
import { pendingFor } from './swipe.js?v=48';
import { installApp, installOffer, isStandalone } from './install.js?v=48';

const app = document.getElementById('app');

/* ---------- Themes ----------
   Each wedding re-points the --w-* tokens. "gold" is the accent metal:
   antique gold for Charani's dusty blue, rose gold for Elow's Chateau Rose. */
export const THEMES = {
  blue: { bg: '#EEF5F3', surface: '#FFFFFF', ink: '#163144', muted: '#4A6170', line: '#C9D8DC', soft: '#E4EFEE', accent: '#163144', accentInk: '#FFFFFF', light: '#8FB0C8', deep: '#163144', gold: '#8E6E33', goldLine: '#E3D2AE', goldFill: '#F6EEDC', g0: '#1B405B', g1: '#3E6680', g2: '#9FB9C4', g3: '#DFF3EB', base: '#F4F8F6', pop: '#E89F7E', popInk: '#4A2412', champ: '#CBA86E', deco: 'blue' },
  rose: { bg: '#FAF5F5', surface: '#FFFFFF', ink: '#4A2230', muted: '#6E4B56', line: '#ECD6DA', soft: '#F6E9EB', accent: '#4A2230', accentInk: '#FFFFFF', light: '#E3B8C2', deep: '#4A2230', gold: '#8E6E33', goldLine: '#E3D2AE', goldFill: '#F6EEDC', g0: '#8A5063', g1: '#9E6175', g2: '#E8CBD1', g3: '#F8F0F1', base: '#FCF9F9', pop: '#8FAE98', popInk: '#1F3A28', champ: '#CBA86E', deco: 'rose' },
};
export function themeOf(w) {
  const base = THEMES[w && w.theme] || THEMES.blue;
  // Colours saved before the frosted redesign (no v: 2) belonged to the old look, so they're ignored.
  const c = (w && w.theme_custom) || {};
  return c.v === 2 ? { ...base, ...c } : base;
}
const TOKEN = { bg: '--w-bg', surface: '--w-surface', ink: '--w-ink', muted: '--w-muted', line: '--w-line', soft: '--w-soft', accent: '--w-accent', accentInk: '--w-accent-ink', light: '--w-light', deep: '--w-deep', gold: '--gold', goldLine: '--gold-line', goldFill: '--gold-fill', g0: '--w-g0', g1: '--w-g1', g2: '--w-g2', g3: '--w-g3', base: '--w-base', pop: '--w-pop', popInk: '--w-pop-ink', champ: '--champ' };
export function applyTheme(t) {
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
  btn = onScreen(btn);
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
    item('user', store.me.phone ? 'Your name and number' : 'Your name · add your WhatsApp', profileMenu),
    notifySupported() ? item('bell', 'Notifications on this phone', notifySettings, notifyOn() ? h('span', { class: 'mi-on' }, 'On') : null) : null,
    item('overview', 'How to use the War Room', () => openTour()),
    isStandalone() ? null : item('sparkle', 'Install on this phone', () => installApp()),
    item('zoomIn', easyOn() ? 'Normal view' : 'Easy view (bigger text)', () => { toggleEasy(); render(); }),
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

// "Saved" / "Saving…" / "Offline — will save when you're back online"
const SYNC = { saved: ['Saved', 'Everything is saved'], saving: ['Saving…', 'Saving your change'], offline: ['Offline', 'No internet — your changes are kept on this phone and sent when you’re back online'], waiting: ['Waiting', 'Some changes are kept on this phone, waiting to be sent'] };
const syncText = (v) => v === 'waiting' || (v === 'offline' && (store.outbox || []).length) ? `${(store.outbox || []).length} waiting` : SYNC[v][0];
// What hasn't reached the family yet.
function showOutbox() {
  const items = outboxItems();
  modal({ title: items.length ? `${items.length} ${items.length === 1 ? 'change' : 'changes'} waiting to be sent` : 'Everything is saved',
    body: [h('p', { class: 'muted', style: { marginTop: 0 } }, items.length ? (navigator.onLine ? 'Sending now…' : 'You’re offline. These are kept on this phone and go out by themselves when the internet is back — you can close the app.') : 'All your changes have reached the family.'),
      items.length ? h('ul', { class: 'ob-list' }, items.map(x => h('li', {}, h('b', {}, `${x.kind} ${x.action}`), x.name ? h('span', {}, ' — ' + x.name) : null, h('small', {}, ' · ' + ago(x.at))))) : null,
      (store.failed || []).length ? h('p', { class: 'warn-line' }, `${store.failed.length} could not be saved (the database refused them) — they show in the console for the admin.`) : null],
    actions: [items.length && navigator.onLine ? { label: 'Send now', onClick: () => { store.flush(); } } : null, { label: 'OK', onClick: () => { } }].filter(Boolean) });
}
function syncPill() {
  if (store.mode !== 'live') return null;
  const v = syncState();
  return h('button', { type: 'button', class: 'sync ' + v, title: SYNC[v][1], 'aria-live': 'polite', onclick: showOutbox }, h('i'), h('span', {}, syncText(v)));
}
onStatus((v) => document.querySelectorAll('.sync').forEach(el => { el.className = 'sync ' + v; el.title = SYNC[v][1]; el.lastChild.textContent = syncText(v); }));

function avatar() {
  const n = unread().length;
  const b = h('button', { class: 'avatar', type: 'button', 'aria-label': 'Menu: edit history, bin, settings, your name', onclick: (e) => avatarMenu(e.currentTarget) },
    (store.me.name || '?').trim().charAt(0).toUpperCase(), n ? h('span', { class: 'avatar-dot', 'aria-hidden': 'true' }) : null);
  return b;
}

function profileMenu() {
  const name = h('input', { value: store.me.name, maxlength: 60, autocomplete: 'name' });
  const phone = h('input', { type: 'tel', value: store.me.phone || '', maxlength: 20, autocomplete: 'tel', inputmode: 'tel', placeholder: 'e.g. 98765 43210' });
  modal({
    title: 'Your name and WhatsApp',
    body: [field('This is how your changes are signed', name),
      field('Your WhatsApp number', phone, 'So the family can nudge you on WhatsApp in one tap (“could you add the caterer’s quote?”). Only people in the family can see it. 10-digit Indian numbers are fine; add the country code for others.')],
    actions: [{ label: 'Save', onClick: async () => {
      const v = name.value.trim(); if (!v) return false;
      const ph = phone.value.trim();
      if (ph && !waNumber(ph)) { toast('That number doesn’t look right — 10 digits, or with the country code', 'error'); return false; }
      try { if (v !== store.me.name) await store.rename(v); if (ph !== (store.me.phone || '')) await store.setPhone(ph); toast('Saved'); render(); }
      catch (e) { toast(e.message, 'error'); return false; }
    } }]
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

// Home's first card: hello, your next jobs, and how many options are waiting for your vote.
function greeting() {
  const jobs = myOpenJobs().sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
  const late = jobs.filter(t => t.due && daysUntil(t.due) < 0).length;
  const first = (store.me.name || '').split(/\s+/)[0];
  return h('section', { class: 'greet-card' },
    h('div', { class: 'gc-h' }, h('b', {}, `Hi ${first}`),
      h('span', { class: 'muted' }, jobs.length ? ` · ${jobs.length} ${jobs.length === 1 ? 'job' : 'jobs'} for you` : ' · nothing on your list'),
      late ? h('span', { class: 'neg' }, ` · ${late} overdue`) : null),
    jobs.length ? h('div', { class: 'gc-jobs' }, jobs.slice(0, 2).map(t => h('a', { class: 'gc-job', href: t.kind === 'todo' ? `#/w/${t.wedding_id}/todo` : `#/w/${t.wedding_id}/plan?open=${t.id}` },
      h('span', {}, t.title), t.due ? h('small', { class: daysUntil(t.due) < 0 ? 'neg' : '' }, shortDate(t.due)) : null))) : null,
    h('div', { class: 'gc-links' },
      jobs.length ? h('a', { href: '#/me' }, 'All your jobs →') : h('span', { class: 'muted' }, 'When someone puts your name on a job, it shows here.')));
}

function renderHome() {
  applyTheme(null);
  const ws = weddings();
  const fresh = unread();
  const waiting = waitingDecisions();
  const soon = comingUp();
  const top = store.rows('activity')[0];

  const anns = announcementBars(null);
  const changes = h('section', { class: 'hcard changes-card', 'aria-label': 'New since you last looked' },
    anns.length ? h('div', { class: 'h-anns' }, anns) : null,
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
    }) : h('p', { class: 'muted hc-empty' }, 'No big decisions waiting. Mark a step as a big decision and it shows here until it’s final.'),
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
        h('span', { class: 'home-top-r' }, h('span', { class: 'today' }, todayLabel()), hereDots(null), syncPill(), undoButtons(), avatar())),
      newForYou(null),
      installOffer(),
      h('section', { class: 'emblems' + (ws.length > 2 ? ' many' : '') },
        ws.length ? ws.map(emblem)
          : h('p', { class: 'muted' }, store.me.isAdmin ? h('span', {}, 'No weddings yet. ', h('a', { href: '#/settings' }, 'Add one in Settings')) : 'No weddings yet.')),
      greeting(),
      h('main', { class: 'home-row' }, changes, decide, coming)));
}

/* ---------- Wedding space ---------- */
const TABS = [['overview', 'Overview', 'overview'], ['choose', 'Choose', 'compare'], ['plan', 'Plan', 'plan'], ['lists', 'Lists', 'list'], ['budget', 'Budget', 'budget']];
const ALIAS = { decide: 'overview', files: 'lists', board: 'choose', options: 'choose', swipe: 'choose' }; // still reachable, shown under these tabs
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

  const root = h('div', { class: 'space deco-' + t.deco + (tab === 'board' ? ' on-board' : '') + (tab === 'swipe' ? ' is-swipe' : '') });
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
          h('a', { href: link(k), 'aria-current': (ALIAS[tab] || tab) === k ? 'page' : null },
            h('span', { class: 'snav-ic', html: ICONS[icon] }), h('span', { class: 'snav-t' }, label),
            k === 'overview' && nWait ? h('span', { class: 'nbadge', title: `${nWait} big decisions waiting` }, String(nWait)) : null))),
        syncPill(),
        hereDots(w.id), roleChip(), helpButton(sub === 'todo' ? 'plan' : tab),
        undoButtons(),
        avatar())),
    h('div', { class: 'shead-rule', 'aria-hidden': 'true' }),
    h('img', { class: 'space-flora', src: t.deco === 'rose' ? 'assets/lush_rose.svg' : 'assets/lush_blue.svg', alt: '', 'aria-hidden': 'true' }),
    h('img', { class: 'space-flora two', src: t.deco === 'rose' ? 'assets/sprig_rose.svg' : 'assets/sprig_blue.svg', alt: '', 'aria-hidden': 'true' }),
    h('img', { class: 'space-flora three', src: t.deco === 'rose' ? 'assets/sprig_rose.svg' : 'assets/sprig_blue.svg', alt: '', 'aria-hidden': 'true' }));

  const body = h('div', { class: tab === 'board' ? 'board-wrap' : 'wrap sbody', 'data-fresh': tab === 'board' ? '' : null });
  root.append(body);
  const tp = tip(sub === 'todo' ? 'plan' : tab);
  if (tp) body.prepend(tp);
  if (tab === 'board') renderBoard(body, w, params);
  else if (tab === 'choose') renderChoose(body, w, params);
  else if (tab === 'options') renderOptions(body, w, params.step);
  else if (tab === 'swipe') { const sw = h('div', { class: 'sw-wrap', 'data-fresh': '' }); body.append(sw); renderSwipe(sw, { weddingId: w.id, stepId: params.step }); }
  else if (tab === 'decide') renderOverview(body, w, params); // the old Decisions page now lives on the Overview and in Choose
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

// Who else is here right now: a dot for each person, with the page they're on.
const ROOM = { overview: 'the Overview', choose: 'Choose', options: 'Choose', board: 'the mood board', swipe: 'Choose', plan: 'the plan', todo: 'Jobs', lists: 'Lists', files: 'Lists', budget: 'the budget' };
export function hereDots(wid) {
  const ps = (store.presence || []).filter(p => !wid || String(p.room || '').startsWith(wid + '/'));
  if (!ps.length) return null;
  const where = (p) => { const [w, sub] = String(p.room || '').split('/'); return wid ? 'on ' + (ROOM[sub] || 'this wedding') : (wedding(w) ? 'in ' + wedding(w).couple : 'here'); };
  const names = ps.map(p => `${p.name || 'Someone'} — ${where(p)}`);
  return h('button', { type: 'button', class: 'here-dots', title: names.join('\n'), 'aria-label': `Here now: ${names.join(', ')}`, onclick: () => toast('Here now: ' + names.join(' · ')) },
    ps.slice(0, 4).map(p => h('span', { class: 'hd-av' }, String(p.name || '?').trim().charAt(0).toUpperCase())),
    ps.length > 4 ? h('span', { class: 'hd-more' }, '+' + (ps.length - 4)) : null);
}

// For people with a limited role: a small reminder of what they can do.
function roleChip() {
  const r = store.roleOf(store.me); if (r === 'full') return null;
  const t = r === 'view' ? ['View only', 'You can look, comment and vote. Ask the admin if you need to change things.'] : ['Lists only', 'You can work on Lists & files, comment and vote.'];
  return h('button', { type: 'button', class: 'role-chip', title: t[1], onclick: () => toast(t[1]) }, t[0]);
}

/* ---------- Family-wide pages ---------- */
function pageBar() {
  return h('header', { class: 'pbar' },
    h('div', { class: 'wrap pbar-in' },
      h('a', { class: 'brand', href: '#/home' }, h('span', { class: 'pbar-back', html: ICONS.back }), 'The Wedding War Room'),
      h('nav', { class: 'pnav', 'aria-label': 'Weddings' }, weddings().map(w => h('a', { href: '#/w/' + w.id, style: { color: themeOf(w).deep } }, w.couple))),
      syncPill(),
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

  return h('div', { class: 'landing gate-page', 'data-fresh': '' },
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
  if (store.me && store.setRoom) store.setRoom(parts[0] === 'w' ? parts[1] + '/' + (parts[2] || 'overview') : parts[0] || 'home');
  const key = parts.join('/');
  document.title = 'The Wedding War Room';
  let view;
  document.documentElement.style.background = '';
  if (!parts.length) { applyTheme(null); view = renderLanding(); }
  else if (!booted) { view = h('div', { class: 'loading' }, 'Opening the plans…'); }
  else if (parts[0] === 'p') view = renderPartner(parts[1] || '');
  else if (!store.me) view = renderGate();
  else if (parts[0] === 'w') { view = renderSpace(parts[1], parts[2], params); const w = wedding(parts[1]); if (w) document.title = w.couple + ' · The Wedding War Room'; }
  else if (parts[0] === 'activity' || parts[0] === 'history') view = familyPage(renderActivity());
  else if (parts[0] === 'bin') view = familyPage(renderBin());
  else if (parts[0] === 'budget') view = familyPage(renderFamilyBudget(params));
  else if (parts[0] === 'me') view = familyPage(renderMyJobs());
  else if (parts[0] === 'settings') view = familyPage(renderSettings());
  else if (parts[0] === 'share') view = familyPage(renderShare());
  else if (parts[0] === 'swipe') { const el = h('main', { class: 'wrap swipe-page' }); renderSwipe(el, {}); view = familyPage(el); }
  else { view = renderHome(); setTimeout(maybeWelcome, 400); }
  document.body.dataset.page = parts[0] === 'p' ? 'partner' : !parts.length ? 'landing' : !store.me ? 'gate' : parts[0] === 'w' ? 'space' : parts[0] === 'home' || !['activity', 'history', 'bin', 'settings', 'budget', 'me', 'swipe', 'share'].includes(parts[0]) ? 'home' : 'page';
  const keepScroll = app.dataset.view === key ? window.scrollY : 0;
  const newPage = app.dataset.view !== key;
  app.dataset.view = key;
  if (newPage && view && view.classList) view.classList.add('page-in');
  const boardView = $('.board-view');
  const boardScroll = boardView ? [boardView.scrollLeft, boardView.scrollTop] : null;
  const pop = document.querySelector('.menu-pop'); if (pop) pop.remove();
  // Same page: change only what differs. A new page: put it in whole.
  if (newPage) { app.replaceChildren(view); window.scrollTo(0, 0); }
  else { morphInto(app, view); if (Math.abs(window.scrollY - keepScroll) > 2) window.scrollTo(0, keepScroll); }
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
    const popOpen = document.querySelector('.menu-pop, .add-pop:not([hidden]), .rx-pick:not([hidden]), .addmenu:not([hidden])');
    if (ui.busy || typing || popOpen || document.querySelector('.modal-wrap')) { setTimeout(tryRender, 400); return; }
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
    // Show the saved copy straight away, then bring in the latest from the internet.
    const hadCopy = !!(store.hydrate && store.hydrate());
    if (hadCopy && !onLandingNow()) render();
    try { await store.loadAll(); }
    catch (e) {
      // Offline but there's a copy on this phone: keep working with it; it catches up when the internet is back.
      if (e.offline && hadCopy) { booted = true; toast('No internet — showing what’s saved on this phone. Changes are kept and sent later.'); if (!onLandingNow()) render(); window.addEventListener('online', () => store.loadAll().then(() => render()).catch(() => { }), { once: true }); return; }
      throw e;
    }
  } catch (e) {
    console.error(e);
    app.replaceChildren(h('div', { class: 'landing' }, h('div', { class: 'gate-card' }, h('h1', { class: 'foil' }, 'Could not open the plans'), h('p', { class: 'land-sub' }, e.message || 'Check your internet connection and reload the page.'), h('button', { class: 'enter solid', onclick: () => location.reload() }, 'Try again'))));
    return;
  }
  booted = true;
  startNotifier();
  import('./backups.js?v=48').then(m => m.autoBackup()).catch(() => { });
  if (!onLandingNow()) render();
}

applyEasy();
// Your own vote on the swipe screen redraws only the deck (instant), not the whole page.
store.onChange((info) => { if (info && !info.remote && info.table === 'reactions' && /^#\/(w\/[^/]+\/)?swipe/.test(location.hash)) return; scheduleRender(); });
if (store.mode === 'live' && 'serviceWorker' in navigator && location.protocol === 'https:') {
  // When a new version of the site is published, refresh once so everyone sees it — but never while typing or in a pop-up.
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    const safe = () => { const a = document.activeElement; return !document.querySelector('.modal-wrap') && !(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)); };
    const go = () => { if (safe()) { reloaded = true; location.reload(); } else setTimeout(go, 2000); };
    go();
  });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => { reg.update().catch(() => { }); setInterval(() => reg.update().catch(() => { }), 30 * 60 * 1000); }).catch(() => { });
}
window.addEventListener('hashchange', () => { document.querySelectorAll('.modal-wrap').forEach(m => m.remove()); closeDrawer(); render(); });
boot();
