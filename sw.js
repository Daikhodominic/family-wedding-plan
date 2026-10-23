// Lets the site open quickly and work on a weak connection, and be installed on a phone.
const CACHE = 'fwp-shell-v4';
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('supabase.co') || url.hostname.includes('microlink')) return; // live data never comes from the cache
  const isPage = req.mode === 'navigate';
  if (isPage) {
    // Pages: newest from the internet, saved copy if offline.
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(CACHE).then(cc => cc.put(req, c)); return r; }).catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
    return;
  }
  // Scripts, styles, pictures and fonts: saved copy at once, refreshed in the background.
  e.respondWith(caches.open(CACHE).then(async (cc) => {
    const hit = await cc.match(req);
    const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) cc.put(req, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
