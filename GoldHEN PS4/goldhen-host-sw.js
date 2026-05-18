const CACHE_NAME = 'vortex-goldhen-cache-v1';
const RESOURCES = [
  './',
  './index.html',
  '../docs/hen/assets/goldhen-host.css',
  '../docs/hen/assets/goldhen-host.js',
  '../docs/hen/payloads/goldhen_2.3_505.bin',
  '../docs/hen/payloads/goldhen_2.3_672.bin',
  '../docs/hen/payloads/goldhen_2.3_900.bin'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(RESOURCES))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => (key !== CACHE_NAME ? caches.delete(key) : undefined))
    ))
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
