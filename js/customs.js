// Family custom lists, Naga style: the invitation list and the meat list for each side of the family.
// The bride's side sends its invitation list to the groom's family, and both sides keep a meat list
// of the elders and relatives who receive a share — the pig head for the grandparents, legs for the uncles, and so on.
import { store } from './store.js?v=43';
import { h, toast } from './ui.js?v=43';
import { live, wedding } from './app.js?v=43';
import { openWhatsApp } from './nudge.js?v=43';

export const INVITE_COLS = ['Name', 'Relation', 'Village / town', 'Phone', 'Count', 'Card sent', 'Notes'];
export const MEAT_COLS = ['Name', 'Relation', 'Village / clan', 'Share', 'Weight (kg)', 'Given', 'Notes'];

// Suggestions offered while typing; anything else can still be typed in.
export const SUGGEST = {
  share: ['Pig head', 'Front leg', 'Hind leg', 'Ribs', 'Back (loin)', 'Belly', 'Meat portion'],
  relation: ['Grandmother', 'Grandfather', 'Paternal uncle', 'Maternal uncle', 'Aunt', 'Elder', 'Cousin', 'Village council', 'Church / pastor', 'Friend', 'Neighbour']
};
export const suggestFor = (col) => /^share$/i.test(col.trim()) ? 'share' : /^relation/i.test(col.trim()) ? 'relation' : null;

// Who is the bride and who is the groom in each couple.
const KNOWN = [{ re: /charani/i, bride: 'Charani', groom: 'Adahrii', ours: 'bride' }, { re: /elow/i, groom: 'Elow', bride: 'Maniziia', ours: 'groom' }];
export function sidesOf(w) {
  const k = KNOWN.find(x => x.re.test(w.couple || ''));
  if (k) return k;
  const [a, b] = String(w.couple || '').split('&').map(s => s.trim());
  return { bride: a || 'Bride', groom: b || 'Groom', ours: 'bride' };
}
const sideTitle = (kind, side, s) => `${kind === 'invite' ? 'Invitation list' : 'Meat list'} · ${side === 'bride' ? 'Bride' : 'Groom'}’s side (${s[side]})`;

// Which lists each wedding needs. Charani's family is the bride's side: it prepares both lists and sends them to the groom.
// For Elow & Maniziia both sides are listed.
export function customLists(w) {
  const s = sidesOf(w);
  const sides = s.ours === 'bride' ? ['bride'] : ['groom', 'bride'];
  const other = s.ours === 'bride' ? 'groom' : 'bride';
  const out = [];
  for (const side of sides) {
    out.push({ kind: 'invite', side, title: sideTitle('invite', side, s), columns: INVITE_COLS,
      blurb: side === 'bride' && s.ours === 'bride' ? `Everyone from ${s.bride}’s side to invite — send it to ${s.groom}’s family` : side === s.ours ? `Everyone from ${s[side]}’s side to invite` : `${s[side]}’s family’s list — fill it in from what they send` });
    out.push({ kind: 'meat', side, title: sideTitle('meat', side, s), columns: MEAT_COLS,
      blurb: side === s.ours ? `Elders and relatives on ${s[side]}’s side who receive meat, and which share` : `The meat list for ${s[side]}’s side` });
  }
  const extra = ['invite', 'meat'].map(kind => ({ kind, side: other, title: sideTitle(kind, other, s), columns: kind === 'invite' ? INVITE_COLS : MEAT_COLS, extra: true }))
    .filter(() => s.ours === 'bride');
  return { main: out, extra, sides: s };
}
export const isCustom = (l) => /^(Invitation list|Meat list) · (Bride|Groom)’s side/.test(l.title || '');
const kindOf = (l) => /^Meat list/.test(l.title) ? 'meat' : 'invite';

const sv = (p) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const INVITE_IC = sv('<rect x="3.5" y="6" width="17" height="12.5" rx="1.5"/><path d="M3.8 6.6l8.2 6.4 8.2-6.4"/><path d="M12 14.6c-1-.9-2-1.5-2-2.4a1 1 0 0 1 2-.4 1 1 0 0 1 2 .4c0 .9-1 1.5-2 2.4z"/>');
const MEAT_IC = sv('<path d="M14.5 4.5c3 0 5 2.2 5 5 0 3.6-3.4 6.2-7.2 6.2-1.3 0-2.3.4-3 1.1L7 19"/><path d="M14.5 4.5c-3.4 0-6 2.7-6 6 0 1.4.4 2.6.9 3.4"/><circle cx="5.6" cy="19.4" r="1.6"/><circle cx="4.3" cy="17.6" r="1.3"/><path d="M13.5 8.5c1.2 0 2.2.9 2.2 2"/>');

/* ---------- The section on the Lists page ---------- */
export function customsSection(w, lists, fail) {
  const { main, extra, sides } = customLists(w);
  const byTitle = new Map(lists.map(l => [l.title, l]));
  const start = async (spec) => {
    try { const l = await store.insert('lists', { wedding_id: w.id, step_id: null, title: spec.title, columns: spec.columns }); location.hash = `#/w/${w.id}/lists?list=${l.id}`; } catch (e) { fail(e); }
  };
  const tile = (spec) => {
    const l = byTitle.get(spec.title);
    const n = l ? live(store.rows('list_rows') || []).filter(r => r.list_id === l.id).length : 0;
    return h(l ? 'a' : 'button', { class: 'cust-tile ' + spec.kind + (l ? ' made' : ''), type: l ? null : 'button', href: l ? `#/w/${w.id}/lists?list=${l.id}` : null, onclick: l ? null : () => start(spec) },
      h('span', { class: 'cust-ic', 'aria-hidden': 'true', html: spec.kind === 'meat' ? MEAT_IC : INVITE_IC }),
      h('span', { class: 'cust-tx' }, h('b', {}, spec.kind === 'invite' ? 'Invitation list' : 'Meat list'),
        h('span', { class: 'cust-side' }, `${spec.side === 'bride' ? 'Bride' : 'Groom'}’s side · ${sides[spec.side]}`),
        h('span', { class: 'cust-b' }, l ? `${n} ${n === 1 ? 'name' : 'names'} so far` : spec.blurb)),
      h('span', { class: 'cust-go' }, l ? 'Open →' : '+ Start'));
  };
  const missingExtra = extra.filter(x => !byTitle.has(x.title));
  return h('section', { class: 'dsec customs' },
    h('div', { class: 'dsec-h' }, h('h2', {}, 'Invitations & meat')),
    h('p', { class: 'hint', style: { marginTop: 0 } }, sides.ours === 'bride'
      ? `${sides.bride}’s side prepares these and sends them to ${sides.groom}’s family. Each list has a WhatsApp button that sends it as a message.`
      : `One invitation list and one meat list for each side. Fill in ${sides.bride}’s side from the list her family sends.`),
    h('div', { class: 'cust-grid' }, main.concat(extra.filter(x => byTitle.has(x.title))).map(tile)),
    missingExtra.length ? h('div', { class: 'lchips', style: { marginTop: '10px' } }, missingExtra.map(x => h('button', { type: 'button', class: 'lchip', onclick: () => start(x) }, `+ ${x.kind === 'invite' ? 'Invitation' : 'Meat'} list for ${sides[x.side]}’s side too`))) : null);
}

/* ---------- Sending a list ---------- */
const isTickCol = (c) => /^(confirmed|bought|packed|sent|card sent|ready|done|paid|given|booked|arranged|rsvp|yes\/no|delivered|collected)$/i.test(c.trim());
const rowsOfList = (l) => live(store.rows('list_rows') || []).filter(r => r.list_id === l.id).sort((a, b) => (a.position || 0) - (b.position || 0));
const filled = (r) => (r.cells || []).some(v => String(v || '').trim());

export function shareTally(l) {
  const i = (l.columns || []).findIndex(c => /^share$/i.test(c.trim()));
  if (i < 0) return [];
  const m = new Map();
  for (const r of rowsOfList(l)) { const v = String((r.cells || [])[i] || '').trim(); if (v) m.set(v, (m.get(v) || 0) + 1); }
  return [...m].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${n} × ${k}`);
}

// The list as a WhatsApp message. Phone numbers and tick boxes stay out of it.
export function listMessage(l) {
  const w = wedding(l.wedding_id), cols = l.columns || [];
  const keep = cols.map((c, i) => [c, i]).filter(([c]) => !isTickCol(c) && !/^phone/i.test(c.trim()));
  const nameI = cols.findIndex(c => /^name$/i.test(c.trim())), countI = cols.findIndex(c => /^count$/i.test(c.trim()));
  const rows = rowsOfList(l).filter(filled);
  const lines = rows.map((r, k) => {
    const c = r.cells || [];
    const name = nameI >= 0 ? String(c[nameI] || '').trim() : '';
    const rest = keep.filter(([, i]) => i !== nameI && i !== countI).map(([col, i]) => { const v = String(c[i] || '').trim(); return v ? (/kg/i.test(col) ? v + ' kg' : v) : ''; }).filter(Boolean);
    const cnt = countI >= 0 && String(c[countI] || '').trim() ? ` (${String(c[countI]).trim()})` : '';
    return `${k + 1}. ${name || '—'}${cnt}${rest.length ? ' — ' + rest.join(', ') : ''}`;
  });
  const total = countI >= 0 ? rows.reduce((s, r) => s + (parseFloat(String((r.cells || [])[countI] || '').replace(/[^\d.]/g, '')) || 0), 0) : 0;
  const kgI = cols.findIndex(c => /kg|weight/i.test(c));
  const kg = kgI >= 0 ? rows.reduce((s, r) => s + (parseFloat(String((r.cells || [])[kgI] || '').replace(/[^\d.]/g, '')) || 0), 0) : 0;
  const tally = shareTally(l);
  return [`*${l.title}*`, w ? `${w.couple}’s wedding` : '', '', ...lines, '',
    total ? `Total: ${total} people` : `Total: ${rows.length} ${rows.length === 1 ? 'name' : 'names'}`,
    tally.length ? `Shares: ${tally.join(', ')}` : '',
    kg ? `Meat in all: ${kg} kg` : '',
    store.me && store.me.name ? `\n— ${store.me.name}` : ''].filter((x, i, a) => x !== '' || (a[i - 1] !== '' && i > 0)).join('\n').trim();
}
export function sendList(l) {
  const rows = rowsOfList(l).filter(filled);
  if (!rows.length) { toast('Add some names first'); return; }
  openWhatsApp('', listMessage(l));
}

// A clean white page of the list, for printing or saving as a PDF.
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function printList(l) {
  const w = wedding(l.wedding_id), cols = l.columns || [];
  const rows = rowsOfList(l).filter(filled);
  const tally = shareTally(l);
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(l.title)}</title>
<style>body{font:14px/1.45 'Jost',Arial,sans-serif;color:#1d1d1d;margin:28px;background:#fff}h1{font:600 24px Georgia,serif;margin:0 0 2px}p{margin:0 0 16px;color:#555}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:6px 8px;text-align:left;vertical-align:top}th{background:#f1ece2;font-weight:600}td.n{width:28px;color:#777}
.t{margin-top:12px;color:#333}@media print{body{margin:12mm}}</style></head><body>
<h1>${esc(l.title)}</h1><p>${esc(w ? w.couple + '’s wedding' : '')} · ${rows.length} ${rows.length === 1 ? 'name' : 'names'}</p>
<table><thead><tr><th>#</th>${cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>
${rows.map((r, k) => `<tr><td class="n">${k + 1}</td>${cols.map((c, i) => `<td>${isTickCol(c) ? (/^(y|yes|✓|true|1|done|x)$/i.test(String((r.cells || [])[i] || '').trim()) ? '✓' : '') : esc((r.cells || [])[i])}</td>`).join('')}</tr>`).join('')}
</tbody></table>${tally.length ? `<p class="t">Shares: ${esc(tally.join(', '))}</p>` : ''}
<script>setTimeout(function(){window.print()},300)<\/script></body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  const win = window.open(url, '_blank');
  if (!win) { // pop-ups blocked: print from a hidden frame instead
    const f = h('iframe', { style: { position: 'fixed', width: '0', height: '0', border: '0' }, src: url });
    document.body.append(f); setTimeout(() => f.remove(), 60000);
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export { kindOf };
