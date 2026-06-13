import http from 'node:http';
import { existsSync } from 'node:fs';
import crypto from 'node:crypto';

import cors from 'cors';
import express from 'express';
import session from 'express-session';
import multer from 'multer';
import fs from 'fs-extra';
import * as companion from '@uppy/companion';

import { getEnv, setEnv } from './lib/env.mjs';
import { dataDir, tmpDir, tokenPath } from './lib/paths.mjs';
import {
  ensureDriveReady,
  uploadLocalFileToDrive,
  readStoreDatabase,
  writeStoreDatabase,
  assignItemId,
  timestampItem,
  sanitizeItem,
  deleteDriveFile,
} from './lib/drive.mjs';
import {
  createOAuthClient,
  writeStoredToken,
  hasStoredRefreshToken,
} from './lib/google-client.mjs';

const NODE_ENV = getEnv('NODE_ENV', 'development');
const PORT = Number(getEnv('PORT', 4100));
const HOST = getEnv('HOST', '0.0.0.0');
const SESSION_SECRET = getEnv('SESSION_SECRET', 'vortex-companion-session');
const COMPANION_SECRET = getEnv('COMPANION_SECRET', 'vortex-companion-secret');
const COMPANION_PATH = getEnv('COMPANION_PATH', '/companion');
const CORS_ORIGINS = (getEnv('CORS_ORIGINS', '') || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const GOOGLE_SCOPE = getEnv('GOOGLE_DRIVE_SCOPE', 'https://www.googleapis.com/auth/drive.file');

await fs.ensureDir(dataDir);
await fs.ensureDir(tmpDir);

let hasAuthorization = Boolean(getEnv('GOOGLE_REFRESH_TOKEN')) || existsSync(tokenPath);
if (!hasAuthorization && (await hasStoredRefreshToken())) {
  hasAuthorization = true;
}

const app = express();
app.set('trust proxy', 1);

const corsOptions = {
  origin: CORS_ORIGINS.length ? CORS_ORIGINS : undefined,
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      sameSite: 'lax',
    },
  }),
);

let driveContextPromise = null;

async function getDriveContext(force = false) {
  if (!isConfigured()) {
    throw new Error('Google Drive is not authorised yet. Run npm run google:auth or visit /auth/google/start.');
  }
  if (!driveContextPromise || force) {
    driveContextPromise = ensureDriveReady().catch((error) => {
      driveContextPromise = null;
      throw error;
    });
  }
  return driveContextPromise;
}

function isConfigured() {
  return hasAuthorization;
}

app.get('/health', async (req, res) => {
  res.json({ status: 'ok', configured: isConfigured() });
});

app.get('/api/status', async (req, res) => {
  const status = {
    configured: isConfigured(),
    googleAuthorized: isConfigured(),
    message: isConfigured()
      ? 'Google Drive storage ready.'
      : 'Google Drive is not authorised yet. Run npm run google:auth or visit /auth/google/start.',
    folders: null,
  };
  if (!status.configured) {
    res.json(status);
    return;
  }
  try {
    const { config } = await getDriveContext();
    status.folders = config.folders;
    status.storeDbFileId = config.storeDbFileId;
  } catch (error) {
    status.message = error.message;
    status.googleAuthorized = false;
  }
  res.json(status);
});

app.get('/auth/google/start', async (req, res, next) => {
  try {
    const state = crypto.randomBytes(32).toString('hex');
    req.session.oauthState = state;
    const { oauth2Client } = await createOAuthClient();
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [GOOGLE_SCOPE],
      state: state,
    });
    res.redirect(authUrl);
  } catch (error) {
    next(error);
  }
});

app.get('/auth/google/callback', async (req, res, next) => {
  try {
    const code = req.query.code;
    const state = req.query.state;
    const sessionState = req.session.oauthState;
    delete req.session.oauthState;

    if (!code) {
      res.status(400).send('Missing ?code parameter.');
      return;
    }
    if (!state || !sessionState || state !== sessionState) {
      res.status(400).send('Invalid or expired ?state parameter.');
      return;
    }
    const { oauth2Client } = await createOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    if (!tokens?.refresh_token) {
      res.status(500).send('Google did not return a refresh_token; ensure prompt=consent is enabled.');
      return;
    }
    await writeStoredToken(tokens);
    await setEnv('GOOGLE_REFRESH_TOKEN', tokens.refresh_token);
    hasAuthorization = true;
    res.send('Google Drive authorised. You can close this tab.');
    driveContextPromise = null;
  } catch (error) {
    next(error);
  }
});

const upload = multer({
  dest: tmpDir,
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024,
  },
});

const uploadTargets = {
  package: { folderKey: 'packages', allowed: ['.pkg'] },
  mod: { folderKey: 'mods', allowed: ['.zip', '.7z', '.rar'] },
  image: { folderKey: 'icons', allowed: ['.png', '.jpg', '.jpeg', '.webp'] },
  preview: { folderKey: 'previews', allowed: ['.png', '.jpg', '.jpeg', '.webp'] },
  readme: { folderKey: 'readmes', allowed: ['.txt', '.md', '.markdown'] },
};

function validateExtension(filename, allowed) {
  if (!filename) return false;
  const lower = filename.toLowerCase();
  return allowed.some((ext) => lower.endsWith(ext));
}

async function readJsonBodyField(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

app.post('/api/uploads/:type', upload.single('file'), async (req, res, next) => {
  const { type } = req.params;
  const target = uploadTargets[type];
  if (!target) {
    res.status(404).json({ error: 'Unknown upload type.' });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded.' });
    return;
  }
  if (!validateExtension(req.file.originalname, target.allowed)) {
    await fs.remove(req.file.path);
    res.status(400).json({ error: 'File type not allowed.' });
    return;
  }
  try {
    const { drive, config } = await getDriveContext();
    const folderId = config.folders[target.folderKey];
    if (!folderId) {
      throw new Error(`Drive folder missing for ${type}.`);
    }
    const metadata = await readJsonBodyField(req.body.metadata);
    const uploadOptions = {
      folderId,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      makePublic: metadata?.makePublic !== false,
    };
    const info = await uploadLocalFileToDrive(drive, req.file.path, uploadOptions);
    const response = {
      type,
      fileId: info.id,
      name: info.name,
      size: info.size,
      mimeType: info.mimeType,
      downloadUrl: info.downloadUrl,
      webViewLink: info.webViewLink,
      webContentLink: info.webContentLink,
    };
    if (type === 'readme') {
      const maxPreview = 128 * 1024;
      const buffer = await fs.readFile(req.file.path);
      response.content = buffer.slice(0, maxPreview).toString('utf8');
    }
    if (metadata?.replaceFileId) {
      await deleteDriveFile(drive, metadata.replaceFileId).catch(() => {});
    }
    res.json(response);
  } catch (error) {
    next(error);
  } finally {
    if (req.file?.path) {
      await fs.remove(req.file.path).catch(() => {});
    }
  }
});

async function loadCatalogue() {
  const { drive, config } = await getDriveContext();
  const db = await readStoreDatabase(drive, config.storeDbFileId);
  return { drive, config, db };
}

function getListName(mode) {
  return mode === 'mods' ? 'storeMods' : 'storeItems';
}

app.get('/api/catalogue/:mode', async (req, res, next) => {
  try {
    const mode = req.params.mode === 'mods' ? 'mods' : 'store';
    const { db } = await loadCatalogue();
    res.json(db[getListName(mode)] || []);
  } catch (error) {
    next(error);
  }
});

app.get('/api/public/catalogue', async (req, res, next) => {
  try {
    const { db } = await loadCatalogue();
    res.json(db);
  } catch (error) {
    next(error);
  }
});

app.post('/api/catalogue/:mode', async (req, res, next) => {
  try {
    const mode = req.params.mode === 'mods' ? 'mods' : 'store';
    const incoming = req.body?.item || req.body;
    if (!incoming || typeof incoming !== 'object') {
      res.status(400).json({ error: 'Missing item payload.' });
      return;
    }
    const { drive, config, db } = await loadCatalogue();
    const listName = getListName(mode);
    const list = Array.isArray(db[listName]) ? [...db[listName]] : [];

    let item = assignItemId(incoming);
    item = timestampItem(item);
    item = sanitizeItem(item);

    const existingIndex = list.findIndex((entry) => entry.id === item.id);
    if (existingIndex >= 0) {
      list[existingIndex] = item;
    } else {
      list.push(item);
    }

    const nextDb = { ...db, [listName]: list };
    await writeStoreDatabase(drive, config.storeDbFileId, nextDb);
    res.json(item);
  } catch (error) {
    next(error);
  }
});

app.delete('/api/catalogue/:mode/:id', async (req, res, next) => {
  try {
    const mode = req.params.mode === 'mods' ? 'mods' : 'store';
    const itemId = req.params.id;
    if (!itemId) {
      res.status(400).json({ error: 'Missing item id.' });
      return;
    }
    const { drive, config, db } = await loadCatalogue();
    const listName = getListName(mode);
    const list = Array.isArray(db[listName]) ? [...db[listName]] : [];
    const index = list.findIndex((entry) => entry.id === itemId);
    if (index === -1) {
      res.status(404).json({ error: 'Item not found.' });
      return;
    }
    const [removed] = list.splice(index, 1);
    const nextDb = { ...db, [listName]: list };
    await writeStoreDatabase(drive, config.storeDbFileId, nextDb);

    if (removed?.driveFiles) {
      const values = Object.values(removed.driveFiles).filter(Boolean);
      for (const info of values) {
        if (info?.id) {
          await deleteDriveFile(drive, info.id);
        }
      }
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

async function mountCompanion(appInstance, server) {
  const { clientConfig } = await createOAuthClient();
  const options = {
    providerOptions: {
      drive: {
        key: clientConfig.client_id,
        secret: clientConfig.client_secret,
      },
    },
    server: {
      host: getEnv('COMPANION_HOST', `localhost:${PORT}`),
      protocol: getEnv('COMPANION_PROTOCOL', 'http'),
      path: COMPANION_PATH,
    },
    filePath: tmpDir,
    secret: COMPANION_SECRET,
    debug: NODE_ENV !== 'production',
    corsOrigins: CORS_ORIGINS.length ? CORS_ORIGINS : ['*'],
  };
  const { app: companionApp } = companion.app(options);
  appInstance.use(COMPANION_PATH, companionApp);
  companion.socket(server, options);
}

app.use((err, req, res, _next) => {
  console.error('Companion server error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

const server = http.createServer(app);

await mountCompanion(app, server);

server.listen(PORT, HOST, () => {
  const protocol = getEnv('COMPANION_PROTOCOL', 'http');
  const hostLabel = HOST === '0.0.0.0' ? 'localhost' : HOST;
  console.log(`Vortex Companion server listening on ${protocol}://${hostLabel}:${PORT}`);
});
