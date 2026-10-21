// Anota service worker: network-first so updates always arrive when online, cache fallback for offline use.
const VERSION = 'anota-v9';
const ASSETS = [
  './', 'index.html', 'styles.css', 'app.js', 'db.js', 'pdfout.js', 'docx.js', 'polyfills.js', 'manifest.webmanifest',
  'vendor/pdf.min.mjs', 'vendor/pdf.worker.min.mjs', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/favicon-64.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => Promise.all(ASSETS.map((a) => c.add(new Request(a, { cache: 'reload' })))))
      .then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== 'inknote-inbox').map((k) => caches.delete(k))))
      .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  // Android "Share → Anota" with a PDF
  if (req.method === 'POST' && url.pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      try {
        const form = await req.formData();
        const file = form.get('file');
        if (file) {
          const cache = await caches.open('inknote-inbox');
          await cache.put('shared-file', new Response(file, { headers: { 'x-name': encodeURIComponent(file.name || 'Shared.pdf') } }));
        }
      } catch {}
      return Response.redirect(new URL('./?shared=1', self.registration.scope).href, 303);
    })());
    return;
  }
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  // cache first (instant start), refresh in the background so the next launch has the newest files
  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    const refresh = fetch(req).then((res) => { if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return res; });
    if (hit) { refresh.catch(() => {}); return hit; }
    try { return await refresh; } catch {
      if (req.mode === 'navigate') { const idx = await caches.match('index.html'); if (idx) return idx; }
      throw new Error('offline');
    }
  })());
});
