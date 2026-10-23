// Putting the War Room on the home screen, like an app.
// Android (Chrome, Edge, Samsung Internet): one tap, using the browser's own install prompt.
// iPhone and iPad (Safari): Apple allows no install button, so we show the two taps — Share, then "Add to Home Screen".
import { h, modal, ICONS } from './ui.js?v=50';

let deferred = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; document.dispatchEvent(new Event('fwp-installable')); });
window.addEventListener('appinstalled', () => { deferred = null; try { localStorage.setItem('fwp-installed', '1'); } catch (e) { /* ignore */ } });

export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
const ua = navigator.userAgent || '';
export const isIOS = () => /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isPhone = () => isIOS() || /Android/i.test(ua);

const SHARE_IC = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8"/></svg>';
const ADD_IC = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/></svg>';
const DOTS_IC = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>';

export async function installApp() {
  if (isStandalone()) { modal({ title: 'Already on your home screen', body: h('p', { class: 'muted', style: { margin: 0 } }, 'You’re using the War Room as an app on this phone.'), actions: [{ label: 'OK', onClick: () => { } }] }); return; }
  if (deferred) { const e = deferred; deferred = null; e.prompt(); const r = await e.userChoice.catch(() => null); if (r && r.outcome === 'accepted') try { localStorage.setItem('fwp-installed', '1'); } catch (x) { /* ignore */ } return; }
  const step = (ic, text) => h('li', { class: 'inst-step' }, h('span', { class: 'inst-ic', html: ic }), h('span', {}, text));
  const body = isIOS()
    ? [h('p', { class: 'muted', style: { marginTop: 0 } }, 'In Safari, two taps:'),
      h('ol', { class: 'inst-steps' },
        step(SHARE_IC, h('span', {}, 'Tap the ', h('b', {}, 'Share'), ' button — the square with an arrow, at the bottom of the screen (at the top on an iPad).')),
        step(ADD_IC, h('span', {}, 'Scroll down and tap ', h('b', {}, 'Add to Home Screen'), ', then ', h('b', {}, 'Add'), '.'))),
      h('p', { class: 'hint', style: { margin: 0 } }, 'Using Chrome on the iPhone? The Share button is at the top right, next to the address. Once it’s on the home screen, notifications work on the iPhone too.')]
    : [h('p', { class: 'muted', style: { marginTop: 0 } }, 'In Chrome:'),
      h('ol', { class: 'inst-steps' },
        step(DOTS_IC, h('span', {}, 'Tap the ', h('b', {}, '⋮'), ' menu at the top right.')),
        step(ADD_IC, h('span', {}, 'Tap ', h('b', {}, 'Install app'), ' (or ', h('b', {}, 'Add to Home screen'), '), then ', h('b', {}, 'Install'), '.'))),
      h('p', { class: 'hint', style: { margin: 0 } }, 'It gets its own icon, opens full screen and works without the internet. It updates by itself.')];
  modal({ title: 'Put the War Room on your home screen', body, actions: [{ label: 'Done', onClick: () => { } }] });
}

// A one-time offer on the home page, for phones that haven't installed it yet.
export function installOffer() {
  let off = false; try { off = !!localStorage.getItem('fwp-install-offer-off') || !!localStorage.getItem('fwp-installed'); } catch (e) { /* ignore */ }
  if (off || isStandalone() || !isPhone()) return null;
  const el = h('section', { class: 'tip install-tip' }, h('span', { class: 'tip-i', html: ICONS.sparkle }),
    h('span', {}, h('b', {}, 'Put it on your home screen. '), 'It opens like an app, full screen, and works offline.'),
    h('span', { class: 'tip-acts' },
      h('button', { type: 'button', class: 'tip-x', onclick: () => installApp() }, isIOS() ? 'Show me' : 'Install'),
      h('button', { type: 'button', class: 'link-btn', onclick: (e) => { try { localStorage.setItem('fwp-install-offer-off', '1'); } catch (x) { /* ignore */ } e.target.closest('.install-tip').remove(); } }, 'Not now')));
  return el;
}
