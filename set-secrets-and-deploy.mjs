#!/usr/bin/env node
/**
 * set-secrets-and-deploy.mjs
 *
 * Reads the refresh token written by get-refresh-token.mjs, then:
 *  1. Sets GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET,
 *     and GOOGLE_DRIVE_REFRESH_TOKEN as Cloudflare Worker secrets via Wrangler.
 *  2. Deploys the Worker.
 *  3. Hits /api/status to verify.
 */

import { readFileSync, existsSync, unlinkSync, writeFileSync } from 'fs';
import { spawnSync } from 'child_process';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const credsPath = path.join(__dirname, 'MY-google-ID', 'MY-google-ID.json');
if (!existsSync(credsPath)) {
  console.error('\n✖  MY-google-ID.json not found in MY-google-ID directory.');
  console.error('   Please make sure the file exists at: MY-google-ID/MY-google-ID.json\n');
  process.exit(1);
}
const creds = JSON.parse(readFileSync(credsPath, 'utf8'));
const CLIENT_ID     = creds.web.client_id;
const CLIENT_SECRET = creds.web.client_secret;
const TMP_FILE      = path.join(__dirname, 'refresh_token.tmp');
const WORKER_DIR    = path.join(__dirname, 'cloudflare');
const STATUS_URL    = 'https://vortex-prime-emu.com/api/status';

// ── 1. Read refresh token ───────────────────────────────────────────────────
if (!existsSync(TMP_FILE)) {
  console.error('\n✖  refresh_token.tmp not found.');
  console.error('   Run  node get-refresh-token.mjs  first.\n');
  process.exit(1);
}

const refreshToken = readFileSync(TMP_FILE, 'utf8').trim();
if (!refreshToken) {
  console.error('\n✖  refresh_token.tmp is empty. Re-run  node get-refresh-token.mjs\n');
  process.exit(1);
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  Vortex Prime – Setting Worker secrets + deploying');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// ── 2. Set Wrangler secrets ─────────────────────────────────────────────────
// Wrangler reads the secret value from stdin when --name is provided.
// We write each value to a temp file then pipe it, because Windows stdin
// piping via spawnSync can be tricky with special characters.

const secrets = [
  { name: 'GOOGLE_DRIVE_CLIENT_ID',     value: CLIENT_ID },
  { name: 'GOOGLE_DRIVE_CLIENT_SECRET', value: CLIENT_SECRET },
  { name: 'GOOGLE_DRIVE_REFRESH_TOKEN', value: refreshToken },
];

for (const { name, value } of secrets) {
  process.stdout.write(`  Setting ${name} … `);

  const result = spawnSync(
    'npx',
    ['wrangler', 'secret', 'put', name],
    {
      cwd:      WORKER_DIR,
      encoding: 'utf8',
      input:    value,
      stdio:    ['pipe', 'pipe', 'pipe'],
      shell:    true,
    }
  );

  if (result.status !== 0) {
    console.error('FAILED');
    console.error(result.stderr || result.stdout || '(no output)');
    process.exit(1);
  }
  console.log('✔');
}

// ── 3. Deploy Worker ────────────────────────────────────────────────────────
console.log('\n  Deploying Worker …\n');
const deployResult = spawnSync(
  'cmd',
  ['/c', 'npx wrangler deploy'],
  {
    cwd:      WORKER_DIR,
    encoding: 'utf8',
    stdio:    'inherit',
    shell:    false,
  }
);

if (deployResult.status !== 0) {
  console.error('\n✖  wrangler deploy failed. See output above.');
  process.exit(1);
}

// ── 4. Wait then hit /api/status ────────────────────────────────────────────
console.log('\n  Waiting 4 s for deployment to propagate …');
await new Promise((r) => setTimeout(r, 4000));

console.log(`\n  Testing ${STATUS_URL} …\n`);
try {
  const body = await get(STATUS_URL);
  const data = JSON.parse(body);
  console.log('  Response:');
  console.log(JSON.stringify(data, null, 4).split('\n').map(l => '  ' + l).join('\n'));

  if (data.configured && data.googleAuthorized) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  ✔  Worker is live and Google Drive is authorised!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n  You can now upload files in the admin portal:\n');
    console.log('  https://vortex-prime-emu.com/admin/\n');
  } else {
    console.log('\n  ⚠  Worker responded but may not be fully configured.');
    console.log('  Check the "message" field above for details.\n');
  }
} catch (err) {
  console.error('\n  ⚠  Could not reach /api/status:', err.message);
  console.error('  The Worker may still be propagating. Try manually:\n');
  console.error(`  ${STATUS_URL}\n`);
}

// ── 5. Clean up temp file ───────────────────────────────────────────────────
try { unlinkSync(TMP_FILE); } catch (_) {}

// ── helpers ──────────────────────────────────────────────────────────────────
function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}
