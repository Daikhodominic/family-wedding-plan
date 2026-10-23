// Progress tracking and the Map view of a wedding's pipeline.
import { store } from './store.js?v=38';
import { h, shortDate, daysUntil, ICONS } from './ui.js?v=38';
import { openStep, lockIcon } from './panel.js?v=38';
import { stepPicture, previewUrl } from './decisions.js?v=38';
import { addStepAt, addAreaTo, addStageTo, removeArea } from './addhere.js?v=38';

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

// The map: stages left to right, areas as columns of numbered nodes, joined by lines.
export function renderMap(root, w, plan, params) {
  const map = h('div', { class: 'pmap' });
  const inner = h('div', { class: 'pmap-inner' });
  map.append(inner);
  const gap = (a, s) => h('button', { type: 'button', class: 'mgap', title: s ? `Add a step after “${s.title}”` : 'Add a step', 'aria-label': s ? `Add a step after ${s.title}` : `Add a step to ${a.title}`, onclick: (e) => { e.stopPropagation(); addStepAt(a.id, s); } }, h('span', {}, '+'));
  for (const st of plan.stages) {
    inner.append(h('section', { class: 'mstage' },
      h('div', { class: 'mstage-h' }, h('span', { class: 'ft-sub' }, 'Stage'), h('h3', {}, st.title)),
      h('div', { class: 'mareas' }, st.areas.map(a => h('div', { class: 'marea ' + a.state, dataset: { area: a.id } },
        h('div', { class: 'marea-h' + (plan.here === a.id ? ' here' : '') }, h('b', {}, a.title), h('span', { class: 'ft-sub' }, `${a.complete}/${a.steps.length}`), plan.here === a.id ? h('span', { class: 'here-tag' }, 'You are here') : null,
          h('button', { type: 'button', class: 'marea-x', title: `Remove ${a.title}`, 'aria-label': `Remove the area ${a.title}`, html: ICONS.trash, onclick: () => removeArea(a) })),
        h('div', { class: 'mnodes' }, a.steps.flatMap((s, i) => i < a.steps.length - 1 ? [nodeEl(s), gap(a, s)] : [nodeEl(s)]),
          h('button', { type: 'button', class: 'madd', onclick: () => addStepAt(a.id, null) }, '+ Add a step')))),
        h('button', { type: 'button', class: 'madd area', onclick: () => addAreaTo(st) }, '+ Add an area'))));
  }
  inner.append(h('section', { class: 'mstage add' }, h('button', { type: 'button', class: 'madd stage', onclick: () => addStageTo(w.id) }, '+ Add a stage')));
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
      for (let k = 0; k < ns.length - 1; k++) {
        const a = ns[k].getBoundingClientRect(), b = ns[k + 1].getBoundingClientRect();
        const x = a.left - box.left + 22;
        paths.push(`<path d="M${x} ${a.bottom - box.top} L${x} ${b.top - box.top}" class="${ns[k].classList.contains('complete') ? 'done' : ''}"/>`);
      }
      const next = areas[i + 1];
      if (ns.length && next) {
        const nn = next.querySelector('.mnode');
        if (nn) {
          const [x1, y1] = pt(ns[ns.length - 1], 'out'), [x2, y2] = pt(nn, 'in');
          const mx = (x1 + x2) / 2;
          paths.push(`<path d="M${x1} ${y1} C${mx} ${y1}, ${mx} ${y2}, ${x2 - 6} ${y2}" class="${ar.classList.contains('done') || ar.classList.contains('locked') ? 'done' : ''}" marker-end="url(#ah)"/>`);
        }
      }
    });
    svg.innerHTML = `<defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="ahead"/></marker></defs>` + paths.join('');
    void nodes;
  };
  requestAnimationFrame(() => requestAnimationFrame(drawLines));
  if (window.ResizeObserver) new ResizeObserver(() => drawLines()).observe(inner);

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
    h('span', { class: 'mnum' }, String(s.n)),
    h('span', { class: 'mtxt' }, h('span', { class: 'mt' }, s.title), sub ? h('span', { class: 'ms' + (late ? ' late' : '') }, sub) : null),
    s.locked_at ? h('span', { class: 'mic', html: lockIcon(16) }) : isComplete(s) ? h('span', { class: 'mic', html: ICONS.check }) : s.gate ? h('span', { class: 'mic gate-ic', title: 'Big decision' }, '◆') : s.status === 'doing' ? h('span', { class: 'pulse' }) : null);
}

// A final step on the map shows what was chosen: its picture, who it's with, and a number to call.
export function pictureEl(step, cls = 'dn-pic') {
  const path = stepPicture(step), ext = path ? null : previewUrl(step);
  if (!path && !ext) return null;
  const im = h('img', { class: cls, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' });
  if (ext) im.src = ext; else store.url(path).then(u => { if (u) im.src = u; else im.remove(); });
  return im;
}
function decidedNode(s, cls) {
  const n = s.lock_note || {};
  const pic = pictureEl(s);
  const el = h('div', { class: cls + ' decided' + (pic ? ' with-pic' : ''), dataset: { id: s.id }, role: 'button', tabindex: '0', onclick: (e) => { if (!e.target.closest('a')) openStep(s.id); }, onkeydown: (e) => { if (e.key === 'Enter') openStep(s.id); } },
    pic,
    h('span', { class: 'mnum' }, String(s.n)),
    h('span', { class: 'mtxt' }, h('span', { class: 'mt' }, s.title),
      n.with ? h('span', { class: 'ms gold' }, n.with) : h('span', { class: 'ms' }, 'Final'),
      n.phone ? h('a', { class: 'ms tel', href: 'tel:' + n.phone.replace(/[^\d+]/g, '') }, '☏ ' + n.phone) : null),
    h('span', { class: 'mic', html: lockIcon(16) }));
  return el;
}

