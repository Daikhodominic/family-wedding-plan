// @mentions in comments: "@Elow can you call them?" puts a job in Elow's list (and so on his Home and My jobs).
import { store } from './store.js?v=50';
import { h, toast } from './ui.js?v=50';

const first = (n) => String(n || '').trim().split(/\s+/)[0];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const others = () => (store.rows('members') || []).filter(m => m.name && (!store.me || m.user_id !== store.me.id));

// Who a comment mentions: "@Elow" or "@Elow Daikho" (first names are enough).
// When two people share a first name, only the full name picks one of them.
const shared = (m) => (store.rows('members') || []).filter(x => first(x.name).toLowerCase() === first(m.name).toLowerCase()).length > 1;
export const tagOf = (m) => shared(m) ? m.name.trim() : first(m.name);
export function mentionsIn(body) {
  const out = [];
  for (const m of others()) {
    const alts = shared(m) ? [m.name.trim()] : [m.name.trim(), first(m.name)];
    const re = new RegExp('(^|\\s)@(' + alts.map(esc).join('|') + ')(?![\\p{L}\\d])', 'iu');
    if (re.test(body)) out.push(m);
  }
  return out;
}

// After a comment is sent: a job for each person mentioned.
export async function afterComment(item, body) {
  const ms = mentionsIn(body); if (!ms.length || !item) return;
  const d = item.data || {};
  const what = (d.title || d.text || d.name || 'a card').slice(0, 60);
  for (const m of ms) {
    await store.insert('todos', {
      wedding_id: item.wedding_id, owner: m.name, status: 'todo', due: null, position: -Date.now(),
      title: `Reply to ${first(store.me.name)} about “${what}”`,
      notes: `“${body.slice(0, 300)}” — open the comments on “${what}” to reply.`
    }).catch(() => null); // view-only people can still comment; the job just isn't made
  }
  toast(ms.length === 1 ? `Sent to ${first(ms[0].name)}’s jobs` : `Sent to ${ms.map(m => first(m.name)).join(', ')}’s jobs`);
}

// The comment text with @names highlighted.
export function richBody(body) {
  const names = (store.rows('members') || []).flatMap(m => [m.name.trim(), first(m.name)]).filter(Boolean).sort((a, b) => b.length - a.length);
  if (!names.length || !body.includes('@')) return body;
  const re = new RegExp('@(' + names.map(esc).join('|') + ')(?![\\p{L}\\d])', 'giu');
  const out = []; let i = 0;
  for (const m of body.matchAll(re)) { out.push(body.slice(i, m.index), h('span', { class: 'mention' }, m[0])); i = m.index + m[0].length; }
  out.push(body.slice(i));
  return out;
}

// A row of names under a comment box: tap one to add "@Name ".
export function mentionChips(box, onChange) {
  const ms = others(); if (!ms.length) return null;
  return h('div', { class: 'mention-row' }, h('span', { class: 'muted' }, 'Ask someone:'),
    ms.slice(0, 12).map(m => h('button', { type: 'button', class: 'lchip', onclick: () => {
      const tag = '@' + tagOf(m) + ' ';
      const v = box.value; box.value = (v && !/\s$/.test(v) ? v + ' ' : v) + tag; onChange && onChange(box.value);
      box.focus(); box.setSelectionRange(box.value.length, box.value.length);
    } }, tagOf(m))));
}
