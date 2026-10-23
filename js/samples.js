// Sample options with placeholder pictures (crops of the family's own photos), so the family can feel how swiping,
// comparing and choosing work before real quotes come in. Every sample is marked
// data.sample = true and its title starts with "Sample:", so it is easy to remove in one tap.
const P = (f) => ({ path: 'assets/samples/' + f });

// Each category: which steps it fits (first match wins) and its options.
export const SAMPLE_SETS = [
  { match: /wedding cake|cake for|^cake|finalise the menu/i, options: [
    ['Sample: Rosewater Cakes', '₹6,000 · 3 tiers, serves 150', 'Vanilla and strawberry, fondant roses in blush. Delivers to the church.', [P('silk-flower.jpg'), P('roses-pink.jpg')], '90000 00001'],
    ['Sample: Bake House', '₹4,200 · 2 tiers, naked cake', 'Fresh berries, lighter sponge, cheaper. Pick-up only.', [P('lavender-close.jpg')], ''],
    ['Sample: Aunty’s kitchen', '₹2,500 · home-made', 'Chocolate, simple decoration — the family favourite.', [P('roses-red.jpg'), P('lavender-wall.jpg')], ''] ] },
  { match: /photo/i, options: [
    ['Sample: Lens & Light Studio', '₹85,000 · church + reception', 'Candid, film-look style. 300 edited photos and a 5-minute film. Two shooters.', [P('garden-aisle.jpg'), P('garden-tent.jpg'), P('garden-steps.jpg')], '90000 00002'],
    ['Sample: Hill Frames', '₹60,000 · church only', 'Classic portraits, quick delivery (2 weeks). One shooter, drone extra.', [P('dusk-bloom.jpg'), P('roses-all.jpg')], ''],
    ['Sample: Pine & Petal Films', '₹1,10,000 · full day', 'Cinematic video, same-day highlights shown at the reception.', [P('garden-steps.jpg'), P('dusk-sky.jpg')], ''] ] },
  { match: /^rings$|ring/i, options: [
    ['Sample: Gold & white-gold pair', '₹78,000 · 18k', 'Plain bands with a small diamond for the bride. Engraving free.', [P('silk-drape.jpg'), P('silk-flower.jpg')], ''],
    ['Sample: Simple gold bands', '₹52,000 · 22k', 'Traditional, heavier, no stones.', [P('silk-flower.jpg')], ''] ] },
  { match: /wedding cards|invitation card|print the invitation/i, options: [
    ['Sample: Wax-seal card', '₹45 per card · 300 cards', 'Cream card, envelope with a wine wax seal and the monogram.', [P('roses-all.jpg'), P('silk-drape.jpg')], ''],
    ['Sample: Simple printed card', '₹18 per card', 'One-sided, gold text, no envelope.', [P('lavender-wall.jpg')], ''] ] },
  { match: /reception décor|church décor|décor|venue|shortlist venues/i, options: [
    ['Sample: Floral arch & chairs', '₹35,000 · arch, aisle, 150 chairs', 'White roses and greenery on the arch, matching aisle flowers.', [P('garden-tent.jpg'), P('garden-aisle.jpg')], ''],
    ['Sample: Fairy-light canopy', '₹18,000 · reception area', 'Warm lights over the outdoor tables, by the church.', [P('garden-steps.jpg'), P('dusk-bloom.jpg')], ''] ] },
  { match: /bouquet|flower/i, options: [
    ['Sample: Blush roses & eucalyptus', '₹3,500 · bouquet + 6 buttonholes', 'Soft pink and white, tied with silk ribbon.', [P('roses-pink.jpg'), P('roses-red.jpg'), P('lavender-close.jpg')], ''] ] },
  { match: /candles/i, options: [
    ['Sample: Unity candle set', '₹2,400 · 1 large + 2 tapers', 'Ivory, on a gold tray. Matches the ring tray.', [P('dusk-sky.jpg'), P('silk-flower.jpg')], ''] ] },
  { match: /caterer|^menu$|food service/i, options: [
    ['Sample: Highland Kitchen', '₹450 per plate', 'Pork, chicken, fish, veg boil, rice and custard. Serves from 11 am.', [P('garden-aisle.jpg'), P('garden-steps.jpg')], '90000 00003'],
    ['Sample: Church hall cooks', '₹320 per plate', 'Simple menu, the family supplies the meat.', [P('lavender-wall.jpg')], ''] ] },
  { match: /shawl|traditional attire|gifts for the bride|decide gifts/i, options: [
    ['Sample: Woven shawls', '₹1,200 each · 20 pieces', 'Red and black, for the bride’s family.', [P('roses-red.jpg'), P('silk-drape.jpg')], ''] ] }
];

// Rows to insert for one wedding, given its steps. Each set attaches to the first step it fits, once.
export function sampleRows(weddingId, steps, { uid, now, by }) {
  const used = new Set(); const rows = [];
  for (const set of SAMPLE_SETS) {
    const step = steps.find(s => !used.has(s.id) && set.match.test(s.title || ''));
    if (!step) continue;
    used.add(step.id);
    for (const [title, rate, notes, images, phone] of set.options) {
      const row = { wedding_id: weddingId, kind: 'option', x: 0, y: 0, w: 280, z: 1, data: { step_id: step.id, title, rate, notes, phone, links: [], images, status: 'open', sample: true } };
      if (uid) row.id = uid();
      if (now) row.created_at = now();
      if (by) row.created_by = by;
      rows.push(row);
    }
  }
  return rows;
}
export const isSample = (o) => !!(o && o.data && o.data.sample);
