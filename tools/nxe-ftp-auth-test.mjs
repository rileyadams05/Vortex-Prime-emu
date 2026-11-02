import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const site = await readFile(new URL('../docs/index.html', import.meta.url), 'utf8');
const worker = await readFile(new URL('../cloudflare/worker.js', import.meta.url), 'utf8');
const alias = await readFile(new URL('../docs/projects/nxe/ftp/index.html', import.meta.url), 'utf8');

assert.match(site, /<div class="project-card" aria-label="NXE project">/);
assert.match(site, /An Aurora-inspired Xbox dashboard for Xbox One/);
assert.match(site, /https:\/\/github\.com\/rileyadams05\/NXE/);
assert.match(site, /data-nxe-lightbox/);
assert.doesNotMatch(site, /nxeFtp|nxe-ftp-manager|data-page="nxe-ftp"|\/api\/nxe\//);
assert.doesNotMatch(worker, /if \(path === 'api\/nxe\//);
assert.match(worker, /NXE pairing remains legacy code and is not exposed/);
assert.match(alias, /vortex-route', 'projects'/);
assert.match(alias, /location\.replace\('\/'\)/);

console.log('NXE is displayed as a project; FTP controls and API routing are absent from the primary website.');
