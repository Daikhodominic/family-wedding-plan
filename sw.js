// Lets the site open on a weak connection and be installed on a phone.
// Always the newest version when online; the saved copy only when offline.
const CACHE = 'fwp-shell-v10';
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('supabase.co') || url.hostname.includes('microlink')) return; // live data never comes from the cache
  const same = url.origin === self.location.origin;
  const isPic = /\.(png|jpe?g|webp|gif|svg|woff2?)$/i.test(url.pathname);
  if (same && !isPic) {
    // Pages, scripts and styles: ask the internet first (skipping old browser copies), fall back to the saved copy.
    e.respondWith(fetch(req, { cache: 'no-cache' }).then(r => { if (r && r.ok) { const c = r.clone(); caches.open(CACHE).then(cc => cc.put(req, c)); } return r; })
      .catch(() => caches.match(req).then(r => r || (req.mode === 'navigate' ? caches.match('./index.html') : undefined))));
    return;
  }
  // Pictures and fonts: the saved copy at once, refreshed in the background.
  e.respondWith(caches.open(CACHE).then(async (cc) => {
    const hit = await cc.match(req);
    const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) cc.put(req, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
