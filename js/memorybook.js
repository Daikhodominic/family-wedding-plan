// A memory book of one wedding: everything that was decided (with its picture), favourite ideas
// from the mood board, the numbers, who did what, and the announcements — as a page to print or save as a PDF.
import { store } from './store.js?v=52';
import { toast } from './ui.js?v=52';
import { planOf } from './map.js?v=52';
import { stepPicture } from './decisions.js?v=52';
import { favScore } from './boardauto.js?v=52';
import { samePerson } from './tools.js?v=52';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const live = (t) => (store.rows(t) || []).filter(r => !r.deleted_at);
const long = (d) => d ? new Date(d + (String(d).length === 10 ? 'T00:00' : '')).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
const inr = (n) => n ? '₹' + Number(String(n).replace(/[^\d.]/g, '') || 0).toLocaleString('en-IN') : '';

// Pictures go into the book itself, so the PDF keeps them.
async function dataUrl(path) {
  try {
    const u = /^(https?:|data:|blob:|assets\/)/.test(path) ? path : await store.url(path, 'small'); if (!u) return '';
    const b = await (await fetch(u)).blob();
    return await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(''); r.readAsDataURL(b); });
  } catch (e) { return ''; }
}

export async function memoryBook(w) {
  toast('Putting the memory book together…');
  const plan = planOf(w);
  const steps = plan.stages.flatMap(st => st.areas.flatMap(a => a.steps.map(s => ({ s, a, st }))));
  const finals = steps.filter(x => x.s.locked_at);
  const pics = await Promise.all(finals.map(x => { const p = stepPicture(x.s); return p ? dataUrl(p) : ''; }));
  const board = live('board_items').filter(i => i.wedding_id === w.id && ['image', 'gallery'].includes(i.kind));
  const favs = board.map(i => ({ i, f: favScore(i) })).filter(x => x.f > 0).sort((a, b) => b.f - a.f).slice(0, 9);
  const favPics = await Promise.all(favs.map(x => { const d = x.i.data || {}; const p = d.path || (d.images && d.images[0] && d.images[0].path) || d.thumb; return p ? dataUrl(p) : ''; }));
  const options = live('board_items').filter(i => i.wedding_id === w.id && i.kind === 'option');
  const ids = new Set(live('board_items').filter(i => i.wedding_id === w.id).map(i => i.id));
  const votes = (store.rows('reactions') || []).filter(r => ids.has(r.item_id) && ['love', 'no', 'maybe'].includes(r.value)).length;
  const comments = live('comments').filter(c => c.wedding_id === w.id).length;
  const done = steps.filter(x => x.s.status === 'done' || x.s.locked_at).length;
  const todos = live('todos').filter(t => t.wedding_id === w.id);
  // Who did what: finished steps and to-dos per person in charge.
  const people = new Map();
  for (const t of [...steps.map(x => x.s), ...todos]) if ((t.status === 'done' || t.locked_at) && (t.owner || '').trim()) {
    const k = [...people.keys()].find(n => samePerson(n, t.owner)) || t.owner.trim();
    people.set(k, (people.get(k) || 0) + 1);
  }
  const anns = live('announcements').filter(a => !a.wedding_id || a.wedding_id === w.id).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const acts = (store.rows('activity') || []).filter(a => a.wedding_id === w.id);
  const firstDay = acts.length ? acts[acts.length - 1].created_at.slice(0, 10) : null;
  const paid = live('budget_items').filter(i => i.budget_id === w.id).filter(i => i.paid_at).reduce((t, i) => t + (Number(i.amount) || 0), 0);

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(w.couple)} — memory book</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Jost:wght@400;500&family=Pinyon+Script&display=swap" rel="stylesheet">
<style>
@page{size:A4;margin:14mm}
body{font:13.5px/1.5 'Jost',Arial,sans-serif;color:#2a2523;margin:0;background:#fff}
.page{padding:28px 34px;page-break-after:always}
.cover{min-height:92vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;border:1px solid #d8c7a0;outline:6px double #e9dcc0;outline-offset:-14px}
.mono{font:64px 'Pinyon Script',cursive;color:#9c7a3c;margin:0}
h1{font:500 46px 'Cormorant Garamond',Georgia,serif;margin:6px 0}
h2{font:500 30px 'Cormorant Garamond',Georgia,serif;margin:0 0 4px;border-bottom:1px solid #e6dcc6;padding-bottom:6px}
.sub{color:#7b6f66;letter-spacing:.14em;text-transform:uppercase;font-size:12px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:14px}
.tile{break-inside:avoid;border:1px solid #ece3d3;border-radius:10px;overflow:hidden;background:#fffdf8}
.tile img{width:100%;aspect-ratio:4/3;object-fit:cover;display:block;background:#f3eee4}
.tile .ph{aspect-ratio:4/3;display:grid;place-items:center;background:#f6f0e4;color:#b59b67;font:600 28px 'Cormorant Garamond',serif}
.tile .tx{padding:8px 10px}.tile b{display:block;font-weight:500}.tile small{color:#7b6f66;display:block}
.nums{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:16px 0}
.num{border:1px solid #ece3d3;border-radius:10px;padding:12px;text-align:center}.num b{display:block;font:500 32px 'Cormorant Garamond',serif;color:#9c7a3c}
ul{padding-left:18px}li{margin:3px 0}
.favs{grid-template-columns:repeat(3,1fr)}.favs img{aspect-ratio:1}
@media print{.page{padding:0}}
</style></head><body>
<section class="page cover">
  <p class="mono">${esc(w.monogram || '')}</p>
  <h1>${esc(w.couple)}</h1>
  <p class="sub">${esc(w.wedding_date ? long(w.wedding_date) : (w.date_note || ''))}</p>
  <p style="margin-top:40px;color:#7b6f66">How the family planned it, together${firstDay ? ` · from ${esc(long(firstDay))}` : ''}</p>
</section>
<section class="page">
  <h2>In numbers</h2>
  <div class="nums">
    <div class="num"><b>${done}</b>steps done</div><div class="num"><b>${finals.length}</b>made final</div>
    <div class="num"><b>${options.length}</b>options considered</div><div class="num"><b>${votes}</b>votes cast</div>
    <div class="num"><b>${comments}</b>comments</div><div class="num"><b>${todos.filter(t => t.status === 'done').length}</b>to-dos ticked</div>
    <div class="num"><b>${(store.rows('members') || []).length}</b>in the family group</div>${paid ? `<div class="num"><b>${esc(inr(paid))}</b>paid</div>` : '<div class="num"><b>' + plan.stages.length + '</b>stages</div>'}
  </div>
  ${people.size ? `<h2>Who did what</h2><ul>${[...people.entries()].sort((a, b) => b[1] - a[1]).map(([n, c]) => `<li><b>${esc(n)}</b> — ${c} ${c === 1 ? 'job' : 'jobs'} done</li>`).join('')}</ul>` : ''}
  ${anns.length ? `<h2 style="margin-top:22px">What was announced</h2><ul>${anns.map(a => `<li>${esc(a.body)} <small style="color:#7b6f66">— ${esc(a.author_name || '')}, ${esc(long(a.created_at.slice(0, 10)))}</small></li>`).join('')}</ul>` : ''}
</section>
<section class="page">
  <h2>What we chose</h2>
  ${finals.length ? `<div class="grid">${finals.map((x, i) => { const n = x.s.lock_note || {}; const who = n.with || n.vendor || '';
    return `<div class="tile">${pics[i] ? `<img src="${pics[i]}" alt="">` : `<div class="ph">✓</div>`}<div class="tx"><b>${esc(x.s.title)}</b><small>${esc([x.a.title, who, n.amount ? inr(n.amount) : ''].filter(Boolean).join(' · '))}</small></div></div>`; }).join('')}</div>` : '<p>Nothing has been made final yet.</p>'}
</section>
${favs.length ? `<section class="page"><h2>Favourite ideas</h2><div class="grid favs">${favs.map((x, i) => { const d = x.i.data || {}; return `<div class="tile">${favPics[i] ? `<img src="${favPics[i]}" alt="">` : '<div class="ph">♥</div>'}<div class="tx"><b>${esc(d.title || d.caption || '')}</b></div></div>`; }).join('')}</div></section>` : ''}
<script>window.onload=function(){setTimeout(function(){window.print()},600)}<\/script></body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  const win = window.open(url, '_blank');
  if (!win) { const a = document.createElement('a'); a.href = url; a.download = `${(w.couple || 'wedding').replace(/[^\w]+/g, '-')}-memory-book.html`; document.body.append(a); a.click(); a.remove(); toast('Saved the memory book — open it and choose Print → Save as PDF'); }
  return html;
}
