import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const site = await readFile(new URL('../docs/index.html', import.meta.url), 'utf8');
const auth = await readFile(new URL('../docs/assets/js/streamz-firebase-auth.js', import.meta.url), 'utf8');
const worker = await readFile(new URL('../cloudflare/worker.js', import.meta.url), 'utf8');
const start = site.indexOf('(function initializeNxeFtp() {');
const end = site.indexOf('}());', start) + 5;
assert(start >= 0 && end > start, 'NXE FTP controller is present');
assert.doesNotMatch(site.slice(site.indexOf('id="nxeFtpShell"'), site.indexOf('id="nxeFtpAuthPanel"')), /project-status|nxeFtpConnectionState/, 'FTP heading has no gold status badge');
assert.match(site, /window\.dispatchEvent\(new CustomEvent\('vortex-account-changed'/, 'shared account state notifies the FTP page');
assert.match(site, /renderButton\(buttonSlot/, 'shared Google button renderer serves both locations');
assert.match(auth, /waitForInitialSession/, 'Firebase restoration completes before showing signed-out UI');
assert.match(site, /if \(await refreshModsSession\(true\)\) return;[\s\S]*?await window\.StreamzFirebaseAuth\.waitForInitialSession\(\);[\s\S]*?await refreshModsSession\(\);/, 'initialization waits for persisted Firebase session');
assert.match(worker, /path === 'api\/nxe\/pair\/list'/, 'paired-console lookup route exists');
assert.match(worker, /ensureAuthenticated\(request, env, 'Sign in with Google to view paired consoles/, 'console lookup uses the existing Vortex session');

function harness(initialUser = null, initialHash = '') {
  const listeners = new Map();
  const nodes = new Map();
  const storage = new Map();
  const hiddenInitially = new Set(['nxeFtpAuthPanel', 'nxeFtpPairPanel', 'nxeFtpApp']);
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, {
      hidden: hiddenInitially.has(id), textContent: '', innerHTML: '', style: {},
      addEventListener() {}, appendChild() {},
    });
    return nodes.get(id);
  }
  const window = {
    location: { hash: initialHash },
    addEventListener(name, callback) { listeners.set(name, callback); },
    dispatchEvent(event) { listeners.get(event.type)?.(event); },
  };
  const context = {
    window, document: { getElementById: node, querySelectorAll: () => [], createElement: () => ({ addEventListener() {} }) },
    localStorage: { getItem: (key) => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) },
    URLSearchParams,
    fetch: async (url) => ({
      ok: true,
      json: async () => url.includes('/pair/list') ? { pairs: [] } :
        url.includes('/pair/claim') ? { pair: { pairId: 'test-console', consoleIp: '192.168.1.2', connected: true, running: true } } :
          { ok: true, path: '/', items: [] },
    }),
  };
  vm.runInNewContext(`let currentUser = ${JSON.stringify(initialUser)}; ${site.slice(start, end)}; globalThis.setUser = (user) => { currentUser = user; window.dispatchEvent({ type: 'vortex-account-changed', detail: { user } }); };`, context);
  return { node, setUser: context.setUser };
}

const signedOut = harness();
assert.equal(signedOut.node('nxeFtpLoading').hidden, false, 'loading is distinct from signed out');
assert.equal(signedOut.node('nxeFtpAuthPanel').hidden, true, 'login does not flash during restoration');
signedOut.setUser(null);
assert.equal(signedOut.node('nxeFtpLoading').hidden, true);
assert.equal(signedOut.node('nxeFtpAuthPanel').hidden, false, 'signed-out users see the shared Google button');
assert.equal(signedOut.node('nxeFtpPairPanel').hidden, true);

const account = { email: 'user@example.invalid' };
signedOut.setUser(account);
assert.equal(signedOut.node('nxeFtpAuthPanel').hidden, true, 'login hides Google prompt immediately');
assert.equal(signedOut.node('nxeFtpPairPanel').hidden, false, 'login shows NXE pairing when no console is paired');
assert.equal(signedOut.node('nxeFtpApp').hidden, true, 'console controls require pairing');

const restored = harness(account);
assert.equal(restored.node('nxeFtpAuthPanel').hidden, true, 'existing account skips login on direct URL or refresh');
assert.equal(restored.node('nxeFtpPairPanel').hidden, false, 'existing account sees pairing immediately');
restored.setUser(null);
assert.equal(restored.node('nxeFtpAuthPanel').hidden, false, 'logout returns to Google sign-in');
assert.equal(restored.node('nxeFtpPairPanel').hidden, true, 'logout hides pairing');
assert.equal(restored.node('nxeFtpApp').hidden, true, 'logout hides console controls');

const paired = harness(account, '#pair=test-console&key=test-key');
for (let step = 0; step < 8; step += 1) await Promise.resolve();
assert.equal(paired.node('nxeFtpPairPanel').hidden, true, 'valid pairing shows the console');
assert.equal(paired.node('nxeFtpApp').hidden, false, 'paired users see Server and Files controls');
paired.setUser(null);
assert.equal(paired.node('nxeFtpApp').hidden, true, 'logout hides already paired console controls immediately');
assert.equal(paired.node('nxeFtpAuthPanel').hidden, false, 'logout restores the shared Google sign-in UI');
console.log('NXE FTP shared authentication UI tests passed.');
