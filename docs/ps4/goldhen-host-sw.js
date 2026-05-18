const CACHE_NAME = 'vortex-goldhen-cache-v2';
const RESOURCES = [
  './',
  './index.html',
  './assets/goldhen-host.css',
  './assets/goldhen-host.js',
  './payloads/goldhen_2.3_505.bin',
  './payloads/goldhen_2.3_672.bin',
  './payloads/goldhen_2.3_900.bin'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(RESOURCES);
    })
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
    })
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
