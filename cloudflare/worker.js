const PRODUCTION_ORIGINS = [
  'https://vortex-prime-emu.com',
  'https://rileyadams05.github.io',
];

const LOCAL_DEV_HOSTS = new Set(['localhost', '127.0.0.1']);

const DEFAULT_DB = {
  storeItems: [],
  storeMods: [],
  reports: [],
  adminSettings: {},
};

const UPLOAD_TARGETS = {
  package: {
    folderEnv: 'DRIVE_PACKAGES_FOLDER_ID',
    allowedExtensions: ['.pkg'],
    invalidMessage: 'PKG file required.',
    makePublic: true,
  },
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

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

let sessionKeyCache = null;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const allowedOrigin = resolveAllowedOrigin(origin);

    if (request.method === 'OPTIONS') {
      return optionsResponse(allowedOrigin);
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/+/, '');

    try {
      if (path === '' || path === 'api') {
        return json({ ok: true, service: 'Vortex Prime Companion Worker' }, 200, allowedOrigin);
      }

      if (path === 'api/status') {
        return handleStatus(request, env, allowedOrigin);
      }

      if (path === 'api/auth/config') {
        return handleAuthConfig(request, env, allowedOrigin);
      }

      if (path === 'api/auth/login') {
        return handleLogin(request, env, allowedOrigin);
      }

      if (path === 'api/auth/logout') {
        return handleLogout(env, allowedOrigin);
      }

      if (path === 'api/risc/events') {
        return handleRiscEvents(request, env, allowedOrigin);
      }

      if (path === 'api/public/catalogue') {
        return handlePublicCatalogue(env, allowedOrigin);
      }

      if (path === 'api/public/submit-video') {
        return handlePublicSubmitVideo(request, env, allowedOrigin);
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

function resolveAllowedOrigin(origin) {
  if (!origin) return PRODUCTION_ORIGINS[0];
  if (PRODUCTION_ORIGINS.includes(origin)) {
    return origin;
  }
  if (isAllowedLocalOrigin(origin)) {
    return origin;
  }
  return null;
}

function isAllowedLocalOrigin(origin) {
  try {
    const url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return false;
    }
    if (!LOCAL_DEV_HOSTS.has(url.hostname)) {
      return false;
    }
    if (url.port && Number.isNaN(Number(url.port))) {
      return false;
    }
    return true;
  } catch (error) {
    return false;
  }
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

async function handlePublicCatalogue(env, origin) {
  const db = await loadDatabase(env);
  return json(db, 200, origin);
}

async function handleAuthConfig(request, env, origin) {
  const session = await readSession(request, env).catch(() => null);
  const summary = buildAuthSummary(env, session);
  return json({ ok: true, ...summary }, 200, origin);
}

async function handleLogin(request, env, origin) {
  if (request.method !== 'POST') {
    throw httpError(405, 'Login requires POST.');
  }

  const body = await request.json().catch(() => null);
  const credential = body?.credential;
  if (!credential || typeof credential !== 'string') {
    throw httpError(400, 'Missing Google credential.');
  }

  const profile = await validateGoogleCredential(credential, env);
  const role = isAdminEmail(profile.email, env) ? 'admin' : 'uploader';
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: profile.sub,
    email: profile.email,
    name: profile.name || null,
    picture: profile.picture || null,
    role,
    exp: now + SESSION_TTL_SECONDS,
    iat: now,
  };
  const token = await createSessionToken(payload, env);
  const response = json({
    ok: true,
    user: sanitizeUserForResponse(payload),
    role,
  }, 200, origin);
  response.headers.append('Set-Cookie', buildSessionCookie(token));
  return response;
}

async function handleLogout(env, origin) {
  const response = json({ ok: true }, 200, origin);
  response.headers.append('Set-Cookie', buildSessionCookie('', { maxAge: 0 }));
  return response;
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
  const mode = normaliseMode(segments[2]);

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
  if (!json || typeof json !== 'object') {
    return { ...DEFAULT_DB };
  }
  return { ...DEFAULT_DB, ...json };
}

async function persistDatabase(env, data) {
  const fileId = requireEnv(env, 'DRIVE_DATABASE_FILE_ID');
  const body = JSON.stringify({ ...DEFAULT_DB, ...data }, null, 2);
  const response = await driveRequest(
    env,
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&supportsAllDrives=true`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
      },
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
  const listName = mode === 'mods' ? 'storeMods' : 'storeItems';
  const list = Array.isArray(db[listName]) ? db[listName] : [];
  return list.map((entry) => sanitizeItem(entry));
}

async function saveCatalogueItem(env, mode, incoming, actor) {
  const db = await loadDatabase(env);
  const listName = mode === 'mods' ? 'storeMods' : 'storeItems';
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
  const listName = mode === 'mods' ? 'storeMods' : 'storeItems';
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
  // "Uploaded By" is the editable display label for who uploaded it to the
  // Vortex Prime Store (e.g. "Riley Adams"). Falls back to legacy uploader/owner.
  item.uploadedBy = (item.uploadedBy || item.uploader || item.owner || '').toString().trim();
  item.tags = Array.isArray(item.tags) ? item.tags.filter(Boolean) : [];
  item.platform = item.platform || 'PS4';
  item.updated = item.updated || new Date().toISOString();
  item.type = item.type === 'mods' ? 'mods' : 'store';
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

function normaliseMode(value) {
  return value === 'mods' ? 'mods' : 'store';
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

function sanitizeUserForResponse(user) {
  if (!user || typeof user !== 'object') return null;
  const { email, name, picture, role } = user;
  const trimmedEmail = typeof email === 'string' ? email.trim() : null;
  if (!trimmedEmail) return null;
  return {
    email: trimmedEmail,
    name: typeof name === 'string' ? name.trim() : null,
    picture: typeof picture === 'string' ? picture.trim() : null,
    role: role || 'uploader',
  };
}

function buildAuthSummary(env, sessionUser) {
  return {
    googleClientId: String(env.GOOGLE_OAUTH_CLIENT_ID || '').trim() || null,
    adminEmails: getAdminEmails(env),
    user: sanitizeUserForResponse(sessionUser),
  };
}

async function ensureAuthenticated(request, env) {
  const session = await readSession(request, env);
  if (!session) {
    throw httpError(401, 'Sign in with Google to upload.');
  }
  return session;
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
  if (options.expires instanceof Date) {
    parts.push(`Expires=${options.expires.toUTCString()}`);
  }
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

async function driveRequest(env, url, options = {}, retry = true) {
  const token = await getAccessToken(env);
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  const response = await fetch(url, { ...options, headers });
  if (response.status === 401 && retry) {
    tokenCache = null;
    return driveRequest(env, url, options, false);
  }
  return response;
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
  
  let foundItem = db.storeItems?.find(item => item.id === itemId || item.name === itemId || item.code === itemId);
  
  if (!foundItem) {
    foundItem = db.storeMods?.find(item => item.id === itemId || item.name === itemId || item.code === itemId);
  }

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
