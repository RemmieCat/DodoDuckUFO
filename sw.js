const CACHE_NAME = 'abducktion-v4';
const BASE = '/DodoDuckUFO';

const ASSETS = [
  `${BASE}/`,
  `${BASE}/index.html`,
  `${BASE}/style.css`,
  `${BASE}/modal.css`,
  `${BASE}/script.js`,
  `${BASE}/game.js`,
  `${BASE}/settings.js`,
  `${BASE}/app.js`,
  `${BASE}/manifest.json`,
  `${BASE}/icon-192.png`,
  `${BASE}/icon-512.png`,
  `${BASE}/images/transparent/ufo.png`,
  // Actions
  `${BASE}/images/actions/abducktion.png`,
  `${BASE}/images/actions/blackhole.png`,
  `${BASE}/images/actions/body_snatcher.png`,
  `${BASE}/images/actions/dubabduction.png`,
  `${BASE}/images/actions/gravity_assist.png`,
  `${BASE}/images/actions/mass_abducktion.png`,
  `${BASE}/images/actions/orbit.png`,
  `${BASE}/images/actions/parallel_universe.png`,
  `${BASE}/images/actions/shape_shifter.png`,
  `${BASE}/images/actions/swap.png`,
  `${BASE}/images/actions/teleport.png`,
  `${BASE}/images/actions/wormhole.png`,
  // Cartoon color ducks
  `${BASE}/images/colors/teal.png`,
  `${BASE}/images/colors/purple.png`,
  `${BASE}/images/colors/gold.png`,
  `${BASE}/images/colors/gray.png`,
  `${BASE}/images/colors/white.png`,
  // Realistic duck species
  `${BASE}/images/ducks/blue_goose.png`,
  `${BASE}/images/ducks/blue_winged_teal.png`,
  `${BASE}/images/ducks/brant.png`,
  `${BASE}/images/ducks/bufflehead.png`,
  `${BASE}/images/ducks/canada_goose.png`,
  `${BASE}/images/ducks/canvasback.png`,
  `${BASE}/images/ducks/cinnamon_teal.png`,
  `${BASE}/images/ducks/common_eider.png`,
  `${BASE}/images/ducks/common_loon.png`,
  `${BASE}/images/ducks/common_merganser.png`,
  `${BASE}/images/ducks/gadwall.png`,
  `${BASE}/images/ducks/green_winged_teal.png`,
  `${BASE}/images/ducks/hooded_merganser.png`,
  `${BASE}/images/ducks/king_eider.png`,
  `${BASE}/images/ducks/mallard.png`,
  `${BASE}/images/ducks/mute_swan.png`,
  `${BASE}/images/ducks/northern_shoveler.png`,
  `${BASE}/images/ducks/red_breasted_merganser.png`,
  `${BASE}/images/ducks/red_throated_loon.png`,
  `${BASE}/images/ducks/redhead.png`,
  `${BASE}/images/ducks/ring_necked.png`,
  `${BASE}/images/ducks/ruddy.png`,
  `${BASE}/images/ducks/snow_goose.png`,
  `${BASE}/images/ducks/surf_scoter.png`,
  `${BASE}/images/ducks/tundra_swan.png`,
  `${BASE}/images/ducks/wigeon.png`,
  `${BASE}/images/ducks/wood.png`,
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
  if (!event.request.url.includes(BASE)) return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
