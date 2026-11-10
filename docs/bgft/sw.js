// Retires only the former BGFT PWA scope. The Vortex Prime root worker is untouched.
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith('bgft-shell-')).map((name) => caches.delete(name)));
    await self.clients.claim();
    await self.registration.unregister();
  })());
});

// No fetch handler: requests use the network while this retirement worker updates.
