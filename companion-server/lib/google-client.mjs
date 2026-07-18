import fs from 'fs-extra';
import path from 'path';
import { google } from 'googleapis';
import { defaultClientPath, tokenPath } from './paths.mjs';
import { getEnv } from './env.mjs';

function selectDefaultRedirectUri(list = []) {
  const desired = 'https://vortex-prime-emu.com/auth/google/callback';
  return list.find((uri) => uri === desired) || list[0];
}

function extractWebCredentials(json) {
  if (!json) throw new Error('Google OAuth client JSON is empty.');
  if (json.web) return json.web;
  if (json.installed) return json.installed;
  return json;
}

async function readClientConfig() {
  const customPath = getEnv('GOOGLE_OAUTH_CLIENT_PATH');
  const clientPath = customPath ? path.resolve(customPath) : defaultClientPath;
  const exists = await fs.pathExists(clientPath);
  if (!exists) {
    throw new Error(`Google OAuth client file not found: ${clientPath}`);
  }
  const raw = await fs.readFile(clientPath, 'utf8');
  const json = JSON.parse(raw);
  const web = extractWebCredentials(json);
  if (!web?.client_id || !web?.client_secret) {
    throw new Error('Google OAuth client JSON must include client_id and client_secret.');
  }
  const redirectUris = Array.isArray(web.redirect_uris) ? web.redirect_uris : [];
  const defaultRedirectUri = selectDefaultRedirectUri(redirectUris);
  return { config: web, clientPath, redirectUris, defaultRedirectUri };
}

export async function createOAuthClient(options = {}) {
  const { redirectUriOverride } = options;
  const { config, clientPath, redirectUris, defaultRedirectUri } = await readClientConfig();
  const envOverride = getEnv('GOOGLE_OAUTH_REDIRECT');
  const redirectUri = redirectUriOverride || envOverride || defaultRedirectUri;
  if (!redirectUri) {
    throw new Error('No redirect URI found in Google OAuth client JSON.');
  }
  const registeredUris = redirectUris || [];
  if (redirectUriOverride && !registeredUris.includes(redirectUriOverride)) {
    const error = new Error(`Redirect URI not registered in Google Cloud: ${redirectUriOverride}`);
    error.code = 'REDIRECT_URI_NOT_REGISTERED';
    error.redirectUri = redirectUriOverride;
    error.registeredRedirectUris = registeredUris;
    throw error;
  }
  if (envOverride && !registeredUris.includes(envOverride)) {
    const error = new Error(`Redirect URI from GOOGLE_OAUTH_REDIRECT is not registered: ${envOverride}`);
    error.code = 'REDIRECT_URI_NOT_REGISTERED';
    error.redirectUri = envOverride;
    error.registeredRedirectUris = registeredUris;
    throw error;
  }
  const oauth2Client = new google.auth.OAuth2(config.client_id, config.client_secret, redirectUri);
  const token = await readStoredToken();
  const envToken = getEnv('GOOGLE_REFRESH_TOKEN');
  const refreshToken = envToken || token?.refresh_token;
  if (refreshToken) {
    oauth2Client.setCredentials({ refresh_token: refreshToken });
  }
  return {
    oauth2Client,
    redirectUri,
    clientConfig: config,
    clientPath,
    registeredRedirectUris: registeredUris,
    hasRefreshToken: Boolean(refreshToken),
  };
}

export async function readStoredToken() {
  const exists = await fs.pathExists(tokenPath);
  if (!exists) return null;
  try {
    const raw = await fs.readFile(tokenPath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    console.warn('Failed to parse stored Google token JSON', error);
    return null;
  }
}

export async function writeStoredToken(token) {
  if (!token || !token.refresh_token) {
    throw new Error('Token payload must include refresh_token.');
  }
  await fs.writeJson(tokenPath, token, { spaces: 2 });
}

export async function getDriveClient() {
  const { oauth2Client } = await createOAuthClient();
  return google.drive({ version: 'v3', auth: oauth2Client });
}

export async function hasStoredRefreshToken() {
  if (getEnv('GOOGLE_REFRESH_TOKEN')) return true;
  const stored = await readStoredToken();
  return Boolean(stored?.refresh_token);
}
