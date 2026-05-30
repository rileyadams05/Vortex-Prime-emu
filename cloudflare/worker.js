const ALLOWED_ORIGINS = [
  'https://vortex-prime-emu.com',
  'https://rileyadams05.github.io'
];

const CATALOG_KEYS = {
  store: 'catalog/store.json',
  mods: 'catalog/mods.json',
};

export default {
  async fetch(request, env) {
    if (!env.VORTEX_UPLOADS) {
      return json({ ok: false, message: 'VORTEX_UPLOADS binding is missing on this Worker.' }, 500);
    }

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
        return handleStatus(env, allowedOrigin);
      }

      if (path === 'api/public/catalogue') {
        return handlePublicCatalogue(env, allowedOrigin);
      }

      if (path.startsWith('api/catalogue/')) {
        return handleCatalogueRequest(request, env, path, allowedOrigin);
      }

      if (path.startsWith('api/uploads/')) {
        return handleUploadRequest(request, env, path, allowedOrigin, url.origin);
      }

      if (path.startsWith('api/assets/')) {
        return handleAssetRequest(request, env, path.substring('api/assets/'.length));
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
  if (!origin) return ALLOWED_ORIGINS[0];
  return ALLOWED_ORIGINS.includes(origin) ? origin : null;
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

async function handleStatus(env, origin) {
  const status = {
    configured: true,
    googleAuthorized: true,
    message: 'Cloudflare storage ready.',
    folders: {
      packages: 'r2://vortex-prime-store-uploads/uploads/packages',
      mods: 'r2://vortex-prime-store-uploads/uploads/mods',
      icons: 'r2://vortex-prime-store-uploads/uploads/icons',
      previews: 'r2://vortex-prime-store-uploads/uploads/previews',
      readmes: 'r2://vortex-prime-store-uploads/uploads/readmes',
    },
    storeDbFileId: 'r2://vortex-prime-store-uploads/catalog/store.json',
  };

  try {
    await ensureCatalogueInitialised(env, 'store');
    await ensureCatalogueInitialised(env, 'mods');
  } catch (error) {
    status.configured = false;
    status.googleAuthorized = false;
    status.message = error.message || 'Unable to access Cloudflare R2 storage.';
  }

  return json(status, 200, origin);
}

async function handlePublicCatalogue(env, origin) {
  const db = await readDatabase(env);
  return json(db, 200, origin);
}

async function handleCatalogueRequest(request, env, path, origin) {
  const segments = path.split('/');
  const mode = normaliseMode(segments[2]);
  const catalogKey = CATALOG_KEYS[mode];
  if (!catalogKey) {
    throw httpError(404, 'Unknown catalogue.');
  }

  if (request.method === 'GET') {
    const list = await readCatalogue(env, mode);
    return json(list, 200, origin);
  }

  if (request.method === 'POST') {
    const payload = await request.json().catch(() => null);
    if (!payload || typeof payload !== 'object') {
      throw httpError(400, 'Missing JSON payload.');
    }
    const incoming = payload.item && typeof payload.item === 'object' ? payload.item : payload;
    const saved = await saveCatalogueItem(env, mode, incoming);
    return json(saved, 200, origin);
  }

  if (request.method === 'DELETE') {
    const itemId = segments[3];
    if (!itemId) {
      throw httpError(400, 'Missing item id.');
    }
    await deleteCatalogueItem(env, mode, itemId);
    return json({ success: true }, 200, origin);
  }

  return json({ ok: false, message: 'Method not allowed.' }, 405, origin);
}

async function handleUploadRequest(request, env, path, origin, requestOrigin) {
  if (request.method !== 'POST') {
    throw httpError(405, 'Upload endpoint only supports POST.');
  }

  const type = path.split('/')[2];
  const target = uploadTargetFor(type);
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
  const key = buildObjectKey(target.baseKey, file.name);
  await putFile(env, key, file, target.cacheControl);

  if (metadata?.replaceFileId) {
    await safeDelete(env, metadata.replaceFileId);
  }

  if (target.kind === 'asset') {
    return json(buildAssetResponse(key, file, requestOrigin), 200, origin);
  }

  if (target.kind === 'text') {
    const content = await file.text();
    await env.VORTEX_UPLOADS.put(key, content, {
      httpMetadata: {
        contentType: file.name.toLowerCase().endsWith('.txt') ? 'text/plain; charset=utf-8' : 'text/markdown; charset=utf-8',
      },
    });
    return json(buildReadmeResponse(key, file, content, requestOrigin), 200, origin);
  }

  throw httpError(500, 'Unsupported upload target.');
}

async function handleAssetRequest(request, env, key) {
  const cleanKey = decodeURIComponent(key).replace(/^\/+/, '');
  const object = await env.VORTEX_UPLOADS.get(cleanKey);
  if (!object) {
    return new Response('Not Found', { status: 404 });
  }
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('cache-control', headers.get('cache-control') || 'public, max-age=31536000, immutable');
  headers.set('etag', object.httpEtag);
  if (request.method === 'HEAD') {
    return new Response(null, { status: 204, headers });
  }
  return new Response(object.body, { status: 200, headers });
}

function uploadTargetFor(type) {
  const map = {
    package: {
      baseKey: 'uploads/packages',
      allowedExtensions: ['.pkg'],
      invalidMessage: 'PKG file required.',
      kind: 'asset',
      cacheControl: 'public, max-age=31536000, immutable',
    },
    mod: {
      baseKey: 'uploads/mods',
      allowedExtensions: ['.zip', '.7z', '.rar'],
      invalidMessage: 'Mod archive must be ZIP, 7Z, or RAR.',
      kind: 'asset',
      cacheControl: 'public, max-age=31536000, immutable',
    },
    image: {
      baseKey: 'uploads/icons',
      allowedExtensions: ['.png', '.jpg', '.jpeg', '.webp'],
      invalidMessage: 'Icon must be PNG, JPG, JPEG, or WEBP.',
      kind: 'asset',
      cacheControl: 'public, max-age=31536000, immutable',
    },
    preview: {
      baseKey: 'uploads/previews',
      allowedExtensions: ['.png', '.jpg', '.jpeg', '.webp'],
      invalidMessage: 'Preview must be PNG, JPG, JPEG, or WEBP.',
      kind: 'asset',
      cacheControl: 'public, max-age=31536000, immutable',
    },
    readme: {
      baseKey: 'uploads/readmes',
      allowedExtensions: ['.txt', '.md', '.markdown'],
      invalidMessage: 'README must be TXT or Markdown.',
      kind: 'text',
    },
  };
  return map[type];
}

async function readCatalogue(env, mode) {
  await ensureCatalogueInitialised(env, mode);
  const key = CATALOG_KEYS[mode];
  const object = await env.VORTEX_UPLOADS.get(key);
  if (!object) return [];
  const json = await object.json().catch(() => []);
  return Array.isArray(json) ? json : [];
}

async function saveCatalogueItem(env, mode, incoming) {
  const list = await readCatalogue(env, mode);
  const now = new Date().toISOString();
  const item = normaliseCatalogueItem(incoming, mode, now);
  const index = list.findIndex((entry) => entry.id === item.id);
  if (index >= 0) {
    list[index] = item;
  } else {
    list.push(item);
  }
  await writeJson(env, CATALOG_KEYS[mode], list);
  return item;
}

async function deleteCatalogueItem(env, mode, itemId) {
  const list = await readCatalogue(env, mode);
  const index = list.findIndex((entry) => entry.id === itemId);
  if (index === -1) {
    throw httpError(404, 'Item not found.');
  }
  const [removed] = list.splice(index, 1);
  await writeJson(env, CATALOG_KEYS[mode], list);
  await cleanupDriveFiles(env, removed?.driveFiles);
}

async function cleanupDriveFiles(env, driveFiles) {
  if (!driveFiles || typeof driveFiles !== 'object') return;
  const values = Object.values(driveFiles).filter(Boolean);
  await Promise.all(values.map(async (info) => {
    if (info?.id) {
      await safeDelete(env, info.id);
    }
    if (info?.key && info.key !== info.id) {
      await safeDelete(env, info.key);
    }
  }));
}

async function readDatabase(env) {
  const [store, mods] = await Promise.all([
    readCatalogue(env, 'store'),
    readCatalogue(env, 'mods'),
  ]);
  return {
    storeItems: store,
    storeMods: mods,
  };
}

async function ensureCatalogueInitialised(env, mode) {
  const key = CATALOG_KEYS[mode];
  if (!key) return;
  const head = await env.VORTEX_UPLOADS.head(key);
  if (!head) {
    await writeJson(env, key, []);
  }
}

async function writeJson(env, key, data) {
  await env.VORTEX_UPLOADS.put(key, JSON.stringify(data, null, 2), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
  });
}

async function putFile(env, key, file, cacheControl) {
  const options = {
    httpMetadata: {
      contentType: file.type || 'application/octet-stream',
    },
  };
  if (cacheControl) {
    options.httpMetadata.cacheControl = cacheControl;
  }
  await env.VORTEX_UPLOADS.put(key, file.stream(), options);
}

async function safeDelete(env, key) {
  try {
    await env.VORTEX_UPLOADS.delete(key);
  } catch (error) {
    console.warn('Failed to delete object', key, error);
  }
}

function normaliseCatalogueItem(raw, mode, timestamp) {
  const item = { ...(raw || {}) };
  item.id = normaliseId(item.id);
  item.code = normaliseCode(item.code);
  item.type = mode === 'mods' ? 'mods' : 'store';
  item.updated = timestamp;
  if (!item.uploaded_at) {
    item.uploaded_at = timestamp;
  }
  if (!item.created_at) {
    item.created_at = timestamp;
  }
  if (!item.driveFiles || typeof item.driveFiles !== 'object') {
    item.driveFiles = {};
  }
  if (item.download_url) {
    item.download = {
      enabled: true,
      url: item.download_url,
      type: item.fileType || (mode === 'mods' ? 'archive' : 'pkg'),
    };
  }
  return item;
}

function normaliseId(id) {
  if (id && typeof id === 'string' && id.trim()) {
    return id.trim();
  }
  return crypto.randomUUID();
}

function normaliseCode(code) {
  if (code && typeof code === 'string' && code.trim()) {
    return code.trim();
  }
  return generateCode();
}

function generateCode() {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

function normaliseMode(value) {
  return value === 'mods' ? 'mods' : 'store';
}

function buildObjectKey(baseKey, fileName) {
  const safeName = fileName.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '_');
  const unique = crypto.randomUUID();
  return `${baseKey}/${unique}-${safeName}`;
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

function assetUrl(origin, key) {
  const base = origin || 'https://vortex-prime-emu.com';
  return `${base}/api/assets/${encodeURIComponent(key).replace(/%2F/g, '/')}`;
}

function buildAssetResponse(key, file, origin) {
  const url = assetUrl(origin, key);
  return {
    id: key,
    key,
    name: file.name,
    size: file.size,
    mimeType: file.type || 'application/octet-stream',
    downloadUrl: url,
    webViewLink: url,
    webContentLink: url,
  };
}

function buildReadmeResponse(key, file, content, origin) {
  const url = assetUrl(origin, key);
  const format = file.name.toLowerCase().endsWith('.txt') ? 'text' : 'markdown';
  return {
    id: key,
    key,
    name: file.name,
    size: content.length,
    mimeType: format === 'text' ? 'text/plain; charset=utf-8' : 'text/markdown; charset=utf-8',
    downloadUrl: url,
    webViewLink: url,
    webContentLink: url,
    content,
    format,
  };
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}
