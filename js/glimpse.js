// Glimpse: the whole wedding at a glance, Instagram style.
// A grid of every choice (flower girls' dresses, boutonnieres, cards …) in plan order — the final design or the
// chosen one as its picture, otherwise the option in the lead. Tap one to open it full screen and go through
// them one after another, like stories: what was chosen, the alternatives that were considered and their votes,
// and whether it can still change.
import { store } from './store.js?v=49';
import { h, ICONS, shortDate, toast, buzz } from './ui.js?v=49';
import { isDecider } from './tools.js?v=49';
import { render } from './app.js?v=49';
import { categoriesOf, optionsOf, votesOf, myVote, finalOf, chosenOf, openProfile, chooseOption, lightbox, photoEl, firstPic, placeholder, swipeAgain, roundsOf, addFinal, editOption, vote } from './swipe.js?v=49';

const FILTERS = [['all', 'Everything'], ['decided', 'Decided'], ['open', 'Still open'], ['empty', 'No options yet']];
let filter = 'all';

// Where a category stands, and the picture that stands for it.
function stateOf(w, c) {
  const opts = optionsOf(w.id, c.step.id);
  const fin = finalOf(c.step), ch = chosenOf(c.step);
  const ranked = opts.filter(o => (o.data || {}).status !== 'not' && (o.data || {}).status !== 'chosen').sort((a, b) => votesOf(b).score - votesOf(a).score);
  const lead = ranked[0] && votesOf(ranked[0]).total ? ranked[0] : null;
  const decided = !!c.step.locked_at || !!ch;
  const votes = opts.reduce((n, o) => n + votesOf(o).total, 0);
  let cover = null, badge = '', kind = 'empty';
  if (fin.latest) { const v = fin.latest; cover = (v.images || [])[0] ? v.images[0].path : ((v.docs || []).find(x => x.thumb) || {}).thumb; badge = 'Final design'; kind = 'decided'; }
  if (!cover && ch) { cover = firstPic(ch); badge = fin.latest ? 'Final design' : 'Chosen'; kind = 'decided'; }
  if (!cover && decided) { badge = 'Final'; kind = 'decided'; }
  if (!decided && opts.length) { kind = 'open'; const show = lead || opts[0]; cover = firstPic(show); badge = lead ? `Leading · ${votes} ${votes === 1 ? 'vote' : 'votes'}` : `${opts.length} ${opts.length === 1 ? 'option' : 'options'}`; }
  return { opts, fin, ch, lead, decided, kind, cover, badge, votes };
}

export function renderGlimpse(root, w) {
  const cats = categoriesOf(w);
  const all = cats.map(c => ({ c, st: stateOf(w, c) }));
  const counts = { all: all.length, decided: all.filter(x => x.st.kind === 'decided').length, open: all.filter(x => x.st.kind === 'open').length, empty: all.filter(x => x.st.kind === 'empty').length };
  const shown = all.filter(x => filter === 'all' || x.st.kind === filter);
  root.append(
    h('div', { class: 'gl-intro' }, h('p', {}, counts.all ? `${counts.decided} decided · ${counts.open} still open${counts.empty ? ` · ${counts.empty} with no options yet` : ''}. Tap any one to go through them like stories.` : 'Nothing here yet. Every big decision in the plan — and anything with options — appears here with its picture.')),
    counts.all ? h('div', { class: 'gl-filters', role: 'tablist' }, FILTERS.filter(([k]) => k === 'all' || counts[k]).map(([k, l]) => h('button', { type: 'button', class: 'lchip' + (filter === k ? ' on' : ''), 'aria-pressed': String(filter === k), onclick: () => { filter = k; render(); } }, `${l} · ${counts[k]}`))) : null,
    shown.length ? h('div', { class: 'ig-grid' }, shown.map((x, i) => h('button', { type: 'button', class: 'ig-tile ' + x.st.kind, 'aria-label': x.c.step.title, onclick: () => openStories(w, shown.map(y => y.c), i) },
      x.st.cover ? photoEl(x.st.cover, 'ig-img') : h('span', { class: 'ig-ph' }, x.c.step.title.split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase()),
      h('span', { class: 'ig-badge ' + x.st.kind }, x.st.badge || 'No options yet'),
      h('span', { class: 'ig-name' }, x.c.step.title)))) : counts.all ? h('p', { class: 'muted' }, 'Nothing with this filter.') : null);
}

/* ---------- Stories ---------- */
export function openStories(w, cats, start = 0) {
  document.querySelectorAll('.st-wrap').forEach(x => x.remove());
  let i = start;
  const wrap = h('div', { class: 'st-wrap', role: 'dialog', 'aria-label': 'Glimpse' });
  let waitT = 0;
  const redraw = () => { clearTimeout(waitT); if (!wrap.isConnected) return; if (document.querySelector('.pf-wrap, .modal-wrap')) { waitT = setTimeout(redraw, 350); return; } draw(); };
  const off = store.onChange(redraw);
  const close = () => { off(); document.removeEventListener('keydown', key, true); wrap.classList.add('out'); setTimeout(() => wrap.remove(), 180); };
  const go = (d) => { const n = i + d; if (n < 0) return; if (n >= cats.length) { close(); return; } i = n; buzz(6); draw(); };
  const key = (e) => { if (document.querySelector('.pf-wrap, .modal-wrap, .lightbox')) return; if (e.key === 'Escape') close(); if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); };
  document.addEventListener('keydown', key, true);

  function draw() {
    const c = cats[i]; const step = store.find('steps', c.step.id) || c.step;
    const st = stateOf(w, { ...c, step });
    const decider = isDecider(w.id);
    const fin = st.fin.latest;
    const heroPics = fin ? [...(fin.images || []).map(x => x.path), ...(fin.docs || []).filter(x => x.thumb).map(x => x.thumb)] : st.ch ? (st.ch.data.images || []).map(x => x.path) : (st.lead || st.opts[0]) ? (((st.lead || st.opts[0]).data || {}).images || []).map(x => x.path) : [];
    const heroOpt = st.ch || st.lead || st.opts[0] || null;
    const others = st.opts.filter(o => o !== st.ch).sort((a, b) => votesOf(b).score - votesOf(a).score);
    const rounds = roundsOf(step);
    const altCard = (o) => {
      const d = o.data || {}; const v = votesOf(o); const mine = myVote(o);
      return h('div', { class: 'st-alt' + (d.status === 'not' ? ' not' : '') },
        h('button', { type: 'button', class: 'st-alt-pic', onclick: () => openProfile(o, (val) => vote(o, val)), 'aria-label': 'Open ' + (d.title || 'option') }, firstPic(o) ? photoEl(firstPic(o), '') : placeholder(o, 'st-alt-ph')),
        h('b', {}, d.title || 'Option'),
        h('span', { class: 'st-alt-v' }, v.total ? `♥ ${v.love.length} · ✕ ${v.no.length}` : 'No votes', mine ? ` · you: ${mine === 'love' ? '♥' : '✕'}` : ''),
        decider && (st.decided ? store.me.isAdmin : true) && d.status !== 'chosen' ? h('button', { type: 'button', class: 'btn small ghost', onclick: async () => {
          if (step.locked_at) { toast('Start a new round first (↻ New round), then choose this one', 'error'); return; }
          await chooseOption(o);
        } }, st.decided ? 'Change to this' : 'Make it final') : null);
    };
    wrap.replaceChildren(
      h('div', { class: 'st-bars' }, cats.map((_, k) => h('span', { class: k < i ? 'seen' : k === i ? 'on' : '' }))),
      h('div', { class: 'st-top' },
        h('span', { class: 'st-pos' }, `${i + 1} of ${cats.length}`),
        h('button', { type: 'button', class: 'st-x', 'aria-label': 'Close', html: ICONS.close, onclick: close })),
      h('div', { class: 'st-scroll' },
        h('div', { class: 'st-hero', onclick: (e) => { if (heroPics.length && !e.target.closest('button')) lightbox(heroPics, 0); } },
          heroPics[0] ? photoEl(heroPics[0], 'sw-img', step.title) : heroOpt ? placeholder(heroOpt, 'sw-img') : h('div', { class: 'sw-img ph' }, h('span', {}, 'No options yet')),
          h('div', { class: 'st-hero-tx' },
            h('span', { class: 'st-kicker' }, [c.stage && c.stage.title, c.area && c.area.title].filter(Boolean).join(' · ')),
            h('h2', {}, step.title),
            h('span', { class: 'ig-badge ' + st.kind }, st.badge || 'No options yet'))),
        h('div', { class: 'st-body' },
          st.ch ? h('p', { class: 'st-line' }, h('b', {}, 'Chosen: '), (st.ch.data || {}).title || 'Option', fin ? h('span', { class: 'muted' }, ` — final design${st.fin.versions.length > 1 ? ' v' + st.fin.versions.length : ''} by ${fin.by || 'someone'}, ${shortDate(fin.at.slice(0, 10))}`) : h('span', { class: 'muted' }, ' — sample; final design to come')) :
            st.lead ? h('p', { class: 'st-line' }, h('b', {}, 'In the lead: '), (st.lead.data || {}).title || 'Option', ` (♥ ${votesOf(st.lead).love.length})`) :
            st.opts.length ? h('p', { class: 'st-line muted' }, 'No votes yet.') : h('p', { class: 'st-line muted' }, 'No options yet — add a few so the family can swipe.'),
          step.owner ? h('p', { class: 'st-line' }, h('b', {}, 'In charge: '), step.owner) : null,
          h('p', { class: 'st-line muted' }, step.locked_at ? (store.me.isAdmin ? 'Final. You can start a new round if it needs to change.' : 'Final. Only the admin can reopen it.') : st.decided ? 'Chosen — a Decider can still change it.' : decider ? 'Still open — you can choose when the family has voted.' : 'Still open — vote on the options below.'),
          rounds.length ? h('p', { class: 'st-line muted' }, rounds.map((r, k) => `Round ${k + 1}: ${r.chosen ? r.chosen.title : 'no choice'} (${shortDate(r.at.slice(0, 10))})`).join(' · ')) : null,
          others.length ? [h('h3', { class: 'st-h' }, st.ch ? 'The other options considered' : 'The options'), h('div', { class: 'st-alts' }, others.map(altCard))] : null,
          h('div', { class: 'st-acts' },
            st.ch && !fin ? h('button', { type: 'button', class: 'btn', onclick: () => addFinal(st.ch) }, '+ Add the final design') : null,
            st.ch && fin ? h('button', { type: 'button', class: 'btn ghost small', onclick: () => addFinal(st.ch) }, '+ A newer version') : null,
            !st.decided ? h('button', { type: 'button', class: 'btn ghost small', onclick: () => { close(); editOption(w, step.id); } }, '+ Add an option') : null,
            st.opts.length && (!step.locked_at || store.me.isAdmin) ? h('button', { type: 'button', class: 'btn ghost small', onclick: () => { close(); swipeAgain(w, step); } }, step.locked_at ? '↻ New round' : '↻ Swipe these') : null,
            h('a', { class: 'btn ghost small', href: `#/w/${w.id}/options?step=${step.id}`, onclick: () => close() }, 'Open the category')))),
      h('button', { type: 'button', class: 'st-nav prev', 'aria-label': 'Previous', disabled: i === 0 ? true : null, onclick: () => go(-1) }, '‹'),
      h('button', { type: 'button', class: 'st-nav next', 'aria-label': i === cats.length - 1 ? 'Finish' : 'Next', onclick: () => go(1) }, i === cats.length - 1 ? '✓' : '›'));
  }
  // Swipe sideways to move between categories (up and down scrolls the story).
  let sx = 0, sy = 0, on = false, horiz = null;
  wrap.addEventListener('pointerdown', (e) => { if (e.target.closest('button, a, .st-alts')) return; on = true; horiz = null; sx = e.clientX; sy = e.clientY; });
  wrap.addEventListener('pointermove', (e) => { if (!on || horiz !== null) return; const mx = e.clientX - sx, my = e.clientY - sy; if (Math.hypot(mx, my) > 12) horiz = Math.abs(mx) > Math.abs(my) * 1.3; });
  wrap.addEventListener('pointerup', (e) => { if (!on) return; on = false; const mx = e.clientX - sx; if (horiz && Math.abs(mx) > 50) go(mx < 0 ? 1 : -1); });
  draw();
  document.body.append(wrap);
  requestAnimationFrame(() => wrap.classList.add('in'));
}
