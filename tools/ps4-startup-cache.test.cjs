const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

async function startup(page, savedIp, blocked = false) {
  const nodes = new Map();
  const makeNode = () => ({ hidden: false, value: '', dataset: {}, classList: { toggle() {}, add() {}, remove() {} }, addEventListener() {}, append() {}, appendChild() {}, replaceChildren() {}, setAttribute() {} });
  for (const match of read(`docs/ps4/${page}/index.html`).matchAll(/id="([^"]+)"/g)) nodes.set(match[1], makeNode());
  const context = { console, URL, URLSearchParams, AbortController, setTimeout, clearTimeout,
    document: { getElementById: id => nodes.get(id), createElement: makeNode },
    location: { search: '' }, addEventListener() {},
    fetch: async () => { throw new TypeError('offline'); },
    sessionStorage: { getItem: () => null },
    VortexPrimeCatalogueValidation: require('../docs/assets/js/ps4-catalogue-validation.js'),
    VortexPrimeCatalogueState: require('../docs/assets/js/ps4-catalogue-state.js'),
    VortexPrimeCatalogueApi: require('../docs/assets/js/ps4-catalogue-api.js')
  };
  const storage = { getItem: key => key === 'vortexPrime.consoleIp.ps4' ? savedIp : null, setItem() {} };
  Object.defineProperty(context, 'localStorage', { get() { if (blocked) throw new Error('Storage denied'); return storage; } });
  context.window = context;
  vm.runInNewContext(read(`docs/assets/js/ps4-${page === 'send' ? 'package-sender' : 'catalogue-manager'}.js`), context);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(nodes.get('manualIpPanel').hidden, Boolean(savedIp) && !blocked, `${page}: address visibility`);
  if (!savedIp || blocked) assert.equal(nodes.get('connectionLabel').textContent, 'No PS4 address saved');
  else assert.ok(!nodes.get('connectionLabel').textContent.includes('Checking'), 'offline checks must settle');
}

(async () => {
  for (const page of ['catalogues', 'send']) {
    await startup(page, '');
    await startup(page, '192.168.1.50');
    await startup(page, '', true);
  }
  const handlers = {};
  let policy;
  const old = new Response('stale');
  const cache = { match: async () => old, put: async () => {} };
  vm.runInNewContext(read('docs/app-sw.js'), {
    self: { location: { origin: 'https://example.test' }, addEventListener: (name, fn) => { handlers[name] = fn; } },
    URL, Response, caches: { open: async () => cache, match: async () => old },
    fetch: async (request, options) => { policy = options.cache; return new Response('current'); }
  });
  let result;
  handlers.fetch({ request: { method: 'GET', url: 'https://example.test/assets/js/ps4-package-sender.js', destination: 'script' }, respondWith: promise => { result = promise; } });
  assert.equal(await (await result).text(), 'current', 'cached JavaScript must not override the current response');
  assert.equal(policy, 'no-cache');
  console.log('Both PS4 pages: first visit, saved/offline address, denied storage; service worker stale-script regression passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
