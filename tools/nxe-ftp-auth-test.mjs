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
assert.match(site, /id="nxeFtpAuth"/, 'Authentication verification indicator is present');

// Credential Action Buttons & Modals
assert.match(site, /id="nxeFtpBtnSetCredentials"/, 'Set Username & Password button is present');
assert.match(site, /id="nxeFtpBtnChangeCredentials"/, 'Change Username & Password button is present');
assert.match(site, /id="nxeFtpBtnViewCredentials"/, 'View Username & Password button is present');
assert.match(site, /id="nxeFtpCredModal"/, 'Credentials edit modal dialog is present');
assert.match(site, /id="nxeFtpCredUser"/, 'Credentials username input is present');
assert.match(site, /id="nxeFtpCredPass"/, 'Credentials password input is present');
assert.match(site, /id="nxeFtpCredConfirm"/, 'Credentials confirm password input is present');
assert.match(site, /id="nxeFtpCredRemove"/, 'Remove credentials button is present');
assert.match(site, /id="nxeFtpViewCredModal"/, 'View credentials modal dialog is present');
assert.match(site, /id="nxeFtpViewUser"/, 'View credentials username display is present');
assert.match(site, /id="nxeFtpViewPass"/, 'View credentials password display is present');
assert.match(site, /id="nxeFtpToggleViewPass"/, 'Toggle view password button is present');
assert.match(site, /id="nxeFtpCopyViewPass"/, 'Copy view password button is present');
assert.match(site, /How to access your Xbox storage/, 'FTP client usage guidance is present');

assert.match(controller, /storageVerified/, 'controller checks storageVerified from Xbox status');
assert.match(controller, /✓ Yes/, 'controller displays green checkmark for verified storage authentication');
assert.match(controller, /setCredentialButtons/, 'controller dynamically manages Set vs Change & View buttons');

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

function harness({ initialUser = null, pairs = [], pairsByAccount = null, connectError = false } = {}) {
  let activeUser = initialUser;
  const listeners = new Map();
  const nodes = new Map();
  const storage = new Map();
  const requests = [];
  const hiddenInitially = new Set(['nxeFtpAuthPanel', 'nxeFtpPairPanel', 'nxeFtpSuccessPanel', 'nxeFtpApp', 'nxeFtpCredModal', 'nxeFtpViewCredModal', 'nxeFtpBtnChangeCredentials', 'nxeFtpBtnViewCredentials']);

  function node(id) {
    if (!nodes.has(id)) {
      const eventHandlers = new Map();
      nodes.set(id, {
        hidden: hiddenInitially.has(id),
        textContent: '',
        innerHTML: '',
        value: '',
        disabled: false,
        dataset: {},
        style: {},
        addEventListener(event, handler) {
          if (!eventHandlers.has(event)) eventHandlers.set(event, []);
          eventHandlers.get(event).push(handler);
        },
        click() {
          const list = eventHandlers.get('click') || [];
          for (const handler of list) handler({ preventDefault() {} });
        },
        focus() {},
        appendChild() {},
      });
    }
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
      const userEmail = activeUser?.email || '';
      const currentPairs = pairsByAccount ? (pairsByAccount[userEmail] || []) : pairs;
      const pairsWithToken = currentPairs.map((p) => ('controlToken' in p ? p : { ...p, controlToken: '0123456789abcdef0123456789abcdef' }));
      return { ok: true, json: async () => ({ pairs: pairsWithToken }) };
    }
    if (String(url).includes('/api/nxe/pair/forget')) {
      return { ok: true, json: async () => ({ ok: true }) };
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
      return { ok: true, json: async () => ({ ftpRunning: true, storageVerified: true, hasCredentials: true, username: 'xbox' }) };
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
    setTimeout(cb, ms) { return setTimeout(cb, ms); },
    clearTimeout(id) { clearTimeout(id); },
    setInterval(cb, ms) { return setInterval(cb, ms); },
    clearInterval(id) { clearInterval(id); },
  };

  vm.runInNewContext(
    `let currentUser = ${JSON.stringify(initialUser)}; ${controller}; globalThis.setUser = (user) => { currentUser = user; window.dispatchEvent({ type: 'vortex-account-changed', detail: { user } }); };`,
    context,
  );
  return {
    node,
    requests,
    setUser: (user) => {
      activeUser = user;
      context.setUser(user);
    },
    storage,
  };
}

async function settle() {
  for (let step = 0; step < 5; step += 1) await new Promise((resolve) => setImmediate(resolve));
}

// ── Test 1: Completely new account ──────────────────────────────────────────
const brandNewUser = harness({ initialUser: { email: 'brandnew@example.invalid' }, pairs: [] });
// Inject stale localStorage to prove server state wins and stale keys are purged
brandNewUser.storage.set('nxe-saved-ip', '192.168.0.70');
brandNewUser.storage.set('nxe-saved-username', 'olduser');
await settle();
assert.equal(brandNewUser.node('nxeFtpPairPanel').hidden, false, 'Test 1: new user sees manual connect form');
assert.equal(brandNewUser.node('nxeFtpIpInput').value, '', 'Test 1: Console IP is completely empty (no stale/pre-filled IP)');
assert.equal(brandNewUser.node('nxeFtpUsernameInput').value, '', 'Test 1: Username is completely empty');
assert.equal(brandNewUser.node('nxeFtpPasswordInput').value, '', 'Test 1: Password is completely empty');
assert.equal(brandNewUser.node('nxeFtpPortInput').value, '2121', 'Test 1: FTP Port defaults to 2121');
assert.equal(brandNewUser.node('nxeFtpSuccessPanel').hidden, true, 'Test 1: success screen is hidden');
assert.equal(brandNewUser.node('nxeFtpApp').hidden, true, 'Test 1: control panel is hidden');

// ── Test 2: First successful pairing ─────────────────────────────────────────
brandNewUser.node('nxeFtpIpInput').value = '192.168.0.68';
brandNewUser.node('nxeFtpConnectBtn').click();
await settle();
assert.equal(brandNewUser.node('nxeFtpSuccessPanel').hidden, false, 'Test 2: first successful pair shows success screen');
assert.equal(brandNewUser.node('nxeFtpPairPanel').hidden, true, 'Test 2: connect form is hidden on success screen');
assert.equal(brandNewUser.node('nxeFtpApp').hidden, true, 'Test 2: control panel is hidden before pressing Continue');

// Press Continue
brandNewUser.node('nxeFtpContinueBtn').click();
await settle();
assert.equal(brandNewUser.node('nxeFtpApp').hidden, false, 'Test 2: control panel visible after pressing Continue');
assert.equal(brandNewUser.node('nxeFtpSuccessPanel').hidden, true, 'Test 2: success panel hidden after pressing Continue');

// ── Test 3: Refresh after pairing ────────────────────────────────────────────
const savedPair = { pairId: 'console-pair-series-x', consoleIp: '192.168.0.68', ftpPort: '2121', controlToken: 'tok-series-x-123' };
const refreshedUser = harness({ initialUser: { email: 'brandnew@example.invalid' }, pairs: [savedPair] });
await settle();
assert.equal(refreshedUser.node('nxeFtpApp').hidden, false, 'Test 3: returning user on refresh goes directly to control panel');
assert.equal(refreshedUser.node('nxeFtpSuccessPanel').hidden, true, 'Test 3: success screen is skipped on normal refresh');
assert.equal(refreshedUser.node('nxeFtpPairPanel').hidden, true, 'Test 3: pair form is hidden on normal refresh');
assert.equal(refreshedUser.node('nxeFtpIp').textContent, '192.168.0.68', 'Test 3: control panel displays correct console IP');

// ── Test 4: Close / reopen browser ───────────────────────────────────────────
const reopenedSession = harness({ initialUser: { email: 'brandnew@example.invalid' }, pairs: [savedPair] });
await settle();
assert.equal(reopenedSession.node('nxeFtpApp').hidden, false, 'Test 4: reopened browser goes directly to control panel');
assert.equal(reopenedSession.node('nxeFtpSuccessPanel').hidden, true, 'Test 4: success screen is skipped on reopened session');

// ── Test 5: Sign out and sign back in ────────────────────────────────────────
refreshedUser.setUser(null);
await settle();
assert.equal(refreshedUser.node('nxeFtpAuthPanel').hidden, false, 'Test 5: signed out shows auth panel');
assert.equal(refreshedUser.node('nxeFtpApp').hidden, true, 'Test 5: signed out hides control panel');
refreshedUser.setUser({ email: 'brandnew@example.invalid' });
await settle();
assert.equal(refreshedUser.node('nxeFtpApp').hidden, false, 'Test 5: signing back in restores control panel directly');
assert.equal(refreshedUser.node('nxeFtpSuccessPanel').hidden, true, 'Test 5: signing back in skips success screen');

// ── Test 6: Forget console ───────────────────────────────────────────────────
refreshedUser.node('nxeFtpForget').click();
await settle();
assert.equal(refreshedUser.node('nxeFtpApp').hidden, true, 'Test 6: control panel is hidden after Forget');
assert.equal(refreshedUser.node('nxeFtpPairPanel').hidden, false, 'Test 6: connection form is shown after Forget');
assert.equal(refreshedUser.node('nxeFtpSuccessPanel').hidden, true, 'Test 6: success panel is NOT shown on Forget');
assert.equal(refreshedUser.node('nxeFtpIpInput').value, '', 'Test 6: IP input is blanked on Forget');
assert.equal(refreshedUser.storage.has('nxe-saved-ip'), false, 'Test 6: saved IP removed from storage');
assert.equal(refreshedUser.storage.has('nxe-pair-key:console-pair-series-x'), false, 'Test 6: pair key removed from storage');
const forgetReq = refreshedUser.requests.find((r) => String(r.url).includes('/api/nxe/pair/forget'));
assert.ok(forgetReq, 'Test 6: forget request sent to backend');
assert.equal(JSON.parse(forgetReq.options.body).pairId, 'console-pair-series-x', 'Test 6: forget payload includes pairId');

// ── Test 7: Refresh after Forget ─────────────────────────────────────────────
const afterForgetUser = harness({ initialUser: { email: 'brandnew@example.invalid' }, pairs: [] });
await settle();
assert.equal(afterForgetUser.node('nxeFtpPairPanel').hidden, false, 'Test 7: blank connection form shown after refresh following Forget');
assert.equal(afterForgetUser.node('nxeFtpIpInput').value, '', 'Test 7: IP field remains completely blank on refresh');
assert.equal(afterForgetUser.node('nxeFtpApp').hidden, true, 'Test 7: control panel remains hidden');
assert.equal(afterForgetUser.node('nxeFtpSuccessPanel').hidden, true, 'Test 7: success screen remains hidden');

// ── Test 8: Pair again after Forget ──────────────────────────────────────────
afterForgetUser.node('nxeFtpIpInput').value = '192.168.0.68';
afterForgetUser.node('nxeFtpConnectBtn').click();
await settle();
assert.equal(afterForgetUser.node('nxeFtpSuccessPanel').hidden, false, 'Test 8: pairing again shows success screen with tick');
assert.equal(afterForgetUser.node('nxeFtpApp').hidden, true, 'Test 8: control panel hidden until Continue is clicked');
afterForgetUser.node('nxeFtpContinueBtn').click();
await settle();
assert.equal(afterForgetUser.node('nxeFtpApp').hidden, false, 'Test 8: control panel entered after Continue');

// ── Test 9: Different Google account (Cross-account isolation) ───────────────
const accountA = harness({
  initialUser: { email: 'accountA@example.invalid' },
  pairsByAccount: {
    'accountA@example.invalid': [savedPair],
    'accountB@example.invalid': []
  }
});
await settle();
assert.equal(accountA.node('nxeFtpApp').hidden, false, 'Test 9: Account A has saved console');

// Switch to Account B (which has no paired console)
accountA.setUser({ email: 'accountB@example.invalid' });
await settle();
assert.equal(accountA.node('nxeFtpPairPanel').hidden, false, 'Test 9: Account B sees manual connect form');
assert.equal(accountA.node('nxeFtpIpInput').value, '', 'Test 9: Account B sees empty IP field (no leak from Account A)');
assert.equal(accountA.node('nxeFtpApp').hidden, true, 'Test 9: Account B does not have control panel open');

// Switch back to Account A
accountA.setUser({ email: 'accountA@example.invalid' });
await settle();
assert.equal(accountA.node('nxeFtpApp').hidden, false, 'Test 9: switching back to Account A restores console');

console.log('ALL 9 NXE FTP LIFECYCLE & STATE MACHINE TESTS PASSED.');

