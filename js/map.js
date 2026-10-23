// Progress tracking and the Map view of a wedding's pipeline.
import { store } from './store.js?v=49';
import { render } from './app.js?v=49';
import { h, shortDate, daysUntil, ICONS } from './ui.js?v=49';
import { openStep, lockIcon } from './panel.js?v=49';
import { stepPicture, previewUrl } from './decisions.js?v=49';
import { addStepAt, addAreaTo, addStageTo, removeArea } from './addhere.js?v=49';
import { areaIcon, ringSvg, roman } from './areaicons.js?v=49';

const live = (rows) => rows.filter(r => !r.deleted_at);
const byPos = (a, b) => (a.position || 0) - (b.position || 0);
export const isComplete = (s) => s.status === 'done' || !!s.locked_at;

// Stages → areas → steps for one wedding, with progress worked out.
export function planOf(w) {
  const stages = live(store.rows('stages')).filter(s => s.wedding_id === w.id).sort(byPos);
  const areasAll = live(store.rows('areas')).filter(a => a.wedding_id === w.id);
  const stepsAll = live(store.rows('steps')).filter(s => s.wedding_id === w.id);
  let total = 0, complete = 0, locked = 0, here = null, n = 0;
  const out = stages.map(st => {
    const areas = areasAll.filter(a => a.stage_id === st.id).sort(byPos).map(a => {
      const steps = stepsAll.filter(s => s.area_id === a.id).sort(byPos).map(s => ({ ...s, n: ++n }));
      const c = steps.filter(isComplete).length, l = steps.filter(s => s.locked_at).length;
      const moving = steps.some(s => s.status === 'doing');
      total += steps.length; complete += c; locked += l;
      let state = 'todo';
      if (steps.length && c === steps.length) state = l ? 'locked' : 'done';
      else if (c || moving) state = 'doing';
      const area = { ...a, steps, state, complete: c, locked: l };
      if (!here && state !== 'done' && state !== 'locked' && steps.length) here = area.id;
      return area;
    });
    return { ...st, areas };
  });
  return { stages: out, total, complete, locked, pct: total ? Math.round(complete / total * 100) : 0, here };
}

// The progress line: one slim segment per area, coloured by how far along it is.
export function journeyBar(w, plan, { onPick } = {}) {
  const hereArea = plan.stages.flatMap(st => st.areas).find(a => a.id === plan.here);
  return h('div', { class: 'journey' },
    h('div', { class: 'journey-track' }, plan.stages.map(st => h('div', { class: 'jstage', style: { flex: Math.max(1, st.areas.length) } },
      h('div', { class: 'jsegs' }, st.areas.length ? st.areas.map(a => h('button', {
        type: 'button', class: 'jseg ' + a.state + (plan.here === a.id ? ' here' : ''), title: `${a.title}: ${a.complete} of ${a.steps.length}`,
        'aria-label': `${a.title}, ${a.complete} of ${a.steps.length} done`, onclick: () => onPick && onPick(a.id)
      })) : h('span', { class: 'jseg empty' })),
      h('div', { class: 'jstage-name' }, st.title)))),
    h('div', { class: 'journey-sum' },
      h('b', {}, plan.pct + '% there'),
      hereArea ? h('span', {}, ' · you are here: ', h('b', { class: 'here-name' }, hereArea.title)) : plan.total ? h('span', {}, ' · everything is done') : h('span', {}, ' · no steps yet'),
      plan.locked ? h('span', { class: 'jlock' }, h('span', { html: lockIcon(13) }), ` ${plan.locked} final`) : null,
      h('span', { class: 'jlegend' },
        h('span', {}, h('i', { class: 'jseg doing' }), 'Underway'), h('span', {}, h('i', { class: 'jseg done' }), 'Done'), h('span', {}, h('i', { class: 'jseg locked' }), 'Final'))));
}

// The map: stages left to right (top to bottom on phones), areas as columns of numbered stations, joined by lines.
const mapStage = {}; // which stage a phone shows, per wedding
export function renderMap(root, w, plan, params) {
  const map = h('div', { class: 'pmap', 'data-fresh': '' }); // drawn lines follow the nodes, so the map is always rebuilt whole
  const inner = h('div', { class: 'pmap-inner' });
  map.append(inner);
  // Phones: one stage at a time, picked from a row of chips (starts at the stage you're in).
  const phone = matchMedia('(max-width: 760px)').matches;
  const hereStage = plan.stages.findIndex(st => st.areas.some(a => a.id === plan.here));
  let si0 = mapStage[w.id] ?? (hereStage >= 0 ? hereStage : 0);
  if (si0 >= plan.stages.length) si0 = 0;
  if (params && params.focus) { const fi = plan.stages.findIndex(st => st.areas.some(a => a.id === params.focus || a.steps.some(x => x.id === params.focus))); if (fi >= 0) si0 = fi; }
  if (phone && plan.stages.length > 1) root.append(h('div', { class: 'mstage-pick lchips', role: 'tablist', 'aria-label': 'Stage' }, plan.stages.map((st, i) => h('button', { type: 'button', role: 'tab', class: 'lchip' + (i === si0 ? ' on' : ''), 'aria-selected': String(i === si0), onclick: () => { mapStage[w.id] = i; render(); } }, roman(i + 1) + ' · ' + st.title))));
  const gap = (a, s) => h('button', { type: 'button', class: 'mgap', title: s ? `Add a step after “${s.title}”` : 'Add a step', 'aria-label': s ? `Add a step after ${s.title}` : `Add a step to ${a.title}`, onclick: (e) => { e.stopPropagation(); addStepAt(a.id, s); } }, h('span', {}, '+'));
  plan.stages.forEach((st, si) => {
    if (phone && plan.stages.length > 1 && si !== si0) return;
    const stSteps = st.areas.flatMap(a => a.steps), stDone = stSteps.filter(isComplete).length, stFinal = stSteps.filter(x => x.locked_at).length;
    inner.append(h('section', { class: 'mstage' },
      h('div', { class: 'mstage-h' },
        h('span', { class: 'stage-num', 'aria-hidden': 'true' }, h('span', { html: ringSvg(stDone, stFinal, stSteps.length, 52) }), h('b', {}, roman(si + 1))),
        h('div', {}, h('h3', {}, st.title), h('span', { class: 'ft-sub' }, `${stDone} of ${stSteps.length} done${stFinal ? ` · ${stFinal} final` : ''}`))),
      h('div', { class: 'mareas' }, st.areas.map(a => h('div', { class: 'marea ' + a.state, dataset: { area: a.id } },
        h('div', { class: 'marea-h' + (plan.here === a.id ? ' here' : '') },
          h('span', { class: 'area-badge', 'aria-hidden': 'true' }, h('span', { class: 'ab-ring', html: ringSvg(a.complete, a.steps.filter(x => x.locked_at).length, a.steps.length, 42) }), h('span', { class: 'ab-ic', html: areaIcon(a.title) })),
          h('span', { class: 'area-tt' }, h('b', {}, a.title), h('span', { class: 'ft-sub' }, `${a.complete} of ${a.steps.length}`)),
          plan.here === a.id ? h('span', { class: 'here-tag' }, 'You are here') : null,
          h('button', { type: 'button', class: 'marea-x', title: `Remove ${a.title}`, 'aria-label': `Remove the section ${a.title}`, html: ICONS.trash, onclick: () => removeArea(a) })),
        h('div', { class: 'mnodes' }, a.steps.flatMap((s, i) => i < a.steps.length - 1 ? [nodeEl(s), gap(a, s)] : [nodeEl(s)]),
          h('button', { type: 'button', class: 'madd', onclick: () => addStepAt(a.id, null) }, '+ Add a step')))),
        h('button', { type: 'button', class: 'madd area', onclick: () => addAreaTo(st) }, '+ Add a section'))));
  });
  if (!phone || plan.stages.length <= 1 || si0 === plan.stages.length - 1) inner.append(h('section', { class: 'mstage add' }, h('button', { type: 'button', class: 'madd stage', onclick: () => addStageTo(w.id) }, '+ Add a stage')));
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'pmap-lines'); svg.setAttribute('aria-hidden', 'true');
  inner.prepend(svg);
  root.append(map);

  const drawLines = () => {
    const box = inner.getBoundingClientRect();
    svg.setAttribute('width', inner.scrollWidth); svg.setAttribute('height', inner.scrollHeight);
    const paths = [];
    const nodes = [...inner.querySelectorAll('.mnode')];
    const pt = (el, side) => { const r = el.getBoundingClientRect(); return side === 'out' ? [r.right - box.left, r.top - box.top + r.height / 2] : [r.left - box.left, r.top - box.top + r.height / 2]; };
    const areas = [...inner.querySelectorAll('.marea')];
    areas.forEach((ar, i) => {
      const ns = [...ar.querySelectorAll('.mnode')];
      // The line runs through each step's numbered station.
      const stn = (n) => { const m = n.querySelector('.mnum') || n; const r = m.getBoundingClientRect(); return [r.left - box.left + r.width / 2, r.top - box.top + r.height / 2]; };
      for (let k = 0; k < ns.length - 1; k++) {
        const [x1, y1] = stn(ns[k]), [, y2] = stn(ns[k + 1]);
        paths.push(`<path d="M${x1} ${y1} L${x1} ${y2}" class="track ${ns[k].classList.contains('complete') && ns[k + 1].classList.contains('complete') ? 'done' : ns[k].classList.contains('complete') ? 'half' : ''}"/>`);
      }
      const next = areas[i + 1];
      if (ns.length && next) {
        const nn = next.querySelector('.mnode');
        const cls = ar.classList.contains('done') || ar.classList.contains('locked') ? 'done' : '';
        // On phones the areas stack top to bottom, so the link drops from the last station to the next area's badge.
        if (nn && next.getBoundingClientRect().top >= ar.getBoundingClientRect().bottom - 2) {
          const last = ns[ns.length - 1].querySelector('.mnum') || ns[ns.length - 1], r1 = last.getBoundingClientRect();
          const tgt = next.querySelector('.area-badge') || nn, r2 = tgt.getBoundingClientRect();
          const x1 = r1.left - box.left + r1.width / 2, y1 = r1.bottom - box.top, x2 = r2.left - box.left + r2.width / 2, y2 = r2.top - box.top - 4;
          paths.push(`<path d="M${x1} ${y1} C${x1} ${y1 + 40}, ${x2} ${y2 - 40}, ${x2} ${y2}" class="link ${cls}"/><circle cx="${x2}" cy="${y2}" r="3" class="link-dot"/>`);
        } else if (nn) {
          const [x1, y1] = pt(ns[ns.length - 1], 'out'), [x2, y2] = pt(nn, 'in');
          const mx = (x1 + x2) / 2;
          paths.push(`<path d="M${x1} ${y1} C${mx} ${y1}, ${mx} ${y2}, ${x2 - 4} ${y2}" class="link ${cls}"/><circle cx="${x2 - 4}" cy="${y2}" r="3" class="link-dot"/>`);
        }
      }
    });
    svg.innerHTML = paths.join('');
    void nodes;
  };
  // Lines are drawn at most once a frame, and not while the map is off screen.
  let queued = false;
  const queue = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; if (inner.isConnected) drawLines(); }); };
  requestAnimationFrame(queue);
  if (window.ResizeObserver) { const ro = new ResizeObserver(() => { if (!inner.isConnected) { ro.disconnect(); return; } queue(); }); ro.observe(inner); }

  if (params && params.focus) requestAnimationFrame(() => {
    const el = inner.querySelector(`[data-id="${CSS.escape(params.focus)}"]`);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }); el.classList.add('flash'); }
  });
}

function nodeEl(s) {
  const late = s.due && !isComplete(s) && daysUntil(s.due) < 0;
  const cls = ['mnode', s.locked_at ? 'locked' : s.status, isComplete(s) ? 'complete' : '', s.gate && !s.locked_at ? 'is-gate' : ''].filter(Boolean).join(' ');
  const sub = s.locked_at ? ((s.lock_note && s.lock_note.with) || 'Final') : [s.owner, s.due ? (late ? 'overdue' : 'due ' + shortDate(s.due)) : null].filter(Boolean).join(' · ');
  if (s.locked_at) return decidedNode(s, cls);
  return h('button', { type: 'button', class: cls, dataset: { id: s.id }, onclick: () => openStep(s.id), 'aria-label': `${s.n}. ${s.title}${s.locked_at ? ', final' : isComplete(s) ? ', done' : ''}` },
    h('span', { class: 'mnum' }, isComplete(s) ? h('span', { html: ICONS.check }) : String(s.n)),
    h('span', { class: 'mtxt' }, h('span', { class: 'mt' }, s.title), sub ? h('span', { class: 'ms' + (late ? ' late' : '') }, sub) : null),
    s.locked_at ? h('span', { class: 'mic', html: lockIcon(16) }) : isComplete(s) ? h('span', { class: 'mic', html: ICONS.check }) : s.gate ? h('span', { class: 'mic gate-ic', title: 'Big decision' }, '◆') : s.status === 'doing' ? h('span', { class: 'pulse' }) : null);
}

// A final step on the map shows what was chosen: its picture, who it's with, and a number to call.
export function pictureEl(step, cls = 'dn-pic') {
  const path = stepPicture(step), ext = path ? null : previewUrl(step);
  if (!path && !ext) return null;
  const im = h('img', { class: cls, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' });
  if (ext) im.src = ext; else { im.dataset.path = path; store.url(path, 'small').then(u => { if (u) im.src = u; else im.remove(); }); }
  return im;
}
function decidedNode(s, cls) {
  const n = s.lock_note || {};
  const pic = pictureEl(s);
  const el = h('div', { class: cls + ' decided' + (pic ? ' with-pic' : ''), dataset: { id: s.id }, role: 'button', tabindex: '0', onclick: (e) => { if (!e.target.closest('a')) openStep(s.id); }, onkeydown: (e) => { if (e.key === 'Enter') openStep(s.id); } },
    pic,
    h('span', { class: 'mnum final' }, h('span', { class: 'diamond' })),
    h('span', { class: 'mtxt' }, h('span', { class: 'mt' }, s.title),
      n.with ? h('span', { class: 'ms gold' }, n.with) : h('span', { class: 'ms' }, 'Final'),
      n.phone ? h('a', { class: 'ms tel', href: 'tel:' + n.phone.replace(/[^\d+]/g, '') }, '☏ ' + n.phone) : null),
    h('span', { class: 'mic', html: lockIcon(16) }));
  return el;
}

