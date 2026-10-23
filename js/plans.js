// Ready-made plans the admin can load into a wedding with one tap.
// Each step: [title, note, big decision?, suggested?]. Suggested steps came from
// Claude's review of Catholic weddings in Nagaland and Manipur; the rest are the family's own list.
// Each to-do: [title, due date, where it belongs].
import { store } from './store.js?v=49';
import { h, toast, modal , ICONS } from './ui.js?v=49';
import { live } from './app.js?v=49';
import { SECTIONS } from './clear.js?v=49';
import { othersGate, byOthers, keepOthersSteps } from './safety.js?v=49';
import { customLists } from './customs.js?v=49';

const S = (title, note = '', gate = false, sugg = false) => [title, note, gate, sugg];

export const PLANS = {
  // Charani & Adahrii: our family is the bride's side. Added to the plan alongside what's there — nothing is replaced.
  charani: {
    addOnly: true,
    label: 'Charani’s preparations',
    offer: 'Charani’s preparations are ready.',
    marker: 'Resize the ring',
    dateNote: 'Dates count back from the wedding on 7 December — change any of them.',
    stages: [
      ['Before', [
        ['Bride’s preparations (Charani)', [
          S('Resize the ring', 'Take it to the jeweller with the right size; allow a week or two.'),
          S('Stitch the wedding dress and gown', 'Book the tailor, fittings, and the final fitting a week or two before.', true),
          S('Trousseau: buy and market', 'Everything Charani takes with her — clothes, shoes, toiletries, small things. The list is under Lists.'),
          S('Clothes gifts for the groom’s family', 'Traditional wear for Adahrii’s family — who gets what. The list is under Lists.'),
          S('Boutonnieres for both families', 'For the men and boys on both sides — the girls’ side and the boys’ side.'),
          S('Flower girls’ dresses', 'Stitched — measurements from each girl’s family.'),
          S('Bridesmaids’ dresses', 'Stitched — fabric, colour and measurements.'),
          S('Choose the make-up artist', 'Add a few as options under Choose so the family can compare.', true),
          S('Bridal gifts for the new home', 'What Charani takes to her new house: a custom-built almirah, a fridge, a washing machine, bedspreads and blankets. The list is under Lists.'),
          S('Custom-built almirah', 'Order early from the carpenter — making it takes weeks. Size it for the room in the new house.', true),
          S('Fridge and washing machine', 'Buy, and arrange delivery to the new house.')
        ]],
        ['Invitations & meat', [
          S('Invitation list: bride’s side (Charani)', 'Everyone from our side to invite. The list is under Lists.'),
          S('Send the invitation list to Adahrii’s family', 'Open the list and tap “Send on WhatsApp”, or print it.'),
          S('Meat list: bride’s side (Charani)', 'The elders and relatives who receive meat — pig head for the grandparents, legs for the uncles, and so on.'),
          S('Send the meat list to Adahrii’s family', 'Open the list and tap “Send on WhatsApp”, or print it.')
        ]]
      ]]
    ],
    todos: [
      ['Order the custom-built almirah from the carpenter', '2026-10-30', 'Bride’s preparations'],
      ['Book the make-up artist', '2026-11-01', 'Bride’s preparations'],
      ['Give the dress and gown to the tailor', '2026-11-01', 'Bride’s preparations'],
      ['Send the bride’s side invitation list to Adahrii’s family', '2026-11-05', 'Invitations & meat'],
      ['Take the ring to be resized', '2026-11-10', 'Bride’s preparations'],
      ['Flower girls’ and bridesmaids’ dresses to the tailor', '2026-11-10', 'Bride’s preparations'],
      ['Send the meat list to Adahrii’s family', '2026-11-20', 'Invitations & meat'],
      ['Buy the fridge and washing machine', '2026-11-25', 'Bride’s preparations'],
      ['Final fitting: dress and gown', '2026-11-25', 'Bride’s preparations'],
      ['Boutonnieres ready for both families', '2026-12-01', 'Bride’s preparations'],
      ['Deliver the almirah, fridge and washing machine to the new house', '2026-12-01', 'Bride’s preparations']
    ],
    lists: [
      { step: 'Bridal gifts for the new home', title: 'Bridal gifts for the new home', columns: ['Item', 'Details', 'Qty', 'Price (₹)', 'Bought', 'Delivered', 'Notes'],
        rows: [['Almirah (custom-built)', 'Order from the carpenter; size for the room', '1'], ['Fridge', '', '1'], ['Washing machine', '', '1'], ['Bedspreads', '', ''], ['Blankets', '', '']] },
      { step: 'Trousseau: buy and market', title: 'Trousseau', columns: ['Item', 'Qty', 'Price (₹)', 'Bought', 'Notes'] },
      { step: 'Clothes gifts for the groom’s family', title: 'Clothes gifts for the groom’s family', columns: ['Name', 'Relation', 'Traditional wear', 'Price (₹)', 'Bought', 'Packed', 'Notes'] },
      { step: 'Invitation list: bride’s side (Charani)', custom: 'invite' },
      { step: 'Meat list: bride’s side (Charani)', custom: 'meat' }
    ]
  },
  elow: {
    label: 'Elow & Maniziia — full checklist',
    marker: 'Maniziia: preparation to join the Catholic Church',
    dateNote: 'Dates assume a wedding in early February 2027, before Lent (10 Feb). Move them once the date is fixed.',
    stages: [
      ['Before', [
        ['Money & who does what', [
          S('Overall budget and each family’s share', 'Agree a total and a rough amount for each area.', true, true),
          S('Joint meeting of both families', 'Who is in charge of what, who pays for what, and the customs to follow.', false, true),
          S('Assign people in charge for each area', 'Every area needs one name.', false, true),
          S('Plan around Charani’s wedding (7 Dec)', 'Same family and helpers — avoid clashes in December.', false, true)
        ]],
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
          S('Papers for the church', 'Recent baptism certificates (Elow and Maniziia), confirmation certificates, letters from both parishes.', false, true),
          S('Meeting with the priest', 'Marriage interview — many parishes do this before the banns.', false, true),
          S('Wedding banns', 'Announced in church on three Sundays, usually in both parishes. Needs the papers and the priest’s meeting first.'),
          S('Two witnesses', 'Choose them; they sign the register.', false, true),
          S('Confession for the couple before the wedding', 'Usually in the week before.', false, true),
          S('Priest for officiating', '', true),
          S('Mass preparation', 'Readings, readers, prayers of the faithful, altar servers.'),
          S('Rehearsal before the wedding'),
          S('Offering and thanks to the church', 'Church, priest, choir, sacristan.', false, true),
          S('Government registration of the marriage', 'If needed for official documents later — ask the priest.', false, true)
        ]],
        ['Families & customs', [
          S('Formal visit and proposal between the families', 'The Mao way — ask the elders on both sides how it’s done.', false, true),
          S('Customary agreement between the families', 'If your communities have one — what is given and when.', false, true),
          S('Gifts for the bride’s family', 'Traditional shawls — ask which are right for a Mao family. List to be made.'),
          S('Meat gift for the family and elders', 'Make the list of who receives it.'),
          S('Meat list: groom’s side (Elow)', 'Elders and relatives on our side who receive meat — pig head for the grandparents, legs for the uncles, and so on. The list is under Lists.'),
          S('Meat list: bride’s side (Maniziia)', 'The elders and relatives on Maniziia’s side who receive meat. Fill it in with her family.')
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
          S('Invitation list: groom’s side (Elow)', 'Everyone from our side to invite. The list is under Lists.'),
          S('Invitation list: bride’s side (Maniziia)', 'Get the list from Maniziia’s family and put it in, so the head count covers both sides.'),
          S('Head count', 'Drives food, meat, chairs, tents and cars — needed early.', false, true),
          S('Wedding cards', 'Printing usually takes 2–3 weeks.', true),
          S('Delivering the invitations', 'Who takes cards to whom, by hand or by message.', false, true),
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
          S('Seating for elders, priests and special guests', '', false, true),
          S('Ushers to welcome people at the church', '', false, true),
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
          S('Butchering and storing the meat', 'Usually the day before — where it is kept cool.', false, true),
          S('Cooks and kitchen team', '', false, true),
          S('Firewood or gas for cooking', '', false, true),
          S('Pots, plates, serving and water', '', false, true),
          S('Meals for cooks and helpers on preparation days', '', false, true),
          S('Marketing — buying food and supplies', 'Rice, vegetables, oil, spices, custard items. Who goes, when, which market.'),
          S('Wedding cake', '', true),
          S('Cake for distribution')
        ]],
        ['Transport & shopping', [
          S('Transport to Dimapur for shopping', 'Clothes, rings, décor and bulk buying — plan the trips.'),
          S('Transport and stay for the bride’s family and Mao guests', '', false, true),
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
          S('Run sheet for the day', 'Who does what, and when.', false, true),
          S('Volunteer briefing the week before', '', false, true),
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
          S('Taking down décor and tents', '', false, true),
          S('Return hired items and settle accounts', '', false, true),
          S('Honeymoon', '', false, true)
        ]]
      ]]
    ],
    todos: [
      // This week and next
      ['Meet the parish priest: Maniziia joining the Church, dates before Lent, banns, papers', '2026-11-01', 'Church'],
      ['Ask when Maniziia’s classes start and sign her up', '2026-11-01', 'Church'],
      ['Ask the elders on both sides how the Mao proposal visit should go', '2026-11-01', 'Families'],
      ['Fix a provisional date with the church and the priest', '2026-11-05', 'Church'],
      ['Family meeting: who is in charge of what, and each family’s share', '2026-11-08', 'Money'],
      ['Agree the overall budget and a rough amount for each area', '2026-11-08', 'Money'],
      // By mid-November
      ['Announce the date to the family and the church', '2026-11-15', 'Church'],
      ['Ask for baptism certificates from both parishes', '2026-11-15', 'Church'],
      ['Ask the church for permission to use the grounds', '2026-11-15', 'Setup'],
      ['Start the guest list on both sides', '2026-11-15', 'Guests'],
      ['Get a rough head count', '2026-11-22', 'Guests'],
      ['Get quotes: event management and décor', '2026-11-22', 'Setup'],
      ['Get quotes: photographer and videographer', '2026-11-22', 'Music & photos'],
      // By end of November
      ['First Dimapur trip: rings, groom’s attire, bride’s gown', '2026-11-29', 'Transport & shopping'],
      ['Order the rings', '2026-11-30', 'Clothes & rings'],
      ['Sign up for the marriage class', '2026-11-30', 'Church'],
      ['Book event management, photographer and singer', '2026-11-30', 'Setup'],
      ['Get quotes: tents, chairs, sound and generator', '2026-11-30', 'Setup'],
      ['Choose the card design and get printer quotes', '2026-11-30', 'Guests'],
      // December, around Charani’s wedding
      ['Finalise the guest list and head count', '2026-12-15', 'Guests'],
      ['Order the wedding cards', '2026-12-15', 'Guests'],
      ['Decide meat quantities and book the animals', '2026-12-20', 'Food'],
      ['Book the cooks and kitchen team', '2026-12-20', 'Food'],
      ['Book the cars and drivers', '2026-12-20', 'Transport'],
      ['Order the bed, mattress and bedding', '2026-12-20', 'Home'],
      ['Send permit information to guests from outside', '2026-12-20', 'Guests'],
      ['Arrange stay and transport for the bride’s family and Mao guests', '2026-12-20', 'Transport'],
      // Early January
      ['Give the papers to the priest and have the marriage interview', '2027-01-05', 'Church'],
      ['Hand out the invitations', '2027-01-10', 'Guests'],
      ['Decide and buy the gifts for the bride’s family', '2027-01-10', 'Families'],
      ['Make the meat-gift list', '2027-01-10', 'Families'],
      ['Choose the music and hymns; ask the choir and the MC', '2027-01-10', 'Music & photos'],
      ['Choose the two witnesses and tell the priest', '2027-01-15', 'Church'],
      ['Order the wedding cake and the cake for distribution', '2027-01-15', 'Food'],
      // Late January
      ['Second Dimapur trip: décor and bulk buying', '2027-01-20', 'Transport & shopping'],
      ['Make the marketing list: rice, vegetables, oil, spices, custard items', '2027-01-20', 'Food'],
      ['Print the wedding programme', '2027-01-25', 'Guests'],
      ['Get the home and bedroom ready', '2027-01-25', 'Home'],
      ['Final fittings: gown and groom’s attire', '2027-01-25', 'Clothes & rings'],
      ['Banns read on three Sundays', '2027-01-31', 'Church'],
      // Wedding week
      ['Briefing for volunteers and in-charges, with the run sheet', '2027-02-02', 'The day'],
      ['Confession for the couple', '2027-02-03', 'Church'],
      ['Rehearsal at the church', '2027-02-04', 'Church'],
      ['Market for fresh items', '2027-02-04', 'Food'],
      ['Set up tents, chairs and toilets; test the generator and sound', '2027-02-05', 'Setup'],
      ['Church décor and reception décor', '2027-02-05', 'Setup'],
      ['Butcher and store the meat; start cooking', '2027-02-05', 'Food'],
      ['Collect the cake, programmes and outfits', '2027-02-05', 'The day'],
      // After
      ['Return hired items and settle accounts', '2027-02-12', 'After'],
      ['Thanksgiving service', '2027-02-14', 'After'],
      ['Thank-you visits and calls', '2027-02-20', 'After'],
      ['Return visit to the bride’s family', '2027-02-20', 'After']
    ],
    lists: [
      { step: 'Invitation list: groom’s side (Elow)', custom: 'invite', side: 'groom' },
      { step: 'Invitation list: bride’s side (Maniziia)', custom: 'invite', side: 'bride' },
      { step: 'Meat list: groom’s side (Elow)', custom: 'meat', side: 'groom' },
      { step: 'Meat list: bride’s side (Maniziia)', custom: 'meat', side: 'bride' }
    ]
  }
};

const stepCount = (p) => p.stages.reduce((n, [, areas]) => n + areas.reduce((m, [, steps]) => m + steps.length, 0), 0);
export const planFor = (w) => PLANS[w.id] || null;
const hasTodos = () => !(store.missing && store.missing.todos) && !store.todosMissing;
const loaded = (w, p) => live(store.rows('steps')).some(s => s.wedding_id === w.id && s.title === p.marker);

// What a loaded wedding is still missing from the ready-made plan (new steps added since, and the to-dos).
function missingFor(w, p) {
  // Anything with the same title counts — even if it's in the Bin, because someone removed it on purpose.
  const have = new Set(store.rows('steps').filter(s => s.wedding_id === w.id).map(s => s.title));
  const haveT = new Set((store.rows('todos') || []).filter(t => t.wedding_id === w.id).map(t => t.title));
  const steps = [];
  p.stages.forEach(([st, as]) => as.forEach(([ar, ss]) => ss.forEach((s, i) => { if (!have.has(s[0])) steps.push({ st, ar, s, i }); })));
  const todos = hasTodos() ? p.todos.filter(t => !haveT.has(t[0])) : [];
  return { steps, todos };
}
export const planLoaded = (w) => { const p = planFor(w); if (!p) return true; if (!loaded(w, p)) return false; const m = missingFor(w, p); return !m.steps.length && !m.todos.length; };

const uid = () => crypto.randomUUID();
const stepRow = (w, aid, [title, note, gate, sugg], ti) => ({ id: uid(), wedding_id: w.id, area_id: aid, title, notes: (sugg ? '✦ Suggested. ' : '') + (note || ''), owner: '', due: null, status: 'todo', position: (ti + 1) * 1000, gate: !!gate });
const todoRows = (w, p, list) => list.map(([title, due, where], i) => ({ id: uid(), wedding_id: w.id, title, notes: where, owner: '', due, status: 'todo', position: (i + 1) * 1000 }));

// Lists that belong to plan steps (the bridal gifts, the invitation and meat lists …), made once and linked to their step.
// A list already there with the same name — even one in the Bin — is left alone.
async function addLists(w, p, steps) {
  if (!p.lists || (store.missing && store.missing.lists)) return 0;
  const have = new Set((store.rows('lists') || []).filter(l => l.wedding_id === w.id).map(l => l.title));
  const stepId = (t) => { const x = steps.find(s => s.title === t) || live(store.rows('steps')).find(s => s.wedding_id === w.id && s.title === t); return x ? x.id : null; };
  const specs = customLists(w), all = specs.main.concat(specs.extra);
  let n = 0;
  for (const L of p.lists) {
    let title = L.title, columns = L.columns;
    if (L.custom) { const c = all.find(x => x.kind === L.custom && (!L.side || x.side === L.side)); if (!c) continue; title = c.title; columns = c.columns; }
    if (have.has(title)) continue;
    const list = await store.insert('lists', { wedding_id: w.id, step_id: stepId(L.step), title, columns });
    if (L.rows && L.rows.length) await store.insertMany('list_rows', L.rows.map((cells, i) => ({ list_id: list.id, wedding_id: w.id, cells: columns.map((_, j) => cells[j] || ''), position: (i + 1) * 1000 })));
    have.add(title); n++;
  }
  return n;
}

async function freshLoad(w, p, clear, keep) {
  const ts = new Date().toISOString();
  const othersSteps = keep ? live(store.rows('steps')).filter(st => st.wedding_id === w.id && byOthers(st)) : [];
  // 1. The old plan goes to the Bin.
  const oldStages = live(store.rows('stages')).filter(s => s.wedding_id === w.id);
  const stageIds = oldStages.map(s => s.id);
  const areaIds = live(store.rows('areas')).filter(a => stageIds.includes(a.stage_id)).map(a => a.id);
  const stepIds = live(store.rows('steps')).filter(s => areaIds.includes(s.area_id)).map(s => s.id);
  await store.removeMany('steps', stepIds, ts);
  await store.removeMany('areas', areaIds, ts);
  await store.removeMany('stages', stageIds, ts);
  // 2. Old sample content the admin ticked goes to the Bin too.
  for (const key of clear) for (const [t, all] of SECTIONS[key].rows(w.id)) { const rows = keep ? all.filter(r => !byOthers(r)) : all; if (rows.length && !(store.missing && store.missing[t])) await store.removeMany(t, rows.map(r => r.id), ts); }
  // 3. The checklist and the to-dos go in.
  const stages = [], areas = [], steps = [];
  p.stages.forEach(([st, as], si) => {
    const sid = uid(); stages.push({ id: sid, wedding_id: w.id, title: st, position: (si + 1) * 1000 });
    as.forEach(([ar, ss], ai) => {
      const aid = uid(); areas.push({ id: aid, wedding_id: w.id, stage_id: sid, title: ar, position: (ai + 1) * 1000 });
      ss.forEach((s, ti) => steps.push(stepRow(w, aid, s, ti)));
    });
  });
  await store.insertMany('stages', stages);
  await store.insertMany('areas', areas);
  await store.insertMany('steps', steps);
  if (hasTodos()) await store.insertMany('todos', todoRows(w, p, p.todos));
  if (othersSteps.length) await keepOthersSteps(w.id, othersSteps);
  const lists = await addLists(w, p, steps);
  return { steps: steps.length, todos: hasTodos() ? p.todos.length : 0, lists };
}

async function topUp(w, p) {
  const m = missingFor(w, p);
  const stages = live(store.rows('stages')).filter(s => s.wedding_id === w.id);
  const areas = live(store.rows('areas')).filter(a => a.wedding_id === w.id);
  const newStages = [], newAreas = [], steps = [];
  for (const { st, ar, s, i } of m.steps) {
    let stage = stages.find(x => x.title === st) || newStages.find(x => x.title === st);
    if (!stage) { stage = { id: uid(), wedding_id: w.id, title: st, position: (stages.length + newStages.length + 1) * 1000 }; newStages.push(stage); }
    let area = areas.find(x => x.title === ar && x.stage_id === stage.id) || newAreas.find(x => x.title === ar && x.stage_id === stage.id);
    if (!area) { area = { id: uid(), wedding_id: w.id, stage_id: stage.id, title: ar, position: (ar.startsWith('Money') ? 0 : 1) * ((areas.length + newAreas.length + 1) * 1000) }; newAreas.push(area); }
    steps.push(stepRow(w, area.id, s, i));
  }
  if (newStages.length) await store.insertMany('stages', newStages);
  if (newAreas.length) await store.insertMany('areas', newAreas);
  if (steps.length) await store.insertMany('steps', steps);
  if (m.todos.length) await store.insertMany('todos', todoRows(w, p, m.todos));
  const lists = await addLists(w, p, steps);
  return { steps: steps.length, todos: m.todos.length, lists };
}

export function loadPlan(w) {
  const p = planFor(w); if (!p) return;
  const fresh = !p.addOnly && !loaded(w, p);
  const done = (r) => toast(`Done — ${r.steps} steps${r.todos ? `, ${r.todos} to-dos` : ''}${r.lists ? ` and ${r.lists} lists` : ''} are in`);
  const fail = (e) => { console.error(e); toast(e.message || 'That did not load. Check your connection and try again.', 'error'); };
  if (!fresh) {
    const m = missingFor(w, p);
    modal({
      title: p.addOnly && !loaded(w, p) ? `Add ${p.label}?` : 'Add the new items?',
      body: [h('p', { class: 'muted', style: { margin: 0 } }, `${m.steps.length} new steps${m.todos.length ? ` and ${m.todos.length} dated to-dos` : ''}${p.lists ? ', with their lists,' : ''} will be added. Nothing you’ve already done or changed is touched.`),
        p.addOnly && p.dateNote ? h('p', { class: 'hint', style: { margin: '8px 0 0' } }, p.dateNote) : null],
      actions: [{ label: 'Cancel', kind: 'ghost', onClick: () => { } }, { label: 'Add them', onClick: () => store.batch(() => topUp(w, p)).then(done).catch(fail) }]
    });
    return;
  }
  const counts = (key) => SECTIONS[key].rows(w.id).reduce((n, [t, rows]) => n + (store.missing && store.missing[t] ? 0 : rows.length), 0);
  const boxes = ['board', 'todo', 'files', 'budget'].map(key => ({ key, n: counts(key), box: h('input', { type: 'checkbox', checked: true }) })).filter(b => b.n);
  const planRows = [['stages', live(store.rows('stages')).filter(x => x.wedding_id === w.id)], ['areas', live(store.rows('areas')).filter(x => x.wedding_id === w.id)], ['steps', live(store.rows('steps')).filter(x => x.wedding_id === w.id)]];
  const gate = othersGate([...planRows, ...boxes.flatMap(b => SECTIONS[b.key].rows(w.id))], 'go to the Bin (their plan steps included)');
  modal({
    title: `Load the full checklist for ${w.couple}?`, wide: true,
    body: [
      h('p', { class: 'muted', style: { margin: 0 } }, `${stepCount(p)} steps in Before · The wedding day · After, each with its note${hasTodos() ? `, and ${p.todos.length} dated to-dos from now until after the wedding` : ''}. The current plan moves to the Bin.`),
      boxes.length ? h('fieldset', { class: 'load-clear' }, h('legend', {}, 'Also clear the old sample content for this wedding'),
        boxes.map(({ key, n, box }) => h('label', { class: 'd-check' }, box, `${SECTIONS[key].label} — ${n} ${SECTIONS[key].what}`))) : null,
      gate.el,
      h('p', { class: 'hint', style: { margin: 0 } }, (gate.n ? 'Kept steps go into a “Kept from the old plan” area. ' : '') + 'Everything cleared goes to the Bin and can be brought back together. ' + p.dateNote)],
    actions: [{ label: 'Cancel', kind: 'ghost', onClick: () => { } }, {
      label: 'Load the checklist', onClick: () => store.batch(() => freshLoad(w, p, boxes.filter(b => b.box.checked).map(b => b.key), gate.keep())).then(done).catch(fail)
    }]
  });
}

// A one-line offer on the plan and overview pages, for the admin, until everything is in.
// Once the checklist is in, new items are added by themselves (for the admin, once per visit) — never removed.
const autoRan = new Set();
function autoTopUp(w, p) {
  if (autoRan.has(w.id)) return; autoRan.add(w.id);
  setTimeout(() => store.batch(() => topUp(w, p)).then(r => { if (r.steps || r.todos) toast(`Added ${r.steps ? r.steps + ' new steps' : ''}${r.steps && r.todos ? ' and ' : ''}${r.todos ? r.todos + ' to-dos' : ''} to the plan`); }).catch(e => console.warn(e)), 600);
}
export function planOffer(w) {
  const p = planFor(w);
  if (!p || !store.me || !store.me.isAdmin || planLoaded(w)) return null;
  const fresh = !p.addOnly && !loaded(w, p);
  if (!fresh && loaded(w, p) && store.mode === 'live') { autoTopUp(w, p); return null; }
  const m = fresh ? null : missingFor(w, p);
  return h('section', { class: 'tip auto' }, h('span', { class: 'tip-i', html: ICONS.sparkle }),
    fresh
      ? h('span', {}, h('b', {}, 'The full checklist is ready. '), `${stepCount(p)} steps${hasTodos() ? ` and ${p.todos.length} dated to-dos` : ''} — it replaces the sample content.`)
      : h('span', {}, h('b', {}, (p.addOnly && !loaded(w, p) ? p.offer : 'New items are ready.') + ' '), `${m.steps.length} steps${m.todos.length ? ` and ${m.todos.length} to-dos` : ''} to add to the plan.`),
    h('button', { type: 'button', class: 'tip-x', onclick: () => loadPlan(w) }, fresh ? 'Load it' : 'Add them'));
}
