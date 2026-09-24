import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const site = await readFile(new URL('../docs/index.html', import.meta.url), 'utf8');
const controller = await readFile(new URL('../docs/assets/js/nxe-ftp-manager.js', import.meta.url), 'utf8');
const auth = await readFile(new URL('../docs/assets/js/streamz-firebase-auth.js', import.meta.url), 'utf8');
const worker = await readFile(new URL('../cloudflare/worker.js', import.meta.url), 'utf8');

assert.match(site, /id="nxeFtpManualView"/, 'manual IP view is present');
assert.match(site, /saved securely under your signed-in Google account/, 'manual UI explains account-backed saving');
assert.doesNotMatch(site, /nxeFtpQrView|nxeFtpShowQrBtn|Scan the QR code/, 'QR connection UI is removed');
assert.match(auth, /waitForInitialSession/, 'Firebase restoration completes before showing signed-out UI');
assert.match(worker, /controlTokenEncrypted: await encryptNxeControlToken/, 'claimed NXE token is encrypted before persistence');
assert.match(worker, /decryptNxeControlToken\(current\.controlTokenEncrypted, pairId, env\)/, 'account restore decrypts the saved token');
assert.match(worker, /current\.accountId && current\.accountId !== accountId/, 'saved credentials cannot cross Google accounts');
assert.match(controller, /pairId: consolePairId/, 'manual connect binds the typed IP to the live console identity');
assert.match(controller, /Double-check every IP digit/, 'connection failures explain invalid or changed addresses');
assert.match(controller, /function normalizeIpv4Input/, 'mobile dotless IPv4 input has a safe normalization path');
assert.match(controller, /candidates\.length === 1/, 'ambiguous dotless addresses are not guessed');

function harness({ initialUser = null, pairs = [], identifyError = false } = {}) {
  const listeners = new Map();
  const nodes = new Map();
  const storage = new Map();
  const requests = [];
  const hiddenInitially = new Set(['nxeFtpAuthPanel', 'nxeFtpPairPanel', 'nxeFtpSuccessPanel', 'nxeFtpApp']);

  function node(id) {
    if (!nodes.has(id)) nodes.set(id, {
      hidden: hiddenInitially.has(id),
      textContent: '',
      innerHTML: '',
      value: '',
      disabled: false,
      dataset: {},
      style: {},
      addEventListener() {},
      appendChild() {},
    });
    return nodes.get(id);
  }

  const window = {
    location: { hash: '', pathname: '/projects/nxe/ftp/' },
    addEventListener(name, callback) { listeners.set(name, callback); },
    dispatchEvent(event) { listeners.get(event.type)?.(event); },
    prompt() { return null; },
  };

  const fetch = async (url, options = {}) => {
    requests.push({ url, options });
    if (String(url).includes('/api/v1/device/identify')) {
      if (identifyError) throw new Error('unreachable');
      return { ok: true, json: async () => ({ pairId: 'console-pair-1234' }) };
    }
    if (String(url).includes('/api/nxe/pair/list')) {
      return { ok: true, json: async () => ({ pairs }) };
    }
    if (String(url).includes('/api/nxe/pair/connect')) {
      const body = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          pair: { pairId: body.pairId, consoleIp: body.consoleIp, ftpPort: '2121', running: true },
          controlToken: '0123456789abcdef0123456789abcdef',
        }),
      };
    }
    if (String(url).includes('/api/v1/device/status')) {
      return { ok: true, json: async () => ({ ftpRunning: true }) };
    }
    return { ok: true, json: async () => ({ ok: true, path: '/', items: [] }) };
  };

  const context = {
    AbortSignal,
    Headers,
    URLSearchParams,
    fetch,
    history: { replaceState() {} },
    localStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key),
    },
    window,
    document: {
      getElementById: node,
      querySelectorAll: () => [],
      createElement: () => ({ addEventListener() {}, appendChild() {}, style: {}, dataset: {} }),
    },
    setTimeout() {},
  };

  vm.runInNewContext(
    `let currentUser = ${JSON.stringify(initialUser)}; ${controller}; globalThis.setUser = (user) => { currentUser = user; window.dispatchEvent({ type: 'vortex-account-changed', detail: { user } }); };`,
    context,
  );
  return { node, requests, setUser: context.setUser, storage };
}

async function settle() {
  for (let step = 0; step < 5; step += 1) await new Promise((resolve) => setImmediate(resolve));
}

const signedOut = harness();
signedOut.setUser(null);
assert.equal(signedOut.node('nxeFtpAuthPanel').hidden, false, 'signed-out users see Google sign-in');
signedOut.setUser({ email: 'user@example.invalid' });
await settle();
assert.equal(signedOut.node('nxeFtpPairPanel').hidden, false, 'signed-in users without a console see manual IP entry');

const savedPair = { pairId: 'console-pair-1234', consoleIp: '192.168.0.70', ftpPort: '2121' };
const restored = harness({ initialUser: { email: 'user@example.invalid' }, pairs: [savedPair] });
await settle();
assert.equal(restored.node('nxeFtpIpInput').value, '192.168.0.70', 'account IP is restored on a new browser');
assert.equal(restored.node('nxeFtpSuccessPanel').hidden, false, 'account-backed credential restore reaches success');
assert.equal(restored.storage.get('nxe-pair-key:console-pair-1234'), '0123456789abcdef0123456789abcdef', 'restored credential is cached locally after server recovery');
const connectRequest = restored.requests.find((entry) => String(entry.url).includes('/api/nxe/pair/connect'));
assert.deepEqual(JSON.parse(connectRequest.options.body), {
  consoleIp: '192.168.0.70',
  pairId: 'console-pair-1234',
  ftpPort: '2121',
});

const unreachable = harness({ initialUser: { email: 'user@example.invalid' }, pairs: [savedPair], identifyError: true });
await settle();
assert.match(unreachable.node('nxeFtpPairMessage').textContent, /Double-check every IP digit/, 'unreachable saved IP gives correction guidance');

console.log('NXE FTP account-backed manual connection tests passed.');
