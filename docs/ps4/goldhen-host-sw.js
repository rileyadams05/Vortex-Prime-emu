const CACHE_NAME = 'vortex-goldhen-cache-v4';
const RESOURCES = [
  './',
  './index.html',
  './goldhen-selector.html',
  './assets/goldhen-selector.css',
  './assets/goldhen-selector.js',
  './assets/goldhen-host.css',
  './assets/goldhen-host.js',
  './assets/data/vortex-goldhen-manifest.json',
  './vortex/vortex-autostart.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(RESOURCES);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
