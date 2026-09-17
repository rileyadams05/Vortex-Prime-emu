import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const worker = await readFile(join(root, 'cloudflare', 'worker.js'), 'utf8');
const workerModule = await import(`data:text/javascript;base64,${Buffer.from(worker).toString('base64')}`);
const {
  normalizeModxTableRecord,
  parseGithubReleaseUrl,
  parseModxExecutableMetadata,
  parseModxMaintenanceMode,
} = workerModule;

const release = parseGithubReleaseUrl('https://github.com/Example-Owner/game-table/releases/tag/v1.2.0');
assert.deepEqual(release, {
  provider: 'github',
  url: 'https://github.com/Example-Owner/game-table/releases/tag/v1.2.0',
  releaseUrl: 'https://github.com/Example-Owner/game-table/releases/tag/v1.2.0',
  repositoryUrl: 'https://github.com/Example-Owner/game-table',
  owner: 'Example-Owner',
  repository: 'game-table',
  tag: 'v1.2.0',
  version: 'v1.2.0',
});

for (const rejected of [
  'javascript:alert(1)',
  'http://github.com/owner/repo/releases/tag/v1.0.0',
  'https://localhost/owner/repo/releases/tag/v1.0.0',
  'https://127.0.0.1/owner/repo/releases/tag/v1.0.0',
  'https://github.com.evil.example/owner/repo/releases/tag/v1.0.0',
  'https://github.com/owner/repo',
  'https://github.com/owner/repo/releases',
  'https://github.com/owner/repo/blob/main/readme.md',
  'https://github.com/owner/repo/releases/tag/v1.0.0?redirect=https://localhost',
  'https://github.com/owner/repo/releases/tag/v1.0.0#fragment',
]) {
  assert.throws(() => parseGithubReleaseUrl(rejected), { status: 400 }, rejected);
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
  github: {
    repositoryUrl: 'https://github.com/Riley/watch-dogs-table',
    releaseUrl: 'https://github.com/Riley/watch-dogs-table/releases/tag/v1.3.2',
    owner: 'Riley',
    repository: 'watch-dogs-table',
    tag: 'v1.3.2',
  },
  version: 'v1.3.2',
  release: {
    tag: 'v1.3.2',
    releaseId: '987',
    commitSha: 'c'.repeat(40),
    publishedAt: '2026-09-16T00:00:00.000Z',
    checkedAt: '2026-09-16T00:01:00.000Z',
    asset: {
      id: '654',
      name: 'WatchDogs.modxtrainer',
      downloadUrl: 'https://github.com/Riley/watch-dogs-table/releases/download/v1.3.2/WatchDogs.modxtrainer',
    },
  },
  maintenanceMode: 'community',
  createdAt: '2026-09-16T00:00:00.000Z',
});
assert.equal(normalized.originalAuthor.name, 'Riley');
assert.equal(normalized.source.provider, 'github');
assert.equal(normalized.sourceStatus, 'available');
assert.equal(normalized.maintenanceMode, 'community');
assert.equal(normalized.version, 'v1.3.2');
assert.equal(normalized.release.asset.name, 'WatchDogs.modxtrainer');
assert.equal(normalized.release.asset.downloadUrl, 'https://github.com/Riley/watch-dogs-table/releases/download/v1.3.2/WatchDogs.modxtrainer');
assert.equal('downloadUrl' in normalized, false);

const publishHtml = await readFile(join(root, 'docs', 'modx', 'index.html'), 'utf8');
const uploadsHtml = await readFile(join(root, 'docs', 'modx', 'my-uploads.html'), 'utf8');
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
assert.equal(publishHtml.includes('GitHub release URL'), true);
assert.equal(publishHtml.includes('https://github.com/username/repository/releases/tag/v1.0.0'), true);
assert.equal(publishHtml.includes('Repository-only URLs are not accepted.'), true);
assert.equal(publishHtml.includes('finished .modxtrainer build'), true, 'finished trainer workflow is not explained');
assert.equal(publishHtml.includes('data.trainerAssets'), true, 'release resolver does not consume finished trainer assets');
assert.equal(publishHtml.includes('data.ctAssets'), false, 'raw CT assets remain in the publishing workflow');
assert.equal(publishHtml.includes('Vortex Prime and Mod X store the link and metadata only.'), true, 'non-hosting responsibility is unclear');
assert.equal(publishHtml.includes('name="version"'), false, 'manual version field must not exist');
assert.equal(publishHtml.includes("body:JSON.stringify"), true);
assert.equal(publishHtml.includes('id="sourceStep" aria-labelledby="sourceStepTitle" aria-disabled="true"'), true, 'Step 2 must start locked');
assert.equal(publishHtml.includes('id="sourceFields" disabled'), true, 'Step 2 controls must start disabled');
assert.equal(publishHtml.includes('id="maintenanceFields" disabled'), true, 'Step 3 controls must start disabled');
assert.equal(publishHtml.includes('id="offlineOnlyConfirmed" type="checkbox" required disabled'), true, 'offline confirmation must start disabled');
assert.equal(publishHtml.includes("step1Status:'pending',step2Status:'locked',step3Status:'locked'"), true, 'explicit sequential workflow state is missing');
assert.equal(publishHtml.includes("workflow.step2Status==='complete'"), true, 'Step 2 completion must gate later steps');
assert.equal(publishHtml.includes("workflow.step3Status==='complete'"), true, 'Step 3 completion must gate confirmation');
assert.equal(publishHtml.includes("clearReleaseVerification();workflow.step2Status='pending'"), true, 'changing the Release URL must invalidate downstream state');
assert.equal(publishHtml.includes('Each step unlocks only after the previous step is complete.'), true, 'publishing explanation must describe sequential unlocking');
assert.equal(publishHtml.includes('Submission Verification'), true, 'submission verification step is missing');
assert.equal(publishHtml.includes('id="verificationStep"'), true, 'Step 4 is missing');
assert.equal(publishHtml.includes('id="offlineOnlyConfirmed" type="checkbox" required disabled'), true, 'Step 5 must start locked');
assert.equal(publishHtml.includes("step4Status:'locked'"), true, 'Step 4 explicit state is missing');
assert.equal(publishHtml.includes("api('/api/modx/reviews'"), true, 'review job creation is missing');
assert.equal(publishHtml.includes("workflow.step4Status!=='pass'"), true, 'publish must require a PASS review');
assert.equal(publishHtml.includes('reviewId:verifiedReview.id'), true, 'publish request must carry its review id');
await assert.rejects(readFile(join(root, 'docs', 'modx', 'community.html'), 'utf8'), { code: 'ENOENT' });
for (const html of [publishHtml, homepageHtml, uploadsHtml]) {
  assert.equal(html.includes('community.html'), false, 'public community catalogue link remains');
  assert.equal(html.includes('View Community Tables'), false, 'public community catalogue label remains');
  assert.equal(html.includes('Manage my listings'), false, 'website listing-management label remains');
}
assert.equal(homepageHtml.includes('/modx/my-uploads.html'), true, 'account menu ModX update link is missing');
assert.equal(homepageHtml.includes('Update my tables'), true, 'account menu update label is missing');
assert.equal(homepageHtml.includes('id="accountModxToggle"'), true, 'account menu Mod X submenu toggle is missing');
assert.equal(homepageHtml.includes('id="accountModxMenu" role="menu" hidden'), true, 'account menu Mod X submenu must start collapsed');
assert.equal(homepageHtml.includes('outline: none !important;'), true, 'account menu focus-ring override is missing');
assert.equal(uploadsHtml.includes('/api/modx/my-tables'), true, 'creator listing endpoint is missing');
assert.equal(uploadsHtml.includes("+'/refresh'"), true, 'manual release refresh action is missing');
assert.equal(uploadsHtml.includes('Updates are automatic.'), true, 'automatic update explanation is missing');
assert.equal(publishHtml.includes('href="https://github.com/rileyadams05/ModX"'), true);
assert.equal(publishHtml.includes('View the ModX Repository →'), true);
assert.equal(homepageHtml.includes('<span class="account-menu-label">ModX</span>'), false, 'static ModX account-menu label remains');
assert.equal(worker.includes("request.formData()\n  const file = form.get('file')"), false);
assert.equal(worker.includes('ModX catalogue requests must use JSON; file uploads are not accepted.'), true);
assert.equal(worker.includes('maintenance-submissions'), false, 'ModX maintenance proposal routes remain');
assert.equal(worker.includes("status: 'pending_review'"), false, 'ModX review workflow remains');
assert.equal(worker.includes("path === 'api/modx/my-tables'"), true, 'creator listing route is missing');
assert.equal(worker.includes('/refresh$'), true, 'manual release refresh route is missing');
assert.equal(worker.includes("path === 'api/modx/reviews'"), true, 'review bridge creation route is missing');
assert.equal(worker.includes('handleModxReviewStatus'), true, 'review bridge status route is missing');
assert.equal(worker.includes('reviewId,'), true, 'review id is not forwarded during publication');

for (const html of [publishHtml, uploadsHtml]) {
  for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    assert.doesNotThrow(() => new Function(match[1]), 'inline script should parse');
  }
}

console.log('ModX GitHub publishing contract test passed.');
