// Ready-made plans the admin can load into a wedding with one tap.
// Each step: [title, note, big decision?, suggested?]. Suggested steps came from
// Claude's review of Catholic weddings in Nagaland and Manipur; the rest are the family's own list.
import { store } from './store.js?v=23';
import { h, toast, confirmBox } from './ui.js?v=23';
import { live } from './app.js?v=23';

const S = (title, note = '', gate = false, sugg = false) => [title, note, gate, sugg];

export const PLANS = {
  elow: {
    label: 'Elow & Maniziia — full checklist',
    marker: 'Maniziia: preparation to join the Catholic Church',
    stages: [
      ['Before', [
        ['Church & sacraments', [
          S('Set the date', 'Feb–Mar 2027. Lent starts 10 Feb 2027 — many parishes limit weddings in Lent, so check with the parish early.', true),
          S('Talk to the officiant and church members'),
          S('Announce the date', 'After the church confirms.'),
          S('Maniziia: preparation to join the Catholic Church', 'Classes with the priest. Can take months — start now.', false, true),
          S('Maniziia: baptism', 'Only if she hasn’t been baptised in another church — ask the priest.'),
          S('Maniziia: first confession'),
          S('Maniziia: first communion'),
          S('Maniziia: confirmation', 'Part of joining the Catholic Church.', false, true),
          S('Marriage class', 'Marriage preparation course.'),
          S('Papers for the church', 'Recent baptism certificates, confirmation certificates, letters from both parishes.', false, true),
          S('Meeting with the priest', 'Marriage interview — many parishes do this before the banns.', false, true),
          S('Wedding banns', 'Announced in church on three Sundays, usually in both parishes. Needs the papers and the priest’s meeting first.'),
          S('Two witnesses', 'Choose them; they sign the register.', false, true),
          S('Priest for officiating', '', true),
          S('Mass preparation', 'Readings, readers, prayers of the faithful, altar servers.'),
          S('Rehearsal before the wedding'),
          S('Offering and thanks to the church', 'Church, priest, choir, sacristan.', false, true)
        ]],
        ['Families & customs', [
          S('Formal visit and proposal between the families', 'The Mao way — ask the elders on both sides how it’s done.', false, true),
          S('Customary agreement between the families', 'If your communities have one — what is given and when.', false, true),
          S('Gifts for the bride’s family', 'Traditional shawls — ask which are right for a Mao family. List to be made.'),
          S('Meat gift for the family and elders', 'Make the list of who receives it.')
        ]],
        ['Clothes & rings', [
          S('Rings', '', true),
          S('Groom’s wedding attire', '', true),
          S('Bride’s gown, veil and shoes', 'Coordinate with Maniziia’s family.', true, true),
          S('Formal attire for the family'),
          S('Traditional attire for the families', 'If wearing tribal shawls or wraps for the reception.', false, true),
          S('Bridesmaids and best man', 'Who, and what they wear.', false, true),
          S('Hair and make-up', '', false, true),
          S('Bouquet and buttonholes', '', false, true)
        ]],
        ['Invitations & guests', [
          S('Invitation list / guest list'),
          S('Head count', 'Drives food, meat, chairs, tents and cars — needed early.', false, true),
          S('Wedding cards', 'Printing usually takes 2–3 weeks.', true),
          S('Printed programme for the wedding'),
          S('Stay for guests from out of town', '', false, true),
          S('Permits for guests from outside', 'Manipur and Nagaland both ask visitors from outside for an Inner Line Permit — check for each guest.', false, true)
        ]],
        ['Our home & the bedroom', [
          S('Home preparation'),
          S('Wedding bed'),
          S('Mattress, cushions, bedspreads, pillow covers'),
          S('Mosquito net'),
          S('Home décor — house, bedroom, door')
        ]],
        ['Church & reception setup', [
          S('Event management', '', true),
          S('Church décor'),
          S('Reception décor', 'Reception is outdoors by the church.', true),
          S('Permission to use the church grounds', 'For the reception and the kitchen.', false, true),
          S('Seats for the couple in church'),
          S('Candles'),
          S('Ring tray / cushion'),
          S('Tents, chairs and tables', 'For the outdoor reception and the smaller meal.', false, true),
          S('Toilets and hand-washing', 'For an outdoor reception.', false, true),
          S('Sound system and microphones', '', false, true),
          S('Generator or power backup', '', false, true),
          S('Cold or rain plan', 'Feb–Mar evenings are cold — heaters or shawls for elders.', false, true)
        ]],
        ['Music & photos', [
          S('Music selection'),
          S('Singer', '', true),
          S('Church choir', '', false, true),
          S('Photographer and videographer', '', true),
          S('Host (MC) for the reception programme', '', false, true),
          S('Speeches and blessings at the reception', 'Who speaks, in what order.', false, true)
        ]],
        ['Food', [
          S('Menu', 'Pork · beef · chicken · fish · boiled veg · rice · custard (dessert).', true),
          S('Meat quantities and buying the animals', 'Work out from the head count.', false, true),
          S('Cooks and kitchen team', '', false, true),
          S('Pots, plates, serving and water', '', false, true),
          S('Marketing — buying food and supplies', 'Rice, vegetables, oil, spices, custard items. Who goes, when, which market.'),
          S('Wedding cake', '', true),
          S('Cake for distribution')
        ]],
        ['Transport & shopping', [
          S('Transport to Dimapur for shopping', 'Clothes, rings, décor and bulk buying — plan the trips.'),
          S('Car for the couple', '', true),
          S('Car for the groom'),
          S('Cars for the family'),
          S('Transport for guests'),
          S('Vehicle for gifts'),
          S('Drivers, fuel and parking', '', false, true)
        ]]
      ]],
      ['The wedding day', [
        ['Before the service', [
          S('Morning meal for guests before the service', 'Smaller meal.'),
          S('Elders’ blessing and prayer at home before church', '', false, true)
        ]],
        ['People in charge', [
          S('Hosting in-charge', 'Looks after people before, during and after the wedding.'),
          S('Volunteers for the reception'),
          S('Reception gift and cash table'),
          S('Gift and envelope register', 'Who gave what — for the thank-yous.', false, true),
          S('First aid and someone for the elders', '', false, true),
          S('Clean-up team', '', false, true)
        ]],
        ['After the service', [
          S('Marriage register and certificate', 'Signed after the Mass; keep copies for official use.', false, true),
          S('Meal for well-wishers afterwards', 'Smaller meal.'),
          S('Sharing leftover food and meat', '', false, true),
          S('Welcoming the bride into the home', 'Prayer and welcome after the reception.', false, true)
        ]]
      ]],
      ['After', [
        ['Thanks & visits', [
          S('Thanksgiving service the Sunday after', 'Common in Naga and Manipuri churches.', false, true),
          S('Return visit to the bride’s family', '', false, true),
          S('Thank-you visits and calls', '', false, true)
        ]],
        ['Wrapping up', [
          S('Return hired items and settle accounts', '', false, true),
          S('Honeymoon', '', false, true)
        ]]
      ]]
    ]
  }
};

const stepCount = (p) => p.stages.reduce((n, [, areas]) => n + areas.reduce((m, [, steps]) => m + steps.length, 0), 0);
export const planFor = (w) => PLANS[w.id] || null;
export const planLoaded = (w) => { const p = planFor(w); return !p || live(store.rows('steps')).some(s => s.wedding_id === w.id && s.title === p.marker); };

export async function loadPlan(w) {
  const p = planFor(w); if (!p) return;
  const n = stepCount(p);
  const old = live(store.rows('stages')).filter(s => s.wedding_id === w.id);
  const ok = await confirmBox(`Load the full checklist for ${w.couple}?`,
    `This puts in ${n} steps in Before · The wedding day · After, each with its note.` + (old.length ? ' The current plan moves to the Bin — you can restore it from there.' : ''), 'Load the checklist', '');
  if (!ok) return;
  try {
    if (old.length) {
      const ts = new Date().toISOString();
      const stageIds = old.map(s => s.id);
      const areaIds = live(store.rows('areas')).filter(a => stageIds.includes(a.stage_id)).map(a => a.id);
      const stepIds = live(store.rows('steps')).filter(s => areaIds.includes(s.area_id)).map(s => s.id);
      await store.removeMany('steps', stepIds, ts);
      await store.removeMany('areas', areaIds, ts);
      await store.removeMany('stages', stageIds, ts);
    }
    const stages = [], areas = [], steps = [];
    const uid = () => crypto.randomUUID();
    p.stages.forEach(([st, as], si) => {
      const sid = uid(); stages.push({ id: sid, wedding_id: w.id, title: st, position: (si + 1) * 1000 });
      as.forEach(([ar, ss], ai) => {
        const aid = uid(); areas.push({ id: aid, wedding_id: w.id, stage_id: sid, title: ar, position: (ai + 1) * 1000 });
        ss.forEach(([title, note, gate, sugg], ti) => steps.push({ id: uid(), wedding_id: w.id, area_id: aid, title, notes: (sugg ? '✦ Suggested. ' : '') + (note || ''), owner: '', due: null, status: 'todo', position: (ti + 1) * 1000, gate: !!gate }));
      });
    });
    await store.insertMany('stages', stages);
    await store.insertMany('areas', areas);
    await store.insertMany('steps', steps);
    toast(`Done — ${n} steps are in the plan`);
  } catch (e) { console.error(e); toast(e.message || 'That did not load. Check your connection and try again.', 'error'); }
}

// A one-line offer on the plan page, for the admin, until the checklist is in.
export function planOffer(w) {
  const p = planFor(w);
  if (!p || !store.me || !store.me.isAdmin || planLoaded(w)) return null;
  return h('section', { class: 'tip auto' }, h('span', { class: 'tip-i' }, '✦'),
    h('span', {}, h('b', {}, 'The full checklist is ready. '), `${stepCount(p)} steps for church, families, clothes, food, transport and the day.`),
    h('button', { type: 'button', class: 'tip-x', onclick: () => loadPlan(w) }, 'Load it'));
}
