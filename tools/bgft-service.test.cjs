'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

const projects = read('docs/index.html');
const bgftPage = read('docs/bgft/index.html');
const bgftSender = read('docs/bgft/assets/js/ps4-package-sender.js');
const bgftApi = read('docs/bgft/assets/js/ps4-catalogue-api.js');
const bgftManifest = JSON.parse(read('docs/bgft/manifest.webmanifest'));
const bgftWorker = read('docs/bgft/sw.js');
const installFlow = read('docs/assets/js/bgft-pwa-install.js');
const pagesWorkflow = read('.github/workflows/pages.yml');

assert.match(projects, /<div class="project-card" aria-label="FPKG Builder project">/);
assert.match(projects, /href="https:\/\/github\.com\/rileyadams05\/FPKG-Builder"[^>]*>Repository/);
assert.match(projects, /id="fpkgBuilderInstallButton"/);
assert.match(projects, /id="fpkgProjectVersion"/);
assert.match(projects, /id="fpkgReleaseDialog"/);
assert.match(read('docs/assets/js/fpkg-release.js'), /api\.github\.com\/repos\/rileyadams05\/FPKG-Builder\/releases\/latest/);
assert.match(read('docs/assets/js/fpkg-release.js'), /browser_download_url/);

assert.match(projects, /<div class="project-card" aria-label="BGFT Service project">/);
assert.match(projects, /href="https:\/\/github\.com\/rileyadams05\/BGFT"[^>]*>Repository<\/a>/);
assert.match(projects, /data-nxe-lightbox="\/assets\/BGFT\.png"/);
assert.match(projects, /id="bgftInstallButton"[^>]+href="\/bgft\/(?:install-[a-f0-9]{12}\.html)?\?install=1"/);
assert.match(projects, /id="bgftPwaInstall" manifest-url="\/bgft\/manifest\.webmanifest"/);
assert.match(projects, /id="bgftOpenInstalledApp"[^>]+href="\/bgft\/"/);
assert.match(projects, /id="bgftOpenInBrowser"[^>]+href="\/bgft\/\?open=browser"/);

for (const id of ['connectPs4Button', 'choosePkgButton', 'pairingPanel', 'uploadProgress', 'taskStatus']) {
  assert.ok(bgftPage.includes(`id="${id}"`), `BGFT page is missing ${id}`);
}
assert.match(bgftSender, /\/pairing\/challenge/);
assert.match(bgftSender, /\/bgft\/tasks/);
assert.match(bgftSender, /source: 'url'/);
assert.match(bgftSender, /api\.upload\(activeIp, `\/bgft\/uploads\?filename=/);
assert.match(bgftApi, /application\/vnd\.vortex-prime\.pkg/);
assert.match(bgftPage, /register\('\.\/sw\.js', \{ scope: '\.\/', updateViaCache: 'none' \}\)/);
assert.equal(bgftManifest.start_url, './');
assert.equal(bgftManifest.scope, './');
assert.match(bgftWorker, /keys\.filter\(key => key\.startsWith\('bgft-shell-'\)/);

assert.match(installFlow, /\.install\(\)/);
assert.match(installFlow, /pwa-install-success-event/);
assert.match(installFlow, /pwa-install-fail-event/);
assert.match(installFlow, /pwa-user-choice-result-event/);
assert.match(installFlow, /isWebInstallSupported !== true/);
assert.match(pagesWorkflow, /repository: rileyadams05\/BGFT/);
assert.match(pagesWorkflow, /cp -R \.bgft-source\/web\/. docs\/bgft\//);
assert.match(pagesWorkflow, /@khmyznikov\/pwa-install@0\.7\.0/);

console.log('FPKG release integration and BGFT connection, package sending, task tracking, PWA install and cache tests passed.');
