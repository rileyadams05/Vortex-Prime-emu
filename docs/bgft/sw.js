const CACHE_NAME = 'bgft-shell-v1';
const APP_SCOPE = new URL(self.registration.scope);
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon.svg', './assets/js/ps4-catalogue-api.js', './assets/js/ps4-package-sender.js'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('bgft-shell-') && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(APP_SCOPE.pathname)) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(new URL('./index.html', APP_SCOPE).href)));
    return;
  }
  event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
});
