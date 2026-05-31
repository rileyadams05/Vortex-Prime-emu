#!/usr/bin/env node
/**
 * get-refresh-token.mjs
 *
 * One-shot script: opens the Google OAuth consent screen in your browser,
 * catches the authorization code on localhost:53682, exchanges it for a
 * refresh token, and prints the three Wrangler secret commands to run.
 *
 * Run with:  node get-refresh-token.mjs
 */

import http from 'http';
import https from 'https';
import { URL } from 'url';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const credsPath = path.join(__dirname, 'MY-google-ID', 'MY-google-ID.json');

if (!fs.existsSync(credsPath)) {
  console.error('\n✖  MY-google-ID.json not found in MY-google-ID directory.');
  console.error('   Please make sure the file exists at: MY-google-ID/MY-google-ID.json\n');
  process.exit(1);
}

const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
const CLIENT_ID     = creds.web.client_id;
const CLIENT_SECRET = creds.web.client_secret;
const REDIRECT_URI  = 'http://localhost:53682/oauth2callback';
const SCOPE         = 'https://www.googleapis.com/auth/drive';
// ────────────────────────────────────────────────────────────────────────────

const authUrl =
  `https://accounts.google.com/o/oauth2/v2/auth` +
  `?client_id=${encodeURIComponent(CLIENT_ID)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&scope=${encodeURIComponent(SCOPE)}` +
  `&access_type=offline` +
  `&prompt=consent`;           // forces Google to return a refresh_token

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  Vortex Prime – Google Drive OAuth token setup');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('Waiting for Google to redirect back to localhost:53682 …\n');
console.log('► Open this URL in your browser:\n');
console.log('  ' + authUrl + '\n');
console.log('(The page will say "Waiting…" until you approve Google access.)\n');

// Try to open automatically on Windows
try {
  const { execSync } = await import('child_process');
  execSync(`start "" "${authUrl}"`);
  console.log('(Browser opened automatically. If not, copy the URL above.)\n');
} catch (_) {
  // ignore – user will copy the URL
}

// Start a one-shot HTTP server on port 53682
const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://localhost:53682`);
  if (reqUrl.pathname !== '/oauth2callback') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const code = reqUrl.searchParams.get('code');
  const error = reqUrl.searchParams.get('error');

  if (error || !code) {
    const msg = `Google returned an error: ${error || 'no code received'}`;
    console.error('\n✖  ' + msg);
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end(`<h2>Error: ${msg}</h2><p>Close this tab and check the terminal.</p>`);
    server.close();
    process.exit(1);
  }

  // Exchange code for tokens
  const tokenBody = new URLSearchParams({
    code,
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri:  REDIRECT_URI,
    grant_type:    'authorization_code',
  }).toString();

  let tokenData;
  try {
    tokenData = await post('https://oauth2.googleapis.com/token', tokenBody);
  } catch (err) {
    console.error('\n✖  Token exchange failed:', err.message);
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end(`<h2>Token exchange failed</h2><pre>${err.message}</pre>`);
    server.close();
    process.exit(1);
  }

  const refreshToken = tokenData.refresh_token;
  if (!refreshToken) {
    const detail = JSON.stringify(tokenData, null, 2);
    console.error('\n✖  No refresh_token in response:\n' + detail);
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end(`<h2>No refresh_token returned</h2><pre>${detail}</pre><p>This usually means you did not grant offline access. Close this tab and re-run the script.</p>`);
    server.close();
    process.exit(1);
  }

  // Success
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ✔  Got refresh token!  Setting Cloudflare Worker secrets …');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Write the refresh token to a temp file so the parent process can read it
  const { writeFileSync } = await import('fs');
  writeFileSync('refresh_token.tmp', refreshToken, 'utf8');
  console.log('Refresh token saved to refresh_token.tmp');

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`
    <!DOCTYPE html>
    <html>
    <head><title>Vortex Prime – Authorised</title></head>
    <body style="font-family:sans-serif;text-align:center;padding:60px;background:#0a0a0a;color:#fff;">
      <h1 style="color:#22c55e">✔ Authorised!</h1>
      <p>Google Drive access granted. You can close this tab.</p>
      <p style="color:#888;font-size:0.9em">Return to your terminal to see the next steps.</p>
    </body>
    </html>
  `);

  server.close();
});

server.listen(53682, '127.0.0.1', () => {
  // ready
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('\n✖  Port 53682 is already in use. Close whatever is using it and try again.');
  } else {
    console.error('\n✖  Server error:', err.message);
  }
  process.exit(1);
});

// ── helpers ─────────────────────────────────────────────────────────────────
function post(url, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method:  'POST',
      headers: {
        'Content-Type':   'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (_) {
          reject(new Error('Non-JSON response: ' + data.slice(0, 200)));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}
