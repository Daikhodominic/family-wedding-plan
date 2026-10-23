// Drawn icons for plan areas (picked from the area's name), progress rings and stage numerals.
const sv = (p) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const I = {
  money: sv('<circle cx="12" cy="12" r="8.5"/><path d="M9 8.5h6M9 11h6M9.5 8.5c3.5 0 3.5 5-0 5l4.5 4"/>'),
  church: sv('<path d="M12 2.5v4M10.5 4h3"/><path d="M6.5 21V11l5.5-4.5 5.5 4.5v10"/><path d="M4 21h16"/><path d="M10.2 21v-3.6a1.8 1.8 0 0 1 3.6 0V21"/><circle cx="12" cy="11.6" r="1.3"/>'),
  family: sv('<circle cx="8" cy="8" r="2.6"/><circle cx="16" cy="8" r="2.6"/><path d="M3.5 19c.6-3.3 2.4-5 4.5-5s3.9 1.7 4.5 5"/><path d="M11.5 19c.6-3.3 2.4-5 4.5-5s3.9 1.7 4.5 5"/>'),
  rings: sv('<circle cx="9" cy="14" r="5"/><circle cx="15" cy="14" r="5"/><path d="M10.5 4.5l1.5 2 1.5-2-1.5-1.5z"/>'),
  invite: sv('<rect x="3.5" y="6" width="17" height="12.5" rx="1.5"/><path d="M3.8 6.6l8.2 6.4 8.2-6.4"/><circle cx="12" cy="13.4" r="1.6"/>'),
  home: sv('<path d="M4 11l8-6.5 8 6.5"/><path d="M6 9.6V20h12V9.6"/><path d="M10 20v-5h4v5"/>'),
  decor: sv('<circle cx="12" cy="9" r="2.4"/><path d="M12 4.2a2.4 2.4 0 0 1 0 4.8M7.4 7.5a2.4 2.4 0 0 1 4.4 1.6M16.6 7.5a2.4 2.4 0 0 0-4.4 1.6M8.4 12.3a2.4 2.4 0 0 1 3.6-1.3M15.6 12.3a2.4 2.4 0 0 0-3.6-1.3"/><path d="M12 11.6V21M12 16c-2.2 0-3.6-1.2-4-3M12 18c2.2 0 3.6-1.2 4-3"/>'),
  music: sv('<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>'),
  camera: sv('<rect x="3" y="7" width="18" height="12.5" rx="2"/><path d="M8.5 7l1.5-2.5h4L15.5 7"/><circle cx="12" cy="13.2" r="3.4"/>'),
  food: sv('<path d="M5 3v7a2 2 0 0 0 2 2v9M9 3v7a2 2 0 0 1-2 2M7 3v6"/><path d="M17 21V3c-2 1.2-3 3.6-3 7 0 2 1 3 3 3"/>'),
  car: sv('<path d="M4 16.5V12l2-5h12l2 5v4.5"/><path d="M3.5 12h17"/><circle cx="7.5" cy="16.5" r="1.8"/><circle cx="16.5" cy="16.5" r="1.8"/><path d="M9.3 16.5h5.4"/>'),
  people: sv('<circle cx="12" cy="7.5" r="3"/><path d="M5.5 20c.8-4 3.3-6 6.5-6s5.7 2 6.5 6"/><path d="M17 4.5l1.2 1.2L20.5 3.5"/>'),
  clock: sv('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  heart: sv('<path d="M12 20s-7.5-4.6-7.5-10.4A4.1 4.1 0 0 1 12 7.2a4.1 4.1 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z"/>'),
  check: sv('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12.2l2.8 2.8L16.5 9"/>'),
  pin: sv('<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>'),
  calendar: sv('<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/><path d="M12 13.5l.9 1.8 2 .3-1.45 1.4.35 2L12 18l-1.8 1 .35-2-1.45-1.4 2-.3z"/>'),
  gift: sv('<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M3.5 9h17v3h-17zM12 9v11"/><path d="M12 9c-1.5-3-5-3.5-5-1.2C7 9 12 9 12 9zM12 9c1.5-3 5-3.5 5-1.2C17 9 12 9 12 9z"/>'),
  dress: sv('<path d="M9 3l1.5 4h3L15 3M10.5 7L7 21h10L13.5 7"/><path d="M8.6 14.5c2.2.8 4.6.8 6.8 0"/>'),
  sparkle: sv('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>')
};
const RULES = [
  [/money|budget|cost|pay|account/i, 'money'], [/church|sacrament|priest|mass|banns|service/i, 'church'], [/famil|custom|elder|tradition/i, 'family'],
  [/ring/i, 'rings'], [/cloth|attire|dress|gown|suit|shawl/i, 'dress'], [/invit|guest|card/i, 'invite'], [/home|bedroom|house/i, 'home'],
  [/décor|decor|setup|flower|bouquet/i, 'decor'], [/music|song|choir|band/i, 'music'], [/photo|video/i, 'camera'], [/food|menu|cater|cake|meat|kitchen/i, 'food'],
  [/transport|shopping|car|vehicle|travel/i, 'car'], [/in charge|people|volunteer|host|who does/i, 'people'], [/thank|visit/i, 'heart'],
  [/wrap|after|final|return|settle/i, 'check'], [/venue|location|place/i, 'pin'], [/date|booking|calendar|schedule/i, 'calendar'], [/gift/i, 'gift'],
  [/day|before the|morning|time/i, 'clock']
];
export function areaIcon(title) { const r = RULES.find(([re]) => re.test(title || '')); return I[r ? r[1] : 'sparkle']; }

// A progress ring: done (wedding light colour) and final (gold) as arcs around an icon.
export function ringSvg(done, final, total, size = 44) {
  const r = size / 2 - 3, c = 2 * Math.PI * r, d = total ? done / total : 0, f = total ? final / total : 0;
  return `<svg class="ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-bg"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-done" stroke-dasharray="${(d * c).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-final" stroke-dasharray="${(f * c).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
}
export const roman = (n) => ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n - 1] || String(n);
