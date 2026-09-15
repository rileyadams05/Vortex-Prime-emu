import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const worker = await readFile(join(root, 'cloudflare', 'worker.js'), 'utf8');
const workerModule = await import(`data:text/javascript;base64,${Buffer.from(worker).toString('base64')}`);
const {
  normalizeModxTableRecord,
  parseGithubSourceUrl,
  parseModxExecutableMetadata,
  parseModxMaintenanceMode,
} = workerModule;

const repository = parseGithubSourceUrl('https://github.com/Example-Owner/game-table.git');
assert.deepEqual(repository, {
  provider: 'github',
  url: 'https://github.com/Example-Owner/game-table',
  repositoryUrl: 'https://github.com/Example-Owner/game-table',
  owner: 'Example-Owner',
  repository: 'game-table',
  branch: null,
  tablePath: null,
});

const tableFile = parseGithubSourceUrl('https://github.com/owner/repo/blob/main/tables/Game.ct');
assert.equal(tableFile.repositoryUrl, 'https://github.com/owner/repo');
assert.equal(tableFile.branch, 'main');
assert.equal(tableFile.tablePath, 'tables/Game.ct');

for (const rejected of [
  'javascript:alert(1)',
  'http://github.com/owner/repo',
  'https://localhost/owner/repo',
  'https://127.0.0.1/owner/repo',
  'https://github.com.evil.example/owner/repo',
  'https://github.com/owner/repo/releases/download/table.ct',
  'https://github.com/owner/repo/blob/main/readme.md',
  'https://github.com/owner/repo?redirect=https://localhost',
]) {
  assert.throws(() => parseGithubSourceUrl(rejected), { status: 400 }, rejected);
}

assert.deepEqual(parseModxExecutableMetadata({
  name: 'WatchDogs.exe',
  size: 1024,
  sha256: 'a'.repeat(64),
}), { name: 'WatchDogs.exe', size: 1024, sha256: 'a'.repeat(64) });
assert.equal(parseModxMaintenanceMode('author'), 'author');
assert.equal(parseModxMaintenanceMode('community'), 'community');
assert.throws(() => parseModxMaintenanceMode('uploader'), { status: 400 });

const normalized = normalizeModxTableRecord({
  id: '12345678901234567890',
  gameExecutable: 'WatchDogs.exe',
  gameFingerprint: 'b'.repeat(64),
  author: { id: 'author-1', name: 'Riley' },
  source: { repositoryUrl: 'https://github.com/Riley/watch-dogs-table' },
  maintenanceMode: 'community',
  createdAt: '2026-09-16T00:00:00.000Z',
});
assert.equal(normalized.originalAuthor.name, 'Riley');
assert.equal(normalized.source.provider, 'github');
assert.equal(normalized.sourceStatus, 'available');
assert.equal(normalized.maintenanceMode, 'community');
assert.equal('downloadUrl' in normalized, false);

const publishHtml = await readFile(join(root, 'docs', 'modx', 'index.html'), 'utf8');
const listingsHtml = await readFile(join(root, 'docs', 'modx', 'my-uploads.html'), 'utf8');
const homepageHtml = await readFile(join(root, 'docs', 'index.html'), 'utf8');
for (const removed of [
  'Where is this table supported?',
  'Do you plan to support more services later?',
  'WIN/Service name',
  'futureServiceSupport',
  'serviceScope',
  "form.set('file'",
  'Upload the cheat table',
]) {
  assert.equal(publishHtml.includes(removed), false, `publish page still contains: ${removed}`);
}
assert.equal(publishHtml.includes('type="file" accept=".exe'), true);
assert.equal(publishHtml.includes('name="githubUrl"'), true);
assert.equal(publishHtml.includes("body:JSON.stringify"), true);
await assert.rejects(readFile(join(root, 'docs', 'modx', 'community.html'), 'utf8'), { code: 'ENOENT' });
for (const html of [publishHtml, listingsHtml, homepageHtml]) {
  assert.equal(html.includes('community.html'), false, 'public community catalogue link remains');
  assert.equal(html.includes('View Community Tables'), false, 'public community catalogue label remains');
}
assert.equal(worker.includes("request.formData()\n  const file = form.get('file')"), false);
assert.equal(worker.includes('ModX catalogue requests must use JSON; file uploads are not accepted.'), true);
assert.equal(worker.includes("status: 'pending_review'"), true);

for (const html of [publishHtml, listingsHtml]) {
  for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    assert.doesNotThrow(() => new Function(match[1]), 'inline script should parse');
  }
}

console.log('ModX GitHub publishing contract test passed.');
