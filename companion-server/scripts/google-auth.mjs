#!/usr/bin/env node
import http from 'node:http';
import { once } from 'node:events';

import { google } from 'googleapis';

import { createOAuthClient, writeStoredToken } from '../lib/google-client.mjs';
import { getEnv, setEnv } from '../lib/env.mjs';

const DEFAULT_PORTS = [53682, 53683, 53684, 53685, 53686];
const CALLBACK_PATH = '/oauth2callback';

function buildAuthInstructions(url) {
  console.log('=== Vortex Companion Google OAuth ===');
  console.log('1. A browser window should open automatically. If it does not, open this link:');
  console.log(url);
  console.log('\n2. Sign in with the Google account that owns your Drive storage.');
  console.log('3. Approve Drive access for the companion server when prompted.');
  console.log('4. When Google redirects back to the local callback, this script will continue automatically.');
  console.log('\nIf you see "Access blocked", add your Google account email as a test user in the OAuth consent screen.');
}

async function openBrowser(url) {
  try {
    const { default: open } = await import('open');
    await open(url);
  } catch (error) {
    console.warn('Failed to launch browser automatically. Please open the URL manually.');
  }
}

async function startCallbackListener(preferredPorts = DEFAULT_PORTS) {
  const attempted = [];
  for (const port of preferredPorts) {
    const redirectUri = `http://localhost:${port}${CALLBACK_PATH}`;
    const server = http.createServer((req, res) => {
      const { url } = req;
      try {
        const target = new URL(url, redirectUri);
        if (target.pathname !== CALLBACK_PATH) {
          res.statusCode = 404;
          res.end('Not found.');
          return;
        }
        const error = target.searchParams.get('error');
        const code = target.searchParams.get('code');
        if (error && !code) {
          res.statusCode = 400;
          res.end('Authorization failed. You can close this tab.');
          server.emit('oauth:error', new Error(`Google returned error: ${error}`));
          return;
        }
        if (!code) {
          res.statusCode = 400;
          res.end('Missing authorization code. You can close this tab.');
          server.emit('oauth:error', new Error('Missing authorization code in callback.'));
          return;
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end('<html><body><h1>Google Drive authorised. You can return to the terminal.</h1></body></html>');
        server.emit('oauth:code', code);
      } catch (err) {
        res.statusCode = 500;
        res.end('Invalid callback URL.');
        server.emit('oauth:error', err);
      }
    });

    server.on('clientError', (err, socket) => {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
      console.warn('OAuth callback client error:', err.message);
    });

    try {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => {
          server.off('error', reject);
          resolve();
        });
      });
      return { server, port, redirectUri };
    } catch (error) {
      attempted.push({ port, error });
      if (error.code === 'EADDRINUSE') {
        console.warn(`Port ${port} is busy. Trying another port...`);
        continue;
      }
      throw error;
    }
  }
  const attemptedPorts = attempted.map((entry) => entry.port).join(', ');
  throw new Error(`Unable to start local callback server. Ports tried: ${attemptedPorts}`);
}

async function waitForAuthorization(server) {
  return Promise.race([
    once(server, 'oauth:code').then(([code]) => ({ code })),
    once(server, 'oauth:error').then(([error]) => ({ error })),
  ]);
}

async function verifyDriveAccess(oauth2Client) {
  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  await drive.about.get({ fields: 'user, storageQuota' });
}

async function main() {
  const scope = getEnv('GOOGLE_DRIVE_SCOPE', 'https://www.googleapis.com/auth/drive.file');

  const { server, port, redirectUri } = await startCallbackListener();
  console.log(`Listening for Google OAuth callback on ${redirectUri}`);

  let oauthSetup;
  try {
    oauthSetup = await createOAuthClient({ redirectUriOverride: redirectUri });
  } catch (error) {
    server.close();
    if (error.code === 'REDIRECT_URI_NOT_REGISTERED') {
      console.error('\nRedirect URI is not registered in your Google Cloud OAuth client.');
      console.error(`Add this URI to the OAuth client in Google Cloud Console: ${error.redirectUri}`);
      console.error('Then rerun `npm run google:auth`.');
      process.exit(1);
    }
    throw error;
  }

  const { oauth2Client, registeredRedirectUris } = oauthSetup;
  if (!registeredRedirectUris?.includes(redirectUri)) {
    console.warn('Redirect URI not found in OAuth client JSON. Make sure it is registered.');
  }

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [scope],
    redirect_uri: redirectUri,
  });

  buildAuthInstructions(authUrl);
  await openBrowser(authUrl);

  const { code, error } = await waitForAuthorization(server);
  server.close();

  if (error) {
    console.error('Authorization failed:', error.message);
    if (/access_denied/i.test(error.message)) {
      console.error('Google reported access denied. Ensure your account is listed as a test user.');
    }
    process.exit(1);
  }

  if (!code) {
    console.error('Did not receive an authorization code.');
    process.exit(1);
  }

  try {
    const { tokens } = await oauth2Client.getToken(code.trim());
    if (!tokens.refresh_token) {
      console.error('Google did not return a refresh_token. Make sure "offline" access is enabled.');
      process.exit(1);
    }
    await writeStoredToken(tokens);
    await setEnv('GOOGLE_REFRESH_TOKEN', tokens.refresh_token);

    oauth2Client.setCredentials({ refresh_token: tokens.refresh_token });
    await verifyDriveAccess(oauth2Client);

    console.log('\nGoogle Drive authorised successfully. Refresh token saved to data/google-token.json and .env.');
  } catch (err) {
    console.error('Failed to exchange code for tokens:', err.message);
    if (/redirect_uri_mismatch/i.test(err.message)) {
      console.error(`Ensure the redirect URI ${redirectUri} is added to your Google Cloud OAuth client.`);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Google auth script failed:', error);
  process.exit(1);
});
