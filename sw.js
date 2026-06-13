const CACHE_NAME = 'abducktion-v2';
const BASE = '/DodoDuckUFO';

const ASSETS = [
  `${BASE}/`,
  `${BASE}/index.html`,
  `${BASE}/style.css`,
  `${BASE}/modal.css`,
  `${BASE}/script.js`,
  `${BASE}/game.js`,
  `${BASE}/app.js`,
  `${BASE}/manifest.json`,
  `${BASE}/icon-192.png`,
  `${BASE}/icon-512.png`,
  `${BASE}/images/transparent/ufo.png`,
  `${BASE}/images/mallard.png`,
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Only handle requests within our scope
  if (!event.request.url.includes(BASE)) return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
