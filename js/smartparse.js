// Smart add, part 1: fixed rules. Reads pasted messages and links and pulls out what it can be sure of —
// phone numbers, prices (85k, ₹1.2 lakh, 1,20,000), Instagram handles, links, emails, dates and the kind
// of vendor. Nothing here guesses beyond the text; the AI (part 2) only fills what the rules couldn't.
// No imports, so it can be tested on its own.

/* ---------- Links ---------- */
// Tracking codes are stripped: utm_*, fbclid, igsh, and Instagram's share codes (exln, xtok, dlrf …).
const TRACK = /^(utm_\w+|fbclid|gclid|dclid|msclkid|mc_[ce]id|igsh|igshid|ig_rid|si|s|t|ref|ref_src|ref_url|share|shared|feature|_r|mibextid|rdid|exln|xtok|dlrf)$/i;
export function cleanLink(u) {
  let url;
  try { url = new URL(/^https?:\/\//i.test(u) ? u : 'https://' + u); } catch (e) { return u; }
  const host = url.hostname.replace(/^(www|m|l)\./, '');
  // Instagram, Facebook and WhatsApp links never need their query string.
  if (/(^|\.)(instagram\.com|instagr\.am|facebook\.com|fb\.com|wa\.me)$/.test(host)) url.search = '';
  else for (const k of [...url.searchParams.keys()]) if (TRACK.test(k)) url.searchParams.delete(k);
  url.hash = /^#(:~:|$)/.test(url.hash) ? '' : url.hash;
  let out = url.toString();
  if (url.pathname !== '/' && out.endsWith('/') && !url.search) out = out.slice(0, -1);
  return out;
}
export function linksIn(text) {
  const raw = String(text || '').match(/\b(?:https?:\/\/|www\.)[^\s<>"'()]+|\b(?:instagram\.com|instagr\.am|wa\.me|maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs|facebook\.com|fb\.com)\/[^\s<>"'()]+/gi) || [];
  return [...new Set(raw.map(x => cleanLink(x.replace(/[.,;:!?…)\]]+$/, ''))))];
}
export function linkKind(u) {
  const s = String(u).toLowerCase();
  if (/instagram\.com|instagr\.am/.test(s)) return 'instagram';
  if (/wa\.me|whatsapp\.com/.test(s)) return 'whatsapp';
  if (/facebook\.com|fb\.com/.test(s)) return 'facebook';
  if (/maps\.app\.goo\.gl|google\.[a-z.]+\/maps|goo\.gl\/maps|maps\.google|openstreetmap|g\.co\/kgs/.test(s)) return 'map';
  if (/youtube\.com|youtu\.be/.test(s)) return 'youtube';
  if (/justdial|wedmegood|weddingwire|shaadisaga|weddingbazaar|wedabout|zomato|swiggy/.test(s)) return 'listing';
  return 'website';
}
// An Instagram handle from a profile link (not a post or reel).
export function igHandleOf(u) {
  const m = String(u).match(/instagram\.com\/([A-Za-z0-9._]{1,30})\/?(?:$|[?#])/i);
  if (!m) return '';
  const h = m[1].toLowerCase();
  return ['p', 'reel', 'reels', 'stories', 'explore', 'tv', 'accounts', 'direct'].includes(h) ? '' : h;
}

/* ---------- Phones (India first) ---------- */
export function phonesIn(text) {
  const out = [];
  const t = String(text || '').replace(/[‎‏‪-‮]/g, '');
  for (const m of t.matchAll(/(?<![\d₹$.,])(?:\+|00)?\d[\d\s\-().]{7,17}\d(?![\d,]*\s*(?:k|K|lakh|lac|L\b|cr|\/-|rs|₹))/g)) {
    let d = m[0].replace(/[^\d+]/g, '').replace(/^00/, '+');
    if (/^\+?91\d{10}$/.test(d)) d = '+91' + d.slice(-10);
    else if (/^0?[6-9]\d{9}$/.test(d)) d = '+91' + d.slice(-10);
    else if (/^\+\d{10,14}$/.test(d)) { /* other country, keep */ }
    else if (/^0\d{9,11}$/.test(d)) { /* landline with STD code, keep */ }
    else continue;
    // a price like 1,20,000 is not a phone; a date like 12-03-2027 is not either
    if (/^\d{1,2}[-./]\d{1,2}[-./]\d{2,4}$/.test(m[0].trim())) continue;
    if (!out.includes(d)) out.push(d);
  }
  return out;
}
export const prettyPhone = (p) => /^\+91\d{10}$/.test(p) ? `+91 ${p.slice(3, 8)} ${p.slice(8)}` : p;

/* ---------- Prices ---------- */
// "85k", "₹1.2 lakh", "1,20,000", "Rs 50000/-", "2.5L", "1.5 cr", "45 thousand", "₹ 800 per plate".
export function pricesIn(text) {
  const out = [];
  const t = String(text || '');
  const re = /(?:(₹|rs\.?|inr|rupees)\s*)?(\d{1,3}(?:,\d{2,3})+|\d+(?:\.\d+)?)\s*(k|thousand|lakh|lakhs|lac|lacs|l|cr|crore|crores)?\b\s*(\/-)?\s*((?:per|\/|a)\s*(?:plate|head|person|pax|guest|hour|hr|day|event|function|piece|pc|kg))?/gi;
  for (const m of t.matchAll(re)) {
    const [all, cur, num, unit, dash, per] = m;
    const u = (unit || '').toLowerCase();
    if (!cur && !u && !dash && !per) {
      // a bare number only counts if it is clearly money-sized and not a phone/year/date
      if (!/,/.test(num) || /^\d{10}$/.test(num.replace(/,/g, ''))) continue;
    }
    if (/^\d{4}$/.test(num) && !cur && !u && /^(19|20)\d\d$/.test(num)) continue; // a year
    let v = parseFloat(num.replace(/,/g, ''));
    if (isNaN(v)) continue;
    if (u === 'k' || u === 'thousand') v *= 1e3;
    else if (/^(lakh|lakhs|lac|lacs|l)$/.test(u)) v *= 1e5;
    else if (/^(cr|crore|crores)$/.test(u)) v *= 1e7;
    if (u === 'l' && !cur && v < 1e5) continue;
    if (v < 100 && !cur) continue;
    const digits = String(Math.round(v)).length;
    if (digits >= 10 && !cur && !u) continue; // a phone number
    out.push({ value: Math.round(v), text: all.trim().replace(/\s+/g, ' '), per: per ? per.replace(/^(\/|a)\s*/i, 'per ').replace(/\s+/g, ' ').toLowerCase() : '' });
  }
  return out;
}
export const inr = (v) => '₹' + Number(v).toLocaleString('en-IN');
export function priceLabel(p) { return p ? inr(p.value) + (p.per ? ' ' + p.per : '') : ''; }

/* ---------- Other bits ---------- */
export const emailsIn = (t) => [...new Set(String(t || '').match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) || [])].map(e => e.toLowerCase());
export function handlesIn(text) {
  const t = String(text || '').replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, ' ');
  const out = [];
  for (const m of t.matchAll(/(?:^|[\s(])@([A-Za-z0-9._]{2,30})\b/g)) { const h = m[1].replace(/\.$/, '').toLowerCase(); if (!out.includes(h)) out.push(h); }
  for (const u of linksIn(text)) { const h = igHandleOf(u); if (h && !out.includes(h)) out.push(h); }
  return out;
}
const MONTHS = 'jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec';
export function datesIn(text) {
  const t = String(text || ''); const out = [];
  for (const m of t.matchAll(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s*(${MONTHS})[a-z]*\\.?,?\\s*(\\d{4})?\\b|\\b(${MONTHS})[a-z]*\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s*(\\d{4})?\\b|\\b(\\d{1,2})[/.-](\\d{1,2})[/.-](\\d{2,4})\\b`, 'gi'))) out.push(m[0].trim());
  return [...new Set(out)];
}

/* ---------- What kind of vendor ---------- */
// Words → a kind. Each kind lists words found in step titles too, so a kind can find its step.
export const KINDS = {
  photo: ['photographer', 'photography', 'photo', 'photos', 'candid', 'shoot', 'prewedding', 'pre-wedding', 'studio', 'lens', 'clicks', 'frames', 'album'],
  video: ['videographer', 'videography', 'video', 'films', 'film', 'cinematic', 'cinematography', 'teaser', 'reel', 'drone'],
  decor: ['decor', 'decoration', 'decorations', 'decorator', 'decorators', 'events', 'event', 'stage', 'backdrop', 'setup', 'styling', 'mandap', 'draping', 'lighting', 'balloon'],
  flowers: ['florist', 'flowers', 'floral', 'bouquet', 'bloom', 'blooms', 'petals', 'garland', 'boutonniere', 'boutonnieres'],
  food: ['caterer', 'caterers', 'catering', 'food', 'menu', 'buffet', 'kitchen', 'cuisine', 'plate', 'tasting', 'chef'],
  cake: ['cake', 'cakes', 'bakery', 'baker', 'bakes', 'patisserie', 'desserts', 'cupcakes'],
  makeup: ['makeup', 'make-up', 'mua', 'bridal makeup', 'hair', 'hairstylist', 'stylist', 'salon', 'beauty', 'glam'],
  mehndi: ['mehndi', 'mehendi', 'henna'],
  music: ['dj', 'band', 'music', 'singer', 'choir', 'live music', 'sound', 'musician', 'orchestra', 'saxophone'],
  venue: ['venue', 'hall', 'banquet', 'resort', 'hotel', 'lawn', 'garden', 'convention', 'church', 'chapel', 'farmhouse', 'auditorium'],
  invites: ['invitation', 'invitations', 'invite', 'invites', 'cards', 'card', 'stationery', 'printing', 'printer', 'calligraphy', 'e-invite'],
  attire: ['gown', 'dress', 'bridal wear', 'lehenga', 'saree', 'suit', 'tux', 'tuxedo', 'sherwani', 'tailor', 'boutique', 'couture', 'designer', 'stitching', 'mekhela'],
  jewellery: ['jewellery', 'jewelry', 'jeweller', 'rings', 'ring', 'gold', 'diamond'],
  transport: ['car', 'cars', 'transport', 'travels', 'bus', 'vintage car', 'rental', 'taxi'],
  rentals: ['tent', 'tents', 'shamiana', 'chairs', 'furniture', 'rentals', 'generator', 'crockery'],
  gifts: ['gifts', 'gift', 'hampers', 'hamper', 'favours', 'favors', 'return gifts'],
  planner: ['planner', 'planners', 'wedding planner', 'coordinator', 'coordination', 'management']
};
const KIND_LABEL = { photo: 'Photographer', video: 'Videographer', decor: 'Decorator', flowers: 'Florist', food: 'Caterer', cake: 'Cake', makeup: 'Makeup artist', mehndi: 'Mehndi', music: 'Music', venue: 'Venue', invites: 'Invitations', attire: 'Clothes', jewellery: 'Jewellery', transport: 'Transport', rentals: 'Rentals', gifts: 'Gifts', planner: 'Planner' };
export const kindLabel = (k) => KIND_LABEL[k] || '';
const words = (s) => String(s || '').toLowerCase().replace(/[_@.]/g, ' ').match(/[a-z][a-z-]+/g) || [];
export function kindScores(text) {
  const t = ' ' + String(text || '').toLowerCase().replace(/[_.]/g, ' ') + ' ';
  const sc = {};
  for (const [k, ws] of Object.entries(KINDS)) for (const w of ws) {
    const re = new RegExp('(^|[^a-z])' + w.replace(/[-]/g, '[- ]?') + '(?=[^a-z]|$)', 'g');
    const n = (t.match(re) || []).length; if (n) sc[k] = (sc[k] || 0) + n * (w.length > 5 ? 2 : 1);
  }
  return sc;
}
export function kindOf(text) {
  const sc = kindScores(text); const best = Object.entries(sc).sort((a, b) => b[1] - a[1]);
  if (!best.length) return { kind: '', sure: 0 };
  const [k, v] = best[0], second = best[1] ? best[1][1] : 0;
  return { kind: k, sure: Math.min(1, v / 4) * (second ? Math.min(1, (v - second) / v + 0.3) : 1) };
}

/* ---------- Where it goes: which step ---------- */
const STOPW = new Set('with from that this have your their there what when will just also please call contact send number price rate rates book order date dates more hello thanks'.split(' '));
// steps: [{ id, title, area, stage }]. learned: { word: stepId } from earlier corrections.
export function placeIn(steps, text, kind, learned = {}) {
  const ws = new Set(words(text));
  for (const w of ws) if (learned[w] && steps.some(s => s.id === learned[w])) return { stepId: learned[w], sure: 0.9, why: 'like before' };
  const kw = kind ? KINDS[kind] : [];
  let best = null;
  const has = (tw, w) => tw.has(w) || tw.has(w + 's') || tw.has(w.replace(/s$/, '')) || (w.includes(' ') || w.includes('-')) && [...w.split(/[ -]/)].every(x => tw.has(x));
  for (const s of steps) {
    const title = (s.title + ' ' + (s.area || '')).toLowerCase();
    const tw = new Set(words(title));
    let sc = 0;
    // each word of the step's title counts once: "photo" and "photos" are the same match
    const hitKw = new Set(); for (const t of tw) if (kw.some(w => w === t || w + 's' === t || w === t + 's' || (w.length > 5 && t.startsWith(w)))) hitKw.add(t);
    sc += hitKw.size * 3 + (kw.slice(0, 3).some(w => tw.has(w)) ? 1 : 0); // the main words ("photographer", "photography") a little more
    const hitW = new Set(); for (const w of ws) if (w.length > 3 && !STOPW.has(w)) for (const t of tw) if (t === w || t === w + 's' || t + 's' === w) hitW.add(t);
    sc += hitW.size;
    if (/\bafter\b/i.test(s.stage || '') || /thank|accounts|return/i.test(s.area || '')) sc -= 1.5; // vendors are booked before, not after
    if (sc > 0 && /\b(book|choose|shortlist|finalise|finalize|hire|order)\b/.test(title)) sc += 0.5; // a step that's about choosing someone
    if (sc > 0 && (!best || sc > best.sc)) best = { s, sc, kwHit: hitKw.size > 0 };
  }
  if (!best) return { stepId: null, sure: 0, why: '' };
  if (kind && !best.kwHit) return { stepId: null, sure: 0, why: '' }; // it's a florist, but no step is about flowers: don't guess
  return { stepId: best.s.id, sure: Math.min(1, best.sc / 6), why: kind ? kindLabel(kind) : 'words match' };
}

/* ---------- Names ---------- */
// The vendor's name: an Instagram-style name, a line that looks like a business, or the first short line.
const BIZ = /\b(studio|studios|photography|films|events|event|decor|decorators|caterers|catering|bakery|cakes|florist|flowers|bloom|blooms|creations|productions|weddings|makeover|makeup|salon|boutique|couture|band|music|sounds|travels|tent house|enterprises|co\.?|company|designs|art|arts|clicks|frames|kitchen|foods|resort|hotel|banquet|hall|garden|planners?)\b/i;
export function nameFrom(text, handle) {
  const lines = String(text || '').split(/\n+/).map(l => l.replace(/^[\s\-*•·>]*(?:\(?\d{1,2}[.)]\s+)?/, '').replace(/https?:\/\/\S+/g, '').trim()).filter(Boolean);
  // the part of a line before " – ", " | ", ":" or ",", without @handles, phones and prices
  const head = (l) => l.replace(/^(name|vendor|contact|studio|business)\s*[:\-–]\s*/i, '').split(/\s[–—-]\s|\s\|\s|\s*[:,]\s|\s(?=@)|\s(?=\+?\d[\d\s-]{7,})|\s(?=(?:₹|rs\.?\s)?\d+(?:[.,]\d+)*\s*(?:k|lakh|l|\/-)\b)/i)[0]
    .replace(/@\S+/g, '').replace(/\s{2,}/g, ' ').trim().replace(/[.\-–—|]+$/, '').trim();
  const ok = (c) => c.length >= 3 && c.length <= 48 && !/\d{5,}/.test(c) && !/^(hi|hello|hey|dear|good|please|pls|thanks|ok|sharing|here|these|some)\b/i.test(c);
  for (const l of lines) { const c = head(l); if (ok(c) && BIZ.test(c)) return titleCase(c); }
  if (handle) return titleCase(handle.replace(/[._]+/g, ' ').replace(/\b(official|the|in|by|co)\s*$/i, '').trim());
  const first = lines.map(head).find(c => ok(c) && c.split(/\s+/).length <= 6);
  return first ? titleCase(first) : '';
}
function titleCase(s) { return s.split(/\s+/).map(w => /^[a-z]/.test(w) && w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w).join(' '); }
export const nameKey = (n) => String(n || '').toLowerCase().replace(/&/g, ' and ').replace(/\b(the|studio|studios|photography|official|events?|co|company)\b/g, '').replace(/[^a-z0-9]/g, '');

/* ---------- Locations ---------- */
const PLACES = /\b(guwahati|dimapur|kohima|shillong|imphal|aizawl|itanagar|agartala|jorhat|dibrugarh|tezpur|silchar|kolkata|delhi|new delhi|noida|gurgaon|gurugram|mumbai|bangalore|bengaluru|pune|hyderabad|chennai|goa|jaipur|chandigarh|lucknow|siliguri|darjeeling|gangtok)\b/i;
export function locationIn(text) {
  const t = String(text || '');
  const lbl = t.match(/(?:address|location|located at|based in|studio at|venue)\s*[:\-–]?\s*([^\n]{4,90})/i);
  if (lbl) return lbl[1].replace(/https?:\/\/\S+/g, '').trim().replace(/[.,;]+$/, '');
  const pin = t.match(/[^\n]{0,60}\b\d{3}\s?\d{3}\b/); if (pin && /[a-z]{3,}/i.test(pin[0]) && !/\+?\d{10}/.test(pin[0].replace(/\s/g, ''))) return pin[0].trim();
  const city = t.match(PLACES); return city ? city[0].replace(/^\w/, c => c.toUpperCase()) : '';
}
export function km(a, b) {
  if (!a || !b) return null;
  const R = 6371, r = (x) => x * Math.PI / 180;
  const dLat = r(b.lat - a.lat), dLon = r(b.lon - a.lon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(x)) * 10) / 10;
}

/* ---------- Splitting a message with several vendors ---------- */
// A list of vendors (numbered, bulleted, or separated by blank lines, each with its own phone/link/handle)
// becomes one piece each. A single vendor's message spread over lines stays together.
export function splitVendors(text) {
  const t = String(text || '').replace(/\r/g, '').trim(); if (!t) return [];
  const hasId = (s) => phonesIn(s).length || linksIn(s).length || handlesIn(s).length;
  // 1. numbered or bulleted items
  const numbered = t.split(/\n(?=\s*(?:\d{1,2}[.)]|[•*\-–]|\(\d{1,2}\))\s+\S)/);
  if (numbered.length > 1 && numbered.filter(hasId).length >= 2) return mergeOrphans(numbered);
  // 2. blank-line blocks
  const blocks = t.split(/\n\s*\n+/);
  if (blocks.length > 1 && blocks.filter(hasId).length >= 2) return mergeOrphans(blocks);
  // 3. one line per vendor: "Name - 98xxxxxxx" lines
  const lines = t.split('\n').filter(l => l.trim());
  if (lines.length > 1 && lines.every(l => hasId(l) || l.trim().length < 3) && lines.filter(hasId).length >= 2 && lines.filter(l => /[a-z]{3,}/i.test(l)).length >= 2) return lines.filter(hasId);
  return [t];
}
// A piece with no phone/link/handle (a header, or a stray note) joins its neighbour:
// before the first vendor it's a heading for it, after one it belongs to the one above.
function mergeOrphans(parts) {
  const hasId = (s) => phonesIn(s).length || linksIn(s).length || handlesIn(s).length;
  const out = []; let lead = '';
  for (const p of parts.map(x => x.trim()).filter(Boolean)) {
    if (hasId(p)) { out.push(lead ? lead + '\n' + p : p); lead = ''; }
    else if (out.length) out[out.length - 1] += '\n' + p;
    else lead += (lead ? '\n' : '') + p;
  }
  return out.length ? out : parts;
}

/* ---------- Everything the rules can read from one piece ---------- */
export function readPiece(text) {
  const links = linksIn(text);
  const handles = handlesIn(text);
  const phones = phonesIn(text);
  const prices = pricesIn(text);
  const handle = handles[0] || '';
  const k = kindOf(text + ' ' + handles.join(' '));
  return {
    text: String(text || '').trim(),
    name: nameFrom(text, handle), nameFromHandle: !nameFrom(text, '') && !!handle, handle, handles,
    phones, phone: phones[0] || '',
    whatsapp: (links.find(l => linkKind(l) === 'whatsapp') || '').replace(/^https:\/\/wa\.me\//, '+').replace(/\D/g, '') ? phones[0] || '' : '',
    links: [...links, ...handles.filter(h => !links.some(l => igHandleOf(l) === h)).map(h => 'https://www.instagram.com/' + h)],
    emails: emailsIn(text), prices, price: prices[0] || null, dates: datesIn(text),
    location: locationIn(text), kind: k.kind, kindSure: k.sure
  };
}

/* ---------- Same vendor? ---------- */
// By phone, Instagram handle, or name — in that order of certainty.
export function sameVendor(a, b) {
  const ph = (x) => (x.phones || [x.phone]).filter(Boolean).map(p => String(p).replace(/\D/g, '').slice(-10));
  const pa = ph(a), pb = ph(b);
  if (pa.length && pb.length && pa.some(p => pb.includes(p))) return 'phone';
  const ha = (a.handles || [a.handle]).filter(Boolean).map(x => x.toLowerCase()), hb = (b.handles || [b.handle]).filter(Boolean).map(x => x.toLowerCase());
  if (ha.length && hb.length && ha.some(x => hb.includes(x))) return 'handle';
  const na = nameKey(a.name), nb = nameKey(b.name);
  if (na.length >= 4 && na === nb) return 'name';
  return '';
}
