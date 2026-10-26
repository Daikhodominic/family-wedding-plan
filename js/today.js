// Today: the first page of each wedding, laid out like a wedding website.
// The couple's photo with their monogram, the countdown, what's for you today, what's still to
// decide (with photos), this week, the family, and what's already settled.
import { store } from './store.js?v=53';
import { h, toast, daysUntil, shortDate, ICONS, popMenu, modal, uploadPhoto, buzz } from './ui.js?v=53';
import { live, stepVisible, render } from './app.js?v=53';
import { openStep } from './panel.js?v=53';
import { planOf } from './map.js?v=53';
import { editStep } from './pipeline.js?v=53';
import { jobsFor, isDone } from './myjobs.js?v=53';
import { isDecider, samePerson, siteLink, share } from './tools.js?v=53';
import { announcementBars, finalWeek, datesBanner, looksFinished, shareWeek, calendarFor, newAnnouncement, sentAnnouncements } from './planauto.js?v=53';
import { planOffer } from './plans.js?v=53';
import { categoriesOf, optionsOf, votesOf, firstPic, pendingFor, photoEl } from './swipe.js?v=53';
import { waButton, jobsMessage } from './nudge.js?v=53';
import { areaIcon } from './areaicons.js?v=53';
import { editDate, partnerLinks, partnerSugg } from './overview.js?v=53';

const fail = (e) => { console.error(e); toast(e.message || 'That did not save. Check your connection.', 'error'); };
const first = (n) => String(n || '').trim().split(/\s+/)[0];
const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const d8 = (s) => new Date(s + 'T00:00');

// Headings: a word in capitals, then a word in script ("STILL TO" decide).
export function edHead(caps, script, opts = {}) {
  return h(opts.tag || 'h2', { class: 'ed-h' + (opts.cls ? ' ' + opts.cls : '') }, h('span', { class: 'ed-caps' }, caps), ' ', h('span', { class: 'ed-script' }, script));
}

function tasksOf(w) {
  const steps = live(store.rows('steps')).filter(s => s.wedding_id === w.id && stepVisible(s)).map(s => ({ ...s, kind: 'step', where: (store.find('areas', s.area_id) || {}).title || '' }));
  const todos = (store.missing && store.missing.todos) ? [] : live(store.rows('todos') || []).filter(t => t.wedding_id === w.id).map(t => ({ ...t, kind: 'todo', where: 'Jobs' }));
  return [...steps, ...todos];
}
const openTask = (t) => t.kind === 'todo' ? editStep(store.find('todos', t.id), 'todos') : openStep(t.id);
const setTask = (t, patch) => store.update(t.kind === 'todo' ? 'todos' : 'steps', t.id, patch);

function dateTile(due) {
  if (!due) return h('span', { class: 'ed-tile' }, h('span', { class: 'ed-tile-ic', html: ICONS.user }));
  const d = d8(due);
  return h('span', { class: 'ed-tile' + (daysUntil(due) < 0 ? ' late' : '') }, h('small', {}, DOW[d.getDay()]), h('b', {}, String(d.getDate())));
}

// The cover photo: the couple's own, chosen by the admin; a garden photo until then.
function coverSrc(w) { return (w.theme_custom || {}).cover || null; }
function coverImg(w) {
  const p = coverSrc(w);
  const img = h('img', { class: 'ed-cover', alt: '', decoding: 'async' });
  if (p) store.url(p).then(u => { if (u) img.src = u; });
  else img.src = w.theme === 'blue' ? 'assets/samples/dusk-sky.jpg' : 'assets/samples/garden-aisle.jpg';
  return img;
}
function changeCover(w) {
  const inp = h('input', { type: 'file', accept: 'image/*', hidden: true });
  inp.addEventListener('change', async () => {
    const f = inp.files && inp.files[0]; inp.remove(); if (!f) return;
    toast('Uploading the photo…');
    try { const path = await uploadPhoto(store, f); await store.update('weddings', w.id, { theme_custom: { ...(w.theme_custom || {}), cover: path } }); toast('New cover photo'); }
    catch (e) { fail(e); }
  });
  document.body.append(inp); inp.click();
}
function letters(w) {
  const m = String(w.monogram || '').split(/\s*&\s*|\s+/).filter(Boolean);
  if (m.length >= 2) return [m[0].charAt(0), m[1].charAt(0)];
  const c = String(w.couple || '').split(/\s*&\s*/).filter(Boolean);
  return [(c[0] || '?').charAt(0), (c[1] || '').charAt(0)];
}

export function renderToday(root, w, params = {}) {
  const days = daysUntil(w.wedding_date);
  const plan = planOf(w);
  const all = tasksOf(w);
  const open = all.filter(x => !isDone(x));
  const me = store.me;
  const pending = pendingFor(w.id).length;
  const cats = categoriesOf(w);
  const openCats = cats.filter(c => !c.step.locked_at);
  const finals = all.filter(x => x.kind === 'step' && x.locked_at).sort((a, b) => String(a.locked_at).localeCompare(String(b.locked_at)));
  const mine = me ? jobsFor(me.name).filter(t => t.wedding_id === w.id && !isDone(t)).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999')) : [];

  // Final week takes over the top when it's close.
  const fw = finalWeek(w, params.finalweek === '1' && me.isAdmin);
  if (fw) root.append(fw);

  /* ---------- The cover ---------- */
  const [l1, l2] = letters(w);
  const go = pending ? { label: `${pending} new to vote on`, href: `#/w/${w.id}/swipe` }
    : mine.length ? { label: 'Your next job', onclick: () => openTask(mine[0]) }
    : { label: 'Open the plan', href: `#/w/${w.id}/plan` };
  const dateLine = w.wedding_date ? (() => { const d = d8(w.wedding_date); return `${String(d.getDate()).padStart(2, '0')} · ${String(d.getMonth() + 1).padStart(2, '0')} · ${d.getFullYear()}`; })() : (w.date_note || 'Date to be fixed');
  root.append(h('section', { class: 'ed-hero' },
    coverImg(w),
    h('div', { class: 'ed-hero-shade', 'aria-hidden': 'true' }),
    me.isAdmin ? h('button', { type: 'button', class: 'ed-cover-btn', onclick: () => changeCover(w) }, h('span', { html: ICONS.image }), coverSrc(w) ? 'Change photo' : 'Add your photo') : null,
    h('div', { class: 'ed-hero-in' },
      h('div', { class: 'ed-mono', 'aria-hidden': 'true' }, h('span', { class: 'a' }, l1), h('i'), h('span', { class: 'b' }, l2)),
      h('h1', { class: 'ed-names' }, w.couple),
      me.isAdmin ? h('button', { type: 'button', class: 'ed-date', title: 'Change the date', onclick: () => editDate(w) }, h('i'), dateLine, h('i'))
        : h('span', { class: 'ed-date' }, h('i'), dateLine, h('i')),
      go.href ? h('a', { class: 'ed-go', href: go.href }, go.label, h('span', { html: ICONS.back, class: 'ed-go-ar' }))
        : h('button', { type: 'button', class: 'ed-go', onclick: go.onclick }, go.label, h('span', { html: ICONS.back, class: 'ed-go-ar' })))));

  // Announcements sit right under the cover.
  root.append(...announcementBars(w.id));
  const sent = sentAnnouncements(w.id); if (sent) root.append(sent);

  /* ---------- The countdown ---------- */
  const here = plan.stages.flatMap(st => st.areas.map(a => ({ a, st }))).find(x => x.a.id === plan.here);
  const moreBtn = h('button', { type: 'button', class: 'ed-more', 'aria-haspopup': 'menu', onclick: () => popMenu(moreBtn, [
    { icon: 'comment', label: 'Share this week on WhatsApp', onClick: () => shareWeek(w) },
    { icon: 'plan', label: 'Add dates to my calendar', onClick: () => calendarFor(w) },
    { icon: 'file', label: 'Memory book (print or save as PDF)', onClick: () => import('./memorybook.js?v=53').then(m => m.memoryBook(w)) },
    isDecider() ? { icon: 'note', label: 'Post an announcement', onClick: () => newAnnouncement(w) } : null,
    isDecider() ? { icon: 'user', label: 'Share with the partner family', onClick: () => partnerLinks(w) } : { icon: 'user', label: 'What the partner family sees', href: `#/p/preview-${w.id}` },
    me.isAdmin ? { icon: 'image', label: coverSrc(w) ? 'Change the cover photo' : 'Add a cover photo', onClick: () => changeCover(w) } : null,
    me.isAdmin && !fw ? { icon: 'lock', label: 'Preview final-week mode', href: `#/w/${w.id}?finalweek=1` } : null]) }, 'More ▾');
  const num = (n, label) => h('span', { class: 'ed-num' }, h('b', {}, String(n)), h('small', {}, label));
  root.append(h('section', { class: 'ed-count' },
    h('span', { class: 'ed-thread', 'aria-hidden': 'true' }),
    h('div', { class: 'ed-nums' },
      w.wedding_date && days !== null ? num(Math.max(0, days), days === 0 ? 'Today!' : days < 0 ? 'Married' : days === 1 ? 'Day to go' : 'Days to go') : num('—', 'Date not fixed'),
      h('span', { class: 'ed-dot', 'aria-hidden': 'true' }, '·'), num(finals.length, 'Decided'),
      h('span', { class: 'ed-dot', 'aria-hidden': 'true' }, '·'), num(openCats.length, 'To decide')),
    h('p', { class: 'ed-here' }, here ? ['You are in ', h('a', { href: `#/w/${w.id}/plan?focus=${here.a.id}` }, `${here.st.title} › ${here.a.title}`)] : plan.total ? 'Everything in the plan is done' : 'No steps in the plan yet', ' · ', moreBtn)));

  // Admin set-up (ready-made checklists, filling in dates), folded.
  { const items = [planOffer(w), isDecider() ? datesBanner(w) : null].filter(Boolean);
    if (items.length) root.append(h('details', { class: 'setup-card ed-narrow' }, h('summary', {}, h('span', { class: 'tip-i', html: ICONS.sparkle }), h('b', {}, 'Set-up'), h('span', { class: 'muted' }, ` · ${items.length} ${items.length === 1 ? 'thing' : 'things'} ready to add`)), items)); }

  /* ---------- For you today ---------- */
  const rows = [];
  const soonNobody = open.filter(x => !String(x.owner || '').trim() && x.due && daysUntil(x.due) <= 30).sort((a, b) => a.due.localeCompare(b.due));
  const othersSoon = open.filter(x => String(x.owner || '').trim() && !(me && samePerson(x.owner, me.name)) && x.due && daysUntil(x.due) <= 7).sort((a, b) => a.due.localeCompare(b.due));
  for (const t of mine.slice(0, 2)) rows.push(h('div', { class: 'ed-row' }, dateTile(t.due),
    h('button', { type: 'button', class: 'ed-row-tx', onclick: () => openTask(t) }, h('b', {}, t.title), h('span', { class: t.due && daysUntil(t.due) < 0 ? 'late' : '' }, t.due ? (daysUntil(t.due) < 0 ? 'Overdue since ' + shortDate(t.due) : 'Yours · due ' + shortDate(t.due)) : 'Yours · no date yet')),
    h('button', { type: 'button', class: 'ed-btn', onclick: () => { buzz(); setTask(t, { status: 'done' }).then(() => toast('Done ✓')).catch(fail); } }, 'Done')));
  if (soonNobody[0] && rows.length < 3) { const t = soonNobody[0]; rows.push(h('div', { class: 'ed-row' }, dateTile(t.due),
    h('button', { type: 'button', class: 'ed-row-tx', onclick: () => openTask(t) }, h('b', {}, t.title), h('span', { class: 'ed-warn' }, soonNobody.length > 1 ? `No one in charge · and ${soonNobody.length - 1} more` : 'No one in charge yet')),
    h('button', { type: 'button', class: 'ed-btn', onclick: () => setTask(t, { owner: me.name }).then(() => toast('It’s yours — thank you')).catch(fail) }, 'Take it'))); }
  if (othersSoon[0] && rows.length < 3) { const t = othersSoon[0]; rows.push(h('div', { class: 'ed-row' }, dateTile(t.due),
    h('button', { type: 'button', class: 'ed-row-tx', onclick: () => openTask(t) }, h('b', {}, t.title), h('span', {}, `${t.owner} is in charge`)),
    waButton({ label: 'Nudge', to: t.owner, cls: 'ed-btn ghost', text: () => jobsMessage(t.owner, [t], w.id) }))); }
  const pair = h('div', { class: 'ed-pair' });
  root.append(pair);
  pair.append(h('section', { class: 'ed-sec' }, edHead('For you', 'today'),
    rows.length ? h('div', { class: 'ed-card' }, rows)
      : h('p', { class: 'ed-empty' }, pending ? 'Nothing else needs you today.' : 'Nothing needs you today. Enjoy it.')));

  /* ---------- Still to decide: the band ---------- */
  let band = null;
  if (openCats.length) {
    const ordered = [...openCats].sort((a, b) => pendingFor(w.id, b.step.id).length - pendingFor(w.id, a.step.id).length || b.n - a.n);
    const card = ({ step, area, n }) => {
      const opts = optionsOf(w.id, step.id);
      const lead = [...opts].sort((a, b) => votesOf(b).score - votesOf(a).score)[0];
      const pic = lead && firstPic(lead) || opts.map(firstPic).find(Boolean);
      const fresh = pendingFor(w.id, step.id).length;
      return h('a', { class: 'ed-arch', href: `#/w/${w.id}/options?step=${step.id}` },
        h('span', { class: 'ed-arch-pic' + (pic ? '' : ' empty') }, pic ? archPhoto(pic, area.title + ' ' + step.title) : h('span', { class: 'ed-arch-ic', html: areaIcon(area.title + ' ' + step.title) }),
          fresh ? h('span', { class: 'ed-badge' }, `${fresh} new`) : null),
        h('b', {}, step.title),
        h('small', {}, !n ? 'Add the first option' : lead && votesOf(lead).love.length ? `Leading: ${(lead.data || {}).title}` : `${n} ${n === 1 ? 'option' : 'options'}`));
    };
    band = (h('section', { class: 'ed-band' },
      h('div', { class: 'ed-band-in' },
        edHead('Still to', 'decide'),
        h('p', { class: 'ed-band-sub' }, `${openCats.length} ${openCats.length === 1 ? 'choice' : 'choices'} · the family votes, the Deciders choose`),
        h('div', { class: 'ed-arches' }, ordered.slice(0, 8).map(card)),
        h('a', { class: 'ed-btn line', href: `#/w/${w.id}/choose` }, openCats.length > 8 ? `See all ${openCats.length}` : 'Open Choose'))));
  }

  /* ---------- This week ---------- */
  const week = open.filter(x => x.due && daysUntil(x.due) <= 7).sort((a, b) => a.due.localeCompare(b.due));
  const later = week.length ? [] : open.filter(x => x.due && daysUntil(x.due) <= 30).sort((a, b) => a.due.localeCompare(b.due));
  const showWeek = (week.length ? week : later).slice(0, 5);
  if (showWeek.length) pair.append(h('section', { class: 'ed-sec' },
    week.length ? edHead('This', 'week') : edHead('Coming', 'up'),
    h('div', { class: 'ed-thread-list' }, showWeek.map(t => { const d = d8(t.due), late = daysUntil(t.due) < 0;
      return h('button', { type: 'button', class: 'ed-tl' + (late ? ' late' : daysUntil(t.due) <= 1 ? ' now' : ''), onclick: () => openTask(t) },
        h('small', {}, `${late ? 'OVERDUE · ' : ''}${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`),
        h('b', {}, t.title),
        h('span', { class: t.owner ? '' : 'ed-warn' }, [t.owner ? t.owner : 'No one in charge yet', t.where].filter(Boolean).join(' · '))); })),
    h('a', { class: 'ed-link', href: `#/w/${w.id}/todo` }, 'All jobs →')));

  if (band) root.append(band);

  /* ---------- The family ---------- */
  const members = (store.rows('members') || []).filter(m => m.name);
  if (members.length) {
    const jobsOf = (m) => jobsFor(m.name).filter(t => t.wedding_id === w.id && !isDone(t));
    const person = (m) => {
      const js = jobsOf(m), late = js.some(t => t.due && daysUntil(t.due) < 0);
      return h('button', { type: 'button', class: 'ed-person' + (js.length ? ' busy' : '') + (late ? ' late' : ''), onclick: () => personSheet(w, m, js) },
        h('span', { class: 'ed-av' }, first(m.name).charAt(0).toUpperCase()),
        h('b', {}, me && m.user_id === me.id ? 'You' : first(m.name)),
        h('small', {}, js.length ? `${js.length} ${js.length === 1 ? 'job' : 'jobs'}` : '—'));
    };
    const sorted = [...members].sort((a, b) => jobsOf(b).length - jobsOf(a).length);
    root.append(h('section', { class: 'ed-sec ed-narrow' }, edHead('The', 'family'),
      h('div', { class: 'ed-people' }, sorted.slice(0, 7).map(person),
        h('button', { type: 'button', class: 'ed-person invite', onclick: () => share(`Join our wedding planning for ${w.couple}. Ask me for the family passcode.`, siteLink('')) }, h('span', { class: 'ed-av' }, '+'), h('b', {}, 'Invite'), h('small', {}, 'family')))));
  }

  // Partner family's suggestions, and "looks finished" nudges for the admin.
  const ps = partnerSugg(w); if (ps) root.append(h('div', { class: 'ed-narrow' }, ps));
  const lf = looksFinished(w);
  if (lf.length) root.append(h('section', { class: 'ed-sec ed-narrow' }, edHead('Looks', 'finished'),
    h('div', { class: 'ed-card' }, lf.slice(0, 3).map(({ s, why }) => h('div', { class: 'ed-row' }, h('span', { class: 'ed-tile' }, h('span', { class: 'ed-tile-ic', html: ICONS.check })),
      h('button', { type: 'button', class: 'ed-row-tx', onclick: () => openStep(s.id) }, h('b', {}, s.title), h('span', {}, 'Because ' + why)),
      h('button', { type: 'button', class: 'ed-btn', onclick: () => store.update('steps', s.id, { status: 'done' }).then(() => toast('Done ✓')).catch(fail) }, 'Tick it'))))));

  /* ---------- Already settled ---------- */
  if (finals.length) root.append(h('section', { class: 'ed-settled' },
    h('span', { class: 'ed-thread', 'aria-hidden': 'true' }),
    h('small', {}, 'Already settled'),
    h('p', {}, finals.map(s => ((s.lock_note && s.lock_note.with) ? `${s.title} — ${s.lock_note.with}` : s.title)).join(' · ')),
    h('a', { class: 'ed-link', href: `#/w/${w.id}/choose?view=glimpse` }, 'See them at a glance')));
}

// A photo that falls back to the section's drawing if it can't be loaded.
function archPhoto(path, title) {
  const img = photoEl(path, '');
  img.loading = 'eager';
  const off = () => { const box = img.parentNode; if (!box) return; box.classList.add('empty'); img.replaceWith(h('span', { class: 'ed-arch-ic', html: areaIcon(title) })); };
  img.addEventListener('error', off);
  if (!/^(https?:|assets\/)/.test(path)) store.url(path, 'small').then(u => { if (!u) setTimeout(off); });
  return img;
}

// A person: their open jobs here, and a nudge.
function personSheet(w, m, js) {
  const mine = store.me && m.user_id === store.me.id;
  modal({
    title: mine ? 'Your jobs' : m.name,
    body: [
      js.length ? h('div', { class: 'ed-card' }, js.slice(0, 8).map(t => h('div', { class: 'ed-row' }, dateTile(t.due),
        h('button', { type: 'button', class: 'ed-row-tx', onclick: () => { document.querySelector('.modal-wrap') && document.querySelector('.modal-wrap').remove(); openTask(t); } }, h('b', {}, t.title), h('span', {}, t.where || ''))))) : h('p', { class: 'muted' }, mine ? 'Nothing with your name on it here.' : `${first(m.name)} has nothing open in this wedding.`),
      !mine && js.length ? h('div', { style: { marginTop: '14px' } }, waButton({ label: `Nudge ${first(m.name)} on WhatsApp`, to: m.name, small: false, text: () => jobsMessage(m.name, js, w.id) })) : null],
    actions: [{ label: 'Close', onClick: () => { } }]
  });
}
