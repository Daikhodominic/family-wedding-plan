// Lets the site open on a weak connection and be installed on a phone.
// Always the newest version when online; the saved copy only when offline.
const CACHE = 'fwp-shell-v35';
const SHARE = 'fwp-share'; // photos and links shared into the War Room from another app, waiting to be filed
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== SHARE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const req = e.request;
  // Shared from WhatsApp (or the gallery): keep the files, then open the page that files them.
  if (req.method === 'POST' && new URL(req.url).pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      try {
        const fd = await req.formData();
        const cc = await caches.open(SHARE);
        for (const k of await cc.keys()) await cc.delete(k);
        const files = fd.getAll('media').filter(f => f && f.size);
        const meta = { at: Date.now(), title: fd.get('title') || '', text: fd.get('text') || '', url: fd.get('url') || '', files: files.map((f, i) => ({ key: `shared/${i}`, name: f.name || `photo-${i + 1}.jpg`, type: f.type || 'application/octet-stream' })) };
        await Promise.all(files.map((f, i) => cc.put(`shared/${i}`, new Response(f, { headers: { 'Content-Type': f.type || 'application/octet-stream' } }))));
        await cc.put('shared/meta', new Response(JSON.stringify(meta), { headers: { 'Content-Type': 'application/json' } }));
      } catch (err) { /* fall through to the page, which says nothing arrived */ }
      return Response.redirect(new URL('./index.html#/share', self.registration.scope).href, 303);
    })());
    return;
  }
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
// Tapping a notification opens the War Room at the right page.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const hash = (e.notification.data && e.notification.data.url) || '#/home';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const c = list.find(x => x.url.startsWith(self.registration.scope));
    if (c) { c.navigate ? c.navigate(c.url.split('#')[0] + hash).catch(() => { }) : null; return c.focus(); }
    return self.clients.openWindow(self.registration.scope + 'index.html' + hash);
  }));
});
