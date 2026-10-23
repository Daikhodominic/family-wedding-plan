// One-tap WhatsApp nudges: opens WhatsApp with the message already written.
// With a saved number it goes straight to that person; without one WhatsApp asks who to send it to.
import { store } from './store.js?v=32';
import { h, ICONS, shortDate, daysUntil, buzz } from './ui.js?v=32';
import { wedding, live } from './app.js?v=32';
import { siteLink } from './tools.js?v=32';

// Indian numbers are usually typed as 10 digits; WhatsApp needs the country code.
export function waNumber(raw) {
  let d = String(raw || '').replace(/[^\d]/g, '');
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  if (d.length === 10) d = '91' + d;
  return d.length >= 11 && d.length <= 15 ? d : '';
}
export const waHref = (phone, text) => `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(text)}`;
export function openWhatsApp(phone, text) { buzz(10); window.open(waHref(phone, text), '_blank', 'noopener'); }

const first = (name) => String(name || '').trim().split(/\s+/)[0] || '';
const coupleOf = (wid) => { const w = wedding(wid); return w ? w.couple : 'the wedding'; };
const sign = () => (store.me && store.me.name ? `\n\n— ${store.me.name}` : '');

// What a step is still missing, in words someone would actually send.
function stepAskText(s) {
  const opts = live(store.rows('board_items')).filter(i => i.kind === 'option' && (i.data || {}).step_id === s.id).length;
  const late = s.due && s.status !== 'done' && daysUntil(s.due) < 0;
  let need;
  if (late) need = `it was due on ${shortDate(s.due)}. How is it going? Anything I can help with?`;
  else if (!opts && !s.locked_at && s.gate) need = 'could you add a few options — photos, the rate and a phone number? Everyone can then vote on them.';
  else if (!s.due && !s.locked_at) need = 'when do you think this can be done?';
  else if (s.status === 'in_progress') need = 'how is it going? Please update it when there’s news.';
  else need = 'any update? Please tick it off or add the details when you can.';
  return need;
}

export function stepMessage(s) {
  const link = siteLink(`#/w/${s.wedding_id}/plan?open=${s.id}`);
  const hi = s.owner ? `Hi ${first(s.owner)}, ` : 'Hi everyone, ';
  if (!s.owner) return `${hi}who can take care of “${s.title}” for ${coupleOf(s.wedding_id)}’s wedding? Nobody is in charge of it yet.\n\n${link}${sign()}`;
  return `${hi}about “${s.title}” for ${coupleOf(s.wedding_id)}’s wedding: ${stepAskText(s)}\n\n${link}${sign()}`;
}

export function jobsMessage(name, jobs, wid) {
  const lines = jobs.slice(0, 6).map(t => `• ${t.title}${t.due ? (daysUntil(t.due) < 0 ? ` (was due ${shortDate(t.due)})` : ` (by ${shortDate(t.due)})`) : ''}`);
  const more = jobs.length > 6 ? `\n…and ${jobs.length - 6} more` : '';
  return `Hi ${first(name)}, a quick check on your jobs for ${coupleOf(wid)}’s wedding:\n${lines.join('\n')}${more}\n\nPlease update or tick them off here: ${siteLink('#/me')}${sign()}`;
}

export function optionMessage(o, stepTitle) {
  const d = o.data || {};
  return `New option for ${stepTitle || 'the wedding'} (${coupleOf(o.wedding_id)}): ${d.title || 'have a look'}${d.rate ? ' — ' + d.rate : ''}.\nHave a look and vote ♥ / ? / ✕:\n${siteLink(`#/w/${o.wedding_id}/swipe?step=${d.step_id || ''}`)}${sign()}`;
}
export function swipeMessage(wid, n) {
  return `${n} new ${n === 1 ? 'thing' : 'things'} to look at for ${wid ? coupleOf(wid) + '’s wedding' : 'the weddings'} — photos, rates and links. Swipe to vote, it takes a minute:\n${siteLink(wid ? `#/w/${wid}/swipe` : '#/swipe')}${sign()}`;
}
export function vendorMessage(o, stepTitle) {
  const d = o.data || {}; const w = wedding(o.wedding_id);
  const when = w && w.wedding_date ? ` on ${shortDate(w.wedding_date)}` : w && w.date_note ? ` (${w.date_note})` : '';
  return `Hello${d.title ? ' ' + d.title.replace(/^Example:\s*/, '') : ''}, we’re planning a wedding${when} and are looking at ${String(stepTitle || 'your services').toLowerCase()}. Could you share your rates, what’s included and whether you’re free on that date? Thank you!${store.me && store.me.name ? '\n— ' + store.me.name : ''}`;
}

// The button itself. `to` is a person's name (their saved number is used when there is one).
export function waButton({ label, text, to = '', phone = '', small = true, cls = '' }) {
  const num = phone || (to ? store.memberPhone(to) : '');
  return h('button', {
    type: 'button', class: `btn ${small ? 'small ' : ''}wa-btn ${cls}`.trim(),
    title: num ? `Opens WhatsApp to ${to || 'them'}` : 'Opens WhatsApp — pick who to send it to',
    onclick: (e) => { e.preventDefault(); e.stopPropagation(); openWhatsApp(num, typeof text === 'function' ? text() : text); }
  }, h('span', { class: 'wa-ic', html: ICONS.chat }), label);
}

export function stepWaButton(s) {
  if (s.locked_at || s.status === 'done') return null;
  const label = s.owner ? `Ask ${first(s.owner)} on WhatsApp` : 'Ask on WhatsApp who can do this';
  return waButton({ label, to: s.owner || '', text: () => stepMessage(store.find('steps', s.id) || s) });
}
