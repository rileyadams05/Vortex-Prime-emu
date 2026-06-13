#!/usr/bin/env node
/**
 * Grants roles/riscconfigs.admin to the existing service account so it can
 * register the Cross-Account Protection stream.
 */

import crypto from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const oauthPath = path.join(__dirname, 'MY-google-ID', 'MY-google-ID.json');
const serviceAccountPath = path.join(__dirname, 'MY-google-ID', 'vortex-prime-drive-worker-key.json');
const redirectUri = 'http://localhost:53682/oauth2callback';
const scope = 'https://www.googleapis.com/auth/cloud-platform';
const role = 'roles/riscconfigs.admin';

if (!existsSync(oauthPath) || !existsSync(serviceAccountPath)) {
  console.error('Missing MY-google-ID OAuth or service-account JSON file.');
  process.exit(1);
}

const oauth = JSON.parse(readFileSync(oauthPath, 'utf8')).web;
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
const projectId = serviceAccount.project_id || oauth.project_id;
const member = `serviceAccount:${serviceAccount.client_email}`;

const state = base64Url(crypto.randomBytes(32));
const codeVerifier = base64Url(crypto.randomBytes(64));
const codeChallenge = base64Url(crypto.createHash('sha256').update(codeVerifier).digest());

const authUrl =
  'https://accounts.google.com/o/oauth2/v2/auth' +
  `?client_id=${encodeURIComponent(oauth.client_id)}` +
  `&redirect_uri=${encodeURIComponent(redirectUri)}` +
  '&response_type=code' +
  `&scope=${encodeURIComponent(scope)}` +
  '&access_type=online' +
  `&state=${encodeURIComponent(state)}` +
  `&code_challenge=${encodeURIComponent(codeChallenge)}` +
  '&code_challenge_method=S256' +
  '&prompt=consent';

console.log(`Granting ${role} to ${member} in project ${projectId}.`);
console.log('Opening Google approval page...');

try {
  execSync(`start "" "${authUrl}"`);
} catch (error) {
  console.log(authUrl);
}

const accessToken = await waitForAccessToken();
const policy = await requestJson(`https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}:getIamPolicy`, {
  method: 'POST',
  accessToken,
  body: {},
});

const bindings = Array.isArray(policy.bindings) ? policy.bindings : [];
let binding = bindings.find((entry) => entry.role === role);
if (!binding) {
  binding = { role, members: [] };
  bindings.push(binding);
}
if (!binding.members.includes(member)) {
  binding.members.push(member);
}

const updatedPolicy = await requestJson(`https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}:setIamPolicy`, {
  method: 'POST',
  accessToken,
  body: {
    policy: {
      ...policy,
      bindings,
    },
  },
});

console.log('Updated IAM policy etag:', updatedPolicy.etag || '(none)');
console.log(`${member} now has ${role}.`);

function waitForAccessToken() {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const reqUrl = new URL(req.url, redirectUri);
      if (reqUrl.pathname !== '/oauth2callback') {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      try {
        const error = reqUrl.searchParams.get('error');
        const code = reqUrl.searchParams.get('code');
        const returnedState = reqUrl.searchParams.get('state');
        if (error || !code) throw new Error(error || 'Missing authorization code.');
        if (returnedState !== state) throw new Error('Invalid OAuth state.');

        const token = await exchangeCode(code);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Permission granted</h1><p>You can close this tab.</p>');
        server.close();
        resolve(token);
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(`<h1>Failed</h1><pre>${escapeHtml(error.message)}</pre>`);
        server.close();
        reject(error);
      }
    });
    server.listen(53682, '127.0.0.1');
    server.on('error', reject);
  });
}

async function exchangeCode(code) {
  const data = await requestJson('https://oauth2.googleapis.com/token', {
    method: 'POST_FORM',
    body: new URLSearchParams({
      code,
      client_id: oauth.client_id,
      client_secret: oauth.client_secret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    }),
  });
  if (!data?.access_token) {
    throw new Error('Google did not return an access token.');
  }
  return data.access_token;
}

function requestJson(url, { method = 'GET', accessToken, body } = {}) {
  const isForm = method === 'POST_FORM';
  const payload = body ? String(isForm ? body : JSON.stringify(body)) : null;
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: isForm ? 'POST' : method,
      headers: {
        Accept: 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(payload ? {
          'Content-Type': isForm ? 'application/x-www-form-urlencoded' : 'application/json; charset=utf-8',
          'Content-Length': Buffer.byteLength(payload),
        } : {}),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = data ? JSON.parse(data) : null;
        } catch (error) {
          parsed = data;
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(parsed);
          return;
        }
        const detail = typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2);
        reject(new Error(`HTTP ${res.statusCode}: ${detail}`));
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function base64Url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
