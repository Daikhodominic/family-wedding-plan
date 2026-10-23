// The first page of each wedding: what's happening, what's next, who is doing what.
import { store } from './store.js?v=28';
import { h, toast, modal, field, daysUntil, fancyDate, shortDate, ago, ICONS, popMenu } from './ui.js?v=28';
import { live, stepVisible, feedList, themeOf, render } from './app.js?v=28';
import { openStep, lockIcon } from './panel.js?v=28';
import { planOf, journeyBar } from './map.js?v=28';
import { listSummary } from './lists.js?v=28';
import { budgetMath, inr } from './budget.js?v=28';
import { editStep } from './pipeline.js?v=28';
import { canonical } from './myjobs.js?v=28';
import { pictureEl } from './map.js?v=28';
import { readyToDecide, favScore } from './boardauto.js?v=28';
import { isDecider } from './tools.js?v=28';
import { cardTitle } from './decisions.js?v=28';
import { announcementBars, finalWeek, datesBanner, looksFinished, shareWeek, calendarFor, newAnnouncement } from './planauto.js?v=28';
import { share, siteLink, copyLink } from './tools.js?v=28';
import { planOffer } from './plans.js?v=28';
import { newForYou } from './swipe.js?v=28';

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

// Sections show their first three; "Show all" opens the rest right there.
const opened = new Set();
function moreToggle(key, n, shown) {
  if (n <= shown) return null;
  const on = opened.has(key);
  return h('button', { type: 'button', class: 'o-more', 'aria-expanded': String(on), onclick: () => { if (on) opened.delete(key); else opened.add(key); render(); } }, on ? 'Show fewer' : `Show all ${n}`);
}
function block(title, items, empty, opts = {}) {
  const key = (opts.key || '') + title;
  const limit = opened.has(key) ? items.length : (opts.limit || 3);
  return h('section', { class: 'oblock' + (opts.cls ? ' ' + opts.cls : '') },
    h('div', { class: 'ob-h' }, h('h2', {}, title), items.length ? h('span', { class: 'count' + (opts.countCls ? ' ' + opts.countCls : '') }, String(items.length)) : null, opts.link ? h('a', { class: 'ob-link', href: opts.link[0] }, opts.link[1]) : null),
    items.length ? h('div', { class: 'olist' }, items.slice(0, limit).map(t => taskRow(t, opts)), moreToggle(key, items.length, opts.limit || 3))
      : h('p', { class: 'muted o-empty' }, empty));
}

// Suggestions sent in by the partner family (on a card, or in general).
function partnerSugg(w) {
  const list = live(store.rows('comments') || []).filter(c => c.wedding_id === w.id && c.from_partner).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6);
  if (!list.length) return null;
  return h('section', { class: 'oblock partner-sugg' }, h('div', { class: 'ob-h' }, h('h2', {}, 'From the partner family'), h('span', { class: 'count gold' }, String(list.length))),
    h('div', { class: 'olist' }, list.map(c => { const it = c.item_id && store.find('board_items', c.item_id);
      return h(it ? 'a' : 'div', { class: 'orow', href: it ? `#/w/${w.id}/board?focus=${it.id}` : null }, h('span', { class: 'o-dot list' }), h('span', { class: 'o-main' }, h('b', {}, '“' + c.body + '”'), h('span', {}, `${c.author_name || 'Partner family'}${it ? ' · on ' + cardTitle(it) : ''} · ${ago(c.created_at)}`))); })));
}

// Viewer links for the partner family: make one, copy or send it, or turn it off.
function partnerLinks(w) {
  if (store.missing && store.missing.partner_links) { toast('The partner view needs database update 9. Ask the admin to run it.', 'error'); return; }
  const body = h('div', { class: 'pl-body' });
  const draw = () => {
    const links = live(store.rows('partner_links') || []).filter(l => l.wedding_id === w.id && !l.revoked_at);
    const people = (store.rows('partners') || []).filter(p => p.wedding_id === w.id);
    const label = h('input', { placeholder: 'e.g. Adahrii’s family', maxlength: 60 });
    body.replaceChildren(
      h('p', { class: 'muted', style: { margin: 0 } }, 'Anyone with the link can see this wedding’s mood board, what’s been decided (no prices) and how far along it is, and can react and send suggestions. They never see the budget, phone numbers, lists, files or family comments.'),
      h('a', { class: 'btn ghost small', href: `#/p/preview-${w.id}`, onclick: () => document.querySelector('.modal-wrap') && document.querySelector('.modal-wrap').remove() }, 'See exactly what they see'),
      ...(links.length ? links.map(l => { const url = siteLink('#/p/' + l.token);
        return h('div', { class: 'pl-row' }, h('div', {}, h('b', {}, l.label), h('span', { class: 'ft-sub' }, ` · ${people.filter(p => p.link_id === l.id).length} joined`), h('div', { class: 'pl-url' }, url)),
          h('div', { class: 'acts' }, h('button', { type: 'button', class: 'btn small', onclick: () => copyLink(url) }, 'Copy'),
            h('button', { type: 'button', class: 'btn small ghost', onclick: () => share(`${w.couple} — have a look at our wedding plans and ideas, and send us your suggestions:`, url) }, 'WhatsApp'),
            h('button', { type: 'button', class: 'btn small ghost', style: { color: 'var(--warn)' }, onclick: () => store.update('partner_links', l.id, { revoked_at: new Date().toISOString() }).then(() => { toast('That link no longer works'); draw(); }).catch(e => toast(e.message, 'error')) }, 'Turn off'))); })
        : [h('p', { class: 'ft-sub' }, 'No link yet.')]),
      h('div', { class: 'pl-new' }, label, h('button', { type: 'button', class: 'btn', onclick: () => store.insert('partner_links', { wedding_id: w.id, label: label.value.trim() || 'Partner family', token: crypto.randomUUID() }).then(() => { toast('Link made — copy it or send it on WhatsApp'); draw(); }).catch(e => toast(e.message, 'error')) }, 'Make a link')));
  };
  draw();
  modal({ title: 'Share with the partner family', wide: true, body });
}

export function renderOverview(root, w, params = {}) {
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

  // Announcements and final-week mode come first.
  root.append(...announcementBars(w.id));
  { const n = newForYou(w.id); if (n) root.append(n); }
  const fw = finalWeek(w, params.finalweek === '1' && store.me.isAdmin);
  if (fw) root.append(fw);
  // Header: date, countdown, a one-line tally, the journey bar and one "More" menu.
  const tally = [
    [finished, 'done'], [open.length, 'to do'],
    overdue.length ? [overdue.length, 'overdue', 'warn'] : null,
    plan.locked ? [plan.locked, 'final', 'gold'] : null].filter(Boolean);
  const moreBtn = h('button', { type: 'button', class: 'btn ghost small oh-more', 'aria-haspopup': 'menu', onclick: () => popMenu(moreBtn, [
    { icon: 'comment', label: 'Share this week on WhatsApp', onClick: () => shareWeek(w) },
    { icon: 'plan', label: 'Add dates to my calendar', onClick: () => calendarFor(w) },
    isDecider() ? { icon: 'note', label: 'Post an announcement', onClick: () => newAnnouncement(w) } : null,
    isDecider() ? { icon: 'user', label: 'Share with the partner family', onClick: () => partnerLinks(w) } : { icon: 'user', label: 'What the partner family sees', href: `#/p/preview-${w.id}` },
    store.me.isAdmin && !fw ? { icon: 'lock', label: 'Preview final-week mode', href: `#/w/${w.id}?finalweek=1` } : null]) }, 'More ', h('span', { 'aria-hidden': 'true' }, '▾'));
  root.append(h('section', { class: 'ohero calm' },
    h('div', { class: 'oh-top' },
      h('div', { class: 'oh-when' },
        store.me.isAdmin
          ? h('button', { type: 'button', class: 'oh-date', onclick: () => editDate(w), title: 'Change the date' }, w.wedding_date ? fancyDate(w.wedding_date) : (w.date_note || 'Date not fixed yet'), h('span', { class: 'oh-edit', html: ICONS.edit }))
          : h('div', { class: 'oh-date' }, w.wedding_date ? fancyDate(w.wedding_date) : (w.date_note || 'Date not fixed yet')),
        w.wedding_date && days !== null
          ? h('div', { class: 'oh-count' }, h('b', {}, String(Math.max(0, days))), h('span', {}, days === 0 ? 'Today!' : days < 0 ? 'Married!' : days === 1 ? 'day to go' : 'days to go'))
          : store.me.isAdmin ? h('div', { class: 'oh-count tbd' }, h('button', { type: 'button', class: 'btn small', onclick: () => editDate(w) }, 'Set the date')) : null),
      h('div', { class: 'oh-side' },
        moreBtn,
        h('div', { class: 'oh-tally' }, tally.map(([n, label, cls]) => h('span', { class: 'ot' + (cls ? ' ' + cls : '') }, h('b', {}, String(n)), ' ' + label))))),
    journeyBar(w, plan, { onPick: (areaId) => { location.hash = `#/w/${w.id}/plan?focus=${areaId}`; } })));
  { const po = planOffer(w); if (po) root.append(po); }
  const db = isDecider() ? datesBanner(w) : null; if (db) root.append(db);
  const lf = looksFinished(w);
  if (lf.length) root.append(h('section', { class: 'oblock looks' },
    h('div', { class: 'ob-h' }, h('h2', {}, 'Looks finished'), h('span', { class: 'count' }, String(lf.length)), h('span', { class: 'ob-sub' }, 'Tick these off?')),
    h('div', { class: 'olist' }, lf.slice(0, 3).map(({ s, why }) => h('div', { class: 'orow lf' },
      h('span', { class: 'o-dot doing' }), h('span', { class: 'o-main' }, h('b', {}, s.title), h('span', {}, 'Because ' + why)),
      h('button', { type: 'button', class: 'btn small', onclick: () => store.update('steps', s.id, { status: 'done' }).then(() => toast('Done ✓')).catch(fail) }, 'Mark done'))))));
  const boardItems = live(store.rows('board_items')).filter(i => i.wedding_id === w.id && !['shape', 'connector', 'label', 'option'].includes(i.kind));
  const ready = isDecider() ? boardItems.filter(readyToDecide) : [];
  if (ready.length) root.append(h('section', { class: 'tip ready' }, h('span', { class: 'tip-i' }, '✦'),
    h('span', {}, h('b', {}, `Ready to decide: `), ready.map(r => cardTitle(r)).join(', '), ' — the family has voted.'),
    h('a', { class: 'tip-x', href: `#/w/${w.id}/board?focus=${ready[0].id}` }, 'Have a look')));
  const favs = boardItems.map(i => ({ i, s: favScore(i) })).filter(x => x.s >= 2).sort((a, b) => b.s - a.s).slice(0, 6);
  const finals = all.filter(x => x.kind === 'step' && x.locked_at).sort((a, b) => String(b.locked_at).localeCompare(String(a.locked_at)));
  if (finals.length) root.append(h('section', { class: 'decided-strip' },
    h('div', { class: 'ob-h' }, h('h2', {}, 'Decided so far'), h('span', { class: 'count gold' }, String(finals.length)), h('a', { class: 'ob-link', href: `#/w/${w.id}/plan?view=glimpse` }, 'See the wedding at a glance →')),
    h('div', { class: 'ds-row' }, finals.slice(0, 6).map(s => h('button', { type: 'button', class: 'ds-item', onclick: () => openStep(s.id) },
      pictureEl(s, 'ds-pic') || h('span', { class: 'ds-pic ph' }, '✓'),
      h('b', {}, (s.lock_note && s.lock_note.choice && s.lock_note.choice.title) || s.title),
      h('span', {}, (s.lock_note && (s.lock_note.vendor || s.lock_note.with)) || s.title))))));

  // Who is doing what
  const people = new Map();
  for (const x of open) {
    const key = canonical(x.owner);
    const k = key.toLowerCase() || '~';
    if (!people.has(k)) people.set(k, { name: key || 'Not assigned yet', list: [] });
    people.get(k).list.push(x);
  }
  const ppl = [...people.entries()].sort((a, b) => (a[0] === '~') - (b[0] === '~') || b[1].list.length - a[1].list.length);
  const whoEl = h('section', { class: 'oblock who' },
    h('div', { class: 'ob-h' }, h('h2', {}, 'Who is doing what'), h('span', { class: 'ob-sub' }, 'Open jobs, by the person in charge')),
    ppl.length ? h('div', { class: 'who-grid' }, ppl.filter(([k]) => k !== '~').slice(0, opened.has(w.id + 'who') ? 99 : 4).map(([k, p]) => {
      const late = p.list.filter(x => x.due && daysUntil(x.due) < 0).length;
      const sorted = [...p.list].sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
      return h('div', { class: 'person' + (k === '~' ? ' nobody' : '') },
        h('div', { class: 'p-h' }, h('span', { class: 'p-av' }, k === '~' ? '?' : p.name.charAt(0).toUpperCase()), h('b', {}, p.name),
          h('span', { class: 'p-n' }, `${p.list.length} open`, late ? h('span', { class: 'neg' }, ` · ${late} overdue`) : null)),
        h('div', { class: 'olist' }, sorted.slice(0, 3).map(x => taskRow(x, { showOwner: false })), sorted.length > 3 ? h('span', { class: 'o-more' }, `+ ${sorted.length - 3} more`) : null));
    })) : h('p', { class: 'muted o-empty' }, 'Nothing open. Give steps and to-dos a “person in charge” and they appear here.'),
    moreToggle(w.id + 'who', ppl.filter(([k]) => k !== '~').length, 4));

  // Recently done (from the edit history)
  const recent = store.rows('activity').filter(a => a.wedding_id === w.id && a.changes && ((a.changes.status && a.changes.status.new === 'done') || (a.changes.locked_at && a.changes.locked_at.new))).slice(0, 6);

  // Lists and money at a glance
  const lists = (store.missing && store.missing.lists) ? [] : live(store.rows('lists') || []).filter(l => l.wedding_id === w.id).sort((a, b) => a.title.localeCompare(b.title));
  const listsEl = h('section', { class: 'oblock' },
    h('div', { class: 'ob-h' }, h('h2', {}, 'Lists'), h('a', { class: 'ob-link', href: `#/w/${w.id}/lists` }, 'All lists →')),
    lists.length ? h('div', { class: 'olist' }, lists.slice(0, 4).map(l => { const s = listSummary(l); return h('a', { class: 'orow', href: `#/w/${w.id}/lists?list=${l.id}` }, h('span', { class: 'o-dot list', html: '' }), h('span', { class: 'o-main' }, h('b', {}, l.title), h('span', {}, s.join(' · ')))); }))
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

  const named = ppl.filter(([k]) => k !== '~');
  const nothingUrgent = !overdue.length && !doing.length && !soon.length;
  const left = [
    overdue.length ? block('Overdue', overdue, '', { key: w.id, cls: 'warnblock', countCls: 'warn', more: `#/w/${w.id}/plan` }) : null,
    doing.length ? block('Happening now', doing, '', { key: w.id, more: `#/w/${w.id}/plan` }) : null,
    soon.length ? block('Coming up · next 3 weeks', soon, '', { key: w.id, more: `#/w/${w.id}/plan` }) : null,
    block('Waiting on a decision', waiting, 'No big decisions waiting.', { key: w.id, countCls: 'gold', link: [`#/w/${w.id}/choose`, 'Choose'] })].filter(Boolean);
  const right = [
    named.length ? whoEl : null,
    partnerSugg(w),
    recent.length ? h('section', { class: 'oblock' },
      h('div', { class: 'ob-h' }, h('h2', {}, 'Recently done'), h('a', { class: 'ob-link', href: '#/history' }, 'History →')),
      feedList(recent.slice(0, 4), { compact: true })) : null,
    favs.length ? h('section', { class: 'oblock' }, h('div', { class: 'ob-h' }, h('h2', {}, 'Family favourites'), h('a', { class: 'ob-link', href: `#/w/${w.id}/board` }, 'Board →')),
      h('div', { class: 'olist' }, favs.slice(0, 4).map(({ i, s }) => h('a', { class: 'orow', href: `#/w/${w.id}/board?focus=${i.id}` }, h('span', { class: 'o-dot list' }), h('span', { class: 'o-main' }, h('b', {}, cardTitle(i)), h('span', {}, `${s} likes and votes`)))))) : null,
    lists.length ? listsEl : null,
    moneyEl && budgetMath(w.id).b ? moneyEl : null].filter(Boolean);
  if (nothingUrgent) root.append(h('p', { class: 'o-calm' }, '✓ Nothing overdue or due in the next three weeks.'));
  root.append(h('div', { class: 'ogrid' + (right.length ? '' : ' one') }, h('div', { class: 'ocol' }, left), right.length ? h('div', { class: 'ocol' }, right) : null));
  void t; void ago; void lockIcon;
}
