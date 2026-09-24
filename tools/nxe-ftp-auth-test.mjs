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
assert.doesNotMatch(site, /nxeFtpFilesTab|nxeFtpUploadInput|nxeFtpDropZone|nxeFtpBreadcrumb|nxeFtpTransfers/, 'file manager elements are removed from site HTML');
assert.doesNotMatch(controller, /processUploadQueue|renderFileList|renderBreadcrumb|createFolder/, 'file manager logic is removed from controller JS');
assert.match(site, /id="nxeFtpPortInput"/, 'FTP port input is present');
assert.match(site, /id="nxeFtpUsernameInput"/, 'Username input is present');
assert.match(site, /id="nxeFtpPasswordInput"/, 'Password input is present');
assert.match(site, /id="nxeFtpAuthMode"/, 'Authentication display is present');
assert.match(site, /How to access your Xbox storage/, 'FTP client usage guidance is present');

assert.match(auth, /waitForInitialSession/, 'Firebase restoration completes before showing signed-out UI');
assert.match(worker, /controlTokenEncrypted: await encryptNxeControlToken/, 'claimed NXE token is encrypted before persistence');
assert.match(worker, /decryptNxeControlToken\(current\.controlTokenEncrypted, current\.pairId, env\)/, 'account restore decrypts with the matched console identity');
assert.match(worker, /class NxePairSession/, 'Cloudflare relay Durable Object is exported');
assert.match(worker, /acceptWebSocket\(server, \[role\]\)/, 'relay uses hibernatable WebSockets');
assert.match(controller, /\/api\/nxe\/relay\/browser\?pairId=/, 'browser file controls use the authenticated cloud relay');
assert.doesNotMatch(controller, /localFetch\(apiBase \+ '\/api\/v1\/device\/status'/, 'status no longer depends on direct private-network browser access');
assert.match(worker, /current\.accountId && current\.accountId !== accountId/, 'saved credentials cannot cross Google accounts');
assert.match(controller, /body: JSON\.stringify\(\{ consoleIp: ip, ftpPort: port \}\)/, 'manual connect asks the cloud bridge to verify the live console IP');
assert.match(worker, /entry\.networkHash === networkHash/, 'first-time pairing requires the website and console to share a network');
assert.match(worker, /Date\.parse\(entry\.lastSeenAt \|\| 0\) >= liveCutoff/, 'manual connect only accepts an actively reporting console');
assert.match(controller, /Double-check every IP digit/, 'connection failures explain invalid or changed addresses');
assert.match(controller, /function normalizeIpv4Input/, 'mobile dotless IPv4 input has a safe normalization path');
assert.match(controller, /return '192\.168\.0\.' \+ Number\(missingZeroOctet\[1\]\)/, 'a missing zero octet is corrected for the console subnet shown by NXE');
assert.match(controller, /candidates\.length === 1/, 'ambiguous dotless addresses are not guessed');

function harness({ initialUser = null, pairs = [], connectError = false } = {}) {
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
      return { ok: true, json: async () => ({ pairId: 'console-pair-1234' }) };
    }
    if (String(url).includes('/api/nxe/pair/list')) {
      return { ok: true, json: async () => ({ pairs }) };
    }
    if (String(url).includes('/api/nxe/pair/connect')) {
      if (connectError) {
        return { ok: false, json: async () => ({ message: 'Double-check every IP digit and make sure NXE is open.' }) };
      }
      const body = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          pair: { pairId: 'console-pair-1234', consoleIp: body.consoleIp, ftpPort: body.ftpPort || '2121', running: true },
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
  ftpPort: '2121',
});

const unreachable = harness({ initialUser: { email: 'user@example.invalid' }, pairs: [savedPair], connectError: true });
await settle();
assert.match(unreachable.node('nxeFtpPairMessage').textContent, /Double-check every IP digit/, 'unreachable saved IP gives correction guidance');

console.log('NXE FTP account-backed manual connection tests passed.');
