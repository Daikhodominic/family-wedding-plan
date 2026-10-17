import { store } from './store.js';
import { h, $, toast, modal, field, daysUntil, fancyDate, ago, ICONS, confirmBox } from './ui.js';
import { renderPipeline } from './pipeline.js';
import { renderBoard } from './board.js';
import { renderActivity, renderBin, renderSettings, describe, linkFor } from './extras.js';

const app = document.getElementById('app');

/* ---------- Themes ---------- */
export const THEMES = {
  blue: { bg: '#F9F7F2', surface: '#FFFFFF', ink: '#2B3540', muted: '#5C6B78', line: '#DCE3E9', soft: '#E7EDF2', accent: '#4F6A84', accentInk: '#FFFFFF', light: '#AFBEC8', deco: 'blue' },
  rose: { bg: '#F7F0E8', surface: '#FFFFFF', ink: '#3A2A30', muted: '#7D6A6F', line: '#EAD8CF', soft: '#F6E8E3', accent: '#7A4A5C', accentInk: '#FFFFFF', light: '#DCAFA6', deco: 'rose' }
};
export function themeOf(w) {
  const base = THEMES[w && w.theme] || THEMES.blue;
  return { ...base, ...((w && w.theme_custom) || {}) };
}
function applyTheme(el, t) {
  const map = { bg: '--w-bg', surface: '--w-surface', ink: '--w-ink', muted: '--w-muted', line: '--w-line', soft: '--w-soft', accent: '--w-accent', accentInk: '--w-accent-ink', light: '--w-light' };
  for (const [k, v] of Object.entries(map)) if (t[k]) el.style.setProperty(v, t[k]);
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

export const weddings = () => store.rows('weddings').slice().sort((a, b) => (a.position || 0) - (b.position || 0));
export const wedding = (id) => store.rows('weddings').find(w => w.id === id);
export const live = (rows) => rows.filter(r => !r.deleted_at);

/* ---------- Shell ---------- */
function unreadCount() {
  if (!store.me) return 0;
  return store.rows('activity').filter(a => a.id > store.me.lastSeen && a.actor !== store.me.id).length;
}

function topbar(current) {
  const n = unreadCount();
  return h('div', { class: 'wrap topbar' },
    h('a', { class: 'brand', href: '#/' }, 'Our Family Wedding Plan'),
    h('nav', { class: 'topnav', 'aria-label': 'Main' },
      h('a', { href: '#/activity', 'aria-current': current === 'activity' ? 'page' : null }, 'Activity', n ? h('span', { class: 'badge' }, String(n)) : null),
      h('a', { href: '#/bin', 'aria-current': current === 'bin' ? 'page' : null }, 'Bin'),
      store.me && store.me.isAdmin ? h('a', { href: '#/settings', 'aria-current': current === 'settings' ? 'page' : null, 'aria-label': 'Settings', html: ICONS.settings }) : null,
      h('button', { class: 'navlink', type: 'button', onclick: profileMenu, title: 'Your name' }, store.me ? store.me.name + (store.me.isAdmin ? ' · Admin' : '') : '')
    ));
}

function profileMenu() {
  const name = h('input', { value: store.me.name, maxlength: 60, autocomplete: 'name' });
  modal({
    title: 'Your name',
    body: [field('This is how your changes are signed', name),
      store.mode === 'live' ? h('button', { class: 'link-btn', type: 'button', onclick: async () => { if (await confirmBox('Sign out?', 'You will need the family passcode to come back in on this device.', 'Sign out')) { await store.signOut(); location.hash = '#/'; location.reload(); } } }, 'Sign out of this device') : null],
    actions: [{ label: 'Save', onClick: async () => { const v = name.value.trim(); if (!v) return false; await store.rename(v); toast('Saved'); render(); } }]
  });
}

function demoFlag() {
  if (store.mode !== 'demo') return null;
  return h('div', { class: 'demo-flag' }, 'Preview with sample data — changes stay in this browser only. ',
    h('button', { type: 'button', onclick: () => store.resetDemo() }, 'Reset the sample'));
}

/* ---------- Home ---------- */
function archFor(w) {
  const t = themeOf(w);
  const isRose = t.deco === 'rose';
  const days = daysUntil(w.wedding_date);
  const steps = live(store.rows('steps')).filter(s => s.wedding_id === w.id && stepVisible(s));
  const done = steps.filter(s => s.status === 'done').length;
  const sprig = isRose ? 'assets/sprig_rose.svg' : 'assets/sprig_blue.svg';
  const [a, b] = (w.monogram || '').split('&');
  return h('a', { class: 'arch ' + (isRose ? 'rose' : 'blue'), href: '#/w/' + w.id, style: isRose ? null : null },
    h('img', { class: 'deco', src: sprig, alt: '', 'aria-hidden': 'true', style: isRose ? { right: '-64px', top: '-30px', transform: 'rotate(32deg)' } : { left: '-64px', top: '-30px', transform: 'rotate(-32deg)' } }),
    h('img', { class: 'deco', src: sprig, alt: '', 'aria-hidden': 'true', style: isRose ? { left: '-58px', bottom: '-36px', width: '180px', transform: 'scaleX(-1) rotate(8deg)' } : { right: '-58px', bottom: '-36px', width: '180px', transform: 'scaleX(-1) rotate(-8deg)' } }),
    h('span', { class: 'swag', 'aria-hidden': 'true' }),
    isRose
      ? h('div', { class: 'mono' }, h('div', { class: 'seal' }, (a || '').trim(), h('span', { style: { fontSize: '17px', margin: '0 2px' } }, '&'), (b || '').trim()))
      : h('div', { class: 'mono' }, h('img', { src: 'assets/wreath_blue.svg', alt: '' }), (a || '').trim(), h('span', { style: { fontSize: '18px', margin: '0 2px' } }, '&'), (b || '').trim()),
    h('div', { class: 'couple', style: { color: t.accent } }, w.couple),
    h('div', { class: 'when', style: { color: t.ink } }, w.wedding_date ? fancyDate(w.wedding_date) : (w.date_note || 'Date to be fixed')),
    w.wedding_date && days !== null
      ? h('div', { class: 'count' }, h('b', { style: { color: t.ink } }, String(Math.max(0, days))), h('span', { style: { color: t.muted } }, days === 0 ? 'today!' : days < 0 ? 'married!' : days === 1 ? 'day to go' : 'days to go'))
      : h('div', {}, h('div', { class: 'tbd', style: { color: t.ink } }, 'Date to be fixed'), h('div', { class: 'muted', style: { fontSize: '14px' } }, 'The countdown starts once the date is set')),
    h('div', { class: 'muted', style: { fontSize: '14px' } }, steps.length ? `${done} of ${steps.length} steps done` : ''),
    h('span', { class: 'btn', style: { background: t.accent, color: t.accentInk } }, `Open ${w.couple.split('&')[0].trim()}'s plan`, h('span', { 'aria-hidden': 'true' }, '→'))
  );
}

function petals() {
  const spec = [
    ['22%', '18%', 14, 9, '#AFBEC8', 20, 0, 'l'], ['31%', '62%', 10, 7, '#C9D5DE', -30, -3, 'l'], ['12%', '40%', 8, 6, '#8F9EAF', 50, -6, 'l'],
    ['24%', '22%', 14, 9, '#DCAFA6', -15, -2, 'r'], ['33%', '66%', 10, 7, '#E8C6BE', 35, -5, 'r'], ['13%', '44%', 8, 6, '#C9967F', -40, -7, 'r']
  ];
  return spec.map(([x, y, w, hh, c, r, d, side]) => h('span', {
    class: 'petal', 'aria-hidden': 'true',
    style: { [side === 'l' ? 'left' : 'right']: x, top: y, width: w + 'px', height: hh + 'px', background: c, animationDelay: d + 's', borderRadius: side === 'l' ? '60% 0 60% 0' : '0 60% 0 60%', '--r': r + 'deg' }
  }));
}

export function feedList(items, { compact = false } = {}) {
  return h('ul', { class: 'feed' }, items.map(a => {
    const d = describe(a);
    const unread = store.me && a.id > store.me.lastSeen && a.actor !== store.me.id;
    return h('li', {}, h('a', { class: 'row' + (unread ? ' unread' : ''), href: linkFor(a) },
      h('span', { class: 'dot ' + (a.wedding_id && wedding(a.wedding_id) ? a.wedding_id === 'elow' ? 'elow' : a.wedding_id === 'charani' ? 'charani' : 'none' : 'none'), style: dotStyle(a) }),
      h('span', {}, h('strong', {}, a.actor_name || 'Someone'), ' ', d.text,
        a.wedding_id && wedding(a.wedding_id) ? h('span', { class: 'muted' }, ' · ' + wedding(a.wedding_id).couple.split('&')[0].trim()) : null,
        !compact && d.changes.length ? h('span', { class: 'changes' }, d.changes) : null),
      h('span', { class: 'time' }, ago(a.created_at))));
  }));
}
function dotStyle(a) { const w = wedding(a.wedding_id); return w ? { background: themeOf(w).accent } : null; }

function renderHome() {
  const ws = weddings();
  const unread = store.rows('activity').filter(a => store.me && a.id > store.me.lastSeen && a.actor !== store.me.id);
  const recent = (unread.length ? unread : store.rows('activity')).slice(0, 5);
  return h('div', {},
    demoFlag(),
    topbar('home'),
    h('header', { class: 'hero' },
      h('div', { class: 'bloom l', 'aria-hidden': 'true' }), h('div', { class: 'bloom r', 'aria-hidden': 'true' }),
      h('img', { class: 'sprig l', src: 'assets/sprig_blue.svg', alt: '', 'aria-hidden': 'true' }),
      h('img', { class: 'sprig r', src: 'assets/sprig_rose.svg', alt: '', 'aria-hidden': 'true' }),
      petals(),
      h('div', { class: 'wrap' },
        h('div', { class: 'hero-text' },
          h('div', { class: 'eyebrow' }, 'Two weddings · one family'),
          h('h1', {}, 'Our Family Wedding Plan'),
          h('p', { class: 'lede' }, "Every plan, idea and sample for both weddings, in one place. Add what you find, tick off what's done, and see what changed while you were away.")),
        h('div', { class: 'arches' }, ws.map(archFor)))),
    h('section', { class: 'wrap' },
      h('div', { class: 'panel' },
        h('div', { class: 'panel-head' },
          h('h2', {}, unread.length ? 'Since your last visit' : 'Latest changes'),
          h('a', { href: '#/activity', style: { fontWeight: 500 } }, unread.length ? `See all ${unread.length} new →` : 'See all activity →')),
        recent.length ? feedList(recent, { compact: true }) : h('p', { class: 'muted' }, 'Nothing has changed yet. Open a plan and add the first step or photo.'))),
    h('footer', { class: 'wrap foot' },
      h('span', {}, 'Removed something by mistake? Anyone can restore it from the ', h('a', { href: '#/bin' }, 'Bin'), '.'),
      h('span', {}, 'Only the admin can delete permanently.')));
}

/* ---------- Wedding space ---------- */
export function stepVisible(s) {
  const a = store.find('areas', s.area_id);
  if (!a || a.deleted_at) return false;
  const st = store.find('stages', a.stage_id);
  return !!(st && !st.deleted_at);
}

function renderSpace(id, tab, params) {
  const w = wedding(id);
  if (!w) return h('div', {}, topbar(), h('div', { class: 'wrap' }, h('p', {}, 'That wedding was not found. ', h('a', { href: '#/' }, 'Go home'))));
  const t = themeOf(w);
  const root = h('div', { class: 'space' });
  applyTheme(root, t);
  const days = daysUntil(w.wedding_date);
  const [a, b] = (w.monogram || '').split('&');
  const mono = t.deco === 'rose'
    ? h('div', { class: 'mono', style: { width: '96px', height: '96px' } }, h('div', { class: 'seal', style: { width: '82px', height: '82px', fontSize: '24px', background: t.accent } }, (a || '').trim(), '&', (b || '').trim()))
    : h('div', { class: 'mono', style: { width: '96px', height: '96px', fontSize: '26px', color: t.accent } }, h('img', { src: 'assets/wreath_blue.svg', alt: '' }), (a || '').trim(), h('span', { style: { fontSize: '16px', margin: '0 2px' } }, '&'), (b || '').trim());
  const ribbon = t.deco === 'rose'
    ? '<svg class="ribbon" viewBox="0 0 1200 28" preserveAspectRatio="none" aria-hidden="true"><path d="M0 4 Q 100 26 200 4 Q 300 26 400 4 Q 500 26 600 4 Q 700 26 800 4 Q 900 26 1000 4 Q 1100 26 1200 4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>'
    : '<svg class="ribbon" viewBox="0 0 1200 24" preserveAspectRatio="none" aria-hidden="true"><path d="M0 12 C 150 2, 300 22, 450 12 S 750 2, 900 12 S 1100 20, 1200 10" fill="none" stroke="currentColor" stroke-width="2"/></svg>';

  root.append(
    demoFlag() || '',
    h('div', { class: 'wrap topbar' },
      h('a', { href: '#/', class: 'brand', style: { letterSpacing: '.02em', textTransform: 'none', fontFamily: 'var(--sans)', fontSize: '15px' } }, '← Home'),
      h('div', { class: 'toggle', role: 'group', 'aria-label': 'Choose wedding' },
        weddings().map(x => h('a', { href: '#/w/' + x.id + (tab === 'board' ? '/board' : ''), 'aria-current': x.id === id ? 'page' : null }, x.couple))),
      h('nav', { class: 'topnav' },
        h('a', { href: '#/activity' }, 'Activity', unreadCount() ? h('span', { class: 'badge' }, String(unreadCount())) : null),
        h('a', { href: '#/bin' }, 'Bin'))),
    h('div', { class: 'wrap space-head' },
      mono,
      h('div', { class: 'names' },
        h('h1', {}, w.couple),
        h('div', { class: 'when caps', style: { fontSize: '14px' } },
          w.wedding_date ? `${fancyDate(w.wedding_date)}${days !== null && days >= 0 ? ` · ${days} ${days === 1 ? 'day' : 'days'} to go` : ''}` : `${w.date_note || 'Date'} · date to be fixed`,
          store.me.isAdmin ? h('a', { href: '#/settings', class: 'pill', style: { letterSpacing: 0, textTransform: 'none', fontFamily: 'var(--sans)', textDecoration: 'none' } }, w.wedding_date ? 'Edit' : 'Set the date') : null)),
      h('nav', { class: 'tabs', 'aria-label': 'Sections' },
        h('a', { href: '#/w/' + id, 'aria-current': tab !== 'board' ? 'page' : null }, 'Pipeline'),
        h('a', { href: '#/w/' + id + '/board', 'aria-current': tab === 'board' ? 'page' : null }, 'Mood board'))),
    h('div', { class: 'wrap', style: { color: t.light }, html: ribbon }));

  const body = h('div', { class: tab === 'board' ? 'board-wrap' : 'wrap' });
  root.append(body);
  if (tab === 'board') renderBoard(body, w, params); else renderPipeline(body, w, params);
  return root;
}

/* ---------- Gate ---------- */
function renderGate() {
  const err = h('div', { class: 'err', role: 'alert' });
  const pass = h('input', { type: 'password', autocomplete: 'current-password', required: true });
  const name = h('input', { autocomplete: 'name', maxlength: 60, required: true, placeholder: 'e.g. Aunty Ela' });
  const btn = h('button', { class: 'btn', type: 'submit', style: { background: '#4F6A84' } }, 'Come in');
  const form = h('form', {
    onsubmit: async (e) => {
      e.preventDefault(); err.textContent = ''; btn.disabled = true; btn.textContent = 'Checking…';
      try { await store.join(pass.value, name.value.trim()); await boot(); }
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
      try { await store.adminSignIn(email.value.trim(), pw.value); await boot(); }
      catch (x) { aErr.textContent = x.message; }
    }
  }, field('Admin email', email), field('Password', pw), aErr, h('button', { class: 'btn', type: 'submit', style: { background: '#2F2B2C' } }, 'Sign in as admin'));

  return h('div', { class: 'gate' },
    h('div', { class: 'hero', style: { position: 'absolute', inset: 0, padding: 0 } },
      h('div', { class: 'bloom l' }), h('div', { class: 'bloom r' }),
      h('img', { class: 'sprig l', src: 'assets/sprig_blue.svg', alt: '' }), h('img', { class: 'sprig r', src: 'assets/sprig_rose.svg', alt: '' })),
    h('div', { class: 'card' },
      h('div', { class: 'eyebrow' }, 'Two weddings · one family'),
      h('h1', {}, 'Our Family Wedding Plan'),
      h('p', { class: 'muted', style: { margin: 0 } }, 'Enter the family passcode to see and add to the plans.'),
      form,
      h('button', { class: 'link-btn', type: 'button', style: { color: 'var(--muted)', fontSize: '14px' }, onclick: () => { adminForm.hidden = !adminForm.hidden; form.hidden = !adminForm.hidden ? true : false; } }, 'Admin sign-in'),
      adminForm));
}

/* ---------- Render loop ---------- */
let pending = false;
export function render() {
  if (!store.me) { app.replaceChildren(renderGate()); return; }
  const { parts, params } = parseRoute();
  let view; let key = parts.join('/');
  document.title = 'Our Family Wedding Plan';
  if (parts[0] === 'w') { view = renderSpace(parts[1], parts[2], params); const w = wedding(parts[1]); if (w) document.title = w.couple + ' · Family Wedding Plan'; }
  else if (parts[0] === 'activity') view = h('div', {}, demoFlag(), topbar('activity'), renderActivity());
  else if (parts[0] === 'bin') view = h('div', {}, demoFlag(), topbar('bin'), renderBin());
  else if (parts[0] === 'settings') view = h('div', {}, demoFlag(), topbar('settings'), renderSettings());
  else view = renderHome();
  const keepScroll = app.dataset.view === key ? window.scrollY : 0;
  app.dataset.view = key;
  const boardView = $('.board-view');
  const boardScroll = boardView ? [boardView.scrollLeft, boardView.scrollTop] : null;
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
    if (ui.busy || typing || document.querySelector('.modal-wrap')) { setTimeout(tryRender, 600); return; }
    pending = false; render();
  };
  requestAnimationFrame(tryRender);
}

async function boot() {
  app.replaceChildren(h('div', { class: 'loading' }, 'Opening the plans…'));
  try {
    const state = await store.init();
    if (state !== 'ready') { render(); return; }
    await store.loadAll();
  } catch (e) {
    console.error(e);
    app.replaceChildren(h('div', { class: 'gate' }, h('div', { class: 'card' }, h('h1', {}, 'Could not open the plans'), h('p', { class: 'muted' }, e.message || 'Check your internet connection and reload the page.'), h('button', { class: 'btn', onclick: () => location.reload() }, 'Try again'))));
    return;
  }
  render();
}

store.onChange(() => scheduleRender());
window.addEventListener('hashchange', () => { if (!store.me) return; render(); });
boot();
