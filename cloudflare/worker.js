const PRODUCTION_ORIGINS = [
  'https://vortex-prime-emu.com',
  'https://rileyadams05.github.io',
];

const DEFAULT_DB = {
  storeMods: [],
  reports: [],
  vortexAccounts: [],
  nxePairs: [],
  adminSettings: {},
};

const UPLOAD_TARGETS = {
  mod: {
    folderEnv: 'DRIVE_MODS_FOLDER_ID',
    allowedExtensions: ['.zip', '.7z', '.rar'],
    invalidMessage: 'Mod archive must be ZIP, 7Z, or RAR.',
    makePublic: true,
  },
  image: {
    folderEnv: 'DRIVE_ICONS_FOLDER_ID',
    allowedExtensions: ['.png', '.jpg', '.jpeg', '.webp'],
    invalidMessage: 'Icon must be PNG, JPG, JPEG, or WEBP.',
    makePublic: true,
  },
  preview: {
    folderEnv: 'DRIVE_PREVIEWS_FOLDER_ID',
    allowedExtensions: ['.png', '.jpg', '.jpeg', '.webp'],
    invalidMessage: 'Preview must be PNG, JPG, JPEG, or WEBP.',
    makePublic: true,
  },
  readme: {
    folderEnv: 'DRIVE_READMES_FOLDER_ID',
    allowedExtensions: ['.txt', '.md', '.markdown'],
    invalidMessage: 'README must be TXT or Markdown.',
    makePublic: true,
  },
};

let tokenCache = null;
let googleCertCache = null;
let riscConfigCache = null;
let adminEmailCache = null;

const GOOGLE_ISSUERS = new Set([
  'https://accounts.google.com',
  'accounts.google.com',
]);

const SESSION_COOKIE_NAME = 'vps_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days (persistent login)
const ACCOUNT_SETUP_TTL_SECONDS = 15 * 60;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

let sessionKeyCache = null;

let nxeControlTokenKeyCache = null;

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin');
    const allowedOrigin = resolveAllowedOrigin(origin);

    if (request.method === 'OPTIONS') {
      return optionsResponse(allowedOrigin);
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/+/, '');

    try {
      if (path === 'api/auth/logout') {
        return handleLogout(env, allowedOrigin);
      }

      if (path.startsWith('api/auth/')) {
        return json({ ok: false, message: 'Website sign-in and account APIs have been retired.' }, 410, allowedOrigin);
      }

      if (path.startsWith('api/modx/')) {
        return json({ ok: false, message: 'ModX catalogue changes are submitted as GitHub pull requests.' }, 410, allowedOrigin);
      }

      if (path === 'api/risc/events') {
        return json({ ok: false, message: 'Google account security integration has been retired.' }, 410, allowedOrigin);
      }

      if (path === 'privacy-policy') {
        return Response.redirect(new URL('/privacy/', request.url), 308);
      }

      if (path === '' || path === 'api') {
        return json({ ok: true, service: 'Vortex Prime Companion Worker' }, 200, allowedOrigin);
      }

      if (path === 'api/status' || path === 'api/public/catalogue' ||
          path === 'api/public/submit-video' || path.startsWith('api/catalogue/') ||
          path.startsWith('api/uploads/')) {
        return json({
          ok: false,
          message: 'Storage-backed catalogue endpoints are retired. The public catalogue is served from /mods/mods.json.'
        }, 410, allowedOrigin);
      }

      if (path === 'api/status') {
        return handleStatus(request, env, allowedOrigin);
      }

      if (path === 'api/auth/config') {
        return handleAuthConfig(request, env, allowedOrigin);
      }

      if (path === 'api/auth/login') {
        return handleLogin(request, env, allowedOrigin, ctx);
      }

      if (path === 'api/auth/username/check') {
        return handleUsernameCheck(request, env, allowedOrigin);
      }

      if (path === 'api/auth/complete-profile') {
        return handleCompleteProfile(request, env, allowedOrigin, ctx);
      }

      if (path === 'api/auth/logout') {
        return handleLogout(env, allowedOrigin);
      }

      // NXE pairing remains legacy code and is not exposed by the primary website API.

      if (path === 'api/risc/events') {
        return handleRiscEvents(request, env, allowedOrigin);
      }

      if (path === 'api/public/catalogue') {
        return handlePublicCatalogue(env, allowedOrigin);
      }

      if (path === 'api/public/submit-video') {
        return handlePublicSubmitVideo(request, env, allowedOrigin);
      }

      if (path === 'api/modx/submit') {
        return await handleModxSubmission(request, env, allowedOrigin);
      }

      if (path === 'api/modx/resolve-release') {
        return await handleModxReleaseResolution(request, env, allowedOrigin);
      }

      if (path === 'api/modx/reviews') {
        return await handleModxReviewCreation(request, env, allowedOrigin);
      }

      if (/^api\/modx\/reviews\/[a-f0-9-]{20,80}$/.test(path)) {
        return await handleModxReviewStatus(request, env, path, allowedOrigin);
      }

      if (path === 'api/modx/my-tables') {
        return await handleModxMyTables(request, env, allowedOrigin);
      }

      if (/^api\/modx\/tables\/[^/]+\/refresh$/.test(path)) {
        return await handleModxTableRefresh(request, env, path, allowedOrigin);
      }

      if (path === 'api/modx/tables') {
        return await handlePublicModxTables(request, allowedOrigin);
      }

      if (/^api\/modx\/tables\/[^/]+\/report$/.test(path)) {
        return await handleModxTableReport(request, env, path, allowedOrigin);
      }

      if (path.startsWith('api/catalogue/')) {
        return handleCatalogueRequest(request, env, path, allowedOrigin);
      }

      if (path.startsWith('api/uploads/')) {
        return handleUploadRequest(request, env, path, allowedOrigin);
      }

      return json({ ok: false, message: 'API route not found.' }, 404, allowedOrigin);
    } catch (error) {
      console.error('Worker error:', error);
      const status = error.status || 500;
      const message = error.message || 'Internal server error';
      return json({ ok: false, message }, status, allowedOrigin);
    }
  },
};

export class NxePairSession {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('WebSocket upgrade required.', { status: 426 });
    }
    const role = request.headers.get('X-NXE-Relay-Role');
    if (role !== 'console' && role !== 'browser') {
      return new Response('Invalid relay role.', { status: 403 });
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    if (role === 'console') {
      for (const existing of this.state.getWebSockets('console')) {
        try { existing.close(1000, 'Console reconnected'); } catch (_) {}
      }
    }
    this.state.acceptWebSocket(server, [role]);
    server.serializeAttachment({ role });
    server.send(JSON.stringify({
      type: 'relay-ready',
      consoleConnected: role === 'console' || this.state.getWebSockets('console').length > 0,
    }));
    if (role === 'console') this.broadcast('browser', JSON.stringify({ type: 'console-state', connected: true }));
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(socket, message) {
    const attachment = socket.deserializeAttachment() || {};
    const targetRole = attachment.role === 'console' ? 'browser' : 'console';
    const targets = this.state.getWebSockets(targetRole);
    if (!targets.length && attachment.role === 'browser') {
      socket.send(JSON.stringify({ type: 'relay-error', message: 'NXE console is not connected to Vortex Prime.' }));
      return;
    }
    for (const target of targets) {
      try { target.send(message); } catch (_) {}
    }
  }

  webSocketClose(socket) {
    const attachment = socket.deserializeAttachment() || {};
    if (attachment.role === 'console') this.broadcast('browser', JSON.stringify({ type: 'console-state', connected: false }));
  }

  webSocketError(socket) {
    this.webSocketClose(socket);
  }

  broadcast(role, message) {
    for (const socket of this.state.getWebSockets(role)) {
      try { socket.send(message); } catch (_) {}
    }
  }
}

function resolveAllowedOrigin(origin) {
  if (!origin) return PRODUCTION_ORIGINS[0];
  if (PRODUCTION_ORIGINS.includes(origin) ||
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
    return origin;
  }
  return null;
}

function optionsResponse(origin) {
  const headers = new Headers({
    'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
    'access-control-allow-headers': 'Content-Type,Authorization',
    'access-control-max-age': '86400',
  });
  if (origin) {
    headers.set('access-control-allow-origin', origin);
    headers.set('access-control-allow-credentials', 'true');
  }
  return new Response(null, { status: 204, headers });
}

function json(data, status = 200, origin) {
  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  if (origin) {
    headers.set('access-control-allow-origin', origin);
    headers.set('access-control-allow-credentials', 'true');
  }
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers,
  });
}

async function handleStatus(request, env, origin) {
  const requiredSecrets = [
    'GOOGLE_DRIVE_CLIENT_ID',
    'GOOGLE_DRIVE_CLIENT_SECRET',
    'GOOGLE_DRIVE_REFRESH_TOKEN',
    'DRIVE_DATABASE_FILE_ID',
    'DRIVE_PACKAGES_FOLDER_ID',
    'DRIVE_MODS_FOLDER_ID',
    'DRIVE_ICONS_FOLDER_ID',
    'DRIVE_PREVIEWS_FOLDER_ID',
    'DRIVE_READMES_FOLDER_ID',
    'GOOGLE_OAUTH_CLIENT_ID',
    'SESSION_SECRET',
  ];

  const missing = requiredSecrets.filter((name) => !String(env[name] || '').trim());
  const status = {
    configured: missing.length === 0,
    googleAuthorized: false,
    message: missing.length ? `Missing Worker secrets: ${missing.join(', ')}` : 'Google Drive storage ready.',
    folders: buildFolderSummary(env),
    storeDbFileId: buildFileLink(env.DRIVE_DATABASE_FILE_ID),
    auth: buildAuthSummary(env, await readSession(request, env).catch(() => null)),
  };

  if (missing.length) {
    return json(status, 200, origin);
  }

  try {
    await assertDriveAccess(env);
    status.googleAuthorized = true;
  } catch (error) {
    status.configured = false;
    status.googleAuthorized = false;
    status.message = error.message || 'Unable to access Google Drive storage.';
  }

  return json(status, 200, origin);
}

async function handleNxePairRegister(request, env, origin) {
  if (request.method !== 'POST') throw httpError(405, 'NXE registration requires POST.');
  const deviceToken = String(request.headers.get('X-NXE-Device') || '').trim();
  const body = await request.json().catch(() => null);
  const pairId = String(body?.pairId || '').trim();
  const controlToken = String(body?.controlToken || '').trim();
  if (!deviceToken || !pairId || !controlToken) throw httpError(400, 'Incomplete NXE pairing registration.');
  if (!/^[A-Za-z0-9_-]{12,256}$/.test(pairId) || !/^[A-Fa-f0-9]{16,512}$/.test(deviceToken) || !/^[A-Fa-f0-9]{16,512}$/.test(controlToken)) {
    throw httpError(400, 'Invalid NXE pairing credentials.');
  }
  const now = new Date().toISOString();
  const deviceTokenHash = await sha256Base64Url(`nxe-device:${deviceToken}`);
  const controlTokenHash = await sha256Base64Url(`nxe-control:${controlToken}`);
  const controlTokenEncrypted = await encryptNxeControlToken(controlToken, pairId, env);
  const networkHash = await getNxeNetworkHash(request, env);
  const result = await updateDatabase(env, async (db) => {
    const pairs = Array.isArray(db.nxePairs) ? [...db.nxePairs] : [];
    const index = pairs.findIndex((entry) => entry.pairId === pairId);
    const existing = index >= 0 ? pairs[index] : null;
    const next = {
      id: existing?.id || `nxe_${crypto.randomUUID()}`,
      pairId,
      deviceTokenHash,
      controlTokenHash,
      controlTokenEncrypted,
      networkHash: networkHash || existing?.networkHash || null,
      consoleIp: String(body.consoleIp || '').trim(),
      ftpPort: String(body.ftpPort || '2121').trim() || '2121',
      running: Boolean(body.running),
      failure: String(body.failure || '').slice(0, 1000),
      lastSeenAt: now,
      createdAt: existing?.createdAt || now,
      accountId: existing?.accountId || null,
      command: existing?.command || null,
    };
    if (index >= 0) pairs[index] = next;
    else pairs.push(next);
    return { db: { ...db, nxePairs: pairs }, value: next };
  });
  return json({ ok: true, pair: sanitizeNxePair(result, false) }, 200, origin);
}

async function handleNxePairPoll(request, env, origin) {
  if (request.method !== 'POST') throw httpError(405, 'NXE polling requires POST.');
  const deviceToken = String(request.headers.get('X-NXE-Device') || '').trim();
  const body = await request.json().catch(() => null);
  const pairId = String(body?.pairId || '').trim();
  if (!deviceToken || !pairId) throw httpError(400, 'Incomplete NXE polling request.');
  const deviceTokenHash = await sha256Base64Url(`nxe-device:${deviceToken}`);
  const networkHash = await getNxeNetworkHash(request, env);
  const result = await updateDatabase(env, async (db) => {
    const pairs = Array.isArray(db.nxePairs) ? [...db.nxePairs] : [];
    const index = pairs.findIndex((entry) => entry.pairId === pairId && entry.deviceTokenHash === deviceTokenHash);
    if (index < 0) throw httpError(401, 'Unknown NXE pairing device.');
    const current = pairs[index];
    const now = new Date().toISOString();
    const controlToken = String(body.controlToken || '').trim();
    let controlTokenEncrypted = current.controlTokenEncrypted;
    if (controlToken && (!controlTokenEncrypted || !current.controlTokenHash)) {
      controlTokenEncrypted = await encryptNxeControlToken(controlToken, pairId, env);
    }
    const next = {
      ...current,
      controlTokenEncrypted,
      consoleIp: String(body.consoleIp || current.consoleIp || '').trim(),
      ftpPort: String(body.ftpPort || current.ftpPort || '2121').trim(),
      running: Boolean(body.running),
      failure: String(body.failure || '').slice(0, 1000),
      lastSeenAt: now,
      networkHash: networkHash || current.networkHash || null,
    };
    let command = next.command || null;
    const ackId = String(body.ackCommandId || '').trim();
    if (ackId && command?.id === ackId) {
      next.command = null;
      command = null;
    }
    pairs[index] = next;
    return { db: { ...db, nxePairs: pairs }, value: { pair: next, command } };
  });
  return json({ ok: true, command: result.command || undefined, pair: sanitizeNxePair(result.pair, false) }, 200, origin);
}

async function handleNxePairList(request, env, origin) {
  if (request.method !== 'GET') throw httpError(405, 'NXE pairing list requires GET.');
  const user = await ensureAuthenticated(request, env, 'Sign in with Google to view paired consoles.');
  const db = await loadDatabase(env);
  const accountId = user.firebaseUid || user.sub || user.email;
  const rawPairs = (Array.isArray(db.nxePairs) ? db.nxePairs : [])
    .filter((entry) => entry.accountId === accountId);
  const pairs = await Promise.all(rawPairs.map(async (entry) => {
    const safe = sanitizeNxePair(entry, false);
    // Return the decrypted controlToken so the browser can silently restore its
    // session on any signed-in device without needing a cached localStorage key.
    if (entry.controlTokenEncrypted) {
      try {
        safe.controlToken = await decryptNxeControlToken(entry.controlTokenEncrypted, entry.pairId, env);
      } catch (_) {
        safe.controlToken = '';
      }
    } else {
      safe.controlToken = '';
    }
    return safe;
  }));
  return json({ ok: true, pairs }, 200, origin);
}

async function handleNxePairClaim(request, env, origin) {
  if (request.method !== 'POST') throw httpError(405, 'NXE pairing claim requires POST.');
  const user = await ensureAuthenticated(request, env, 'Sign in with Google before pairing NXE.');
  const body = await request.json().catch(() => null);
  const pairId = String(body?.pairId || '').trim();
  const controlToken = String(body?.controlToken || '').trim();
  if (!pairId || !controlToken) throw httpError(400, 'Pair ID and pairing key are required.');
  const accountId = user.firebaseUid || user.sub || user.email;
  const controlTokenHash = await sha256Base64Url(`nxe-control:${controlToken}`);
  const result = await updateDatabase(env, async (db) => {
    const pairs = Array.isArray(db.nxePairs) ? [...db.nxePairs] : [];
    const index = pairs.findIndex((entry) => entry.pairId === pairId && entry.controlTokenHash === controlTokenHash);
    if (index < 0) throw httpError(404, 'NXE pairing not found or pairing key is invalid.');
    const next = {
      ...pairs[index],
      accountId,
      controlTokenEncrypted: await encryptNxeControlToken(controlToken, pairId, env),
      claimedAt: new Date().toISOString(),
    };
    pairs[index] = next;
    return { db: { ...db, nxePairs: pairs }, value: next };
  });
  return json({ ok: true, pair: sanitizeNxePair(result, false) }, 200, origin);
}

// Manual IP connect. NXE continuously reports its current LAN IP through the
// outbound cloud bridge. Existing owners can restore that live record on any
// device. A first-time claim additionally has to come from the same public
// network as the console, without persisting the raw public address.
async function handleNxePairConnect(request, env, origin) {
  if (request.method !== 'POST') throw httpError(405, 'NXE connect requires POST.');
  const user = await ensureAuthenticated(request, env, 'Sign in with Google to connect an NXE console.');
  const body = await request.json().catch(() => null);
  const consoleIp = String(body?.consoleIp || '').trim();
  const pairId = String(body?.pairId || '').trim();
  const ftpPort   = String(body?.ftpPort || '2121').trim() || '2121';
  if (!isValidIpv4Address(consoleIp)) throw httpError(400, 'Enter a valid console IP address and double-check every digit.');
  if (pairId && !/^[A-Za-z0-9_-]{12,256}$/.test(pairId)) throw httpError(400, 'NXE did not return a valid console identity.');
  const accountId = user.firebaseUid || user.sub || user.email;
  const networkHash = await getNxeNetworkHash(request, env);
  const result = await updateDatabase(env, async (db) => {
    const pairs = Array.isArray(db.nxePairs) ? [...db.nxePairs] : [];
    const liveCutoff = Date.now() - (15 * 60 * 1000);
    const candidates = pairs
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => entry.consoleIp === consoleIp &&
        Date.parse(entry.lastSeenAt || 0) >= liveCutoff &&
        (!pairId || entry.pairId === pairId));
    const owned = candidates.filter(({ entry }) => entry.accountId === accountId);
    const networkMatch = candidates.filter(({ entry }) => networkHash && entry.networkHash === networkHash);
    const claimable = candidates.filter(({ entry }) => !entry.accountId && networkHash && entry.networkHash === networkHash);
    const unclaimed = candidates.filter(({ entry }) => !entry.accountId);
    const savedFallback = pairs
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => entry.consoleIp === consoleIp && entry.accountId === accountId && (!pairId || entry.pairId === pairId));
    const match = owned[0] || networkMatch[0] || claimable[0] || unclaimed[0] || (candidates.length === 1 ? candidates[0] : null) || savedFallback[0] || null;
    if (!match) {
      throw httpError(404, 'NXE could not reach console at ' + consoleIp + '. Double-check every IP digit, confirm the address on your Xbox screen, and make sure NXE is open.');
    }
    const existing = match.index;
    const current = pairs[existing];
    if (current.accountId && current.accountId !== accountId) {
      throw httpError(409, 'This NXE console is saved to a different Vortex Prime account.');
    }
    let controlToken = '';
    if (current.controlTokenEncrypted) {
      try {
        controlToken = await decryptNxeControlToken(current.controlTokenEncrypted, current.pairId, env);
      } catch (_) {
        controlToken = current.pairId;
      }
    } else {
      controlToken = current.pairId;
    }
    const now = new Date().toISOString();
    const next = {
      ...current,
      consoleIp,
      ftpPort,
      accountId,
      claimedAt: now,
    };
    pairs[existing] = next;
    return { db: { ...db, nxePairs: pairs }, value: { pair: next, controlToken } };
  });
  return json({
    ok: true,
    pair: sanitizeNxePair(result.pair, false),
    controlToken: result.controlToken,
  }, 200, origin);
}

function isValidIpv4Address(value) {
  const parts = String(value || '').split('.');
  return parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

async function getNxeNetworkHash(request, env) {
  const forwarded = String(request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || '').split(',')[0].trim();
  if (!forwarded) return '';
  return sha256Base64Url(`nxe-network:${forwarded}:${String(env.SESSION_SECRET || '')}`);
}

async function handleNxeRelayUpgrade(request, env, path) {
  if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
    throw httpError(426, 'NXE relay requires a WebSocket connection.');
  }
  const url = new URL(request.url);
  const pairId = String(url.searchParams.get('pairId') || '').trim();
  if (!/^[A-Za-z0-9_-]{12,256}$/.test(pairId)) throw httpError(400, 'Invalid NXE console identity.');
  const db = await loadDatabase(env);
  const pair = (Array.isArray(db.nxePairs) ? db.nxePairs : []).find((entry) => entry.pairId === pairId);
  if (!pair) throw httpError(404, 'NXE console is not registered.');

  let role;
  if (path.endsWith('/console')) {
    const deviceToken = String(request.headers.get('X-NXE-Device') || url.searchParams.get('deviceToken') || url.searchParams.get('token') || '').trim();
    const deviceTokenHash = await sha256Base64Url(`nxe-device:${deviceToken}`);
    if (!deviceToken || deviceTokenHash !== pair.deviceTokenHash) throw httpError(401, 'Unknown NXE relay device.');
    role = 'console';
  } else {
    const controlKey = String(url.searchParams.get('key') || url.searchParams.get('controlToken') || '').trim();
    const controlKeyHash = controlKey ? await sha256Base64Url(`nxe-control:${controlKey}`) : '';
    let authenticated = false;
    let accountId = '';
    try {
      const user = await ensureAuthenticated(request, env, 'Sign in with Google to use the NXE relay.');
      accountId = user.firebaseUid || user.sub || user.email;
      authenticated = true;
    } catch (_) {}

    if (authenticated) {
      if (pair.accountId && pair.accountId !== accountId) {
        throw httpError(403, 'This NXE console is not saved to your account.');
      }
    } else if (controlKeyHash && controlKeyHash === pair.controlTokenHash) {
      // Authenticated via pairing key
    } else {
      throw httpError(401, 'Sign in with Google or provide a valid pairing key to use the NXE relay.');
    }
    role = 'browser';
  }

  if (!env.NXE_PAIR_SESSIONS) throw httpError(503, 'NXE relay is not configured.');
  const stub = env.NXE_PAIR_SESSIONS.getByName(pairId);
  const headers = new Headers(request.headers);
  headers.set('X-NXE-Relay-Role', role);
  headers.delete('Authorization');
  headers.delete('Cookie');
  headers.delete('X-NXE-Device');
  return stub.fetch(new Request(request.url, { method: 'GET', headers }));
}

async function handleNxePairCommand(request, env, origin) {
  if (request.method !== 'POST') throw httpError(405, 'NXE commands require POST.');
  const user = await ensureAuthenticated(request, env, 'Sign in with Google before controlling NXE.');
  const body = await request.json().catch(() => null);
  const pairId = String(body?.pairId || '').trim();
  const type = String(body?.type || '').trim().toLowerCase();
  const allowed = new Set(['configure', 'start', 'stop', 'restart']);
  if (!pairId || !allowed.has(type)) throw httpError(400, 'Invalid NXE command.');
  const accountId = user.firebaseUid || user.sub || user.email;
  const result = await updateDatabase(env, async (db) => {
    const pairs = Array.isArray(db.nxePairs) ? [...db.nxePairs] : [];
    const index = pairs.findIndex((entry) => entry.pairId === pairId && entry.accountId === accountId);
    if (index < 0) throw httpError(404, 'NXE console is not paired to this account.');
    const id = `cmd_${crypto.randomUUID()}`;
    const command = {
      id,
      type,
      username: type === 'configure' ? String(body.username || '').slice(0, 128) : undefined,
      password: type === 'configure' ? String(body.password || '').slice(0, 512) : undefined,
      createdAt: new Date().toISOString(),
    };
    const next = { ...pairs[index], command };
    pairs[index] = next;
    return { db: { ...db, nxePairs: pairs }, value: { id, type } };
  });
  return json({ ok: true, command: result }, 202, origin);
}

async function handleNxePairForget(request, env, origin) {
  if (request.method !== 'POST') throw httpError(405, 'NXE forget requires POST.');
  const user = await ensureAuthenticated(request, env, 'Sign in with Google before unpairing NXE.');
  const body = await request.json().catch(() => null);
  const pairId = String(body?.pairId || '').trim();
  if (!pairId) throw httpError(400, 'Pair ID is required.');
  const accountId = user.firebaseUid || user.sub || user.email;
  await updateDatabase(env, async (db) => {
    const pairs = Array.isArray(db.nxePairs) ? [...db.nxePairs] : [];
    const index = pairs.findIndex((entry) => entry.pairId === pairId && entry.accountId === accountId);
    if (index >= 0) {
      const next = {
        ...pairs[index],
        accountId: null,
        controlTokenEncrypted: null,
        claimedAt: null,
      };
      pairs[index] = next;
    }
    return { db: { ...db, nxePairs: pairs }, value: true };
  });
  return json({ ok: true }, 200, origin);
}

function sanitizeNxePair(pair, includeSecrets = false) {
  if (!pair) return null;
  const result = {
    id: pair.id,
    pairId: pair.pairId,
    consoleIp: pair.consoleIp || '',
    ftpPort: pair.ftpPort || '2121',
    running: Boolean(pair.running),
    failure: pair.failure || '',
    lastSeenAt: pair.lastSeenAt || null,
    createdAt: pair.createdAt || null,
    claimedAt: pair.claimedAt || null,
    connected: Boolean(pair.lastSeenAt && Date.now() - Date.parse(pair.lastSeenAt) < 20000),
  };
  if (includeSecrets) {
    result.controlTokenHash = pair.controlTokenHash;
    result.deviceTokenHash = pair.deviceTokenHash;
  }
  return result;
}

async function handlePublicCatalogue(env, origin) {
  const db = await loadDatabase(env);
  return json({ storeMods: Array.isArray(db.storeMods) ? db.storeMods : [] }, 200, origin);
}

async function handleAuthConfig(request, env, origin) {
  const session = await readSession(request, env).catch(() => null);
  const summary = buildAuthSummary(env, session);
  return json({ ok: true, ...summary }, 200, origin);
}

async function handleLogin(request, env, origin, ctx) {
  if (request.method !== 'POST') {
    throw httpError(405, 'Login requires POST.');
  }

  const body = await request.json().catch(() => null);
  const idToken = typeof body?.idToken === 'string'
    ? body.idToken
    : await exchangeGoogleCredentialForFirebase(body?.credential, env);
  if (!idToken) {
    throw httpError(400, 'Missing Firebase ID token.');
  }

  const profile = await validateFirebaseIdToken(idToken, env);
  const db = await loadDatabase(env);
  const account = findVortexAccount(db, profile.uid);
  const role = isAdminEmail(profile.email, env) ? 'admin' : 'uploader';
  const now = Math.floor(Date.now() / 1000);

  if (!account) {
    const setupToken = await createSessionToken({
      purpose: 'account_setup',
      sub: profile.sub,
      firebaseUid: profile.uid,
      email: profile.email,
      name: profile.name || null,
      picture: profile.picture || null,
      role,
      exp: now + ACCOUNT_SETUP_TTL_SECONDS,
      iat: now,
    }, env);
    return json({
      ok: true,
      requiresProfile: true,
      setupToken,
      profile: {
        name: profile.name || '',
        email: profile.email,
        picture: profile.picture || null,
      },
    }, 200, origin);
  }

  const payload = {
    sub: profile.sub,
    firebaseUid: profile.uid,
    email: profile.email,
    name: account.name,
    username: account.username,
    picture: profile.picture || null,
    role,
    exp: now + SESSION_TTL_SECONDS,
    iat: now,
  };
  const token = await createSessionToken(payload, env);

  const response = json({
    ok: true,
    requiresProfile: false,
    user: sanitizeUserForResponse(payload),
    role,
  }, 200, origin);
  response.headers.append('Set-Cookie', buildSessionCookie(token));
  return response;
}

async function handleUsernameCheck(request, env, origin) {
  if (request.method !== 'POST') {
    throw httpError(405, 'Username availability checks require POST.');
  }
  const body = await request.json().catch(() => null);
  await verifyAccountSetupToken(body?.setupToken, env);
  const username = normalizeUsername(body?.username);
  const validationMessage = validateUsername(username);
  if (validationMessage) {
    return json({ ok: true, available: false, message: validationMessage }, 200, origin);
  }
  const db = await loadDatabase(env);
  const available = !getVortexAccounts(db).some((account) => account.usernameKey === username.toLowerCase());
  return json({
    ok: true,
    available,
    message: available ? 'Username is available.' : 'That username is already taken.',
  }, 200, origin);
}

async function handleCompleteProfile(request, env, origin, ctx) {
  if (request.method !== 'POST') {
    throw httpError(405, 'Account completion requires POST.');
  }
  const body = await request.json().catch(() => null);
  const setup = await verifyAccountSetupToken(body?.setupToken, env);
  const name = normalizeAccountName(body?.name);
  const email = String(body?.email || '').trim().toLowerCase();
  const username = normalizeUsername(body?.username);

  if (name.length < 2 || name.length > 80) throw httpError(400, 'Enter your full name.');
  if (!email || email !== String(setup.email || '').trim().toLowerCase()) {
    throw httpError(400, 'The email address must match the verified Google account.');
  }
  const usernameMessage = validateUsername(username);
  if (usernameMessage) throw httpError(400, usernameMessage);

  const nowIso = new Date().toISOString();
  const account = await updateDatabase(env, async (db) => {
    const accounts = getVortexAccounts(db);
    const usernameKey = username.toLowerCase();
    const conflict = accounts.find((entry) => entry.usernameKey === usernameKey && entry.firebaseUid !== setup.firebaseUid);
    if (conflict) throw httpError(409, 'That username is already taken.');
    const existingIndex = accounts.findIndex((entry) => entry.firebaseUid === setup.firebaseUid);
    const existing = existingIndex >= 0 ? accounts[existingIndex] : null;
    const nextAccount = {
      id: existing?.id || crypto.randomUUID(),
      firebaseUid: setup.firebaseUid,
      email,
      name,
      username,
      usernameKey,
      picture: typeof setup.picture === 'string' ? setup.picture : null,
      createdAt: existing?.createdAt || nowIso,
      updatedAt: nowIso,
    };
    if (existingIndex >= 0) accounts[existingIndex] = nextAccount;
    else accounts.push(nextAccount);
    return { db: { ...db, vortexAccounts: accounts }, value: nextAccount };
  });

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: setup.sub,
    firebaseUid: setup.firebaseUid,
    email: account.email,
    name: account.name,
    username: account.username,
    picture: account.picture,
    role: isAdminEmail(account.email, env) ? 'admin' : 'uploader',
    exp: now + SESSION_TTL_SECONDS,
    iat: now,
  };
  const token = await createSessionToken(payload, env);

  const response = json({
    ok: true,
    requiresProfile: false,
    user: sanitizeUserForResponse(payload),
    role: payload.role,
  }, 200, origin);
  response.headers.append('Set-Cookie', buildSessionCookie(token));
  return response;
}

function getVortexAccounts(db) {
  return Array.isArray(db?.vortexAccounts) ? [...db.vortexAccounts] : [];
}

function findVortexAccount(db, firebaseUid) {
  if (!firebaseUid) return null;
  return getVortexAccounts(db).find((account) => account.firebaseUid === firebaseUid) || null;
}

function normalizeAccountName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeUsername(value) {
  return String(value || '').trim();
}

function validateUsername(username) {
  if (username.length < 3 || username.length > 24) return 'Username must be between 3 and 24 characters.';
  if (!/^[A-Za-z0-9_]+$/.test(username)) return 'Use only letters, numbers, and underscores.';
  return '';
}

async function verifyAccountSetupToken(token, env) {
  if (typeof token !== 'string' || !token) throw httpError(401, 'Your account setup session has expired. Sign in again.');
  const payload = await verifySessionToken(token, env);
  if (payload?.purpose !== 'account_setup' || !payload.firebaseUid || !payload.email) {
    throw httpError(401, 'Invalid account setup session.');
  }
  return payload;
}

async function handleLogout(env, origin) {
  const response = json({ ok: true }, 200, origin);
  response.headers.append('Set-Cookie', buildSessionCookie('', { maxAge: 0 }));
  return response;
}

function maskName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  return parts.map((part, index) => (index === 0 ? part : `${part[0] || ''}.`)).join(' ');
}

async function hmacSha256Hex(secret, value) {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(value));
  return bytesToHex(new Uint8Array(signature));
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const normalized = String(hex || '').trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(normalized) || normalized.length % 2 !== 0) {
    throw new Error('Invalid hex value.');
  }
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = Number.parseInt(normalized.slice(i, i + 2), 16);
  }
  return bytes;
}

function sanitizeSingleLine(value, maxLength) {
  return String(value || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return false;
  if (date.toISOString().slice(0, 10) !== value) return false;
  return date.getTime() < Date.now();
}

async function handleRiscEvents(request, env, origin) {
  if (request.method !== 'POST') {
    throw httpError(405, 'Cross-Account Protection receiver requires POST.');
  }

  const token = await readSecurityEventToken(request);
  const event = await validateSecurityEventToken(token, env);
  await handleSecurityEvent(event, env);
  return json({ ok: true, received: true }, 202, origin);
}

async function handleCatalogueRequest(request, env, path, origin) {
  const segments = path.split('/');
  if (segments[2] !== 'mods') {
    return json({ ok: false, message: 'Catalogue route not found.' }, 404, origin);
  }
  const mode = 'mods';

  if (request.method === 'GET') {
    const list = await readCatalogue(env, mode);
    return json(list, 200, origin);
  }

  if (request.method === 'POST') {
    let admin;
    try {
      admin = await ensureAdmin(request, env);
    } catch (error) {
      const status = Number(error?.status) || 403;
      const message = status === 401
        ? 'Sign in with Google to manage the catalogue.'
        : (error?.message || 'Admin privileges required.');
      return json({ ok: false, message }, status, origin);
    }
    const payload = await request.json().catch(() => null);
    if (!payload || typeof payload !== 'object') {
      throw httpError(400, 'Missing JSON payload.');
    }
    const incoming = payload.item && typeof payload.item === 'object' ? payload.item : payload;
    const saved = await saveCatalogueItem(env, mode, incoming, admin);
    return json(saved, 200, origin);
  }

  if (request.method === 'DELETE') {
    try {
      await ensureAdmin(request, env);
    } catch (error) {
      const status = Number(error?.status) || 403;
      const message = status === 401
        ? 'Sign in with Google to manage the catalogue.'
        : (error?.message || 'Admin privileges required.');
      return json({ ok: false, message }, status, origin);
    }
    const itemId = segments[3];
    if (!itemId) {
      throw httpError(400, 'Missing item id.');
    }
    await deleteCatalogueItem(env, mode, itemId);
    return json({ success: true }, 200, origin);
  }

  return json({ ok: false, message: 'Method not allowed.' }, 405, origin);
}

async function handleUploadRequest(request, env, path, origin) {
  if (request.method !== 'POST') {
    throw httpError(405, 'Upload endpoint only supports POST.');
  }

  let user;
  try {
    user = await ensureAuthenticated(request, env);
  } catch (error) {
    const status = Number(error?.status) || 401;
    const message = error?.message || 'Sign in with Google to upload.';
    return json({ ok: false, message }, status, origin);
  }

  const type = path.split('/')[2];
  const target = UPLOAD_TARGETS[type];
  if (!target) {
    throw httpError(404, 'Unknown upload type.');
  }

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File) || !file.name) {
    throw httpError(400, 'No file uploaded.');
  }

  if (!hasAllowedExtension(file.name, target.allowedExtensions)) {
    throw httpError(400, target.invalidMessage);
  }

  const metadata = parseMetadata(form.get('metadata'));
  const folderId = requireEnv(env, target.folderEnv);

  let fileInfo;
  try {
    fileInfo = await uploadFileToDrive(env, folderId, file, target.makePublic !== false);
  } catch (error) {
    console.error('Upload failed for type', type, error);
    const status = Number(error?.status) || 500;
    const rawMessage = error?.message || 'Upload failed.';
    // Detect Drive quota errors and surface a clear diagnostic message.
    const isQuotaError = rawMessage.includes('storageQuotaExceeded') || rawMessage.toLowerCase().includes('storage quota');
    const message = isQuotaError
      ? 'Google Drive upload failed because the backend is using a service account with no storage quota. Configure Drive OAuth refresh-token storage.'
      : rawMessage;
    return json({ ok: false, message }, status, origin);
  }

  if (metadata?.replaceFileId) {
    await deleteDriveFile(env, metadata.replaceFileId).catch(() => {});
  }

  if (type === 'readme') {
    const maxPreview = 128 * 1024;
    const content = await file.text();
    fileInfo.content = content.slice(0, maxPreview);
    fileInfo.format = file.name.toLowerCase().endsWith('.txt') ? 'text' : 'markdown';
  }

  return json({ ...fileInfo, uploadedBy: sanitizeUserForResponse(user) }, 200, origin);
}

function parseModxExecutableMetadata(input) {
  const name = String(input?.name || '').trim();
  const size = Number(input?.size);
  const sha256 = String(input?.sha256 || '').trim().toLowerCase();
  if (!name || name.length > 260 || name === '.' || name === '..' || /[\\/\u0000-\u001f]/.test(name) || !name.toLowerCase().endsWith('.exe')) {
    throw httpError(400, 'Choose a valid Windows game .exe file.');
  }
  if (!Number.isSafeInteger(size) || size <= 0) throw httpError(400, 'The game executable size is invalid.');
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw httpError(400, 'The game executable verification data is invalid.');
  return { name, size, sha256 };
}

function parseModxMaintenanceMode(value) {
  const maintenanceMode = String(value || '').trim().toLowerCase();
  if (maintenanceMode !== 'author' && maintenanceMode !== 'community') {
    throw httpError(400, 'Choose how future table updates should be handled.');
  }
  return maintenanceMode;
}

function parseGithubReleaseUrl(value) {
  const raw = String(value || '').trim();
  if (!raw || raw.length > 2048) throw httpError(400, 'Enter the full URL to a public GitHub Release.');
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw httpError(400, 'Enter the full URL to a public GitHub Release.');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hostname.toLowerCase() !== 'github.com') {
    throw httpError(400, 'The release must be an https://github.com link.');
  }
  if (url.search || url.hash) throw httpError(400, 'Remove query parameters and fragments from the GitHub Release URL.');
  const parts = url.pathname.split('/').filter(Boolean).map((part) => {
    try { return decodeURIComponent(part); } catch { throw httpError(400, 'The GitHub Release URL contains invalid characters.'); }
  });
  const [owner, repositoryPart, releases, tagRoute, ...tagParts] = parts;
  const repository = String(repositoryPart || '').replace(/\.git$/i, '');
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(owner || '') || /--/.test(owner)) {
    throw httpError(400, 'The GitHub owner in this link is invalid.');
  }
  if (!repository || repository.length > 100 || !/^[A-Za-z0-9._-]+$/.test(repository) || repository === '.' || repository === '..') {
    throw httpError(400, 'The GitHub repository in this link is invalid.');
  }
  const tag = tagParts.join('/').trim();
  if (parts.length < 5 || releases !== 'releases' || tagRoute !== 'tag' || !tag || /[\u0000-\u001f\u007f]/.test(tag)) {
    throw httpError(400, 'Use the full GitHub Release URL in /OWNER/REPOSITORY/releases/tag/VERSION format.');
  }
  const repositoryUrl = `https://github.com/${owner}/${repository}`;
  const releaseUrl = `${repositoryUrl}/releases/tag/${tag.split('/').map(encodeURIComponent).join('/')}`;
  return {
    provider: 'github',
    url: releaseUrl,
    releaseUrl,
    repositoryUrl,
    owner,
    repository,
    tag,
    version: tag,
  };
}

async function readModxJson(request) {
  const contentType = String(request.headers.get('content-type') || '').toLowerCase();
  if (!contentType.startsWith('application/json')) {
    throw httpError(415, 'ModX catalogue requests must use JSON; file uploads are not accepted.');
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw httpError(400, 'The request body is invalid.');
  return body;
}

async function handleModxSubmission(request, env, origin) {
  if (request.method !== 'POST') {
    throw httpError(405, 'ModX submissions require POST.');
  }
  const user = await ensureAuthenticated(request, env, 'Sign in with Google to submit a ModX cheat table.');
  const bridgeToken = requireEnv(env, 'MODX_BRIDGE_TOKEN');
  const body = await readModxJson(request);
  if (body.offlineOnlyConfirmed !== true) {
    throw httpError(400, 'Confirm that this table is for offline or single-player use only.');
  }
  const executable = parseModxExecutableMetadata(body.gameExecutable);
  const source = parseGithubReleaseUrl(body.githubUrl);
  const maintenanceMode = parseModxMaintenanceMode(body.maintenanceMode);
  const reviewId = parseModxReviewId(body.reviewId);
  const contributorName = String(user.name || user.email || 'Community').slice(0, 100);
  const outbound = {
    schemaVersion: 3,
    gameExecutable: executable.name,
    gameFingerprint: executable.sha256,
    gameExecutableSize: executable.size,
    author: { name: contributorName },
    source,
    releaseAssetId: body.releaseAssetId == null ? null : String(body.releaseAssetId),
    maintenanceMode,
    reviewId,
    originalAuthorName: contributorName,
    offlineOnlyConfirmed: true,
    uploaderAbuseKey: await buildModxAbuseKey(user, env),
  };

  const response = await fetch('https://modx.vortex-prime-emu.com/community/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-ModX-Bridge': bridgeToken },
    body: JSON.stringify(outbound),
  });
  const payload = await response.json().catch(() => ({ error: 'The ModX backend returned an invalid response.' }));
  if (!response.ok) throw httpError(response.status, payload.error || payload.message || 'ModX submission failed.');
  return json({ ok: true, ...payload }, 201, origin);
}

async function handleModxReviewCreation(request, env, origin) {
  if (request.method !== 'POST') throw httpError(405, 'ModX submission verification requires POST.');
  const user = await ensureAuthenticated(request, env, 'Sign in with Google to verify a ModX submission.');
  const body = await readModxJson(request);
  const executable = parseModxExecutableMetadata(body.gameExecutable);
  const source = parseGithubReleaseUrl(body.githubUrl);
  const maintenanceMode = parseModxMaintenanceMode(body.maintenanceMode);
  const response = await fetch('https://modx.vortex-prime-emu.com/community/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-ModX-Bridge': requireEnv(env, 'MODX_BRIDGE_TOKEN') },
    body: JSON.stringify({
      gameExecutable: executable.name,
      gameFingerprint: executable.sha256,
      gameExecutableSize: executable.size,
      source,
      releaseAssetId: body.releaseAssetId == null ? null : String(body.releaseAssetId),
      maintenanceMode,
      uploaderAbuseKey: await buildModxAbuseKey(user, env),
    }),
  });
  const payload = await response.json().catch(() => ({ error: 'The ModX verification service returned an invalid response.' }));
  if (!response.ok) throw httpError(response.status, payload.error || payload.message || 'Submission verification could not be started.');
  return json({ ok: true, ...payload }, 202, origin);
}

async function handleModxReviewStatus(request, env, path, origin) {
  if (request.method !== 'GET') throw httpError(405, 'ModX submission verification status requires GET.');
  const user = await ensureAuthenticated(request, env, 'Sign in with Google to view a ModX submission review.');
  const reviewId = parseModxReviewId(path.split('/')[3]);
  const response = await fetch(`https://modx.vortex-prime-emu.com/community/reviews/${encodeURIComponent(reviewId)}`, {
    headers: {
      Accept: 'application/json',
      'X-ModX-Bridge': requireEnv(env, 'MODX_BRIDGE_TOKEN'),
      'X-ModX-Uploader-Key': await buildModxAbuseKey(user, env),
    },
  });
  const payload = await response.json().catch(() => ({ error: 'The ModX verification service returned an invalid response.' }));
  if (!response.ok) throw httpError(response.status, payload.error || payload.message || 'Submission verification status could not be loaded.');
  return json({ ok: true, ...payload }, 200, origin);
}

function parseModxReviewId(value) {
  const reviewId = String(value || '').trim();
  if (!/^[a-f0-9-]{20,80}$/i.test(reviewId)) throw httpError(400, 'Complete Mod X Submission Verification before publishing.');
  return reviewId;
}

async function handleModxReleaseResolution(request, env, origin) {
  if (request.method !== 'POST') throw httpError(405, 'GitHub Release verification requires POST.');
  await ensureAuthenticated(request, env, 'Sign in with Google to verify a ModX GitHub Release.');
  const body = await readModxJson(request);
  const source = parseGithubReleaseUrl(body.githubUrl);
  const response = await fetch('https://modx.vortex-prime-emu.com/community/resolve-release', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-ModX-Bridge': requireEnv(env, 'MODX_BRIDGE_TOKEN') },
    body: JSON.stringify({ source, releaseAssetId: body.releaseAssetId == null ? null : String(body.releaseAssetId) }),
  });
  const payload = await response.json().catch(() => ({ error: 'The ModX backend returned an invalid response.' }));
  if (!response.ok) throw httpError(response.status, payload.error || payload.message || 'The GitHub Release could not be verified.');
  return json({ ok: true, ...payload }, 200, origin);
}

async function handleModxMyTables(request, env, origin) {
  if (request.method !== 'GET') throw httpError(405, 'ModX table management requires GET.');
  const user = await ensureAuthenticated(request, env, 'Sign in to manage your ModX tables.');
  const response = await fetch('https://modx.vortex-prime-emu.com/community/my-tables', {
    headers: {
      Accept: 'application/json',
      'X-ModX-Bridge': requireEnv(env, 'MODX_BRIDGE_TOKEN'),
      'X-ModX-Uploader-Key': await buildModxAbuseKey(user, env),
    },
  });
  const payload = await response.json().catch(() => ({ error: 'The ModX backend returned an invalid response.' }));
  if (!response.ok) throw httpError(response.status, payload.error || payload.message || 'Your ModX tables could not be loaded.');
  return json({ ok: true, schemaVersion: 3,
    tables: Array.isArray(payload.tables) ? payload.tables.map(normalizeModxTableRecord) : [] }, 200, origin);
}

async function handleModxTableRefresh(request, env, path, origin) {
  if (request.method !== 'POST') throw httpError(405, 'ModX table refresh requires POST.');
  const user = await ensureAuthenticated(request, env, 'Sign in to update your ModX tables.');
  const tableId = parseModxTableId(path);
  const response = await fetch(`https://modx.vortex-prime-emu.com/community/tables/${encodeURIComponent(tableId)}/refresh`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'X-ModX-Bridge': requireEnv(env, 'MODX_BRIDGE_TOKEN'),
      'X-ModX-Uploader-Key': await buildModxAbuseKey(user, env),
    },
  });
  const payload = await response.json().catch(() => ({ error: 'The ModX backend returned an invalid response.' }));
  if (!response.ok) throw httpError(response.status, payload.error || payload.message || 'The GitHub Release could not be refreshed.');
  return json({ ok: true, ...payload }, 200, origin);
}

function parseModxTableId(path) {
  const tableId = decodeURIComponent(path.split('/')[3] || '').trim();
  if (!/^[a-z0-9-]{20,80}$/i.test(tableId)) throw httpError(400, 'Select a valid table.');
  return tableId;
}

async function handlePublicModxTables(request, origin) {
  if (request.method !== 'GET') throw httpError(405, 'ModX catalogue queries require GET.');
  const requestUrl = new URL(request.url);
  const executable = String(requestUrl.searchParams.get('executable') || '').trim();
  if (!executable || executable.length > 260 || executable === '.' || executable === '..' || /[\\/\u0000-\u001f]/.test(executable) || !executable.toLowerCase().endsWith('.exe')) {
    throw httpError(400, 'Enter a valid game executable name, such as Game.exe.');
  }
  const upstreamUrl = new URL('https://modx.vortex-prime-emu.com/tables');
  upstreamUrl.searchParams.set('executable', executable);
  upstreamUrl.searchParams.set('platform', 'windows');
  const response = await fetch(upstreamUrl, { headers: { Accept: 'application/json' } });
  const payload = await response.json().catch(() => ({ error: 'The ModX catalogue returned an invalid response.' }));
  if (!response.ok) throw httpError(response.status, payload.error || payload.message || 'The ModX catalogue could not be loaded.');
  return json({ ok: true, schemaVersion: 3,
    tables: Array.isArray(payload.tables) ? payload.tables.map(normalizeModxTableRecord) : [] }, 200, origin);
}

function normalizeModxTableRecord(table) {
  const value = table && typeof table === 'object' ? table : {};
  const legacyExecutable = value.executables && typeof value.executables === 'object'
    ? Object.values(value.executables).find(Boolean)
    : '';
  const gameExecutable = sanitizeSingleLine(value.gameExecutable || legacyExecutable, 260);
  const authorName = sanitizeSingleLine(value.author?.name || value.contributorName || value.originalAuthorName, 100) || 'Community';
  const maintenanceMode = value.maintenanceMode === 'community' || value.maintenancePolicy === 'community' ? 'community' : 'author';
  const sourceCandidate = value.github?.releaseUrl || value.source?.releaseUrl || value.source?.url || value.releaseUrl;
  const originalCandidate = value.originalSource?.releaseUrl || value.originalSource?.url || value.originalSourceUrl || sourceCandidate;
  let source = null;
  let originalSource = null;
  try { if (sourceCandidate) source = parseGithubReleaseUrl(sourceCandidate); } catch {}
  try { if (originalCandidate) originalSource = parseGithubReleaseUrl(originalCandidate); } catch {}
  const release = value.release && typeof value.release === 'object' ? value.release : null;
  const asset = release?.asset && typeof release.asset === 'object' ? {
    id: String(release.asset.id || ''), name: sanitizeSingleLine(release.asset.name, 180),
    downloadUrl: String(release.asset.downloadUrl || ''), digest: sanitizeSingleLine(release.asset.digest, 160) || null,
  } : null;
  return {
    id: String(value.id || ''),
    gameId: value.gameId == null ? null : String(value.gameId),
    gameTitle: sanitizeSingleLine(value.gameTitle, 160) || gameExecutable.replace(/\.exe$/i, '') || 'Community table',
    gameExecutable,
    gameFingerprint: /^[a-f0-9]{64}$/i.test(String(value.gameFingerprint || value.gameExecutableSha256 || ''))
      ? String(value.gameFingerprint || value.gameExecutableSha256).toLowerCase()
      : null,
    author: { id: value.author?.id == null ? null : String(value.author.id), name: authorName },
    originalAuthor: {
      id: value.originalAuthor?.id == null ? (value.originalAuthorId == null ? null : String(value.originalAuthorId)) : String(value.originalAuthor.id),
      name: sanitizeSingleLine(value.originalAuthor?.name || value.originalAuthorName || authorName, 100) || authorName,
    },
    github: source ? { repositoryUrl: source.repositoryUrl, releaseUrl: source.releaseUrl,
      owner: source.owner, repository: source.repository, tag: source.tag } : null,
    version: sanitizeSingleLine(value.version || source?.tag, 200) || null,
    release: source ? { tag: sanitizeSingleLine(release?.tag || source.tag, 200),
      releaseId: release?.releaseId == null ? null : String(release.releaseId),
      commitSha: /^[a-f0-9]{40,64}$/i.test(String(release?.commitSha || '')) ? String(release.commitSha).toLowerCase() : null,
      publishedAt: release?.publishedAt || null, checkedAt: release?.checkedAt || null, asset } : null,
    source,
    originalSource,
    maintenanceMode,
    sourceStatus: source ? (value.sourceStatus === 'unavailable' ? 'unavailable' : 'available') : 'unavailable',
    createdAt: value.createdAt || null,
    updatedAt: value.updatedAt || value.createdAt || null,
  };
}

async function handleModxTableReport(request, env, path, origin) {
  if (request.method !== 'POST') throw httpError(405, 'ModX table reports require POST.');
  const user = await ensureAuthenticated(request, env, 'Sign in with Google to report a ModX table.');
  const tableId = parseModxTableId(path);
  const body = await readModxJson(request);
  const allowedReasons = new Set([
    'online_or_multiplayer_cheating',
    'malware_or_unsafe_code',
    'stolen_or_misleading',
    'other',
  ]);
  if (!allowedReasons.has(body.reason)) throw httpError(400, 'Select a valid report reason.');
  const bridgeToken = requireEnv(env, 'MODX_BRIDGE_TOKEN');
  const response = await fetch(`https://modx.vortex-prime-emu.com/community/tables/${encodeURIComponent(tableId)}/report`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-ModX-Bridge': bridgeToken,
    },
    body: JSON.stringify({
      reason: body.reason,
      details: sanitizeSingleLine(body.details, 1000),
      reporterAbuseKey: await buildModxAbuseKey(user, env),
    }),
  });
  const payload = await response.json().catch(() => ({ error: 'The ModX backend returned an invalid response.' }));
  if (!response.ok) throw httpError(response.status, payload.error || payload.message || 'ModX report failed.');
  return json({ ok: true, ...payload }, 201, origin);
}

async function buildModxAbuseKey(user, env) {
  const stableUserId = String(user?.sub || user?.firebaseUid || '').trim();
  if (!stableUserId) throw httpError(401, 'Your account identity could not be verified.');
  return hmacSha256Hex(requireEnv(env, 'SESSION_SECRET'), `modx-abuse:${stableUserId}`);
}

function buildFolderSummary(env) {
  return {
    packages: buildFolderLink(env.DRIVE_PACKAGES_FOLDER_ID),
    mods: buildFolderLink(env.DRIVE_MODS_FOLDER_ID),
    icons: buildFolderLink(env.DRIVE_ICONS_FOLDER_ID),
    previews: buildFolderLink(env.DRIVE_PREVIEWS_FOLDER_ID),
    readmes: buildFolderLink(env.DRIVE_READMES_FOLDER_ID),
  };
}

function buildFolderLink(folderId) {
  const trimmed = String(folderId || '').trim();
  if (!trimmed) return null;
  return `https://drive.google.com/drive/folders/${trimmed}`;
}

function buildFileLink(fileId) {
  const trimmed = String(fileId || '').trim();
  if (!trimmed) return null;
  return `https://drive.google.com/file/d/${trimmed}/view`;
}

async function assertDriveAccess(env) {
  const fileId = requireEnv(env, 'DRIVE_DATABASE_FILE_ID');
  const response = await driveRequest(env, `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name`, { method: 'GET' });
  if (response.status === 404) {
    throw httpError(500, 'Google Drive database file not found.');
  }
  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw httpError(response.status, `Google Drive access failed: ${text}`);
  }
  await response.json();
}

async function loadDatabase(env) {
  const snapshot = await loadDatabaseSnapshot(env);
  return snapshot.db;
}

async function loadDatabaseSnapshot(env) {
  const fileId = requireEnv(env, 'DRIVE_DATABASE_FILE_ID');
  const response = await driveRequest(env, `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, { method: 'GET' });
  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw httpError(response.status, `Failed to load catalogue: ${text}`);
  }
  let json = null;
  try {
    json = await response.json();
  } catch (error) {
    json = null;
  }
  const etag = response.headers.get('etag') || response.headers.get('ETag') || null;
  if (!json || typeof json !== 'object') {
    return { db: { ...DEFAULT_DB }, etag };
  }
  return { db: { ...DEFAULT_DB, ...json }, etag };
}

async function persistDatabase(env, data, options = {}) {
  const fileId = requireEnv(env, 'DRIVE_DATABASE_FILE_ID');
  const body = JSON.stringify({ ...DEFAULT_DB, ...data }, null, 2);
  const headers = {
    'Content-Type': 'application/json; charset=UTF-8',
  };
  if (options.ifMatch) {
    headers['If-Match'] = options.ifMatch;
  }
  const response = await driveRequest(
    env,
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&supportsAllDrives=true`,
    {
      method: 'PATCH',
      headers,
      body,
    },
  );
  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw httpError(response.status, `Failed to save catalogue: ${text}`);
  }
  return JSON.parse(body);
}

async function readCatalogue(env, mode) {
  const db = await loadDatabase(env);
  const listName = 'storeMods';
  const list = Array.isArray(db[listName]) ? db[listName] : [];
  return list.map((entry) => sanitizeItem(entry));
}

async function saveCatalogueItem(env, mode, incoming, actor) {
  const db = await loadDatabase(env);
  const listName = 'storeMods';
  const list = Array.isArray(db[listName]) ? [...db[listName]] : [];

  let item = assignItemId(incoming);
  const index = list.findIndex((entry) => entry.id === item.id);
  const existing = index >= 0 ? list[index] : null;
  item = timestampItem(item, existing);
  item = annotateItemWithActor(item, actor, existing);
  item = sanitizeItem(item);

  if (index >= 0) {
    list[index] = item;
  } else {
    list.push(item);
  }

  const nextDb = { ...db, [listName]: list };
  await persistDatabase(env, nextDb);
  return item;
}

async function deleteCatalogueItem(env, mode, itemId) {
  const db = await loadDatabase(env);
  const listName = 'storeMods';
  const list = Array.isArray(db[listName]) ? [...db[listName]] : [];
  const index = list.findIndex((entry) => entry.id === itemId);
  if (index === -1) {
    throw httpError(404, 'Item not found.');
  }

  const [removed] = list.splice(index, 1);
  const nextDb = { ...db, [listName]: list };
  await persistDatabase(env, nextDb);

  if (removed?.driveFiles && typeof removed.driveFiles === 'object') {
    const values = Object.values(removed.driveFiles).filter(Boolean);
    await Promise.all(values.map(async (info) => {
      if (info?.id) {
        await deleteDriveFile(env, info.id).catch(() => {});
      }
    }));
  }
}

async function uploadFileToDrive(env, folderId, file, makePublic = true) {
  const metadata = {
    name: file.name,
    parents: [folderId],
  };
  const boundary = `vortex-${crypto.randomUUID()}`;
  const mimeType = file.type || 'application/octet-stream';
  const preamble = textEncoder.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`);
  const closing = textEncoder.encode(`\r\n--${boundary}--\r\n`);

  const bodyStream = new ReadableStream({
    async start(controller) {
      controller.enqueue(preamble);
      const reader = file.stream().getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
        controller.enqueue(closing);
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
  });

  const response = await driveRequest(
    env,
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,size,webViewLink,webContentLink',
    {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: bodyStream,
    },
  );

  const json = await response.json().catch(() => null);
  if (!response.ok || !json) {
    const text = json ? JSON.stringify(json) : await response.text().catch(() => response.statusText);
    throw httpError(response.status, `Google Drive upload failed: ${text}`);
  }

  if (makePublic) {
    await ensureAnyoneCanRead(env, json.id);
  }

  return formatDriveFileResponse(json);
}

async function ensureAnyoneCanRead(env, fileId) {
  const response = await driveRequest(
    env,
    `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?supportsAllDrives=true`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    },
  );

  if (response.ok) return;

  const errorJson = await response.json().catch(() => null);
  const reason = errorJson?.error?.errors?.[0]?.reason;
  if (reason === 'alreadyExists') {
    return;
  }
  const text = errorJson ? JSON.stringify(errorJson) : await response.text().catch(() => response.statusText);
  throw httpError(response.status, `Failed to set public permission: ${text}`);
}

async function deleteDriveFile(env, fileId) {
  const response = await driveRequest(env, `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`, {
    method: 'DELETE',
  });
  if (response.status === 404) return;
  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw httpError(response.status, `Failed to delete Drive file: ${text}`);
  }
}

function formatDriveFileResponse(file) {
  const id = file.id;
  const downloadUrl = buildDownloadUrl(id);
  const webViewLink = file.webViewLink || buildFileLink(id);
  const webContentLink = file.webContentLink || downloadUrl;
  return {
    id,
    name: file.name,
    mimeType: file.mimeType,
    size: file.size ? Number(file.size) : undefined,
    downloadUrl,
    webViewLink,
    webContentLink,
  };
}

function buildDownloadUrl(fileId) {
  return `https://drive.google.com/uc?id=${fileId}&export=download`;
}

function sanitizeItem(raw) {
  const item = { ...(raw || {}) };
  item.id = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : crypto.randomUUID();
  item.name = item.name || '';
  item.description = item.description || '';
  // Original Creator / Author of the package (e.g. "Cyb1k") — never overwritten
  // by the uploader's account name.
  item.creator = item.creator || item.author || '';
  // "Uploaded By" is the editable display label for who uploaded the mod.
  item.uploadedBy = (item.uploadedBy || item.uploader || item.owner || '').toString().trim();
  item.tags = Array.isArray(item.tags) ? item.tags.filter(Boolean) : [];
  item.platform = item.platform || 'PS4';
  item.updated = item.updated || new Date().toISOString();
  item.type = 'mods';
  if (!item.driveFiles || typeof item.driveFiles !== 'object') {
    item.driveFiles = {};
  }
  if (item.download_url) {
    item.download = {
      enabled: true,
      url: item.download_url,
      type: item.fileType || (item.type === 'mods' ? 'archive' : 'pkg'),
    };
  }
  return item;
}

function assignItemId(item) {
  if (item?.id) return { ...item };
  return { ...item, id: crypto.randomUUID() };
}

function timestampItem(item, existing) {
  const now = new Date().toISOString();
  const next = { ...item, updated: now };
  next.created_at = existing?.created_at || next.created_at || now;
  next.uploaded_at = existing?.uploaded_at || next.uploaded_at || now;
  return next;
}

function annotateItemWithActor(item, actor, existing) {
  if (!actor) return item;
  const sanitized = sanitizeUserForResponse(actor);
  if (!sanitized) return item;
  const next = {
    ...item,
    lastModifiedBy: sanitized,
  };
  // Ownership account is set once when the item is first created and is then
  // preserved across edits. This is the signed-in account that owns the upload
  // for permission checks — kept separate from the editable "Uploaded By" label.
  next.uploaderAccount = existing?.uploaderAccount || item.uploaderAccount || sanitized;
  return next;
}

function hasAllowedExtension(fileName, allowed) {
  const lower = fileName.toLowerCase();
  return allowed.some((ext) => lower.endsWith(ext));
}

function parseMetadata(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function requireEnv(env, name) {
  const value = String(env[name] || '').trim();
  if (!value) {
    throw httpError(500, `Worker secret ${name} is not set.`);
  }
  return value;
}

async function importNxeControlTokenKey(env) {
  const secret = requireEnv(env, 'SESSION_SECRET');
  if (nxeControlTokenKeyCache?.secret === secret) return nxeControlTokenKeyCache.key;
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(`nxe-control-token:${secret}`));
  const key = await crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  nxeControlTokenKeyCache = { secret, key };
  return key;
}

async function encryptNxeControlToken(controlToken, pairId, env) {
  const key = await importNxeControlTokenKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: textEncoder.encode(`nxe-pair:${pairId}`) },
    key,
    textEncoder.encode(controlToken),
  );
  return `${base64UrlEncode(iv)}.${base64UrlEncode(new Uint8Array(ciphertext))}`;
}

async function decryptNxeControlToken(encryptedToken, pairId, env) {
  const [ivPart, ciphertextPart] = String(encryptedToken || '').split('.');
  if (!ivPart || !ciphertextPart) throw httpError(409, 'Saved NXE credentials are incomplete. Restart NXE and try again.');
  try {
    const key = await importNxeControlTokenKey(env);
    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: base64UrlDecode(ivPart),
        additionalData: textEncoder.encode(`nxe-pair:${pairId}`),
      },
      key,
      base64UrlDecode(ciphertextPart),
    );
    return textDecoder.decode(plaintext);
  } catch (error) {
    throw httpError(409, 'Saved NXE credentials could not be restored. Restart NXE and save the console again.');
  }
}

async function sha256Base64Url(value) {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(String(value)));
  return base64UrlEncode(new Uint8Array(digest));
}

function normalizeScopeForResponse(scope) {
  if (Array.isArray(scope)) return scope.join(' ');
  return String(scope || '').trim();
}

function sanitizeUserForResponse(user) {
  if (!user || typeof user !== 'object') return null;
  const { email, name, username, picture, role } = user;
  const trimmedEmail = typeof email === 'string' ? email.trim() : null;
  if (!trimmedEmail) return null;
  return {
    email: trimmedEmail,
    name: typeof name === 'string' ? name.trim() : null,
    username: typeof username === 'string' ? username.trim() : null,
    picture: typeof picture === 'string' ? picture.trim() : null,
    role: role || 'uploader',
  };
}

function buildAuthSummary(env, sessionUser) {
  return {
    googleClientId: String(env.GOOGLE_OAUTH_CLIENT_ID || '').trim() || null,
    firebase: buildFirebaseWebConfig(env),
    adminEmails: getAdminEmails(env),
    user: sanitizeUserForResponse(sessionUser),
  };
}

function buildFirebaseWebConfig(env) {
  const projectId = String(env.FIREBASE_PROJECT_ID || '').trim();
  const apiKey = String(env.FIREBASE_API_KEY || '').trim();
  const appId = String(env.FIREBASE_APP_ID || '').trim();
  if (!projectId || !apiKey || !appId) return null;
  return {
    apiKey,
    authDomain: String(env.FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`).trim(),
    projectId,
    appId,
    messagingSenderId: String(env.FIREBASE_MESSAGING_SENDER_ID || '').trim() || undefined,
    storageBucket: String(env.FIREBASE_STORAGE_BUCKET || '').trim() || undefined,
  };
}

async function ensureAuthenticated(request, env, message = 'Sign in with Google to upload.') {
  const session = await readSession(request, env).catch(() => null);
  if (session) return session;
  const authorization = request.headers.get('Authorization') || '';
  if (authorization.startsWith('Bearer ')) {
    const profile = await validateFirebaseIdToken(authorization.slice(7).trim(), env);
    return {
      sub: profile.sub,
      firebaseUid: profile.uid,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
      role: isAdminEmail(profile.email, env) ? 'admin' : 'uploader',
    };
  }
  throw httpError(401, message);
}

async function ensureAdmin(request, env) {
  const session = await ensureAuthenticated(request, env);
  if (session.role !== 'admin') {
    throw httpError(403, 'Admin privileges required.');
  }
  return session;
}

function parseCookies(header) {
  if (!header) return {};
  return header.split(';').reduce((acc, part) => {
    const [key, ...rest] = part.split('=');
    if (!key) return acc;
    const name = key.trim();
    const value = rest.join('=').trim();
    if (name) acc[name] = value;
    return acc;
  }, {});
}

async function readSession(request, env) {
  const header = request.headers.get('Cookie');
  if (!header) return null;
  const cookies = parseCookies(header);
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) return null;
  const session = await verifySessionToken(token, env);
  if (env.RISC_EVENTS_KV && session?.sub) {
    const revoked = await env.RISC_EVENTS_KV.get(`revoked-sub:${session.sub}`);
    if (revoked) {
      throw httpError(401, 'Session revoked by Google security event.');
    }
  }
  return session;
}

function buildSessionCookie(value, options = {}) {
  const parts = [`${SESSION_COOKIE_NAME}=${value || ''}`];
  const maxAge = options.maxAge ?? SESSION_TTL_SECONDS;
  parts.push(`Path=/`);
  parts.push(`HttpOnly`);
  parts.push(`Secure`);
  parts.push(`SameSite=Lax`);
  parts.push(`Max-Age=${maxAge}`);
  const expires = options.expires instanceof Date
    ? options.expires
    : (maxAge > 0 ? new Date(Date.now() + maxAge * 1000) : new Date(0));
  parts.push(`Expires=${expires.toUTCString()}`);
  return parts.join('; ');
}

async function importSessionKey(env) {
  if (sessionKeyCache) return sessionKeyCache;
  const secret = requireEnv(env, 'SESSION_SECRET');
  const data = textEncoder.encode(secret);
  sessionKeyCache = await crypto.subtle.importKey(
    'raw',
    data,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return sessionKeyCache;
}

async function createSessionToken(payload, env) {
  const key = await importSessionKey(env);
  const trimmed = sanitizeUserForResponse(payload);
  const toEncode = { ...payload, role: trimmed?.role || payload.role || 'uploader' };
  const json = JSON.stringify(toEncode);
  const base = base64UrlEncode(json);
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, textEncoder.encode(base));
  const signature = base64UrlEncode(new Uint8Array(signatureBuffer));
  return `${base}.${signature}`;
}

async function verifySessionToken(token, env) {
  const [payloadPart, signaturePart] = token.split('.');
  if (!payloadPart || !signaturePart) {
    throw httpError(401, 'Invalid session.');
  }
  const key = await importSessionKey(env);
  const expectedSignatureBuffer = await crypto.subtle.sign('HMAC', key, textEncoder.encode(payloadPart));
  const expectedSignature = new Uint8Array(expectedSignatureBuffer);
  const providedSignature = base64UrlDecode(signaturePart);
  if (!constantTimeEquals(expectedSignature, providedSignature)) {
    throw httpError(401, 'Invalid signature.');
  }
  const payloadJson = textDecoder.decode(base64UrlDecode(payloadPart));
  const payload = JSON.parse(payloadJson);
  if (!payload?.exp || Math.floor(Date.now() / 1000) >= Number(payload.exp)) {
    throw httpError(401, 'Session expired.');
  }
  return payload;
}

function constantTimeEquals(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a[i] ^ b[i];
  }
  return mismatch === 0;
}

function getAdminEmails(env) {
  const raw = String(env.GOOGLE_ADMIN_EMAILS || '').trim();
  if (!raw) {
    adminEmailCache = {
      raw: '',
      list: [],
      exact: new Set(),
      domains: new Set(),
    };
    return adminEmailCache.list;
  }
  if (adminEmailCache?.raw === raw) {
    return adminEmailCache.list;
  }
  const parts = raw
    .split(/[,\n]/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const exact = new Set();
  const domains = new Set();
  for (const entry of parts) {
    if (entry.startsWith('*@')) {
      domains.add(entry.slice(2));
    } else if (entry.startsWith('@')) {
      domains.add(entry.slice(1));
    } else {
      exact.add(entry);
    }
  }
  adminEmailCache = {
    raw,
    list: parts,
    exact,
    domains,
  };
  return adminEmailCache.list;
}

function isAdminEmail(email, env) {
  if (!email) return false;
  const lower = String(email).toLowerCase();
  const configRaw = String(env.GOOGLE_ADMIN_EMAILS || '').trim();
  const cache = adminEmailCache && adminEmailCache.raw === configRaw
    ? adminEmailCache
    : (getAdminEmails(env), adminEmailCache);
  if (cache.exact.has(lower)) {
    return true;
  }
  const domain = lower.split('@')[1];
  if (domain && cache.domains.has(domain)) {
    return true;
  }
  return false;
}

async function exchangeGoogleCredentialForFirebase(googleIdToken, env) {
  if (!googleIdToken || typeof googleIdToken !== 'string') return null;
  const apiKey = requireEnv(env, 'FIREBASE_API_KEY');
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      postBody: `id_token=${encodeURIComponent(googleIdToken)}&providerId=google.com`,
      requestUri: 'https://vortex-prime-emu.com',
      returnIdpCredential: true,
      returnSecureToken: true,
    }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.idToken) {
    throw httpError(401, data?.error?.message || 'Firebase rejected the Google credential.');
  }
  return data.idToken;
}

async function validateFirebaseIdToken(idToken, env) {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw httpError(400, 'Invalid Firebase ID token.');
  const [headerPart, payloadPart, signaturePart] = parts;
  let header;
  let payload;
  try {
    header = JSON.parse(textDecoder.decode(base64UrlDecode(headerPart)));
    payload = JSON.parse(textDecoder.decode(base64UrlDecode(payloadPart)));
  } catch {
    throw httpError(400, 'Malformed Firebase ID token.');
  }

  const projectId = requireEnv(env, 'FIREBASE_PROJECT_ID');
  const now = Math.floor(Date.now() / 1000);
  if (header.alg !== 'RS256' || !header.kid) throw httpError(401, 'Unsupported Firebase token signature.');
  if (payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw httpError(401, 'Firebase token project mismatch.');
  }
  if (!payload.sub || typeof payload.sub !== 'string') throw httpError(401, 'Firebase token is missing a UID.');
  if (Number(payload.exp) <= now || Number(payload.iat) > now || Number(payload.auth_time) > now) {
    throw httpError(401, 'Firebase ID token is expired or not yet valid.');
  }
  if (!payload.email || payload.email_verified !== true) {
    throw httpError(401, 'Firebase account email must be verified.');
  }
  const firebaseProvider = payload.firebase?.sign_in_provider;
  if (firebaseProvider !== 'google.com') throw httpError(401, 'Google Sign-In is required.');

  const publicKey = await getGooglePublicKeyFromJwks(
    header.kid,
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
  );
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    publicKey,
    base64UrlDecode(signaturePart),
    textEncoder.encode(`${headerPart}.${payloadPart}`),
  );
  if (!valid) throw httpError(401, 'Failed to verify Firebase ID token.');

  return {
    uid: payload.sub,
    sub: payload.firebase?.identities?.['google.com']?.[0] || payload.sub,
    email: payload.email,
    name: payload.name || null,
    picture: payload.picture || null,
  };
}

async function validateGoogleCredential(credential, env) {
  const parts = credential.split('.');
  if (parts.length !== 3) {
    throw httpError(400, 'Invalid Google credential.');
  }
  const [headerPart, payloadPart, signaturePart] = parts;
  const headerJson = textDecoder.decode(base64UrlDecode(headerPart));
  const payloadJson = textDecoder.decode(base64UrlDecode(payloadPart));
  let header;
  let payload;
  try {
    header = JSON.parse(headerJson);
    payload = JSON.parse(payloadJson);
  } catch (error) {
    throw httpError(400, 'Malformed Google credential.');
  }

  if (!GOOGLE_ISSUERS.has(payload.iss)) {
    throw httpError(401, 'Invalid Google issuer.');
  }

  const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  const clientId = requireEnv(env, 'GOOGLE_OAUTH_CLIENT_ID');
  if (!audience.includes(clientId)) {
    throw httpError(401, 'Google credential audience mismatch.');
  }

  if (!payload.email || payload.email_verified === false) {
    throw httpError(401, 'Google account email must be verified.');
  }

  const now = Math.floor(Date.now() / 1000);
  if (Number(payload.exp) <= now) {
    throw httpError(401, 'Google credential expired.');
  }
  if (payload.nbf && Number(payload.nbf) > now) {
    throw httpError(401, 'Google credential not yet valid.');
  }

  const publicKey = await getGooglePublicKey(header.kid);
  const signedContent = textEncoder.encode(`${headerPart}.${payloadPart}`);
  const signature = base64UrlDecode(signaturePart);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, signature, signedContent);
  if (!valid) {
    throw httpError(401, 'Failed to verify Google credential.');
  }

  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
  };
}

async function readSecurityEventToken(request) {
  const contentType = request.headers.get('content-type') || '';
  const raw = await request.text();
  if (!raw || !raw.trim()) {
    throw httpError(400, 'Missing security event token.');
  }

  if (contentType.includes('application/json')) {
    let body;
    try {
      body = JSON.parse(raw);
    } catch (error) {
      throw httpError(400, 'Malformed security event JSON body.');
    }
    const token = body?.jwt || body?.token || body?.security_event_token;
    if (!token || typeof token !== 'string') {
      throw httpError(400, 'Missing security event token in JSON body.');
    }
    return token.trim();
  }

  return raw.trim();
}

async function validateSecurityEventToken(token, env) {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw httpError(400, 'Malformed security event token.');
  }

  const [headerPart, payloadPart, signaturePart] = parts;
  let header;
  let payload;
  try {
    header = JSON.parse(textDecoder.decode(base64UrlDecode(headerPart)));
    payload = JSON.parse(textDecoder.decode(base64UrlDecode(payloadPart)));
  } catch (error) {
    throw httpError(400, 'Malformed security event token JSON.');
  }

  const riscConfig = await getRiscConfig();
  if (payload.iss !== riscConfig.issuer) {
    throw httpError(400, 'Security event token issuer mismatch.');
  }

  const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  const allowedAudience = getRiscAudiences(env);
  if (!audience.some((value) => allowedAudience.includes(value))) {
    throw httpError(400, 'Security event token audience mismatch.');
  }

  const publicKey = await getGooglePublicKey(header.kid, riscConfig.jwks_uri);
  const signedContent = textEncoder.encode(`${headerPart}.${payloadPart}`);
  const signature = base64UrlDecode(signaturePart);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, signature, signedContent);
  if (!valid) {
    throw httpError(400, 'Security event token signature verification failed.');
  }

  if (!payload.events || typeof payload.events !== 'object') {
    throw httpError(400, 'Security event token has no events claim.');
  }

  return payload;
}

function getRiscAudiences(env) {
  const configured = String(env.RISC_AUDIENCES || '')
    .split(/[,\n]/)
    .map((value) => value.trim())
    .filter(Boolean);
  const defaults = [
    String(env.GOOGLE_OAUTH_CLIENT_ID || '').trim(),
    String(env.GOOGLE_DRIVE_CLIENT_ID || '').trim(),
  ].filter(Boolean);
  return [...new Set([...configured, ...defaults])];
}

async function getRiscConfig() {
  const now = Date.now();
  if (riscConfigCache && riscConfigCache.expiresAt > now) {
    return riscConfigCache.config;
  }

  const response = await fetch('https://accounts.google.com/.well-known/risc-configuration');
  if (!response.ok) {
    throw httpError(response.status, 'Failed to retrieve Google RISC configuration.');
  }
  const config = await response.json();
  if (!config?.issuer || !config?.jwks_uri) {
    throw httpError(500, 'Google RISC configuration is missing required fields.');
  }

  const cacheControl = response.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeSeconds = maxAgeMatch ? Number(maxAgeMatch[1]) : 300;
  riscConfigCache = {
    config,
    expiresAt: now + maxAgeSeconds * 1000,
  };
  return config;
}

async function handleSecurityEvent(event, env) {
  const eventTypes = Object.keys(event.events || {});
  const subjects = eventTypes
    .map((eventType) => event.events[eventType]?.subject)
    .filter(Boolean);

  if (env.RISC_EVENTS_KV) {
    await storeSecurityEvent(event, eventTypes, subjects, env);
  }

  console.log('Received Google Cross-Account Protection event', {
    jti: event.jti,
    aud: event.aud,
    eventTypes,
    subjects: subjects.map((subject) => ({
      subject_type: subject.subject_type,
      iss: subject.iss,
      sub: subject.sub,
    })),
  });
}

async function storeSecurityEvent(event, eventTypes, subjects, env) {
  const now = Math.floor(Date.now() / 1000);
  const ttl = 60 * 60 * 24 * 90;
  if (event.jti) {
    await env.RISC_EVENTS_KV.put(`event:${event.jti}`, JSON.stringify({
      receivedAt: now,
      eventTypes,
      aud: event.aud,
      iat: event.iat,
    }), { expirationTtl: ttl });
  }

  const revocationEvent = eventTypes.some((eventType) => [
    'https://schemas.openid.net/secevent/risc/event-type/sessions-revoked',
    'https://schemas.openid.net/secevent/oauth/event-type/tokens-revoked',
    'https://schemas.openid.net/secevent/risc/event-type/account-disabled',
  ].includes(eventType));
  if (!revocationEvent) return;

  for (const subject of subjects) {
    if (subject?.sub) {
      await env.RISC_EVENTS_KV.put(`revoked-sub:${subject.sub}`, JSON.stringify({
        revokedAt: now,
        eventTypes,
        jti: event.jti || null,
      }), { expirationTtl: ttl });
    }
  }
}

async function getGooglePublicKey(kid) {
  return getGooglePublicKeyFromJwks(kid, 'https://www.googleapis.com/oauth2/v3/certs');
}

async function getGooglePublicKeyFromJwks(kid, jwksUri) {
  if (!kid) {
    throw httpError(401, 'Missing Google key id.');
  }
  const now = Date.now();
  if (!googleCertCache || googleCertCache.uri !== jwksUri || googleCertCache.expiresAt <= now) {
    await refreshGoogleCertCache(jwksUri);
  }
  let key = googleCertCache.keys.get(kid);
  if (!key) {
    await refreshGoogleCertCache(jwksUri);
    key = googleCertCache.keys.get(kid);
  }
  if (!key) {
    throw httpError(401, 'Unable to verify Google credential key.');
  }
  return key;
}

async function refreshGoogleCertCache(jwksUri = 'https://www.googleapis.com/oauth2/v3/certs') {
  const response = await fetch(jwksUri);
  if (!response.ok) {
    throw httpError(response.status, 'Failed to retrieve Google certificates.');
  }
  const data = await response.json();
  if (!data?.keys || !Array.isArray(data.keys)) {
    throw httpError(500, 'Google certificate response malformed.');
  }
  const keys = new Map();
  await Promise.all(data.keys.map(async (jwk) => {
    if (!jwk.kid) return;
    const key = await crypto.subtle.importKey(
      'jwk',
      {
        ...jwk,
        ext: true,
        key_ops: ['verify'],
      },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    keys.set(jwk.kid, key);
  }));
  const cacheControl = response.headers.get('Cache-Control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeSeconds = maxAgeMatch ? Number(maxAgeMatch[1]) : 300;
  googleCertCache = {
    uri: jwksUri,
    keys,
    expiresAt: Date.now() + maxAgeSeconds * 1000,
  };
}

function base64UrlDecode(input) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? 0 : 4 - (normalized.length % 4);
  const padded = normalized + '='.repeat(pad);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function driveRequest() {
  throw httpError(410, 'Google Drive backed website storage has been retired. Public catalogues are served from repository files.');
}

// Obtains a Google Drive access token by exchanging the stored OAuth refresh
// token.  This uses the personal Google account that owns the Drive storage
// quota, not a service account (which has no quota).
async function getAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.expiresAt > now + 60) {
    return tokenCache.token;
  }

  const clientId     = requireEnv(env, 'GOOGLE_DRIVE_CLIENT_ID');
  const clientSecret = requireEnv(env, 'GOOGLE_DRIVE_CLIENT_SECRET');
  const refreshToken = requireEnv(env, 'GOOGLE_DRIVE_REFRESH_TOKEN');

  const body = new URLSearchParams({
    grant_type:    'refresh_token',
    client_id:     clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.access_token) {
    const detail = data?.error_description || data?.error || (data ? JSON.stringify(data) : response.statusText);
    const isInvalidGrant = data?.error === 'invalid_grant' || /expired|revoked/i.test(String(detail));
    if (isInvalidGrant) {
      throw httpError(
        503,
        'Google Drive authorization has expired or been revoked. Generate a new refresh token and update GOOGLE_DRIVE_REFRESH_TOKEN.',
      );
    }
    throw httpError(response.status, `Failed to obtain Google Drive access token: ${detail}`);
  }

  tokenCache = {
    token:     data.access_token,
    expiresAt: now + Number(data.expires_in || 3600),
  };
  return tokenCache.token;
}

function base64UrlEncode(input) {
  if (typeof input === 'string') {
    return base64UrlEncode(new TextEncoder().encode(input));
  }
  let binary = '';
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function handlePublicSubmitVideo(request, env, origin) {
  if (request.method !== 'POST') {
    throw httpError(405, 'Submit video endpoint only supports POST.');
  }

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== 'object') {
    throw httpError(400, 'Missing JSON payload.');
  }

  const { itemId, url, title, submittedBy } = payload;
  if (!itemId || !url || !title) {
    throw httpError(400, 'Missing required fields: itemId, url, and title are required.');
  }

  const videoId = getYoutubeId(url);
  if (!videoId) {
    throw httpError(400, 'Invalid YouTube video URL.');
  }

  const db = await loadDatabase(env);

  const foundItem = db.storeMods?.find(item => item.id === itemId || item.name === itemId || item.code === itemId);

  if (!foundItem) {
    throw httpError(404, 'Catalogue item not found.');
  }

  if (!Array.isArray(foundItem.youtubeVideos)) {
    foundItem.youtubeVideos = [];
  }

  foundItem.youtubeVideos.push({
    title: title.trim(),
    url: `https://www.youtube.com/watch?v=${videoId}`,
    submittedBy: String(submittedBy || 'Anonymous').trim(),
    status: 'approved',
    submittedAt: new Date().toISOString()
  });

  await persistDatabase(env, db);

  return json({ ok: true, message: 'Video tutorial submitted successfully! It will appear once approved by an admin.' }, 200, origin);
}

function getYoutubeId(url) {
  const value = String(url || '').trim();
  if (!value) return '';
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return parsed.pathname.split('/').filter(Boolean)[0] || '';
    if (host.endsWith('youtube.com')) {
      if (parsed.pathname.startsWith('/shorts/')) return parsed.pathname.split('/').filter(Boolean)[1] || '';
      if (parsed.pathname.startsWith('/embed/')) return parsed.pathname.split('/').filter(Boolean)[1] || '';
      return parsed.searchParams.get('v') || '';
    }
  } catch (error) {
    const match = value.match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([A-Za-z0-9_-]{6,})/);
    return match ? match[1] : '';
  }
  return '';
}

export {
  normalizeModxTableRecord,
  parseGithubReleaseUrl,
  parseModxExecutableMetadata,
  parseModxMaintenanceMode,
};
