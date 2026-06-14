// ─────────────────────────────────────────────────────────────────────────────
// Vortex Prime Service Worker
// Cache version is stamped at deploy time by .github/workflows/pages.yml.
// Every push to main produces a new unique version, automatically wiping
// stale caches without any manual version bumping.
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_VERSION = 'vortex-prime-v__BUILD_TS__';

// Same-origin asset paths that are safe to serve cache-first.
// These are wiped and rebuilt whenever CACHE_VERSION changes (i.e. on deploy).
const CACHE_FIRST_PATTERNS = [
  /^\/assets\//,
  /^\/favicon/,
  /^\/apple-touch-icon/,
  /^\/pwa-icon/,
  /^\/site\.webmanifest$/,
];

// ── Install ──────────────────────────────────────────────────────────────────
// skipWaiting() means the new SW activates immediately — no waiting for old
// tabs to close. Combine with clients.claim() in activate for seamless takeover.
self.addEventListener('install', () => {
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────────────────────
// Delete every cache that doesn't match the current CACHE_VERSION.
// This is the mechanism that wipes stale JS/CSS/images after a deploy.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_VERSION)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Pass cross-origin requests straight through — don't cache third-party
  // content (Google Fonts, external APIs, etc.).
  if (url.origin !== self.location.origin) return;

  // ── Navigation requests (HTML pages) ─────────────────────────────────────
  // Network first: always try to fetch the latest HTML from the server.
  // Fall back to the cache only when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('/'))
        )
    );
    return;
  }

  // ── Static assets (JS, CSS, images, icons, manifest) ─────────────────────
  // Cache first: serve instantly from cache; update cache in background.
  // Because CACHE_VERSION changes on every deploy, the old cache is deleted
  // on activate and assets are fetched fresh from the network on next use.
  const isCacheFirst = CACHE_FIRST_PATTERNS.some((pattern) =>
    pattern.test(url.pathname)
  );

  if (isCacheFirst) {
    event.respondWith(
      caches.open(CACHE_VERSION).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((response) => {
            if (response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          });
        })
      )
    );
    return;
  }

  // ── Everything else ───────────────────────────────────────────────────────
  // Network first with cache fallback.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => cached || caches.match('/'))
      )
  );
});
