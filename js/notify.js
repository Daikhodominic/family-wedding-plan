// Phone notifications from the site itself: when someone else adds an option, gives you a job,
// comments on your step or makes a decision. They arrive while the site is open or in the
// background on the phone (Android keeps it alive for a while once it's on the home screen).
// Notifications when the site is fully closed need a push server — see database update 11 notes.
import { store } from './store.js?v=31';
import { h, toast, modal, buzz } from './ui.js?v=31';
import { wedding } from './app.js?v=31';
import { samePerson } from './tools.js?v=31';

const KEY = 'fwp-notify';
const KINDS = [
  ['options', 'New options to swipe', 'Photos, rates and links someone added'],
  ['mine', 'Jobs given to me', 'When you become the person in charge of something'],
  ['comments', 'Comments for me', 'On things you added or steps you’re in charge of'],
  ['decided', 'Decisions made final', 'When a Decider locks a choice'],
  ['news', 'Family announcements', 'Messages pinned for everyone'],
];
const defaults = () => ({ on: false, options: true, mine: true, comments: true, decided: true, news: true });
export function prefs() { try { return { ...defaults(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (e) { return defaults(); } }
function savePrefs(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* storage blocked */ } }

export const notifySupported = () => typeof window !== 'undefined' && 'Notification' in window;
export const notifyOn = () => notifySupported() && Notification.permission === 'granted' && prefs().on;

async function show(title, body, url, tag) {
  const opts = { body, tag, renotify: true, icon: 'assets/icon-192.png', badge: 'assets/icon-192.png', data: { url } };
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (reg && reg.showNotification) { await reg.showNotification(title, opts); return true; }
  } catch (e) { /* fall through */ }
  try { const n = new Notification(title, opts); n.onclick = () => { window.focus(); if (url) location.hash = url; n.close(); }; return true; } catch (e) { return false; }
}

const couple = (wid) => { const w = wedding(wid); return w ? (w.couple || '').split('&')[0].trim() : ''; };
const stepTitle = (id) => { const s = id && store.find('steps', id); return s ? s.title : ''; };
const by = (row) => store.memberName(row.created_by || row.updated_by || row.locked_by) || 'Someone';
const isMe = (id) => store.me && id === store.me.id;
const mineStep = (s) => s && store.me && s.owner && samePerson(s.owner, store.me.name);

// Turn a change by someone else into a notification (or nothing).
export function describe(ev) {
  const p = prefs(); const r = ev.row || {}; const prev = ev.prev;
  if (ev.table === 'board_items' && ev.type === 'INSERT' && r.kind === 'option' && !isMe(r.created_by) && p.options) {
    const d = r.data || {}; const cat = stepTitle(d.step_id);
    return { kind: 'options', title: `New option${cat ? ' · ' + cat : ''}`, body: `${by(r)} added ${d.title || 'something'}${d.rate ? ' — ' + d.rate : ''}. Swipe to vote.`, url: `#/w/${r.wedding_id}/swipe${d.step_id ? '?step=' + d.step_id : ''}` };
  }
  if (ev.table === 'files' && ev.type === 'INSERT' && !isMe(r.created_by) && p.options && /^image\//.test(r.mime || r.type || '')) {
    const cat = stepTitle(r.step_id);
    return { kind: 'photos', title: `New photo${cat ? ' · ' + cat : ''}`, body: `${by(r)} added a photo for ${couple(r.wedding_id)}’s wedding.`, url: `#/w/${r.wedding_id}/plan${r.step_id ? '?open=' + r.step_id : ''}` };
  }
  if (ev.table === 'steps' && ev.type === 'UPDATE' && prev) {
    if (p.mine && mineStep(r) && !mineStep(prev) && !isMe(r.updated_by)) return { kind: 'mine', title: 'A job for you', body: `“${r.title}” (${couple(r.wedding_id)}) — you’re in charge now${r.due ? ', by ' + r.due : ''}.`, url: `#/w/${r.wedding_id}/plan?open=${r.id}` };
    if (p.decided && r.locked_at && !prev.locked_at && !isMe(r.locked_by)) { const ln = r.lock_note || {}; return { kind: 'decided', title: `Decided · ${r.title}`, body: `${(ln.choice && ln.choice.title) || ln.with || ln.vendor || 'It’s final'} — ${couple(r.wedding_id)}’s wedding.`, url: `#/w/${r.wedding_id}/plan?open=${r.id}` }; }
  }
  if (ev.table === 'todos' && ev.type === 'UPDATE' && prev && p.mine && store.me && r.owner && samePerson(r.owner, store.me.name) && !(prev.owner && samePerson(prev.owner, store.me.name)) && !isMe(r.updated_by)) {
    return { kind: 'mine', title: 'A to-do for you', body: `“${r.title}” — ${couple(r.wedding_id)}’s wedding.`, url: `#/w/${r.wedding_id}/plan` };
  }
  if (ev.table === 'comments' && ev.type === 'INSERT' && !isMe(r.created_by) && p.comments) {
    const it = r.item_id && store.find('board_items', r.item_id); if (!it) return null;
    const s = store.find('steps', (it.data || {}).step_id || it.step_id);
    const what = it.kind === 'option' ? ((it.data || {}).title || 'an option') : (s ? s.title : 'your card');
    if (isMe(it.created_by) || mineStep(s)) return { kind: 'comments', title: `${r.author_name || by(r)} on “${what}”`, body: String(r.body || '').slice(0, 140), url: s ? `#/w/${s.wedding_id}/${it.kind === 'option' ? 'options?step=' + s.id : 'plan?open=' + s.id}` : `#/w/${it.wedding_id}/board` };
  }
  if (ev.table === 'announcements' && ev.type === 'INSERT' && !isMe(r.created_by) && p.news) {
    return { kind: 'news', title: r.title || 'Family announcement', body: String(r.body || r.text || '').slice(0, 160), url: r.wedding_id ? `#/w/${r.wedding_id}` : '#/home' };
  }
  return null;
}

// Bursts (someone adding six photos) become one notification.
let queue = [], timer = null;
function flush() {
  timer = null; const q = queue; queue = [];
  if (!q.length) return;
  if (q.length === 1) { show(q[0].title, q[0].body, q[0].url, q[0].kind); return; }
  const opts = q.filter(x => x.kind === 'options' || x.kind === 'photos');
  if (opts.length === q.length) { const url = q.every(x => x.url.split('?')[0] === q[0].url.split('?')[0]) ? q[0].url.split('?')[0] : '#/swipe'; show(`${q.length} new things to look at`, [...new Set(q.map(x => x.title.replace(/^New (option|photo) · /, '')))].slice(0, 4).join(' · '), url, 'options'); return; }
  show(`${q.length} updates in the War Room`, q.slice(0, 3).map(x => x.title).join(' · '), q[0].url, 'many');
}

let started = false;
export function startNotifier() {
  if (started || !notifySupported()) return; started = true;
  store.onRemoteRow((ev) => {
    if (!notifyOn()) return;
    const n = describe(ev); if (!n) return;
    // While you're looking at the site, the screen already updates — no need to buzz.
    if (document.visibilityState === 'visible' && document.hasFocus()) return;
    queue.push(n); clearTimeout(timer); timer = setTimeout(flush, 2500);
  });
}

export function notifySettings() {
  const p = prefs();
  const perm = notifySupported() ? Notification.permission : 'unsupported';
  const boxes = KINDS.map(([k, label, sub]) => { const b = h('input', { type: 'checkbox', checked: p[k] ? true : null, 'data-k': k }); return h('label', { class: 'd-check nt-row' }, b, h('span', {}, h('b', {}, label), h('span', { class: 'ft-sub' }, sub))); });
  const status = h('p', { class: 'nt-status' });
  const paint = () => {
    const pm = notifySupported() ? Notification.permission : 'unsupported';
    status.className = 'nt-status ' + (pm === 'granted' && prefs().on ? 'on' : pm === 'denied' ? 'off' : '');
    status.textContent = pm === 'unsupported' ? 'This browser can’t show notifications. On Android, open the site in Chrome and add it to the home screen.'
      : pm === 'denied' ? 'Notifications are blocked for this site. Allow them in the browser’s site settings (tap the lock next to the address), then come back.'
      : pm === 'granted' && prefs().on ? 'On for this phone.' : 'Off for this phone.';
  };
  paint();
  modal({
    title: 'Notifications on this phone',
    body: [status, h('div', { class: 'nt-list' }, boxes),
      h('p', { class: 'hint' }, 'They come while the War Room is open or in the background. Add it to your home screen (Chrome menu ⋮ → Add to Home screen) so they keep coming. Each phone chooses for itself.')],
    actions: [
      prefs().on ? { label: 'Turn off', kind: 'ghost', onClick: () => { savePrefs({ ...prefs(), on: false }); toast('Notifications off on this phone'); } } : null,
      { label: perm === 'granted' && p.on ? 'Save' : 'Turn on', onClick: async () => {
        const next = { ...prefs() }; boxes.forEach(l => { const b = l.querySelector('input'); next[b.dataset.k] = b.checked; });
        if (!notifySupported()) { paint(); return false; }
        let pm = Notification.permission;
        if (pm === 'default') pm = await Notification.requestPermission();
        if (pm !== 'granted') { savePrefs({ ...next, on: false }); paint(); return false; }
        next.on = true; savePrefs(next); startNotifier(); buzz(12);
        if (perm !== 'granted' || !p.on) show('Notifications are on', 'You’ll hear about new options, your jobs and decisions here.', '#/home', 'hello');
        toast('Notifications on for this phone');
      } }].filter(Boolean)
  });
}
