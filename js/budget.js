// Budgets: one per wedding plus "Shared home costs", and a family total.
// Everything is worked out live from three tables, so a change anywhere shows everywhere.
//   total        — set by hand
//   contingency  — set by hand (starts at ₹0); unplanned payments and overspends draw from it
//   areas        — the total split up; removing one frees its unspent money
//   payments     — what is owed or paid; no area = unplanned (comes out of contingency)
import { store } from './store.js?v=18';
import { h, toast, modal, field, confirmBox, shortDate, daysUntil, secHead, ICONS } from './ui.js?v=18';
import { live, weddings, themeOf, stepVisible } from './app.js?v=18';
import { openStep } from './panel.js?v=18';
import { deciderOnly, isDecider, deciderNames } from './tools.js?v=18';

/* ---------- Money helpers ---------- */
// Accepts "1,20,000", "120000", "1.2 lakh", "1.2L", "50k", "₹ 45,000".
export function money(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const s = String(v || '').toLowerCase().replace(/[₹,\s]/g, '');
  const m = /^(-?[0-9]*\.?[0-9]+)(l|lakh|lakhs|lac|k|cr|crore)?$/.exec(s);
  if (!m) { const n = parseFloat(s.replace(/[^0-9.]/g, '')); return isFinite(n) ? n : 0; }
  const n = parseFloat(m[1]);
  const mult = { l: 1e5, lakh: 1e5, lakhs: 1e5, lac: 1e5, k: 1e3, cr: 1e7, crore: 1e7 }[m[2]] || 1;
  return n * mult;
}
export const inr = (n) => (n < 0 ? '−' : '') + '₹' + Math.round(Math.abs(n)).toLocaleString('en-IN');
const byPos = (a, b) => (a.position || 0) - (b.position || 0);
function fail(e) { console.error(e); toast(e.message || 'That did not save. Check your connection.', 'error'); }
const missing = () => store.missing && (store.missing.budgets || store.missing.budget_areas || store.missing.budget_items);

/* ---------- The maths ---------- */
export function budgetMath(id) {
  const b = (store.rows('budgets') || []).find(x => x.id === id && !x.deleted_at) || null;
  const areasAll = (store.rows('budget_areas') || []).filter(a => a.budget_id === id);
  const liveAreas = areasAll.filter(a => !a.deleted_at).sort(byPos);
  const removedAreas = areasAll.filter(a => a.deleted_at);
  const items = live(store.rows('budget_items') || []).filter(i => i.budget_id === id);
  const T = b ? Number(b.total) || 0 : 0, C = b ? Number(b.contingency) || 0 : 0;

  const areaRows = liveAreas.map(a => {
    const its = items.filter(i => i.area_id === a.id);
    const committed = its.reduce((t, i) => t + Number(i.amount || 0), 0);
    const paid = its.filter(i => i.paid_at).reduce((t, i) => t + Number(i.amount || 0), 0);
    const planned = Number(a.planned) || 0;
    return { area: a, items: its, planned, committed, paid, toPay: committed - paid, over: Math.max(0, committed - planned), left: Math.max(0, planned - committed) };
  });
  const isLiveArea = (i) => i.area_id && liveAreas.some(a => a.id === i.area_id);
  const isRemovedArea = (i) => i.area_id && removedAreas.some(a => a.id === i.area_id);
  const unplanned = items.filter(i => !isLiveArea(i) && !isRemovedArea(i));
  const removedItems = items.filter(isRemovedArea);
  const removedPaid = removedItems.filter(i => i.paid_at);
  const cancelled = removedItems.filter(i => !i.paid_at);

  // Locked decisions with an amount that nobody has added to the budget yet.
  const linked = new Set(items.map(i => i.step_id).filter(Boolean));
  const fromLocks = b && b.wedding_id ? live(store.rows('steps')).filter(s => s.wedding_id === b.wedding_id && s.locked_at && stepVisible(s) && !linked.has(s.id))
    .map(s => ({ step: s, amount: money(s.lock_note && s.lock_note.amount), advance: money(s.lock_note && s.lock_note.advance) })).filter(x => x.amount > 0) : [];

  const sum = (arr, f) => arr.reduce((t, x) => t + f(x), 0);
  const allocated = sum(areaRows, r => r.planned);
  const removedPaidTotal = sum(removedPaid, i => Number(i.amount || 0));
  const unplannedTotal = sum(unplanned, i => Number(i.amount || 0)) + sum(fromLocks, x => x.amount);
  const overruns = sum(areaRows, r => r.over);
  const contUsed = overruns + unplannedTotal;
  const committed = sum(areaRows, r => r.committed) + sum(unplanned, i => Number(i.amount || 0)) + removedPaidTotal + sum(fromLocks, x => x.amount);
  const paid = sum(areaRows, r => r.paid) + sum(unplanned.filter(i => i.paid_at), i => Number(i.amount || 0)) + removedPaidTotal + sum(fromLocks, x => Math.min(x.advance, x.amount));
  const owing = [...areaRows.flatMap(r => r.items), ...unplanned].filter(i => !i.paid_at);
  return {
    b, T, C, areaRows, removedAreas, unplanned, removedPaid, cancelled, fromLocks,
    allocated, removedPaidTotal, free: T - C - allocated - removedPaidTotal,
    overruns, unplannedTotal, contUsed, contLeft: C - contUsed,
    committed, paid, toPay: committed - paid, overTotal: Math.max(0, committed - T),
    owing: owing.sort((a, b2) => (a.due || '9999').localeCompare(b2.due || '9999')),
    lockOwing: fromLocks.filter(x => x.amount > x.advance)
  };
}

function warnings(m) {
  const out = [];
  if (m.overTotal > 0) out.push(`The overall cost is ${inr(m.overTotal)} over the total budget.`);
  if (m.contLeft < 0) out.push(`Contingency is overspent by ${inr(-m.contLeft)}. Top it up, or move money in from an area or from “Free to reassign”.`);
  if (m.free < 0) out.push(`The areas and contingency add up to ${inr(-m.free)} more than the total. Raise the total or lower an area.`);
  return out;
}

/* ---------- Editors ---------- */
const amountInput = (v, ph = 'e.g. 1,20,000 or 1.2 lakh') => h('input', { inputmode: 'decimal', placeholder: ph, value: v ? Math.round(Number(v)).toLocaleString('en-IN') : '' });

function editBudget(id, opts, m) {
  if (!deciderOnly('change money')) return;
  const total = amountInput(m.b && m.b.total, 'e.g. 15,00,000 or 15 lakh');
  const cont = amountInput(m.b && m.b.contingency, '0');
  modal({
    title: m.b ? 'Total and contingency' : 'Set up this budget',
    body: [field('Total budget (₹)', total, 'Everything for this budget, start to finish.'),
      field('Contingency (₹)', cont, 'Money kept aside for surprises. Starts at ₹0 — unplanned payments and overspends come out of it.')],
    actions: [{
      label: 'Save', onClick: async () => {
        const patch = { total: money(total.value), contingency: money(cont.value) };
        const old = store.find('budgets', id);
        if (m.b) await store.update('budgets', id, patch).catch(fail);
        else if (old) await store.update('budgets', id, { ...patch, deleted_at: null, deleted_by: null }).catch(fail); // set up before, then removed
        else await store.insert('budgets', { id, wedding_id: opts.weddingId || null, title: opts.title, position: opts.position || 0, ...patch }).catch(fail);
      }
    }]
  });
}

function editArea(id, area, m) {
  if (!deciderOnly('change money')) return;
  const title = h('input', { value: area ? area.title : '', maxlength: 80, placeholder: 'e.g. Catering' });
  const planned = amountInput(area && area.planned);
  const free = h('p', { class: 'hint' }, `Free to reassign right now: ${inr(m.free + (area ? Number(area.planned) || 0 : 0))}`);
  modal({
    title: area ? 'Edit area' : 'New area',
    body: [field('Area', title), field('Planned (₹)', planned), free],
    actions: [{
      label: area ? 'Save' : 'Add area', onClick: async () => {
        const t = title.value.trim(); if (!t) return false;
        const patch = { title: t, planned: money(planned.value) };
        if (area) await store.update('budget_areas', area.id, patch).catch(fail);
        else {
          const last = m.areaRows.length ? m.areaRows[m.areaRows.length - 1].area.position || 0 : 0;
          await store.insert('budget_areas', { budget_id: id, wedding_id: m.b.wedding_id || null, position: last + 1000, ...patch }).catch(fail);
        }
      }
    }]
  });
}

function editItem(id, item, m, preset = {}) {
  if (!deciderOnly('change money')) return;
  const it = item || preset;
  const title = h('input', { value: it.title || '', maxlength: 120, placeholder: 'e.g. Caterer advance' });
  const payee = h('input', { value: it.payee || '', maxlength: 80, placeholder: 'Vendor, shop or person' });
  const amount = amountInput(it.amount);
  const due = h('input', { type: 'date', value: it.due || '' });
  const area = h('select', {},
    m.areaRows.map(r => h('option', { value: r.area.id, selected: it.area_id === r.area.id ? true : null }, r.area.title)),
    h('option', { value: '', selected: !it.area_id || !m.areaRows.some(r => r.area.id === it.area_id) ? true : null }, 'Unplanned — from contingency'));
  const paid = h('input', { type: 'checkbox', checked: it.paid_at ? true : null });
  const notes = h('textarea', { rows: 2, placeholder: 'Receipt number, how it was paid…' }); notes.value = it.notes || '';
  const removedArea = item && item.area_id && m.removedAreas.some(a => a.id === item.area_id);
  const refund = h('input', { type: 'checkbox', checked: it.refund_expected ? true : null });
  modal({
    title: item ? 'Payment' : 'New payment',
    body: h('div', { class: 'form-grid' },
      h('div', { class: 'full' }, field('What it’s for', title)),
      field('Amount (₹)', amount), field('Due by', due),
      field('Paid to', payee), removedArea ? h('div', { class: 'field' }, h('label', {}, 'Area'), h('p', { class: 'hint' }, 'Its area was removed. Restore the area from the Bin to move this back.')) : field('Area', area),
      h('label', { class: 'd-check full' }, paid, 'Already paid'),
      removedArea ? h('label', { class: 'd-check full' }, refund, 'A refund is expected') : null,
      h('div', { class: 'full' }, field('Notes', notes))),
    actions: [
      item ? { label: 'Move to Bin', kind: 'ghost', onClick: async () => { await store.remove('budget_items', item.id).then(() => toast('Moved to the Bin')).catch(fail); } } : null,
      {
        label: item ? 'Save' : 'Add payment', onClick: async () => {
          const t = title.value.trim(); if (!t) return false;
          const patch = { title: t, payee: payee.value.trim(), amount: money(amount.value), due: due.value || null, notes: notes.value,
            paid_at: paid.checked ? (it.paid_at || new Date().toISOString()) : null };
          if (!removedArea) patch.area_id = area.value || null;
          if (removedArea) patch.refund_expected = refund.checked;
          if (item) await store.update('budget_items', item.id, patch).catch(fail);
          else await store.insert('budget_items', { budget_id: id, wedding_id: m.b.wedding_id || null, step_id: it.step_id || null, refund_expected: false, position: 0, ...patch }).catch(fail);
        }
      }].filter(Boolean)
  });
}

// Move planned money between areas, contingency and "free to reassign".
function moveMoney(id, m, fromKey) {
  if (!deciderOnly('change money')) return;
  const opts = [['free', `Free to reassign (${inr(m.free)})`], ['cont', `Contingency (${inr(m.C)})`], ...m.areaRows.map(r => [r.area.id, `${r.area.title} (${inr(r.planned)})`])];
  const sel = (v) => h('select', {}, opts.map(([k, l]) => h('option', { value: k, selected: k === v ? true : null }, l)));
  const from = sel(fromKey || 'free'), to = sel(fromKey === 'free' || !fromKey ? (m.areaRows[0] ? m.areaRows[0].area.id : 'cont') : 'free');
  const amt = amountInput('');
  modal({
    title: 'Move money',
    body: h('div', { class: 'form-grid' }, field('From', from), field('To', to), h('div', { class: 'full' }, field('Amount (₹)', amt))),
    actions: [{
      label: 'Move', onClick: async () => {
        const a = money(amt.value); if (!a || from.value === to.value) return false;
        const avail = from.value === 'free' ? m.free : from.value === 'cont' ? m.C : (m.areaRows.find(r => r.area.id === from.value) || {}).planned || 0;
        if (a > avail && !(await confirmBox('Move more than is there?', `Only ${inr(avail)} is available there. Moving ${inr(a)} will leave it below zero.`, 'Move anyway', ''))) return false;
        const ops = [];
        const adj = (k, d) => {
          if (k === 'free') return; // free is whatever is left over, so it moves on its own
          if (k === 'cont') ops.push(store.update('budgets', id, { contingency: (Number(m.C) || 0) + d }));
          else { const r = m.areaRows.find(x => x.area.id === k); ops.push(store.update('budget_areas', k, { planned: (r.planned || 0) + d })); }
        };
        adj(from.value, -a); adj(to.value, a);
        await Promise.all(ops).then(() => toast('Moved ' + inr(a))).catch(fail);
      }
    }]
  });
}

// Restoring an area takes its planned money back from "free to reassign".
export async function confirmAreaRestore(area) {
  const m = budgetMath(area.budget_id);
  const need = Number(area.planned) || 0;
  const paidThere = (store.rows('budget_items') || []).filter(i => i.area_id === area.id && !i.deleted_at && i.paid_at).reduce((t, i) => t + Number(i.amount || 0), 0);
  const freeAfter = m.free - need + paidThere;
  if (freeAfter >= 0) return true;
  return confirmBox('Not enough free money', `Bringing back “${area.title}” takes ${inr(need)} from Free to reassign, but only ${inr(m.free + paidThere)} is free. The budget will be ${inr(-freeAfter)} over-planned until you move money around.`, 'Restore anyway', '');
}

async function removeArea(r) {
  if (!deciderOnly('change money')) return;
  const unpaid = r.items.filter(i => !i.paid_at);
  const text = `${inr(r.left)} of unspent money goes to Free to reassign.` + (r.paid ? ` The ${inr(r.paid)} already paid stays on record.` : '') + (unpaid.length ? ` ${unpaid.length} unpaid ${unpaid.length === 1 ? 'payment is' : 'payments are'} cancelled with it.` : '') + ' Anyone can bring it back from the Bin.';
  if (await confirmBox(`Remove “${r.area.title}”?`, text, 'Remove area')) store.remove('budget_areas', r.area.id).then(() => toast('Moved to the Bin')).catch(fail);
}

const markPaid = (i) => !deciderOnly('change money') ? null : store.update('budget_items', i.id, { paid_at: new Date().toISOString() }).then(() => toast('Marked paid')).catch(fail);
const markUnpaid = (i) => !deciderOnly('change money') ? null : store.update('budget_items', i.id, { paid_at: null }).catch(fail);

/* ---------- Pieces ---------- */
function stat(label, value, sub, cls = '') {
  return h('div', { class: 'stat ' + cls }, h('span', {}, label), h('b', {}, value), sub ? h('small', {}, sub) : null);
}

// Ribbon showing how the total is shared out.
function ribbon(m) {
  const T = Math.max(m.T, m.allocated + m.C + m.removedPaidTotal, 1);
  const seg = (v, cls, label) => v > 0 ? h('span', { class: 'rb-seg ' + cls, style: { flexGrow: v }, title: `${label}: ${inr(v)}` }) : null;
  return h('div', { class: 'ribbon-wrap' },
    h('div', { class: 'ribbon', role: 'img', 'aria-label': `Of ${inr(m.T)}: ${inr(m.allocated)} in areas, ${inr(m.C)} contingency, ${inr(Math.max(0, m.free))} free` },
      seg(m.allocated, 'alloc', 'In areas'), seg(m.removedPaidTotal, 'gone', 'Paid in removed areas'), seg(m.C, 'cont', 'Contingency'), seg(Math.max(0, m.free), 'free', 'Free to reassign'),
      m.free < 0 ? null : null),
    h('div', { class: 'rb-legend' },
      h('span', {}, h('i', { class: 'rb-seg alloc' }), 'In areas ', h('b', {}, inr(m.allocated))),
      h('span', {}, h('i', { class: 'rb-seg cont' }), 'Contingency ', h('b', {}, inr(m.C))),
      h('span', {}, h('i', { class: 'rb-seg free' }), 'Free to reassign ', h('b', { class: m.free < 0 ? 'neg' : '' }, inr(m.free))),
      m.removedPaidTotal ? h('span', {}, h('i', { class: 'rb-seg gone' }), 'Paid in removed areas ', h('b', {}, inr(m.removedPaidTotal))) : null));
  void T;
}

// One bar per area: paid, committed but unpaid, then what's left of the plan; overspend in red.
function areaBar(r) {
  const scale = Math.max(r.planned, r.committed, 1);
  const pct = (v) => (v / scale * 100) + '%';
  const unpaidInPlan = Math.max(0, Math.min(r.committed, r.planned) - Math.min(r.paid, r.planned));
  return h('div', { class: 'abar', role: 'img', 'aria-label': `${r.area.title}: planned ${inr(r.planned)}, committed ${inr(r.committed)}, paid ${inr(r.paid)}` },
    h('span', { class: 'ab paid', style: { width: pct(Math.min(r.paid, r.planned)) }, title: 'Paid ' + inr(r.paid) }),
    h('span', { class: 'ab owed', style: { width: pct(unpaidInPlan) }, title: 'Committed, not paid yet ' + inr(r.toPay) }),
    h('span', { class: 'ab left', style: { width: pct(r.left) }, title: 'Not spent yet ' + inr(r.left) }),
    r.over ? h('span', { class: 'ab over', style: { width: pct(r.over) }, title: 'Over the plan by ' + inr(r.over) }) : null);
}

function itemRow(id, i, m, opts = {}) {
  const late = !i.paid_at && i.due && daysUntil(i.due) < 0;
  return h('div', { class: 'brow' + (i.paid_at ? ' is-paid' : '') + (opts.cancelled ? ' is-cancelled' : '') },
    h('button', { type: 'button', class: 'brow-main', onclick: () => editItem(id, i, m) },
      h('span', { class: 'brow-t' }, i.title),
      h('span', { class: 'brow-s' + (late ? ' late' : '') }, [
        i.payee, opts.cancelled ? 'cancelled with the area' : i.paid_at ? 'paid ' + shortDate(i.paid_at.slice(0, 10)) : i.due ? (late ? 'overdue since ' : 'due ') + shortDate(i.due) : 'no due date',
        opts.removed ? 'area removed' : null, i.refund_expected ? 'refund expected' : null].filter(Boolean).join(' · '))),
    h('span', { class: 'brow-amt' }, inr(Number(i.amount || 0))),
    opts.cancelled ? h('span') : i.paid_at
      ? h('button', { type: 'button', class: 'paid-tag', title: 'Tap to mark as not paid', onclick: () => markUnpaid(i) }, h('span', { html: ICONS.check }), 'Paid')
      : isDecider() ? h('button', { type: 'button', class: 'btn small soft', onclick: () => markPaid(i) }, 'Mark paid') : h('span', { class: 'owed-tag' }, 'To pay'));
}

function monthChart(owing, lockOwing) {
  const buckets = new Map();
  const add = (key, v) => buckets.set(key, (buckets.get(key) || 0) + v);
  const thisMonth = new Date().toISOString().slice(0, 7);
  for (const i of owing) add(!i.due ? 'none' : i.due.slice(0, 7) < thisMonth ? 'late' : i.due.slice(0, 7), Number(i.amount || 0));
  for (const x of lockOwing) add('none', x.amount - x.advance);
  const keys = [...buckets.keys()].filter(k => k !== 'late' && k !== 'none').sort();
  const rows = [...(buckets.has('late') ? ['late'] : []), ...keys, ...(buckets.has('none') ? ['none'] : [])];
  if (!rows.length) return h('p', { class: 'muted hc-empty' }, 'Nothing left to pay.');
  const max = Math.max(...rows.map(k => buckets.get(k)));
  const label = (k) => k === 'late' ? 'Overdue' : k === 'none' ? 'No date yet' : new Date(k + '-01T00:00').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  return h('div', { class: 'months', role: 'table', 'aria-label': 'Money needed by month' }, rows.map(k => h('div', { class: 'mrow' + (k === 'late' ? ' late' : ''), role: 'row', title: `${label(k)}: ${inr(buckets.get(k))}` },
    h('span', { class: 'm-l', role: 'cell' }, label(k)),
    h('span', { class: 'm-bar', role: 'cell' }, h('i', { style: { width: Math.max(2, buckets.get(k) / max * 100) + '%' } })),
    h('span', { class: 'm-v', role: 'cell' }, inr(buckets.get(k))))));
}

function upcoming(id, m, limit = 8) {
  const list = m.owing.slice(0, limit);
  return list.length ? h('div', { class: 'blist' }, list.map(i => itemRow(id, i, m)), m.owing.length > limit ? h('p', { class: 'hint', style: { margin: '8px 0 0' } }, `+ ${m.owing.length - limit} more below`) : null)
    : h('p', { class: 'muted hc-empty' }, 'Nothing waiting to be paid.');
}

/* ---------- One budget ---------- */
export function renderBudgetView(root, opts) {
  const id = opts.id;
  if (missing()) {
    root.append(secHead('Money', opts.heading || 'Budget'));
    root.append(h('div', { class: 'soon-note' }, h('span', { class: 'soon-ic', html: ICONS.budget }), h('div', {}, h('b', {}, 'The budget needs database update 5'), h('p', {}, 'Ask the admin to run 005_budget.sql in Supabase, then reload this page.'))));
    return;
  }
  const m = budgetMath(id);
  const famLink = h('a', { class: 'btn ghost small', href: '#/budget' }, 'Family total →');
  if (!m.b) {
    root.append(secHead('Money', opts.heading || 'Budget', famLink));
    root.append(h('div', { class: 'budget-empty' },
      h('div', { class: 'eyebrow' }, 'Start here'),
      h('h2', {}, 'Set the total budget'),
      h('p', {}, opts.blurb || 'Write down the total you have for this. Then split it into areas, keep some aside for surprises, and add payments as they come up.'),
      isDecider() ? h('button', { class: 'btn', type: 'button', onclick: () => editBudget(id, opts, m) }, 'Set the total') : h('p', { class: 'hint' }, `One of the Deciders (${deciderNames()}) can set it up.`)));
    return;
  }

  const can = isDecider();
  root.append(secHead('Money', opts.heading || 'Budget',
    can ? h('button', { class: 'btn', type: 'button', onclick: () => editItem(id, null, m) }, '+ Payment') : null,
    can ? h('button', { class: 'btn ghost', type: 'button', onclick: () => editArea(id, null, m) }, '+ Area') : null,
    can ? h('button', { class: 'btn ghost', type: 'button', onclick: () => moveMoney(id, m) }, 'Move money') : null,
    opts.family !== false ? famLink : null));
  if (!can) root.append(h('p', { class: 'hint ro-note' }, `You can see everything here. Only the Deciders (${deciderNames()}) can change money.`));

  root.append(h('div', { class: 'stats five' },
    h('button', { type: 'button', class: 'stat as-btn', onclick: () => editBudget(id, opts, m), title: 'Change the total' }, h('span', {}, 'Total budget'), h('b', {}, inr(m.T)), h('small', {}, 'Tap to change')),
    stat('Overall cost', inr(m.committed), `${inr(m.paid)} paid`),
    stat('Still to pay', inr(m.toPay), m.owing.length ? `${m.owing.length} ${m.owing.length === 1 ? 'payment' : 'payments'}` : 'All settled', 'accent'),
    h('button', { type: 'button', class: 'stat as-btn' + (m.contLeft < 0 ? ' warn' : ''), onclick: () => editBudget(id, opts, m), title: 'Change the contingency' }, h('span', {}, 'Contingency left'), h('b', {}, inr(m.contLeft)), h('small', {}, m.C ? `of ${inr(m.C)} · ${inr(m.contUsed)} used` : 'Starts at ₹0 · tap to set')),
    stat('Free to reassign', inr(m.free), m.free < 0 ? 'Over-planned' : 'Not in any area yet', m.free < 0 ? 'warn' : '')));

  const warns = warnings(m);
  if (warns.length) root.append(h('div', { class: 'bwarn', role: 'alert' }, h('b', {}, 'Over budget'), warns.map(t => h('span', {}, t))));
  root.append(ribbon(m));

  // Areas, each with its payments
  const areasEl = h('section', { class: 'dsec' },
    h('div', { class: 'dsec-h' }, h('h2', {}, 'Areas'), h('span', { class: 'count' }, String(m.areaRows.length))),
    m.areaRows.length ? null : h('p', { class: 'muted' }, 'No areas yet. Add one for each big spend — catering, venue, décor, clothes, gifts.'),
    m.areaRows.map(r => h('div', { class: 'barea' + (r.over ? ' is-over' : '') },
      h('div', { class: 'barea-h' },
        h('button', { type: 'button', class: 'barea-t', onclick: () => editArea(id, r.area, m) }, r.area.title),
        h('span', { class: 'barea-n' }, h('b', {}, inr(r.committed)), ' of ', inr(r.planned), r.over ? h('span', { class: 'neg' }, ` · ${inr(r.over)} over`) : r.left ? h('span', {}, ` · ${inr(r.left)} left`) : null),
        h('button', {
          type: 'button', class: 'icon-btn menu-btn', 'aria-label': `More for ${r.area.title}`, html: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/></svg>',
          onclick: () => {
            const mm = modal({
              title: r.area.title, body: h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
                [['Add a payment here', () => editItem(id, null, m, { area_id: r.area.id })], ['Edit name or planned amount', () => editArea(id, r.area, m)], ['Move money out of this area…', () => moveMoney(id, m, r.area.id)], ['Remove this area', () => removeArea(r), 'danger']]
                  .map(([l, f, k]) => h('button', { class: 'btn ' + (k || 'ghost'), type: 'button', style: { justifyContent: 'flex-start' }, onclick: () => { mm.close(); f(); } }, l)))
            });
          }
        })),
      areaBar(r),
      r.items.length ? h('div', { class: 'blist' }, r.items.sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999')).map(i => itemRow(id, i, m))) : null,
      isDecider() ? h('button', { type: 'button', class: 'dashed', onclick: () => editItem(id, null, m, { area_id: r.area.id }) }, '+ Add a payment') : null)));

  // Unplanned, locked decisions not yet added, removed areas
  const extras = h('div', {});
  if (m.unplanned.length || m.fromLocks.length) extras.append(h('section', { class: 'dsec' },
    h('div', { class: 'dsec-h' }, h('h2', {}, 'Unplanned · from contingency'), h('span', { class: 'count gold' }, inr(m.unplannedTotal))),
    m.fromLocks.length ? h('div', { class: 'lockfeed' },
      h('p', { class: 'hint', style: { margin: '0 0 8px' } }, 'Final decisions with an amount. They count here until you put them in an area.'),
      m.fromLocks.map(x => h('div', { class: 'brow' },
        h('button', { type: 'button', class: 'brow-main', onclick: () => openStep(x.step.id) }, h('span', { class: 'brow-t' }, x.step.title), h('span', { class: 'brow-s' }, ['Final decision', x.step.lock_note && x.step.lock_note.with, x.advance ? inr(x.advance) + ' advance paid' : null].filter(Boolean).join(' · '))),
        h('span', { class: 'brow-amt' }, inr(x.amount)),
        h('button', { type: 'button', class: 'btn small', onclick: () => addLockToBudget(id, x, m) }, 'Put in an area')))) : null,
    m.unplanned.length ? h('div', { class: 'blist' }, m.unplanned.map(i => itemRow(id, i, m))) : null));
  if (m.removedPaid.length || m.cancelled.length) extras.append(h('section', { class: 'dsec' },
    h('div', { class: 'dsec-h' }, h('h2', {}, 'From removed areas')),
    h('p', { class: 'hint' }, 'Money already paid stays on record. Unpaid payments were cancelled with their area — restore the area from the Bin to bring them back.'),
    h('div', { class: 'blist' }, m.removedPaid.map(i => itemRow(id, i, m, { removed: true })), m.cancelled.map(i => itemRow(id, i, m, { cancelled: true })))));

  const side = h('aside', { class: 'bside' },
    h('section', { class: 'bcard' }, h('div', { class: 'hc-label' }, 'Coming up to pay'), upcoming(id, m, 6)),
    h('section', { class: 'bcard' }, h('div', { class: 'hc-label' }, 'Money needed by month'), monthChart(m.owing, m.lockOwing)));

  root.append(h('div', { class: 'bgrid' }, h('div', { class: 'bmain' }, areasEl, extras), side));
}

async function addLockToBudget(id, x, m) {
  if (!deciderOnly('change money')) return;
  const pick = h('select', {}, m.areaRows.map(r => h('option', { value: r.area.id }, r.area.title)), h('option', { value: '' }, 'Unplanned — from contingency'));
  modal({
    title: 'Put in an area',
    body: [h('p', { class: 'muted', style: { margin: 0 } }, `“${x.step.title}” · ${inr(x.amount)}${x.advance ? `, of which ${inr(x.advance)} is paid` : ''}.`), field('Area', pick)],
    actions: [{
      label: 'Add to budget', onClick: async () => {
        const base = { budget_id: id, wedding_id: m.b.wedding_id || null, step_id: x.step.id, area_id: pick.value || null, payee: (x.step.lock_note && x.step.lock_note.with) || '', notes: '', refund_expected: false, position: 0 };
        const adv = Math.min(x.advance, x.amount);
        try {
          if (adv > 0) await store.insert('budget_items', { ...base, title: x.step.title + ' · advance', amount: adv, paid_at: x.step.locked_at, due: x.step.locked_at.slice(0, 10) });
          if (x.amount - adv > 0) await store.insert('budget_items', { ...base, title: x.step.title + (adv > 0 ? ' · balance' : ''), amount: x.amount - adv, paid_at: null, due: x.step.due || null });
          toast('Added to the budget');
        } catch (e) { fail(e); }
      }
    }]
  });
}

/* ---------- Pages ---------- */
export function renderWeddingBudget(root, w) {
  renderBudgetView(root, {
    id: w.id, weddingId: w.id, title: w.couple, position: w.position || 0,
    blurb: w.theme === 'blue' ? 'For the family’s own costs for this wedding — gifts, clothes, dress stitching and anything else we pay for.' : null
  });
}

export function renderFamilyBudget(params = {}) {
  const wrap = h('main', { class: 'wrap sbody family-budget' });
  if (missing()) { renderBudgetView(wrap, { id: 'shared', heading: 'Family budget' }); return wrap; }
  const ws = weddings();
  const ids = [...ws.map(w => w.id), 'shared'];
  const ms = ids.map(budgetMath);
  const sum = (f) => ms.reduce((t, m) => t + f(m), 0);
  wrap.append(secHead('Everyone’s money', 'Family budget'));
  wrap.append(h('div', { class: 'stats five' },
    stat('Family total', inr(sum(m => m.T)), `${ms.filter(m => m.b).length} budgets`),
    stat('Overall cost', inr(sum(m => m.committed)), `${inr(sum(m => m.paid))} paid`),
    stat('Still to pay', inr(sum(m => m.toPay)), null, 'accent'),
    stat('Contingency left', inr(sum(m => m.contLeft)), `of ${inr(sum(m => m.C))}`, sum(m => m.contLeft) < 0 ? 'warn' : ''),
    stat('Free to reassign', inr(sum(m => m.free)), null, sum(m => m.free) < 0 ? 'warn' : '')));

  const card = (title, m, href, t) => h('a', { class: 'fbcard', href, style: t ? { '--c-deep': t.deep, '--c-gold': t.gold, '--c-accent': t.accent } : null },
    h('span', { class: 'fb-t' }, title),
    m.b ? [h('span', { class: 'fb-big' }, inr(m.committed), h('small', {}, ` of ${inr(m.T)}`)),
      h('span', { class: 'fb-bar' }, h('i', { style: { width: Math.min(100, m.T ? m.committed / m.T * 100 : 0) + '%' } })),
      h('span', { class: 'fb-s' }, `${inr(m.toPay)} still to pay`, warnings(m).length ? h('b', { class: 'neg' }, ' · over budget') : null)]
      : h('span', { class: 'fb-s' }, 'Not set up yet →'));
  wrap.append(h('div', { class: 'fbgrid' },
    ws.map((w, i) => card(w.couple, ms[i], `#/w/${w.id}/budget`, themeOf(w))),
    card('Shared home costs', ms[ms.length - 1], '#/budget?to=shared', null)));

  // combined upcoming + months
  const owing = ms.flatMap((m, i) => m.owing.map(it => ({ ...it, _b: ids[i] }))).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
  const lockOwing = ms.flatMap(m => m.lockOwing);
  wrap.append(h('div', { class: 'bgrid' },
    h('div', { class: 'bmain', id: 'shared' }),
    h('aside', { class: 'bside' },
      h('section', { class: 'bcard' }, h('div', { class: 'hc-label' }, 'Coming up to pay · everyone'),
        owing.length ? h('div', { class: 'blist' }, owing.slice(0, 8).map(i => itemRow(i._b, i, budgetMath(i._b)))) : h('p', { class: 'muted hc-empty' }, 'Nothing waiting to be paid.')),
      h('section', { class: 'bcard' }, h('div', { class: 'hc-label' }, 'Money needed by month · everyone'), monthChart(owing, lockOwing)))));

  // Shared home costs live on this page.
  const shared = wrap.querySelector('#shared');
  renderBudgetView(shared, { id: 'shared', title: 'Shared home costs', heading: 'Shared home costs', family: false, position: 99,
    blurb: 'For things the whole house needs before the weddings — painting, curtains, mattresses, repairs.' });
  // The shared view brings its own side column; keep the page tidy by using only its main part.
  const inner = shared.querySelector('.bgrid');
  if (inner) { inner.classList.add('flat'); const s2 = inner.querySelector('.bside'); if (s2) s2.remove(); }
  if (params.to === 'shared') setTimeout(() => { const el = document.getElementById('shared'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 80);
  return wrap;
}

