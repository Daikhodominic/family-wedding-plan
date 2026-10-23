// First-visit welcome, one-time tips, and Easy view (bigger text, fewer controls).
import { store } from './store.js?v=47';
import { h, modal , ICONS } from './ui.js?v=47';
import { once, markOnce } from './tools.js?v=47';

// The first-visit tour. It comes back each visit until "Don't show this again" is tapped,
// and can be opened any time from the menu ("How to use the War Room").
const sv = (p) => `<svg viewBox="0 0 48 48" width="46" height="46" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const SLIDES = [
  { t: 'Welcome to the War Room', ic: sv('<path d="M10 40V20l14-11 14 11v20"/><path d="M19 40V28h10v12"/><path d="M24 9V4M21 6h6"/>'),
    p: 'Both weddings — Charani & Adahrii, and Elow & Maniziia — are planned here together. Everyone in the family can add ideas, vote, tick off jobs and see what’s decided, from any phone or laptop.' },
  { t: 'Home: start here', ic: sv('<circle cx="16" cy="24" r="9"/><circle cx="32" cy="24" r="9"/>'),
    p: 'Tap a couple’s monogram to open their wedding. “New for you” at the top shows options waiting for your vote. Below: what changed since you last looked, decisions waiting, and what’s coming up.',
    where: 'Home → a monogram' },
  { t: 'Each wedding has five tabs', ic: sv('<rect x="6" y="10" width="36" height="28" rx="4"/><path d="M6 32h36M15 32v6M24 32v6M33 32v6"/>'),
    p: 'Overview (what’s happening, who’s doing what) · Choose (options to vote on) · Plan (every step, in order) · Lists (guests, meat list, gifts, files) · Budget. The bar at the bottom moves between them.' },
  { t: 'Choose: swipe to vote', ic: sv('<rect x="14" y="8" width="20" height="30" rx="4" transform="rotate(12 24 23)"/><path d="M6 40l6-4M42 40l-6-4"/>'),
    p: 'Push a card right if you love it, left if not — a light push is enough. Swipe up to see all its photos and details. Made a mistake? ↶ undoes it. The Deciders choose once the family has voted.',
    where: 'Choose → a category → Swipe' },
  { t: 'Adding an option or a sample', ic: sv('<rect x="8" y="8" width="32" height="32" rx="6"/><path d="M24 16v16M16 24h16"/>'),
    p: 'Tap “+ Add an option”. Pick a category or type a new one, say when it happens and who’s in charge. Add photos — front, back, a vendor’s work. Choose “A sample for ideas” to put it on the mood board instead, with nothing to vote on.',
    where: 'Choose → + Add an option' },
  { t: 'The plan and your jobs', ic: sv('<path d="M10 12h28M10 24h28M10 36h18"/><circle cx="38" cy="36" r="4"/>'),
    p: 'Plan shows every step: tap one to see details, add files or make it final, and tick it when it’s done. Map and Glimpse are other views of the same plan. Anything with your name shows in My jobs (the menu, top right).',
    where: 'Plan → List · Map · Glimpse · To-do' },
  { t: 'Glimpse: the wedding at a glance', ic: sv('<rect x="6" y="6" width="16" height="16" rx="3"/><rect x="26" y="6" width="16" height="16" rx="3"/><rect x="6" y="26" width="16" height="16" rx="3"/><rect x="26" y="26" width="16" height="16" rx="3"/>'),
    p: 'Every choice as a picture, like Instagram. Tap one and go through them one by one: what was chosen, the alternatives, the votes, and whether it can still change. Once a sample is chosen, add the final design there.',
    where: 'Plan → Glimpse' },
  { t: 'Lists, invitations and the meat list', ic: sv('<rect x="10" y="6" width="28" height="36" rx="4"/><path d="M16 16h16M16 24h16M16 32h10"/>'),
    p: 'Lists holds the invitation and meat lists for each side, gifts, the trousseau and more. Each list can be sent on WhatsApp or printed / saved as a PDF. Files and photos live there too.',
    where: 'Lists' },
  { t: 'Safe to try things', ic: sv('<path d="M14 18a12 12 0 1 1-2 14"/><path d="M8 12v8h8"/>'),
    p: 'Nothing is lost: deleted things go to the Bin and anyone can bring them back. ↶ at the top undoes your last change. Easy view (in the menu) makes the text bigger.' },
  { t: 'Put it on your home screen', ic: sv('<rect x="14" y="4" width="20" height="40" rx="4"/><path d="M24 14v14M18 22l6 6 6-6"/>'),
    p: 'Menu → “Install on this phone”. It then opens like an app, full screen. Turn on notifications in the menu to hear about new options and jobs for you.' }
];
const OFF_KEY = 'welcome-off';
export function maybeWelcome() {
  if (!store.me || !once(OFF_KEY) || document.querySelector('.modal-wrap')) return;
  try { if (sessionStorage.getItem('fwp-tour-seen')) return; sessionStorage.setItem('fwp-tour-seen', '1'); } catch (e) { /* ignore */ }
  openTour();
}
export function openTour(start = 0) {
  let i = start;
  const body = h('div', { class: 'welcome tour' });
  const m = modal({ title: ' ', body });
  m.panel.classList.add('welcome-modal');
  const draw = () => {
    const sl = SLIDES[i];
    body.replaceChildren(
      h('div', { class: 'wl-ic', html: sl.ic }),
      h('div', { class: 'eyebrow' }, `${i + 1} of ${SLIDES.length}`),
      h('h2', {}, sl.t), h('p', {}, sl.p),
      sl.where ? h('p', { class: 'wl-where' }, h('span', {}, 'Where: '), sl.where) : null,
      h('div', { class: 'wl-dots' }, SLIDES.map((_, j) => h('button', { type: 'button', class: j === i ? 'on' : '', 'aria-label': `Go to ${j + 1}`, onclick: () => { i = j; draw(); } }))),
      h('div', { class: 'wl-acts' },
        i > 0 ? h('button', { type: 'button', class: 'btn ghost', onclick: () => { i--; draw(); } }, 'Back') : h('button', { type: 'button', class: 'btn ghost', onclick: () => m.close() }, 'Later'),
        h('button', { type: 'button', class: 'btn', onclick: () => { if (i < SLIDES.length - 1) { i++; draw(); } else { markOnce(OFF_KEY); m.close(); } } }, i < SLIDES.length - 1 ? 'Next' : 'Start')),
      h('button', { type: 'button', class: 'link-btn wl-never', onclick: () => { markOnce(OFF_KEY); m.close(); } }, 'Don’t show this again'));
  };
  // swipe between slides on phones
  let sx = 0; body.addEventListener('pointerdown', (e) => { sx = e.clientX; }); body.addEventListener('pointerup', (e) => { const d = e.clientX - sx; if (Math.abs(d) > 50) { if (d < 0 && i < SLIDES.length - 1) i++; else if (d > 0 && i > 0) i--; draw(); } });
  draw();
}

const TIPS = {
  overview: 'This page shows what’s happening now, what’s coming up, and who is doing what. Tap anything to open it.',
  plan: 'Tap a step to see its details, add files, or make it final. Tick the circle when it’s done. Drag by the dots to move things.',
  board: 'Drop photos and links here, or press Ctrl+V to paste. Tap “Comment” on a card to discuss it; tap ♡ if you love it.',
  lists: 'Guest list, gifts, vehicles, songs… Start one below. Tick boxes and totals fill in by themselves.',
  budget: 'Everyone can see the money. Only the Deciders can change it. Tap any payment for details.',
  choose: 'Every big decision has its options here — photographers, rings, cards. Anyone can add one with photos and links; everyone votes; the Deciders choose.',
  options: 'Vote on each option, tick two or three to compare them side by side, and tap a photo to see everything.',
  swipe: 'Push right if you love it, left if not — a light push is enough. Swipe up to see every photo and detail. ↶ undoes a swipe.'
};
export function tip(key) {
  if (!TIPS[key] || !once('tip-' + key)) return null;
  const el = h('div', { class: 'tip', role: 'note' },
    h('span', { class: 'tip-i', html: ICONS.sparkle }), h('span', {}, TIPS[key]),
    h('button', { type: 'button', class: 'tip-x', onclick: () => { markOnce('tip-' + key); el.remove(); } }, 'Got it'));
  return el;
}

export const easyOn = () => { try { return localStorage.getItem('fwp-easy') === '1'; } catch (e) { return false; } };
export function applyEasy() { document.body.classList.toggle('easy', easyOn()); }
export function toggleEasy() { try { localStorage.setItem('fwp-easy', easyOn() ? '0' : '1'); } catch (e) { } applyEasy(); }
