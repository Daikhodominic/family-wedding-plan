// Reactions, comments & suggestions, and option votes on mood board cards.
import { store } from './store.js?v=17';
import { h, toast, ago, ICONS } from './ui.js?v=17';
import { live } from './app.js?v=17';

export const EMOJI = ['❤️', '👍', '😍', '😂', '😮', '🙏'];
const fail = (e) => { console.error(e); toast(e.message || 'That did not save. Check your connection.', 'error'); };
const missing = () => store.missing && (store.missing.comments || store.missing.reactions);

/* ---------- "New since you last looked", per person, per card ---------- */
const SEEN_KEY = 'fwp-seen-comments';
function seenMap() { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); } catch (e) { return {}; } }
function markSeen(itemId) { try { const m = seenMap(); m[itemId] = new Date().toISOString(); localStorage.setItem(SEEN_KEY, JSON.stringify(m)); } catch (e) { /* storage blocked */ } }
export const commentsOf = (itemId) => live(store.rows('comments') || []).filter(c => c.item_id === itemId).sort((a, b) => a.created_at.localeCompare(b.created_at));
const isNew = (c, seen) => c.created_by !== (store.me && store.me.id) && (!seen || c.created_at > seen);
export function newCount(itemId) { const seen = seenMap()[itemId]; return commentsOf(itemId).filter(c => isNew(c, seen)).length; }

/* ---------- Reactions ---------- */
const reactionsOf = (itemId, target = 'card') => (store.rows('reactions') || []).filter(r => r.item_id === itemId && r.target === target);
async function toggle(item, target, value, exclusive = []) {
  if (missing()) { toast('Reactions need database update 6. Ask the admin to run it.', 'error'); return; }
  const mine = reactionsOf(item.id, target).filter(r => r.created_by === store.me.id);
  const same = mine.find(r => r.value === value);
  try {
    for (const r of mine.filter(r => exclusive.includes(r.value) && r.value !== value)) await store.del('reactions', r.id);
    if (same) await store.del('reactions', same.id);
    else await store.insert('reactions', { wedding_id: item.wedding_id, item_id: item.id, target, value, user_name: store.me.name });
  } catch (e) { fail(e); }
}

// The strip along the bottom of every card: reactions, and the comments button.
export function cardFooter(item) {
  const rs = reactionsOf(item.id);
  const counts = EMOJI.map(e => ({ e, list: rs.filter(r => r.value === e) })).filter(x => x.list.length);
  const n = commentsOf(item.id).length, fresh = newCount(item.id);
  const picker = h('div', { class: 'rx-pick', hidden: true }, EMOJI.map(e => h('button', { type: 'button', 'aria-label': 'React ' + e, onclick: () => { picker.hidden = true; toggle(item, 'card', e); } }, e)));
  return h('div', { class: 'cfoot' },
    counts.map(({ e, list }) => h('button', {
      type: 'button', class: 'rx' + (list.some(r => r.created_by === store.me.id) ? ' mine' : ''), title: list.map(r => r.user_name || 'Someone').join(', '),
      onclick: () => toggle(item, 'card', e)
    }, e, h('span', {}, String(list.length)))),
    h('span', { class: 'rx-wrap' },
      h('button', { type: 'button', class: 'rx add', 'aria-label': 'Add a reaction', title: 'React', onclick: () => { picker.hidden = !picker.hidden; } }, '☺', h('span', {}, '+')),
      picker),
    h('button', { type: 'button', class: 'cbtn' + (fresh ? ' fresh' : ''), onclick: () => openThread(item.id), title: fresh ? `${fresh} new` : 'Comments and suggestions' },
      h('span', { html: ICONS.comment }), n ? String(n) : 'Comment', fresh ? h('i', { class: 'newdot', 'aria-label': `${fresh} new` }) : null));
}

/* ---------- Votes on comparison options ---------- */
export const optionKey = (o, i) => o.oid || 'i' + i;
export function voteCounts(item, key) {
  const rs = reactionsOf(item.id, key);
  return { up: rs.filter(r => r.value === 'up'), down: rs.filter(r => r.value === 'down') };
}
export function voteBar(item, key) {
  const { up, down } = voteCounts(item, key);
  const me = store.me.id;
  const names = (l) => l.map(r => r.user_name || 'Someone').join(', ') || 'No votes yet';
  return h('div', { class: 'votes' },
    h('button', { type: 'button', class: 'vote up' + (up.some(r => r.created_by === me) ? ' mine' : ''), title: 'Up: ' + names(up), 'aria-label': `Vote up (${up.length})`, onclick: () => toggle(item, key, 'up', ['down']) }, '▲', h('span', {}, String(up.length))),
    h('button', { type: 'button', class: 'vote down' + (down.some(r => r.created_by === me) ? ' mine' : ''), title: 'Down: ' + names(down), 'aria-label': `Vote down (${down.length})`, onclick: () => toggle(item, key, 'down', ['up']) }, '▼', h('span', {}, String(down.length))));
}

/* ---------- Comments & suggestions drawer ---------- */
let current = null;
export function openThread(itemId) {
  if (current) current.close();
  const root = h('aside', { class: 'drawer thread', role: 'dialog', 'aria-label': 'Comments and suggestions' });
  const shade = h('div', { class: 'drawer-shade', onclick: () => close() });
  document.body.append(shade, root);
  requestAnimationFrame(() => { root.classList.add('open'); shade.classList.add('open'); });
  const seenAtOpen = seenMap()[itemId];
  let kind = 'comment';
  let draft = '';

  const draw = () => {
    const item = store.find('board_items', itemId);
    if (!item || item.deleted_at) { close(); return; }
    const d = item.data || {};
    const list = commentsOf(itemId);
    const fresh = list.filter(c => isNew(c, seenAtOpen));
    const latest = list[list.length - 1];
    const box = h('textarea', { rows: 3, placeholder: kind === 'suggestion' ? 'Suggest something — another option, a vendor, a change…' : 'Write a comment…', maxlength: 2000 });
    box.value = draft;
    box.addEventListener('input', () => { draft = box.value; });
    const send = async () => {
      const body = box.value.trim(); if (!body) return;
      if (missing()) { toast('Comments need database update 6. Ask the admin to run it.', 'error'); return; }
      draft = ''; box.value = '';
      await store.insert('comments', { wedding_id: item.wedding_id, item_id: item.id, kind, body, title: body.slice(0, 120), author_name: store.me.name }).catch(fail);
      markSeen(itemId);
    };
    box.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } });
    root.replaceChildren(
      h('div', { class: 'd-top' }, h('span', {}, 'Mood board · ', (d.title || d.text || d.name || 'Card').slice(0, 60)),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', html: ICONS.close, onclick: close })),
      h('div', { class: 'd-body' },
        h('h2', { class: 'th-h' }, 'Comments & suggestions'),
        h('p', { class: 'hint', style: { margin: 0 } }, fresh.length ? `${fresh.length} new since you last looked — highlighted in gold.` : list.length ? 'Nothing new since you last looked.' : 'Be the first to say something about this.'),
        h('div', { class: 'th-list' }, list.map(c => {
          const mine = c.created_by === store.me.id;
          const isFresh = fresh.includes(c);
          return h('div', { class: 'cm ' + c.kind + (isFresh ? ' fresh' : '') + (c === latest && !fresh.length ? ' latest' : '') },
            h('div', { class: 'cm-h' },
              h('b', {}, c.author_name || store.memberName(c.created_by) || 'Someone'),
              c.kind === 'suggestion' ? h('span', { class: 'cm-tag' }, 'Suggestion') : null,
              isFresh ? h('span', { class: 'cm-new' }, 'New') : c === latest ? h('span', { class: 'cm-latest' }, 'Latest') : null,
              h('span', { class: 'cm-t' }, ago(c.created_at))),
            h('div', { class: 'cm-b' }, c.body),
            mine || store.me.isAdmin ? h('button', { type: 'button', class: 'link-btn cm-del', onclick: () => store.remove('comments', c.id).then(() => toast('Moved to the Bin')).catch(fail) }, 'Remove') : null);
        })),
        h('div', { class: 'composer' },
          h('div', { class: 'd-seg', role: 'group', 'aria-label': 'Type' },
            [['comment', 'Comment'], ['suggestion', 'Suggestion']].map(([k, l]) => h('button', { type: 'button', class: kind === k ? 'on' : '', onclick: () => { kind = k; draw(); } }, l))),
          box,
          h('div', { class: 'composer-f' }, h('span', { class: 'hint', style: { margin: 0 } }, 'Everyone in the family sees this. Ctrl + Enter to send.'),
            h('button', { class: 'btn', type: 'button', onclick: send }, kind === 'suggestion' ? 'Send suggestion' : 'Send')))));
    const scroller = root.querySelector('.d-body');
    const firstNew = root.querySelector('.cm.fresh');
    requestAnimationFrame(() => { if (firstNew) firstNew.scrollIntoView({ block: 'center' }); else scroller.scrollTop = scroller.scrollHeight; });
  };

  const off = store.onChange(({ table } = {}) => {
    if (table && !['comments', 'board_items', 'members'].includes(table)) return;
    const a = document.activeElement;
    if (a && root.contains(a) && a.tagName === 'TEXTAREA') return; // keep the draft; it redraws after sending
    draw();
  });
  const onKey = (e) => { if (e.key === 'Escape' && !document.querySelector('.modal-wrap')) close(); };
  document.addEventListener('keydown', onKey);
  function close() {
    off(); document.removeEventListener('keydown', onKey);
    markSeen(itemId);
    root.classList.remove('open'); shade.classList.remove('open');
    setTimeout(() => { root.remove(); shade.remove(); }, 220);
    if (current && current.root === root) current = null;
    store.emit({ table: 'comments' }); // refresh the "new" dots on the board
  }
  current = { close, root };
  draw();
  markSeen(itemId);
}
