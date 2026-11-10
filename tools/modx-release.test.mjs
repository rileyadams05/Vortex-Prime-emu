import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const source = await readFile(new URL('../docs/assets/js/fpkg-release.js', import.meta.url), 'utf8');
const releaseModule = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const home = await readFile(new URL('../docs/index.html', import.meta.url), 'utf8');
const modxPage = await readFile(new URL('../docs/modx/index.html', import.meta.url), 'utf8');
const workflow = await readFile(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');
const retirement = await readFile(new URL('../docs/bgft/index.html', import.meta.url), 'utf8');
const retirementWorker = await readFile(new URL('../docs/bgft/sw.js', import.meta.url), 'utf8');

const config = {
  repository: 'rileyadams05/ModX', projectName: 'ModX', assetMode: 'modx',
  buttonId: 'modxInstallButton', dialogId: 'modxReleaseDialog', prefix: 'modxRelease',
  cardVersionId: 'modxProjectVersion', cardInstallersId: 'modxProjectInstallers'
};

function makeNode() {
  const listeners = new Map();
  return {
    hidden: false, textContent: '', dataset: {}, href: '', children: [], childElementCount: 0,
    attributes: {}, className: '',
    addEventListener(type, callback) {
      const list = listeners.get(type) || [];
      list.push(callback);
      listeners.set(type, list);
    },
    async dispatch(type, event = {}) {
      for (const callback of listeners.get(type) || []) await callback({ target: this, ...event });
    },
    append(...nodes) { this.children.push(...nodes); this.childElementCount = this.children.length; },
    replaceChildren(...nodes) { this.children = [...nodes]; this.childElementCount = this.children.length; },
    setAttribute(name, value) { this.attributes[name] = value; },
    focus() { this.focused = true; }
  };
}

function harness() {
  const ids = [
    'modxInstallButton', 'modxReleaseDialog', 'modxReleaseStatus', 'modxReleaseRetry',
    'modxReleaseContent', 'modxProjectVersion', 'modxProjectInstallers', 'modxReleaseVersion',
    'modxReleaseDate', 'modxReleaseDownloads', 'modxReleaseAssetWarning', 'modxReleaseNotes',
    'modxReleaseNotesBody'
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, makeNode()]));
  const close = makeNode();
  const dialog = elements.modxReleaseDialog;
  dialog.querySelectorAll = () => [close];
  dialog.showModal = () => { dialog.open = true; };
  dialog.close = () => { dialog.open = false; void dialog.dispatch('close'); };
  const document = {
    readyState: 'complete',
    getElementById: (id) => elements[id] || null,
    createElement: () => makeNode(),
    createTextNode: (text) => ({ textContent: text })
  };
  return { elements, document, close };
}

const original = {
  document: Object.getOwnPropertyDescriptor(globalThis, 'document'),
  localStorage: Object.getOwnPropertyDescriptor(globalThis, 'localStorage'),
  fetch: Object.getOwnPropertyDescriptor(globalThis, 'fetch')
};
function setGlobals(values) {
  for (const [key, value] of Object.entries(values)) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
}
function restoreGlobals() {
  for (const [key, descriptor] of Object.entries(original)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  }
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

test('homepage replaces BGFT with the three active project cards and keeps ModX Cheat Tables', () => {
  const cards = [...home.matchAll(/<div class="project-card" aria-label="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(cards, ['NXE project', 'FPKG Builder project', 'ModX project']);
  assert.ok(home.includes('href="https://github.com/rileyadams05/ModX" target="_blank" rel="noopener noreferrer">Repository</a>'));
  assert.match(home, /id="modxInstallButton"[^>]+aria-controls="modxReleaseDialog"/);
  assert.match(home, /id="modxReleaseDialog"/);
  assert.match(home, /id="modxProjectVersion">Not released yet/);
  assert.match(home, /id="modxProjectInstallers">Not released yet/);
  assert.ok(home.includes('href="/modx/" class="nav-link"'));
  assert.doesNotMatch(home, /BGFT|bgft/i);
  assert.doesNotMatch(home, /bgft-pwa-install|pwa-install-0.7.0/);
  assert.ok(modxPage.includes('<h1>ModX Cheat Tables</h1>'));
  assert.ok(modxPage.includes('href="/">Home'));
  assert.ok(modxPage.includes('href="/help/">Help'));
});

test('ModX installer selection exposes only actual Windows MSI/EXE release assets', () => {
  const msi = { name: 'ModX_0.1.0_x64_en-US.msi', browser_download_url: 'https://github.com/release/modx.msi' };
  const exe = { name: 'ModX_0.1.0_x64-setup.exe', browser_download_url: 'https://github.com/release/modx.exe' };
  assert.deepEqual(releaseModule.selectModxInstallerAssets({ assets: [
    msi, exe,
    { name: 'Source code.zip', browser_download_url: 'https://github.com/release/source.zip' },
    { name: 'missing-url.msi' }
  ] }), [msi, exe]);
  assert.deepEqual(releaseModule.selectModxInstallerAssets({ assets: [] }), []);
});

test('ModX release dialog fetches the latest API record and links its real assets', async () => {
  const h = harness();
  const cache = new Map();
  const calls = [];
  const release = {
    tag_name: 'v0.1.0',
    published_at: '2026-09-17T14:02:28Z',
    body: 'First Windows preview.',
    assets: [
      { name: 'ModX_0.1.0_x64_en-US.msi', size: 2048, browser_download_url: 'https://github.com/rileyadams05/ModX/releases/download/v0.1.0/ModX.msi' },
      { name: 'ModX_0.1.0_x64-setup.exe', size: 4096, browser_download_url: 'https://github.com/rileyadams05/ModX/releases/download/v0.1.0/ModX.exe' },
      { name: 'Source code.zip', size: 1024, browser_download_url: 'https://github.com/source.zip' }
    ]
  };
  setGlobals({
    document: h.document,
    localStorage: { getItem: (key) => cache.get(key) || null, setItem: (key, value) => cache.set(key, value), removeItem: (key) => cache.delete(key) },
    fetch: async (url) => {
      calls.push(String(url));
      return { ok: true, status: 200, headers: { get: () => '"modx-release"' }, json: async () => release };
    }
  });
  try {
    releaseModule.initializeReleaseDialogs([config]);
    await settle();
    assert.deepEqual(calls, ['https://api.github.com/repos/rileyadams05/ModX/releases/latest']);
    assert.equal(h.elements.modxProjectVersion.textContent, '0.1.0');
    assert.equal(h.elements.modxProjectInstallers.textContent, 'MSI · EXE');
    assert.equal(h.elements.modxReleaseVersion.textContent, 'Version 0.1.0');
    assert.match(h.elements.modxReleaseDate.textContent, /^Released /);
    assert.equal(h.elements.modxReleaseNotesBody.textContent, 'First Windows preview.');
    assert.equal(h.elements.modxReleaseDownloads.children.length, 2);
    const firstDownload = h.elements.modxReleaseDownloads.children[0].children[1];
    assert.equal(firstDownload.href, release.assets[0].browser_download_url);
    assert.equal(firstDownload.textContent, 'Download');
    assert.equal(firstDownload.dataset.noGate, 'true');
    assert.equal(h.elements.modxReleaseAssetWarning.hidden, true);
    assert.equal(h.elements.modxReleaseContent.hidden, false);
    await h.elements.modxInstallButton.dispatch('click');
    assert.equal(h.elements.modxReleaseDialog.open, true);
    await h.close.dispatch('click');
    assert.equal(h.elements.modxReleaseDialog.open, false);
  } finally { restoreGlobals(); }
});

test('ModX with no published release shows no fake downloads and keeps a repository route', async () => {
  const h = harness();
  const cache = new Map();
  setGlobals({
    document: h.document,
    localStorage: { getItem: (key) => cache.get(key) || null, setItem: (key, value) => cache.set(key, value), removeItem: (key) => cache.delete(key) },
    fetch: async () => ({ ok: false, status: 404, headers: { get: () => null } })
  });
  try {
    releaseModule.initializeReleaseDialogs([config]);
    await settle();
    assert.match(h.elements.modxReleaseStatus.textContent, /No public ModX release is available yet/);
    assert.equal(h.elements.modxReleaseStatus.hidden, false);
    assert.equal(h.elements.modxReleaseContent.hidden, true);
    assert.equal(h.elements.modxReleaseDownloads.children.length, 0);
    assert.equal(h.elements.modxProjectVersion.textContent, 'Not released yet');
    assert.equal(h.elements.modxProjectInstallers.textContent, 'Not released yet');
    assert.ok(home.includes('href="https://github.com/rileyadams05/ModX/releases"'));
  } finally { restoreGlobals(); }
});

test('missing ModX installer assets and GitHub API rate limits are reported without fake downloads', async () => {
  const h = harness();
  const cache = new Map();
  let fetchCount = 0;
  setGlobals({
    document: h.document,
    localStorage: { getItem: (key) => cache.get(key) || null, setItem: (key, value) => cache.set(key, value), removeItem: (key) => cache.delete(key) },
    fetch: async () => {
      fetchCount++;
      return fetchCount === 1
        ? { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ tag_name: 'v0.1.1', assets: [{ name: 'Source.zip', browser_download_url: 'https://github.com/source.zip' }] }) }
        : { ok: false, status: 403, headers: { get: () => null } };
    }
  });
  try {
    releaseModule.initializeReleaseDialogs([config]);
    await settle();
    assert.equal(h.elements.modxProjectVersion.textContent, '0.1.1');
    assert.equal(h.elements.modxProjectInstallers.textContent, 'No installer attached');
    assert.equal(h.elements.modxReleaseDownloads.children.length, 0);
    assert.match(h.elements.modxReleaseAssetWarning.textContent, /does not include a supported Windows/);
    await h.elements.modxReleaseRetry.dispatch('click');
    await settle();
    assert.match(h.elements.modxReleaseStatus.textContent, /GitHub is temporarily limiting/);
    assert.equal(h.elements.modxReleaseRetry.hidden, false);
  } finally { restoreGlobals(); }
});

test('Pages deployment does not retrieve or generate the BGFT application', () => {
  assert.doesNotMatch(workflow, /Checkout BGFT web app|repository: rileyadams05\/BGFT|\.bgft-source|Prepare BGFT site files|pwa-install@/);
  assert.match(workflow, /actions\/deploy-pages@/);
  assert.match(workflow, /Purge Cloudflare Cache/);
});

test('old BGFT route retires and only unregisters its own service-worker scope', () => {
  assert.match(retirement, /BGFT Service has been retired/);
  assert.match(retirement, /registration\.scope === retiredScope/);
  assert.match(retirement, /name\.startsWith\('bgft-shell-'\)/);
  assert.match(retirementWorker, /name\.startsWith\('bgft-shell-'\)/);
  assert.match(retirementWorker, /self\.registration\.unregister\(\)/);
  assert.doesNotMatch(retirementWorker, /vortex-prime-/);
});
