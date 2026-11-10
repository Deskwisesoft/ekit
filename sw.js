// Service worker: app disponível offline + cache de mapa (Leaflet e mosaicos já vistos).
const VERSION = 'ekit-v21';
const APP = ['./', './index.html', './styles.css', './app.js', './data.js', './pontos-encontro.json', './manifest.webmanifest', './privacidade.html', './icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './chat.js', './vendor/nostr-tools-2.25.1.js', './vendor/fonts/source-sans-3-latin-wght-normal.woff2', './vendor/fonts/source-serif-4-latin-wght-normal.woff2',
  './vendor/leaflet/leaflet.min.js', './vendor/leaflet/leaflet.min.css'];
const TILES = 'ekit-tiles';
const MAX_TILES = 1500;

self.addEventListener('install', e => {
  // cache: 'reload' evita guardar cópias antigas da cache HTTP do browser.
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(APP.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== TILES).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trimTiles() {
  const c = await caches.open(TILES);
  const keys = await c.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_TILES))) await c.delete(k);
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Mosaicos do mapa: cache primeiro, guarda os que vão sendo vistos.
  if (url.hostname === 'tile.openstreetmap.org') {
    e.respondWith(caches.open(TILES).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) { c.put(req, res.clone()); trimTiles(); }
      return res;
    }));
    return;
  }

  // Ficheiros da app (tudo local): stale-while-revalidate.
  if (url.origin === location.origin) {
    e.respondWith(caches.open(VERSION).then(async c => {
      const hit = await c.match(req, { ignoreSearch: url.origin === location.origin });
      const net = fetch(req, { cache: 'no-cache' }).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => null);
      if (hit) { e.waitUntil(net); return hit; }
      return (await net) || (req.mode === 'navigate' ? c.match('./index.html') : Response.error());
    }));
  }
  // Restante (IPMA, ArcGIS): rede normal; a app guarda os últimos dados em localStorage.
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    const c = cs[0];
    if (!c) return self.clients.openWindow(url);
    return c.focus().then(w => (w || c).navigate ? (w || c).navigate(url).catch(() => {}) : null);
  }));
});
