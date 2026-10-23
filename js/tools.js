// Small shared helpers: roles, backup, sharing, calendar files, people.
import { store } from './store.js?v=26';
import { h, toast } from './ui.js?v=26';

/* ---------- Roles ---------- */
const routeWedding = () => { const m = /^#\/w\/([^/?]+)/.exec(location.hash || ''); return m ? decodeURIComponent(m[1]) : null; };
// Deciders can be limited to some weddings (members.decider_for). An empty list means every wedding.
export const decidesFor = (m, wid) => !!(m && (m.is_admin || (m.is_decider && (!wid || wid === 'shared' || !(m.decider_for || []).length || (m.decider_for || []).includes(wid)))));
export const isDecider = (wid = routeWedding()) => !!(store.me && (store.me.isAdmin || (store.me.isDecider && (!wid || wid === 'shared' || !(store.me.deciderFor || []).length || store.me.deciderFor.includes(wid)))));
export function deciderNames(wid = routeWedding()) {
  const names = (store.rows('members') || []).filter(m => decidesFor(m, wid)).map(m => m.name);
  return names.length ? names.join(', ') : 'the admin';
}
// Use at the top of anything only Deciders may do. Returns true if allowed.
export function deciderOnly(what = 'do this', wid) {
  if (isDecider(wid)) return true;
  toast(`Only the Deciders (${deciderNames(wid)}) can ${what}`, 'error');
  return false;
}

/* ---------- People ---------- */
// Everyone in the family plus anyone already named as in charge, for suggestions.
export function peopleNames() {
  const set = new Map();
  for (const m of store.rows('members') || []) if (m.name) set.set(m.name.trim().toLowerCase(), m.name.trim());
  for (const t of ['steps', 'todos']) for (const r of store.rows(t) || []) if (r.owner && !r.deleted_at) { const k = r.owner.trim().toLowerCase(); if (k && !set.has(k)) set.set(k, r.owner.trim()); }
  return [...set.values()].sort((a, b) => a.localeCompare(b));
}
// A text box that suggests family names while still allowing anything (e.g. "Caterer").
export function personInput(value = '', attrs = {}) {
  let dl = document.getElementById('fwp-people');
  if (!dl) { dl = h('datalist', { id: 'fwp-people' }); document.body.append(dl); }
  dl.replaceChildren(...peopleNames().map(n => h('option', { value: n })));
  return h('input', { value, maxlength: 60, autocomplete: 'off', list: 'fwp-people', placeholder: 'Who is handling it', ...attrs });
}
export const samePerson = (a, b) => {
  const x = (a || '').trim().toLowerCase(), y = (b || '').trim().toLowerCase();
  if (!x || !y) return false;
  return x === y || x.split(/\s+/)[0] === y.split(/\s+/)[0] && (x.split(/\s+/).length === 1 || y.split(/\s+/).length === 1);
};

/* ---------- Downloads ---------- */
export function downloadText(name, text, type = 'text/plain') {
  const blob = new Blob([text], { type: type + ';charset=utf-8' });
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
export function downloadBackup() {
  const skip = new Set(['activity']);
  const data = {};
  for (const [t, rows] of Object.entries(store.cache || {})) if (!skip.has(t)) data[t] = rows;
  data.activity = (store.rows('activity') || []).slice(0, 500);
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  downloadText(`wedding-war-room-backup-${stamp}.json`, JSON.stringify({ made: new Date().toISOString(), by: store.me && store.me.name, data }, null, 1), 'application/json');
  toast('Backup downloaded — keep it somewhere safe');
}

/* ---------- Sharing ---------- */
export async function share(text, url) {
  const full = url ? `${text}\n${url}` : text;
  try { if (navigator.share) { await navigator.share({ text, url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  window.open('https://wa.me/?text=' + encodeURIComponent(full), '_blank', 'noopener');
}
export async function copyLink(url) { try { await navigator.clipboard.writeText(url); toast('Link copied'); } catch (e) { prompt('Copy this link:', url); } }
export const siteLink = (hash) => location.origin + location.pathname + location.search.replace(/[?&]demo\b/, '') + hash;

/* ---------- Calendar (.ics) ---------- */
export function icsFile(events, name = 'wedding') {
  const esc = (s) => String(s || '').replace(/[\\,;]/g, m => '\\' + m).replace(/\n/g, '\\n');
  const day = (d) => d.replace(/-/g, '');
  const next = (d) => { const x = new Date(d + 'T00:00'); x.setDate(x.getDate() + 1); return x.toISOString().slice(0, 10).replace(/-/g, ''); };
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Wedding War Room//EN', 'CALSCALE:GREGORIAN'];
  for (const e of events) {
    if (!e.date) continue;
    lines.push('BEGIN:VEVENT', `UID:${e.id || Math.random().toString(36).slice(2)}@wedding-war-room`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
      `DTSTART;VALUE=DATE:${day(e.date)}`, `DTEND;VALUE=DATE:${next(e.date)}`, `SUMMARY:${esc(e.title)}`, e.notes ? `DESCRIPTION:${esc(e.notes)}` : null, 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  downloadText(`${name}.ics`, lines.filter(Boolean).join('\r\n'), 'text/calendar');
}

/* ---------- Once-only flags (tips, welcome) ---------- */
export function once(key) { try { if (localStorage.getItem('fwp-once-' + key)) return false; } catch (e) { return false; } return true; }
export function markOnce(key) { try { localStorage.setItem('fwp-once-' + key, '1'); } catch (e) { /* storage blocked */ } }
