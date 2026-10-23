// First-visit welcome, one-time tips, and Easy view (bigger text, fewer controls).
import { store } from './store.js?v=32';
import { h, modal , ICONS } from './ui.js?v=32';
import { once, markOnce } from './tools.js?v=32';

const SLIDES = [
  ['Welcome to the War Room', 'Both weddings live here. Everyone in the family can add ideas, tick off jobs and see what’s been decided — from any phone or laptop.'],
  ['Tap a monogram', 'Each wedding has an Overview (what’s happening and who is doing what), the Plan, a mood Board, Lists like the guest list, and the Budget.'],
  ['Your jobs come to you', 'Anything with your name on it shows under “Hi …” at the top and in My jobs. Made a mistake? The ↶ button at the top undoes it.']
];
export function maybeWelcome() {
  if (!store.me || !once('welcome') || document.querySelector('.modal-wrap')) return;
  let i = 0;
  const body = h('div', { class: 'welcome' });
  const m = modal({ title: ' ', body, onClose: () => markOnce('welcome') });
  m.panel.classList.add('welcome-modal');
  const draw = () => {
    const [t, p] = SLIDES[i];
    body.replaceChildren(
      h('div', { class: 'eyebrow' }, `${i + 1} of ${SLIDES.length}`),
      h('h2', {}, t), h('p', {}, p),
      h('div', { class: 'wl-dots' }, SLIDES.map((_, j) => h('span', { class: j === i ? 'on' : '' }))),
      h('div', { class: 'wl-acts' },
        h('button', { type: 'button', class: 'link-btn', onclick: () => m.close() }, 'Skip'),
        h('button', { type: 'button', class: 'btn', onclick: () => { if (i < SLIDES.length - 1) { i++; draw(); } else m.close(); } }, i < SLIDES.length - 1 ? 'Next' : 'Start')));
  };
  draw();
}

const TIPS = {
  overview: 'This page shows what’s happening now, what’s coming up, and who is doing what. Tap anything to open it.',
  plan: 'Tap a step to see its details, add files, or make it final. Tick the circle when it’s done. Drag by the dots to move things.',
  board: 'Drop photos and links here, or press Ctrl+V to paste. Tap “Comment” on a card to discuss it; tap ☺ to react.',
  lists: 'Guest list, gifts, vehicles, songs… Start one below. Tick boxes and totals fill in by themselves.',
  budget: 'Everyone can see the money. Only the Deciders can change it. Tap any payment for details.',
  choose: 'Every big decision has its options here — photographers, rings, cards. Anyone can add one with photos and links; everyone votes; the Deciders choose.',
  options: 'Vote on each option, tick two or three to compare them side by side, and tap a photo to see everything.',
  swipe: 'Swipe right if you love it, left if not, up for maybe. Tap the photo for more photos, or “See everything” for links and details.'
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
