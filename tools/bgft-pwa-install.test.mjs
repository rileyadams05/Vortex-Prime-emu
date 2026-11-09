import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../docs/assets/js/bgft-pwa-install.js', import.meta.url), 'utf8');

function createHarness({ webInstall = true, relatedInstalled = false } = {}) {
  const listeners = new Map();
  const element = () => ({
    disabled: false,
    dataset: {},
    attributes: new Map(),
    addEventListener(type, callback) {
      const callbacks = listeners.get(this) ?? new Map();
      const handlers = callbacks.get(type) ?? [];
      handlers.push(callback);
      callbacks.set(type, handlers);
      listeners.set(this, callbacks);
    },
    removeAttribute(name) { this.attributes.delete(name); },
    setAttribute(name, value) { this.attributes.set(name, value); },
    dispatch(type, detail = {}) {
      for (const callback of listeners.get(this)?.get(type) ?? []) callback({ type, target: this, detail });
    }
  });

  const button = element();
  const installer = element();
  installer.isWebInstallSupported = webInstall;
  installer.isRelatedAppsInstalled = relatedInstalled;
  installer.installCalls = 0;
  installer.install = () => { installer.installCalls += 1; return Promise.resolve(); };

  const description = { textContent: '' };
  const choiceDialog = element();
  choiceDialog.open = false;
  choiceDialog.querySelector = () => description;
  choiceDialog.querySelectorAll = () => [];
  choiceDialog.showModal = () => { choiceDialog.open = true; };
  choiceDialog.close = () => { choiceDialog.open = false; };

  const heading = { textContent: '' };
  const appChoice = { hidden: false };
  const browserChoice = { hidden: false, textContent: '' };
  const componentScript = element();
  const locationCalls = [];
  const document = {
    getElementById(id) {
      return ({ bgftInstallButton: button, bgftPwaInstall: installer, bgftInstallChoice: choiceDialog,
        bgftInstallChoiceHeading: heading, bgftOpenInstalledApp: appChoice,
        bgftOpenInBrowser: browserChoice })[id] ?? null;
    },
    querySelector() { return componentScript; },
    documentElement: { dataset: {} }
  };

  vm.runInNewContext(source, {
    document,
    customElements: { whenDefined: () => Promise.resolve() },
    window: { location: { assign: url => locationCalls.push(url) } }
  });

  return { button, installer, choiceDialog, heading, appChoice, browserChoice, componentScript, locationCalls };
}

test('one Install click calls the native BGFT install API from the user gesture', async () => {
  const h = createHarness();
  await Promise.resolve();
  h.button.dispatch('click');
  assert.equal(h.installer.installCalls, 1);
  assert.deepEqual(h.locationCalls, []);
  h.installer.dispatch('pwa-install-success-event');
  assert.equal(h.choiceDialog.open, true);
  assert.equal(h.heading.textContent, 'BGFT is installed');
  assert.equal(h.appChoice.hidden, false);
  assert.equal(h.browserChoice.hidden, false);
});

test('browsers without cross-manifest install support enter BGFT scope for its own prompt', async () => {
  const h = createHarness({ webInstall: false });
  await Promise.resolve();
  h.button.dispatch('click');
  assert.equal(h.installer.installCalls, 0);
  assert.deepEqual(h.locationCalls, ['/bgft/?install=1']);
});

test('already-installed state skips the install prompt', async () => {
  const h = createHarness({ relatedInstalled: true });
  await Promise.resolve();
  h.button.dispatch('click');
  assert.equal(h.installer.installCalls, 0);
  assert.equal(h.heading.textContent, 'BGFT is installed');
  assert.equal(h.choiceDialog.open, true);
});

test('installation failure and cancellation offer the browser route without claiming success', async () => {
  const failed = createHarness();
  await Promise.resolve();
  failed.installer.dispatch('pwa-install-fail-event');
  assert.equal(failed.heading.textContent, 'BGFT could not be installed');
  assert.equal(failed.appChoice.hidden, true);
  assert.equal(failed.browserChoice.hidden, false);

  const cancelled = createHarness();
  await Promise.resolve();
  cancelled.installer.dispatch('pwa-user-choice-result-event', { userChoiceResult: 'dismissed' });
  assert.equal(cancelled.heading.textContent, 'Continue with BGFT');
  assert.equal(cancelled.appChoice.hidden, true);
});

