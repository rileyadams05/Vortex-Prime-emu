'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const workerSource = fs.readFileSync('docs/app-sw.js', 'utf8');
const handlers = {};
let cachePolicy;
const stale = new Response('stale');
const cache = { match: async () => stale, put: async () => {} };
vm.runInNewContext(workerSource, {
  self: { location: { origin: 'https://example.test' }, addEventListener: (name, fn) => { handlers[name] = fn; } },
  URL, Response, caches: { open: async () => cache, match: async () => stale },
  fetch: async (_request, options) => { cachePolicy = options.cache; return new Response('current'); }
});

(async () => {
  assert.match(workerSource, /names\s+\.filter\(\(name\) => name\.startsWith\('vortex-prime-'\)/);
  let response;
  handlers.fetch({
    request: { method: 'GET', url: 'https://example.test/assets/js/fpkg-release.js', destination: 'script' },
    respondWith: promise => { response = promise; }
  });
  assert.equal(await (await response).text(), 'current', 'stale JavaScript must not override the current response');
  assert.equal(cachePolicy, 'no-cache');
  process.stdout.write('Vortex Prime service worker cache invalidation and stale-script regression passed.\n');
})().catch(error => { console.error(error); process.exitCode = 1; });
