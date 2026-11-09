'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const validation = require('../docs/assets/js/ps4-catalogue-validation.js');
const state = require('../docs/assets/js/ps4-catalogue-state.js');
const { createClient } = require('../docs/assets/js/ps4-catalogue-api.js');

const managerHtml = fs.readFileSync(path.join(__dirname, '../docs/ps4/catalogues/index.html'), 'utf8');
const senderHtml = fs.readFileSync(path.join(__dirname, '../docs/ps4/send/index.html'), 'utf8');
const projectsHtml = fs.readFileSync(path.join(__dirname, '../docs/index.html'), 'utf8');
const senderScript = fs.readFileSync(path.join(__dirname, '../docs/assets/js/ps4-package-sender.js'), 'utf8');
const bgftHtml = fs.readFileSync(path.join(__dirname, '../docs/bgft/index.html'), 'utf8');
const bgftScript = fs.readFileSync(path.join(__dirname, '../docs/bgft/assets/js/ps4-package-sender.js'), 'utf8');
const bgftApi = fs.readFileSync(path.join(__dirname, '../docs/bgft/assets/js/ps4-catalogue-api.js'), 'utf8');
const fpkgReleaseScript = fs.readFileSync(path.join(__dirname, '../docs/assets/js/fpkg-release.js'), 'utf8');
const bgftInstallScript = fs.readFileSync(path.join(__dirname, '../docs/assets/js/bgft-pwa-install.js'), 'utf8');
assert.match(managerHtml, /class="catalogue-entry"/);
assert.doesNotMatch(managerHtml, /id="catalogueCategory"|id="catalogueAdapter"|>Category</);
assert.doesNotMatch(managerHtml, /Send a package to PS4|id="pkgDropTarget"|packageToggle/);
assert.match(managerHtml, /href="\/ps4\/send\/"/);
assert.doesNotMatch(senderHtml, /id="pkgDropTarget"/);
assert.doesNotMatch(senderHtml, /id="sendButton"/);
assert.match(senderHtml, /id="sendPackageForm"/);
const fpkgCardStart = projectsHtml.indexOf('<div class="project-card" aria-label="FPKG Builder project">');
const streamzPageStart = projectsHtml.indexOf('<!-- Streamz Page -->', fpkgCardStart);
assert.ok(fpkgCardStart >= 0 && streamzPageStart > fpkgCardStart, 'FPKG Builder project card is missing');
const fpkgCard = projectsHtml.slice(fpkgCardStart, streamzPageStart);
assert.match(fpkgCard, /<h2>FPKG Builder<\/h2>/);
assert.match(fpkgCard, /href="https:\/\/github\.com\/rileyadams05\/FPKG-Builder"[^>]*>Repository</);
assert.match(fpkgCard, /id="fpkgBuilderInstallButton"[^>]*>Install</);
assert.match(fpkgCard, /id="fpkgProjectVersion"/);
assert.doesNotMatch(fpkgCard, /Send FPKG|\/ps4\/send\//);
assert.doesNotMatch(fpkgCard, /Send FPKG|\/ps4\/send\//);
assert.match(senderHtml, /id="pairingPanel"/);
assert.match(senderHtml, /id="uploadProgress"/);
assert.match(senderHtml, /id="taskStatus"/);
assert.match(senderScript, /\/pairing\/challenge/);
assert.match(senderScript, /\/bgft\/tasks/);
assert.match(senderScript, /watchTask\(\{ receiver: 'bgft'/);
assert.match(projectsHtml, /<div class="project-card" aria-label="BGFT project">/);
assert.match(projectsHtml, /href="https:\/\/github\.com\/rileyadams05\/BGFT"[^>]*>Repository<\/a>/);
assert.match(projectsHtml, /<a[^>]+id="bgftInstallButton"[^>]+href="\/bgft\/\?install=1"[^>]*>Install<\/a>/);
assert.match(projectsHtml, /<pwa-install[^>]+manifest-url="\/bgft\/manifest\.webmanifest"/);
assert.match(projectsHtml, /assets\/vendor\/pwa-install-0\.7\.0\.es\.js/);
assert.match(projectsHtml, /id="bgftOpenInstalledApp"[^>]+href="\/bgft\/"/);
assert.match(projectsHtml, /id="bgftOpenInBrowser"[^>]+href="\/bgft\/\?open=browser"/);
assert.match(bgftInstallScript, /\.install\(\)/);
assert.match(bgftInstallScript, /pwa-install-success-event/);
assert.match(bgftInstallScript, /pwa-install-fail-event/);
assert.match(bgftInstallScript, /pwa-user-choice-result-event/);
assert.match(bgftInstallScript, /isWebInstallSupported !== true/);
const pagesWorkflow = fs.readFileSync(path.join(__dirname, '../.github/workflows/pages.yml'), 'utf8');
assert.match(pagesWorkflow, /npm install .*@khmyznikov\/pwa-install@0\.7\.0 esbuild@0\.25\.5/);
assert.match(pagesWorkflow, /\.bin\/esbuild.*--bundle --format=esm/);
assert.match(pagesWorkflow, /! grep -Fq 'from"lit'/);
assert.match(bgftHtml, /<title>BGFT · PS4 Package Installation<\/title>/);
assert.ok(bgftHtml.includes('<pwa-install id="bgftPwaInstall" manual-apple manual-chrome manifest-url="./manifest.webmanifest">'));
assert.match(bgftHtml, /href="\/projects\/"[^>]*aria-label="Back to Projects page"/);
assert.match(bgftHtml, /id="connectPs4Button"/);
assert.match(bgftHtml, /id="choosePkgButton"/);
assert.match(bgftHtml, /\.mobile-upload \{ display:none/);
assert.match(bgftHtml, /@media \(hover:none\) and \(pointer:coarse\)/);
assert.match(bgftHtml, /title="Choose a PKG file">\+/);
assert.match(bgftHtml, /manifest\.webmanifest/);
assert.match(fs.readFileSync(path.join(__dirname, '../docs/bgft/assets/js/pwa-install.js'), 'utf8'), /installer\.showDialog\(true\)/);
assert.ok(fs.readFileSync(path.join(__dirname, '../docs/bgft/assets/js/pwa-install.js'), 'utf8').includes('await installer.updateComplete'));
assert.doesNotMatch(bgftHtml, /class="topbar"|href="\/ps4\/(?:install|catalogues)\/"/);
assert.ok(bgftHtml.includes("sw.js?v=6"));
const bgftManifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/bgft/manifest.webmanifest'), 'utf8'));
assert.equal(bgftManifest.id, '/bgft/');
assert.equal(bgftManifest.start_url, '/bgft/');
assert.equal(bgftManifest.scope, '/bgft/');
assert.match(bgftScript, /const bgftMode = true/);
assert.match(bgftScript, /\/pairing\/challenge/);
assert.match(bgftScript, /\/bgft\/tasks/);
assert.doesNotMatch(bgftScript, /connect\(savedIp\)/);
assert.match(bgftApi, /application\/vnd\.vortex-prime\.pkg/);
assert.match(projectsHtml, /<dialog[^>]+id="fpkgReleaseDialog"/);
assert.match(fpkgReleaseScript, /api\.github\.com\/repos\/rileyadams05\/FPKG-Builder\/releases\/latest/);
assert.match(fpkgReleaseScript, /browser_download_url/);
assert.match(fpkgReleaseScript, /target = '_blank'/);
assert.match(fpkgReleaseScript, /RELEASE_CACHE_TTL_MS/);
assert.match(senderScript, /get\('receiver'\) === 'bgft'/);
assert.match(senderScript, /if \(!bgftMode && rpiReady\)/);

function expectError(callback, pattern) {
  assert.throws(callback, pattern);
}

const goodCatalogue = {
  schema: 'vortex-prime.ps4-catalogue/v1',
  name: 'Test Homebrew',
  items: [{ id: 'publisher.app', name: 'Example app', pkg_url: 'https://cdn.example.test/app.pkg' }]
};

assert.deepEqual(validation.validateCatalogueDocument(goodCatalogue, 'vortex-v1'), {
  name: 'Test Homebrew', count: 1, schema: 'vortex-prime.ps4-catalogue/v1', adapter_id: 'vortex-v1'
});
for (const category of ['games', 'updates', 'dlc', 'homebrew', 'applications']) assert.ok(validation.categories.includes(category));
expectError(() => validation.parseCatalogueUrl('not a url'), /complete catalogue URL/);
expectError(() => validation.parseCatalogueUrl('ftp://example.org/catalogue.json'), /HTTP or HTTPS/);
expectError(() => validation.parseCatalogueUrl('https://user:pass@example.org/catalogue.json'), /credentials/);
expectError(() => validation.validateCatalogueDocument({ ...goodCatalogue, schema: 'unknown/v9' }, 'vortex-v1'), /Unsupported catalogue schema/);
expectError(() => validation.validateCatalogueDocument({ schema: goodCatalogue.schema, name: '', items: [] }, 'vortex-v1'), /non-empty "name"/);
expectError(() => validation.validateCatalogueDocument({ schema: goodCatalogue.schema, name: 'No items' }, 'vortex-v1'), /"items" array/);
expectError(() => validation.validateCatalogueDocument({ ...goodCatalogue, items: [goodCatalogue.items[0], goodCatalogue.items[0]] }, 'vortex-v1'), /Duplicate item id/);
expectError(() => validation.validateCatalogueDocument({ ...goodCatalogue, items: [{ id: 'bad', name: 'Bad URL', pkg_url: 'file:///tmp/not-a-pkg.pkg' }] }, 'vortex-v1'), /http\(s\)/);
assert.equal(validation.isPrivateIPv4('192.168.1.50'), true);
assert.equal(validation.isPrivateIPv4('8.8.8.8'), false);
assert.equal(validation.isDuplicateUrl([{ url: 'https://example.org/catalogue.json' }], 'https://example.org:443/catalogue.json'), true);

const remote = [
  { id: 'remote-a', url: 'https://catalogue.example/a.json', category: 'games', enabled: true, user_pref: 'preserve' },
  { id: 'remote-b', url: 'https://catalogue.example/b.json', category: 'dlc', enabled: true }
];
let queue = [];
queue = state.queue(queue, { operation_id: 'add-1', op: 'add', source: { id: 'local-c', url: 'https://catalogue.example/c.json', category: 'homebrew', enabled: true } });
queue = state.queue(queue, { operation_id: 'change-enable', op: 'set-enabled', source_id: 'local-c', enabled: false });
queue = state.queue(queue, { operation_id: 'change-category', op: 'set-category', source_id: 'local-c', category: 'applications' });
assert.equal(queue.length, 1, 'edits to a pending new source should coalesce into its add operation');
assert.equal(queue[0].source.enabled, false);
assert.equal(queue[0].source.category, 'applications');
let merged = state.applyPending(remote, queue);
assert.equal(merged.length, 3);
assert.equal(merged.find(source => source.id === 'remote-a').user_pref, 'preserve');
assert.equal(merged.find(source => source.id === 'local-c').category, 'applications');

queue = state.queue(queue, { operation_id: 'remove-local', op: 'remove', source_id: 'local-c' });
assert.equal(queue.length, 0, 'removing an unsynced new source should cancel its pending add');
queue = state.queue(queue, { operation_id: 'disable-a', op: 'set-enabled', source_id: 'remote-a', enabled: false });
queue = state.queue(queue, { operation_id: 'category-a', op: 'set-category', source_id: 'remote-a', category: 'updates' });
queue = state.queue(queue, { operation_id: 'remove-b', op: 'remove', source_id: 'remote-b' });
merged = state.applyPending(remote, queue);
assert.equal(merged.length, 1, 'a remove must affect only its selected source');
assert.equal(merged[0].enabled, false);
assert.equal(merged[0].category, 'updates');
assert.equal(merged[0].user_pref, 'preserve', 'unrelated server-owned settings must survive edits');
assert.deepEqual(state.acknowledge(queue, ['disable-a']), queue.slice(1), 'only explicitly acknowledged operations may be cleared');
const memory = new Map();
const fakeStorage = { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value) };
const offlineSnapshot = { sources: merged, pending: queue, revision: 'r1' };
assert.equal(state.write(fakeStorage, 'catalogues', offlineSnapshot), true);
assert.deepEqual(state.read(fakeStorage, 'catalogues'), offlineSnapshot, 'local sources and pending edits must survive a browser reconnect/reload');
memory.set('broken', '{bad json');
assert.deepEqual(state.read(fakeStorage, 'broken'), { sources: [], pending: [], revision: null });

const calls = [];
let xhrInstance;
class FakeXhr {
  constructor() { this.upload = {}; this.headers = {}; this.status = 200; this.responseText = '{"task_id":"task-1","source":"upload","status":"registered"}'; xhrInstance = this; }
  open(method, url, async) { this.method = method; this.url = url; this.async = async; }
  setRequestHeader(name, value) { this.headers[name] = value; }
  send(body) { this.body = body; this.onload(); }
}
const mockFetch = async (url, options) => {
  calls.push({ url, options });
  if (url.endsWith('/conflict')) return { ok: false, status: 409, text: async () => JSON.stringify({ code: 'revision_conflict', message: 'Revision changed' }) };
  if (url.endsWith('/invalid-json')) return { ok: true, status: 200, text: async () => '<html>not JSON</html>' };
  if (url.endsWith('/offline')) throw new TypeError('fetch failed');
  return { ok: true, status: 200, text: async () => JSON.stringify({ revision: 'r2', applied_operation_ids: ['op-1'], sources: [] }) };
};
const client = createClient(mockFetch, 12801, () => new FakeXhr());
(async () => {
  const result = await client.request('192.168.1.50', '/catalogues/operations', {
    method: 'POST', token: 'pair-token',
    headers: { 'If-Match': 'r1', 'Idempotency-Key': 'batch-1' },
    body: { batch_id: 'batch-1', base_revision: 'r1', operations: [{ operation_id: 'op-1', op: 'remove', source_id: 'remote-b' }] }
  });
  assert.equal(result.revision, 'r2');
  assert.equal(calls[0].url, 'http://192.168.1.50:12801/api/v1/catalogues/operations');
  assert.equal(calls[0].options.credentials, 'omit');
  assert.equal(calls[0].options.mode, 'cors');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer pair-token');
  assert.equal(calls[0].options.headers['If-Match'], 'r1');
  assert.equal(JSON.parse(calls[0].options.body).operations[0].source_id, 'remote-b');
  await assert.rejects(client.request('192.168.1.50', '/conflict'), error => error.status === 409 && error.body.code === 'revision_conflict');
  await assert.rejects(client.request('192.168.1.50', '/invalid-json'), /invalid JSON/);
  await assert.rejects(client.request('192.168.1.50', '/offline'), /local PS4 service/);
  const uploadFile = { name: 'homebrew.pkg', size: 1234 };
  const upload = await client.upload('192.168.1.50', '/bgft/uploads?filename=homebrew.pkg', uploadFile, 'pair-token', () => {});
  assert.equal(upload.status, 'registered');
  assert.equal(xhrInstance.url, 'http://192.168.1.50:12801/api/v1/bgft/uploads?filename=homebrew.pkg');
  assert.equal(xhrInstance.method, 'POST');
  assert.equal(xhrInstance.headers.Authorization, 'Bearer pair-token');
  assert.equal(xhrInstance.headers['Content-Type'], 'application/vnd.vortex-prime.pkg');
  assert.equal(xhrInstance.body, uploadFile, 'upload streams the selected file object directly to the console endpoint');
  process.stdout.write('PS4 catalogue validation, pending operations, API errors, and direct BGFT upload client tests passed.\n');
})().catch(error => { console.error(error); process.exitCode = 1; });

