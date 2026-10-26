// The plan helping itself: suggested due dates, "looks finished", the weekly summary,
// calendar files, announcements, final-week mode and copying between weddings.
import { store } from './store.js?v=53';
import { h, toast, modal, field, confirmBox, shortDate, daysUntil, fancyDate , ICONS } from './ui.js?v=53';
import { live, stepVisible, wedding, weddings, render } from './app.js?v=53';
import { together } from './history.js?v=53';
import { isDecider, deciderOnly, share, siteLink, icsFile } from './tools.js?v=53';
import { openStep } from './panel.js?v=53';

const fail = (e) => { console.error(e); toast(e.message || 'That did not save. Check your connection.', 'error'); };
const byPos = (a, b) => (a.position || 0) - (b.position || 0);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; // local date, not UTC

/* ---------- Suggested due dates, counted back from the wedding ---------- */
// Weeks before the wedding (negative = after).
const RULES = [
  [/date|church/i, 22], [/venue|hall/i, 18], [/shortlist.*cater|caterer/i, 14], [/tasting/i, 9], [/menu/i, 6], [/head ?count/i, 2],
  [/collect names|names from/i, 11], [/guest list/i, 9], [/print.*invit|invitation card/i, 8], [/send.*invit/i, 6], [/invit/i, 8],
  [/decide gifts|gifts for/i, 7], [/buy.*gift/i, 4], [/pack|label/i, 1], [/dress|gown|stitch|tailor|outfit/i, 10], [/photo|video/i, 8],
  [/decor|flower|florist/i, 6], [/transport|vehicle|driver|car/i, 3], [/day-of|schedule|run sheet/i, 2], [/advance/i, 16], [/rehears/i, 0.15],
  [/settle|vendor payment|return/i, -1], [/thank/i, -2], [/collect photos/i, -3], [/spent|accounts/i, -4]
];
export function suggestDue(step, w) {
  if (!w || !w.wedding_date) return null;
  const area = store.find('areas', step.area_id); const stage = area && store.find('stages', area.stage_id);
  const st = (stage && stage.title || '').toLowerCase();
  let weeks = null;
  for (const [re, wk] of RULES) if (re.test(step.title)) { weeks = wk; break; }
  if (weeks === null) weeks = /during|day/.test(st) ? 0 : /after/.test(st) ? -1 : 4;
  if (/during|day/.test(st) && weeks > 0 && !/rehears|schedule|day-of/i.test(step.title)) weeks = 0;
  const d = new Date(w.wedding_date + 'T00:00'); d.setDate(d.getDate() - Math.round(weeks * 7));
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (weeks > 0 && d < today) { const c = new Date(today); c.setDate(c.getDate() + 7); return iso(c); } // already late: give a week to catch up
  return iso(d);
}
export function stepsNeedingDates(w) {
  return live(store.rows('steps')).filter(s => s.wedding_id === w.id && stepVisible(s) && !s.due && !s.locked_at && s.status !== 'done');
}
export async function fillSuggestedDates(w) {
  const list = stepsNeedingDates(w);
  if (!list.length) return;
  // Steps sharing a date are saved together — a handful of requests instead of one per step —
  // and the page redraws once, at the end.
  const byDate = new Map();
  for (const st of list) { const d = suggestDue(st, w); if (!d) continue; if (!byDate.has(d)) byDate.set(d, []); byDate.get(d).push(st.id); }
  const n = [...byDate.values()].reduce((k, ids) => k + ids.length, 0);
  await store.batch(() => together(async () => { for (const [due, ids] of byDate) await store.patchMany('steps', ids, { due }); }))
    .then(() => toast(`Suggested dates added to ${n} steps — change any of them in the step`)).catch(fail);
}
export function datesBanner(w) {
  if (!w.wedding_date) return null;
  const n = stepsNeedingDates(w).length;
  if (n < 3) return null;
  return h('div', { class: 'tip auto' }, h('span', { class: 'tip-i', html: ICONS.sparkle }),
    h('span', {}, `${n} steps have no due date. Fill them in by counting back from the wedding (${shortDate(w.wedding_date)})? You can change any of them.`),
    h('button', { type: 'button', class: 'tip-x', onclick: () => fillSuggestedDates(w) }, 'Fill in dates'));
}

/* ---------- Looks finished ---------- */
const tickCol = (c) => /^(confirmed|bought|packed|sent|card sent|ready|done|paid|given|booked|arranged|rsvp|delivered|collected)$/i.test(c.trim());
const ticked = (v) => /^(y|yes|✓|true|1|done|x)$/i.test(String(v || '').trim());
export function looksFinished(w) {
  const out = [];
  for (const s of live(store.rows('steps')).filter(x => x.wedding_id === w.id && stepVisible(x) && x.status !== 'done' && !x.locked_at)) {
    const lists = live(store.rows('lists') || []).filter(l => l.step_id === s.id);
    let why = null;
    for (const l of lists) {
      const cols = (l.columns || []).map((c, i) => [c, i]).filter(([c]) => tickCol(c));
      const rows = live(store.rows('list_rows') || []).filter(r => r.list_id === l.id);
      if (cols.length && rows.length && rows.every(r => cols.every(([, i]) => ticked((r.cells || [])[i])))) { why = `everything on “${l.title}” is ticked`; break; }
    }
    if (!why) {
      const pays = live(store.rows('budget_items') || []).filter(p => p.step_id === s.id);
      if (pays.length && pays.every(p => p.paid_at)) why = 'all its payments are marked paid';
    }
    if (!why) {
      const todos = live(store.rows('todos') || []).filter(t => t.wedding_id === w.id && (t.notes || '').includes('For: ' + s.title));
      if (todos.length && todos.every(t => t.status === 'done')) why = 'its follow-up jobs are done';
    }
    if (why) out.push({ s, why });
  }
  return out;
}

/* ---------- Weekly summary for WhatsApp ---------- */
export function weekSummary(w) {
  const week = 7 * 86400000, now = Date.now();
  const doneActs = (store.rows('activity') || []).filter(a => a.wedding_id === w.id && now - new Date(a.created_at).getTime() < week && a.changes && ((a.changes.status && a.changes.status.new === 'done') || (a.changes.locked_at && a.changes.locked_at.new)));
  const open = [...live(store.rows('steps')).filter(s => s.wedding_id === w.id && stepVisible(s) && s.status !== 'done' && !s.locked_at), ...live(store.rows('todos') || []).filter(t => t.wedding_id === w.id && t.status !== 'done')];
  const due = open.filter(t => t.due && daysUntil(t.due) >= 0 && daysUntil(t.due) <= 7).sort((a, b) => a.due.localeCompare(b.due));
  const late = open.filter(t => t.due && daysUntil(t.due) < 0);
  const days = daysUntil(w.wedding_date);
  const lines = [`💍 ${w.couple}${w.wedding_date && days >= 0 ? ` — ${days} days to go` : ''}`, ''];
  lines.push(`✅ Done this week: ${doneActs.length}`);
  for (const a of doneActs.slice(0, 6)) lines.push(`   • ${a.label || 'a step'}`);
  lines.push(`📅 Due this week: ${due.length}`);
  for (const t of due.slice(0, 8)) lines.push(`   • ${t.title}${t.owner ? ' — ' + t.owner : ''} (${shortDate(t.due)})`);
  if (late.length) { lines.push(`⚠️ Overdue: ${late.length}`); for (const t of late.slice(0, 5)) lines.push(`   • ${t.title}${t.owner ? ' — ' + t.owner : ''}`); }
  lines.push('', 'Open the War Room:');
  return lines.join('\n');
}
export const shareWeek = (w) => share(weekSummary(w), siteLink(`#/w/${w.id}`));

/* ---------- Calendar ---------- */
export function calendarFor(w) {
  const ev = [];
  if (w.wedding_date) ev.push({ id: 'wedding-' + w.id, date: w.wedding_date, title: `💍 ${w.couple} — wedding day` });
  for (const s of live(store.rows('steps')).filter(x => x.wedding_id === w.id && stepVisible(x) && x.due && x.status !== 'done' && !x.locked_at)) ev.push({ id: s.id, date: s.due, title: s.title + (s.owner ? ' — ' + s.owner : ''), notes: w.couple });
  for (const t of live(store.rows('todos') || []).filter(x => x.wedding_id === w.id && x.due && x.status !== 'done')) ev.push({ id: t.id, date: t.due, title: t.title + (t.owner ? ' — ' + t.owner : ''), notes: w.couple });
  icsFile(ev, (w.couple || 'wedding').replace(/[^\w]+/g, '-').toLowerCase() + '-dates');
  toast('Calendar file downloaded — open it to add the dates to your phone or computer calendar');
}

/* ---------- Announcements ---------- */
const annMissing = () => store.missing && store.missing.announcements;
export function unseenAnnouncements(wid) {
  if (annMissing() || !store.me) return [];
  const seen = new Set((store.rows('announcement_seen') || []).filter(s => s.created_by === store.me.id).map(s => s.announcement_id));
  return live(store.rows('announcements') || []).filter(a => (!wid || !a.wedding_id || a.wedding_id === wid) && !seen.has(a.id) && a.created_by !== store.me.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}
export function announcementBars(wid) {
  return unseenAnnouncements(wid).slice(0, 3).map(a => h('div', { class: 'announce', role: 'status' },
    h('span', { class: 'an-k' }, 'Announcement'),
    h('b', {}, a.body),
    h('span', { class: 'an-meta' }, `${a.author_name || 'Someone'} · ${a.wedding_id ? (wedding(a.wedding_id) || {}).couple || '' : 'both weddings'}`),
    h('button', { type: 'button', class: 'an-ok', onclick: () => store.insert('announcement_seen', { announcement_id: a.id }).catch(fail) }, 'Got it')));
}
// Read receipts: for whoever sent an announcement (and the admin), who has seen it.
export function seenBy(a) {
  const seen = new Set((store.rows('announcement_seen') || []).filter(x => x.announcement_id === a.id).map(x => x.created_by));
  const everyone = (store.rows('members') || []).filter(m => m.user_id !== a.created_by);
  return { yes: everyone.filter(m => seen.has(m.user_id)), no: everyone.filter(m => !seen.has(m.user_id)) };
}
export function sentAnnouncements(wid) {
  if (annMissing() || !store.me) return null;
  const mine = live(store.rows('announcements') || []).filter(a => (a.created_by === store.me.id || store.me.isAdmin) && (!wid || !a.wedding_id || a.wedding_id === wid))
    .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 3);
  if (!mine.length) return null;
  const show = (a) => { const s = seenBy(a); modal({ title: 'Who has seen it', body: [h('p', { style: { marginTop: 0 } }, a.body),
    h('p', {}, h('b', {}, `Seen · ${s.yes.length}`), h('br'), s.yes.map(m => m.name).join(', ') || '—'),
    h('p', {}, h('b', {}, `Not yet · ${s.no.length}`), h('br'), s.no.map(m => m.name).join(', ') || 'Everyone has seen it')], actions: [{ label: 'Close', onClick: () => { } }] }); };
  return h('div', { class: 'ann-sent' }, mine.map(a => { const s = seenBy(a); const n = s.yes.length + s.no.length;
    return h('button', { type: 'button', class: 'ann-row', onclick: () => show(a) },
      h('span', { class: 'an-k' }, 'Announcement'), h('span', { class: 'ann-b' }, a.body.length > 80 ? a.body.slice(0, 78) + '…' : a.body),
      h('span', { class: 'ann-seen' + (s.no.length ? '' : ' all') }, s.no.length ? `Seen by ${s.yes.length} of ${n}` : '✓ Seen by everyone')); }));
}
export function newAnnouncement(w) {
  if (annMissing()) { toast('Announcements need database update 8. Ask the admin to run it.', 'error'); return; }
  if (!deciderOnly('send announcements')) return;
  const body = h('textarea', { rows: 3, maxlength: 400, placeholder: 'e.g. The reception now starts at 5 pm, not 6 pm.' });
  const scope = h('select', {}, h('option', { value: w.id }, 'Only ' + w.couple), h('option', { value: '' }, 'Both weddings'));
  modal({
    title: 'Send an announcement',
    body: [field('Message', body, 'Everyone sees it at the top until they tap “Got it”.'), field('For', scope)],
    actions: [{ label: 'Send', onClick: async () => { const t = body.value.trim(); if (!t) return false; await store.insert('announcements', { wedding_id: scope.value || null, body: t, title: t.slice(0, 120), author_name: store.me.name }).then(() => toast('Sent to everyone')).catch(fail); } }]
  });
}

/* ---------- Final-week mode ---------- */
function runSheet(wid) {
  const l = live(store.rows('lists') || []).find(x => x.wedding_id === wid && /run ?sheet|day-of|programme|program|schedule/i.test(x.title));
  if (!l) return null;
  const cols = l.columns || [];
  const ti = cols.findIndex(c => /time/i.test(c)), wi = cols.findIndex(c => /what|item|event/i.test(c)), pi = cols.findIndex(c => /who/i.test(c)), di = cols.findIndex(c => tickCol(c));
  const rows = live(store.rows('list_rows') || []).filter(r => r.list_id === l.id).sort(byPos)
    .sort((a, b) => String((a.cells || [])[ti] || '').localeCompare(String((b.cells || [])[ti] || ''), undefined, { numeric: true }));
  return { l, rows: rows.map(r => ({ time: ti >= 0 ? r.cells[ti] : '', what: wi >= 0 ? r.cells[wi] : (r.cells || [])[0], who: pi >= 0 ? r.cells[pi] : '', done: di >= 0 && ticked(r.cells[di]) })) };
}
function quickCalls(wid) {
  const out = new Map();
  for (const s of live(store.rows('steps')).filter(x => x.wedding_id === wid && x.locked_at && x.lock_note && x.lock_note.phone)) out.set(s.lock_note.phone, (s.lock_note.vendor || s.lock_note.with || s.title).split(' — ').pop());
  for (const l of live(store.rows('lists') || []).filter(x => x.wedding_id === wid && /vendor|vehicle|driver|contact/i.test(x.title))) {
    const cols = l.columns || []; const pi = cols.findIndex(c => /phone|mobile|number/i.test(c)); if (pi < 0) continue;
    const ni = cols.findIndex(c => /vendor|name|driver/i.test(c)); const fi = cols.findIndex(c => /^for$|vehicle/i.test(c));
    for (const r of live(store.rows('list_rows') || []).filter(x => x.list_id === l.id)) { const p = (r.cells || [])[pi]; if (p) out.set(p, [(r.cells || [])[ni >= 0 ? ni : 0], fi >= 0 ? (r.cells || [])[fi] : ''].filter(Boolean).join(' · ')); }
  }
  return [...out.entries()].slice(0, 12);
}
export function finalWeek(w, force) {
  const days = daysUntil(w.wedding_date);
  if (!force && (days === null || days < 0 || days > 7)) return null;
  const open = [...live(store.rows('steps')).filter(s => s.wedding_id === w.id && stepVisible(s) && s.status !== 'done' && !s.locked_at).map(s => ({ ...s, kind: 'step' })),
    ...live(store.rows('todos') || []).filter(t => t.wedding_id === w.id && t.status !== 'done').map(t => ({ ...t, kind: 'todo' }))];
  const urgent = open.filter(t => t.due && daysUntil(t.due) <= 2).sort((a, b) => a.due.localeCompare(b.due));
  const rs = runSheet(w.id);
  const calls = quickCalls(w.id);
  const d = Math.max(0, days ?? 0);
  return h('section', { class: 'final-week' },
    h('div', { class: 'fw-top' },
      h('div', {}, h('div', { class: 'eyebrow' }, days === 0 ? 'It’s the day!' : 'Final week'), h('div', { class: 'fw-count' }, h('b', {}, String(d)), h('span', {}, d === 1 ? 'day to go' : d === 0 ? 'Today' : 'days to go')), h('div', { class: 'fw-date' }, w.wedding_date ? fancyDate(w.wedding_date) : '')),
      isDecider() ? h('button', { type: 'button', class: 'btn', onclick: () => newAnnouncement(w) }, 'Send an announcement') : null),
    h('div', { class: 'fw-grid' },
      h('div', { class: 'fw-box' }, h('h3', {}, `Needs attention now · ${urgent.length}`),
        urgent.length ? urgent.slice(0, 8).map(t => h('button', { type: 'button', class: 'orow' + (daysUntil(t.due) < 0 ? ' late' : ''), onclick: () => t.kind === 'step' ? openStep(t.id) : (location.hash = `#/w/${w.id}/todo?focus=${t.id}`) },
          h('span', { class: 'o-dot ' + t.status }), h('span', { class: 'o-main' }, h('b', {}, t.title), h('span', {}, [t.owner, daysUntil(t.due) < 0 ? 'overdue' : daysUntil(t.due) === 0 ? 'today' : shortDate(t.due)].filter(Boolean).join(' · ')))))
          : h('p', { class: 'muted o-empty' }, 'Nothing urgent. 🎉')),
      h('div', { class: 'fw-box' }, h('h3', {}, 'Run sheet'),
        rs && rs.rows.length ? h('div', { class: 'fw-run' }, rs.rows.slice(0, 14).map(r => h('div', { class: 'fw-r' + (r.done ? ' done' : '') }, h('span', { class: 'fw-t' }, r.time || ''), h('span', {}, r.what || '', r.who ? h('span', { class: 'muted' }, ' · ' + r.who) : null))),
          h('a', { class: 'ob-link', href: `#/w/${w.id}/lists?list=${rs.l.id}` }, 'Open the run sheet →'))
          : h('p', { class: 'muted o-empty' }, 'No run sheet yet. ', h('a', { href: `#/w/${w.id}/lists` }, 'Start a “Day-of run sheet”'), ' in Lists — time, what, who and where.')),
      h('div', { class: 'fw-box' }, h('h3', {}, 'Call quickly'),
        calls.length ? h('div', { class: 'fw-calls' }, calls.map(([p, n]) => h('a', { class: 'fw-call', href: 'tel:' + p.replace(/[^\d+]/g, '') }, h('b', {}, n || p), h('span', {}, p))))
          : h('p', { class: 'muted o-empty' }, 'Phone numbers from final decisions, the Vendors list and Vehicles & drivers show here.'))));
}

/* ---------- Copy between weddings ---------- */
export async function copyList(l, toWid) {
  const nl = await store.insert('lists', { wedding_id: toWid, step_id: null, title: l.title, columns: l.columns }).catch(fail); if (!nl) return;
  const rows = live(store.rows('list_rows') || []).filter(r => r.list_id === l.id).sort(byPos);
  await store.batch(async () => { for (const r of rows) await store.insert('list_rows', { list_id: nl.id, wedding_id: toWid, cells: [...(r.cells || [])], position: r.position }).catch(fail); });
  toast(`Copied to ${(wedding(toWid) || {}).couple || 'the other wedding'}`);
}
export async function copyArea(a, toWid) {
  const target = live(store.rows('stages')).filter(s => s.wedding_id === toWid).sort(byPos);
  const fromStage = store.find('stages', a.stage_id);
  const st = target.find(s => fromStage && s.title.toLowerCase() === fromStage.title.toLowerCase()) || target[0];
  if (!st) { toast('The other wedding has no plan stages yet', 'error'); return; }
  const last = live(store.rows('areas')).filter(x => x.stage_id === st.id).reduce((m, x) => Math.max(m, x.position || 0), 0);
  await together(async () => {
    const na = await store.insert('areas', { wedding_id: toWid, stage_id: st.id, title: a.title, position: last + 1000 });
    for (const s of live(store.rows('steps')).filter(x => x.area_id === a.id).sort(byPos)) await store.insert('steps', { wedding_id: toWid, area_id: na.id, title: s.title, notes: '', owner: '', due: null, status: 'todo', position: s.position, gate: !!s.gate });
  }).then(() => toast(`“${a.title}” copied to ${(wedding(toWid) || {}).couple} — without people or dates`)).catch(fail);
}
export const otherWeddings = (wid) => weddings().filter(x => x.id !== wid);

