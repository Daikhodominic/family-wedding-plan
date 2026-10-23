// The view switch under Choose: To vote · Glimpse · Mood board.
import { h } from './ui.js?v=50';
export function chooseTabs(w, current) {
  const base = '#/w/' + w.id;
  return h('div', { class: 'viewtoggle choose-tabs', role: 'group', 'aria-label': 'View' },
    [['vote', 'To vote', base + '/choose'], ['glimpse', 'Glimpse', base + '/choose?view=glimpse'], ['board', 'Mood board', base + '/board']].map(([k, l, href]) =>
      h('button', { type: 'button', 'aria-pressed': String(current === k), onclick: () => { if (current !== k) location.hash = href; } }, l)));
}
