#!/usr/bin/env node
/**
 * Registers the Cloudflare Worker as the Google Cross-Account Protection
 * receiver for this project.
 *
 * Prerequisites in Google Cloud:
 * - RISC API enabled.
 * - The service account has roles/riscconfigs.admin.
 */

import crypto from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serviceAccountPath = path.join(__dirname, '..', 'MY-google-ID', 'vortex-prime-drive-worker-key.json');
const receiverEndpoint = 'https://vortex-prime-emu.com/api/risc/events';

const eventsRequested = [
  'https://schemas.openid.net/secevent/risc/event-type/verification',
  'https://schemas.openid.net/secevent/risc/event-type/sessions-revoked',
  'https://schemas.openid.net/secevent/oauth/event-type/tokens-revoked',
  'https://schemas.openid.net/secevent/oauth/event-type/token-revoked',
  'https://schemas.openid.net/secevent/risc/event-type/account-disabled',
  'https://schemas.openid.net/secevent/risc/event-type/account-enabled',
  'https://schemas.openid.net/secevent/risc/event-type/account-credential-change-required',
];

if (!existsSync(serviceAccountPath)) {
  console.error(`Missing service account key: ${serviceAccountPath}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

if (!serviceAccount.client_email || !serviceAccount.private_key || !serviceAccount.private_key_id) {
  console.error('Service account key is missing client_email, private_key, or private_key_id.');
  process.exit(1);
}

const authToken = makeBearerToken(serviceAccount);

const updateResponse = await requestJson('https://risc.googleapis.com/v1beta/stream:update', {
  method: 'POST',
  token: authToken,
  body: {
    delivery: {
      delivery_method: 'https://schemas.openid.net/secevent/risc/delivery-method/push',
      url: receiverEndpoint,
    },
    events_requested: eventsRequested,
  },
});

console.log('RISC stream updated:');
console.log(JSON.stringify(updateResponse, null, 2));

const verifyResponse = await requestJson('https://risc.googleapis.com/v1beta/stream:verify', {
  method: 'POST',
  token: authToken,
  body: {
    state: `vortex-prime verification ${new Date().toISOString()}`,
  },
});

console.log('Verification event requested:');
console.log(JSON.stringify(verifyResponse, null, 2));

function makeBearerToken(credentials) {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: credentials.private_key_id,
  };
  const payload = {
    iss: credentials.client_email,
    sub: credentials.client_email,
    aud: 'https://risc.googleapis.com/google.identity.risc.v1beta.RiscManagementService',
    iat: now,
    exp: now + 3600,
  };
  const signingInput = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(signingInput)
    .sign(credentials.private_key);
  return `${signingInput}.${base64Url(signature)}`;
}

function base64UrlJson(value) {
  return base64Url(Buffer.from(JSON.stringify(value), 'utf8'));
}

function base64Url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function requestJson(url, { method = 'GET', token, body } = {}) {
  const payload = body ? JSON.stringify(body) : null;
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(payload ? {
          'Content-Type': 'application/json; charset=utf-8',
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
