// Glimpse: the wedding in a nutshell — every final decision, in the order of the plan,
// with its picture and who to call. Undecided big decisions show as soft outlines.
import { store } from './store.js?v=27';
import { h, shortDate } from './ui.js?v=27';
import { live } from './app.js?v=27';
import { openStep } from './panel.js?v=27';
import { pictureEl } from './map.js?v=27';
import { cardTitle } from './decisions.js?v=27';

function tile(s, area) {
  const n = s.lock_note || {};
  const pic = pictureEl(s, 'gl-pic');
  return h('article', { class: 'gl-tile' + (pic ? '' : ' no-pic'), onclick: (e) => { if (!e.target.closest('a')) openStep(s.id); } },
    pic || h('div', { class: 'gl-pic ph' }, h('span', {}, (area && area.title) || 'Decided')),
    h('div', { class: 'gl-body' },
      h('span', { class: 'gl-area' }, area ? area.title : ''),
      h('h3', {}, n.choice && n.choice.title ? n.choice.title : s.title),
      n.choice && n.choice.title ? h('span', { class: 'gl-step' }, s.title) : null,
      n.with && !(n.choice && n.with.startsWith(n.choice.title)) ? h('span', { class: 'gl-with' }, n.with) : n.vendor && n.vendor !== (n.choice && n.choice.title) ? h('span', { class: 'gl-with' }, n.vendor) : null,
      n.phone ? h('a', { class: 'gl-tel', href: 'tel:' + n.phone.replace(/[^\d+]/g, '') }, '☏ ' + n.phone) : null,
      n.notes ? h('span', { class: 'gl-notes' }, n.notes.length > 120 ? n.notes.slice(0, 118) + '…' : n.notes) : null,
      h('span', { class: 'gl-when' }, '✓ Final · ' + shortDate(String(s.locked_at).slice(0, 10)))));
}
function pending(s, area) {
  return h('article', { class: 'gl-tile pending', onclick: () => openStep(s.id) },
    h('div', { class: 'gl-pic ph' }, h('span', {}, 'Still to decide')),
    h('div', { class: 'gl-body' }, h('span', { class: 'gl-area' }, area ? area.title : ''), h('h3', {}, s.title), s.owner ? h('span', { class: 'gl-with' }, 'With ' + s.owner) : null));
}

export function renderGlimpse(root, w, plan) {
  let decided = 0, open = 0;
  const stagesEl = plan.stages.map(st => {
    const tiles = [];
    for (const a of st.areas) for (const s of a.steps) {
      if (s.locked_at) { tiles.push(tile(s, a)); decided++; }
      else if (s.gate) { tiles.push(pending(s, a)); open++; }
    }
    if (!tiles.length) return null;
    return h('section', { class: 'gl-stage' }, h('div', { class: 'stage-h' }, h('h3', {}, st.title)), h('div', { class: 'gl-grid' }, tiles));
  }).filter(Boolean);

  // Cards marked "Chosen" on the board that aren't pinned to a step.
  const chosen = live(store.rows('board_items')).filter(i => i.wedding_id === w.id && i.data && i.data.status === 'chosen' && !i.data.step_id && !['shape', 'connector', 'label'].includes(i.kind));
  const chosenEl = chosen.length ? h('section', { class: 'gl-stage' }, h('div', { class: 'stage-h' }, h('h3', {}, 'Also chosen on the board')),
    h('div', { class: 'gl-grid' }, chosen.map(c => {
      const d = c.data || {}; const path = c.kind === 'image' ? d.path : c.kind === 'gallery' && d.images && d.images[0] ? d.images[0].path : d.thumb;
      const im = h('img', { class: 'gl-pic', alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' });
      if (path) store.url(path).then(u => { if (u) im.src = u; }); else if (d.preview && d.preview.image) im.src = d.preview.image;
      return h('a', { class: 'gl-tile', href: `#/w/${w.id}/board?focus=${c.id}` }, path || (d.preview && d.preview.image) ? im : h('div', { class: 'gl-pic ph' }, h('span', {}, c.kind)), h('div', { class: 'gl-body' }, h('h3', {}, cardTitle(c)), h('span', { class: 'gl-when' }, '✓ Chosen on the board')));
    }))) : null;

  root.append(h('div', { class: 'gl-intro' },
    h('p', {}, decided ? `${decided} ${decided === 1 ? 'decision is' : 'decisions are'} final${open ? `, ${open} still to decide` : ''}. This is the wedding so far — tap anything for details, or a number to call.` : 'Nothing is final yet. As decisions are made — the venue, the food, the dress — they appear here with their pictures, so everyone can see how the day is coming together.')));
  if (stagesEl.length || chosenEl) root.append(h('div', { class: 'glimpse' }, stagesEl, chosenEl));
}
