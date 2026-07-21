import fs from 'fs-extra';
import path from 'path';
import { Readable } from 'node:stream';
import { google } from 'googleapis';
import { nanoid } from 'nanoid';
import { getEnv } from './env.mjs';
import { createOAuthClient, readStoredToken, writeStoredToken } from './google-client.mjs';
import { privateConfigPath } from './paths.mjs';

const DRIVE_MIME_FOLDER = 'application/vnd.google-apps.folder';
const PUBLIC_DOWNLOAD_BASE = 'https://drive.google.com/uc';

const DEFAULT_DB = {
  storeItems: [],
  storeMods: [],
  reports: [],
  adminSettings: {},
  clips: [],
};

const FOLDER_STRUCTURE = [
  { key: 'root', name: 'Vortex Prime Store' },
  { key: 'packages', name: 'Packages', parent: 'root' },
  { key: 'mods', name: 'Mods', parent: 'root' },
  { key: 'icons', name: 'Icons', parent: 'root' },
  { key: 'previews', name: 'Previews', parent: 'root' },
  { key: 'readmes', name: 'Readmes', parent: 'root' },
  { key: 'database', name: 'Database', parent: 'root' },
  { key: 'clips', name: 'Clips', parent: 'root' },
];

const STORE_DB_NAME = 'store-db.json';

function escapeQueryName(name) {
  return name.replace(/'/g, "\\'");
}

async function ensureFolder(drive, name, parentId = null) {
  const qParts = [
    `name = '${escapeQueryName(name)}'`,
    `mimeType = '${DRIVE_MIME_FOLDER}'`,
    'trashed = false',
  ];
  if (parentId) qParts.push(`'${parentId}' in parents`);
  const response = await drive.files.list({
    q: qParts.join(' and '),
    fields: 'files(id, name)',
    spaces: 'drive',
    pageSize: 1,
  });
  const existing = response.data.files?.[0];
  if (existing) return existing.id;

  const metadata = {
    name,
    mimeType: DRIVE_MIME_FOLDER,
  };
  if (parentId) {
    metadata.parents = [parentId];
  }
  const created = await drive.files.create({
    requestBody: metadata,
    fields: 'id, name',
  });
  return created.data.id;
}

async function ensureStructure(drive) {
  let config = await readPrivateConfig();
  let updated = false;

  for (const folder of FOLDER_STRUCTURE) {
    if (config.folders[folder.key]) continue;
    const parentId = folder.parent ? config.folders[folder.parent] : null;
    const id = await ensureFolder(drive, folder.name, parentId);
    config.folders[folder.key] = id;
    updated = true;
  }

  if (!config.storeDbFileId) {
    const databaseFolderId = config.folders.database;
    if (!databaseFolderId) {
      throw new Error('Database folder ID missing after setup.');
    }
    const fileRes = await drive.files.list({
      q: `name = '${escapeQueryName(STORE_DB_NAME)}' and '${databaseFolderId}' in parents and trashed = false`,
      fields: 'files(id, name)',
      pageSize: 1,
    });
    let fileId = fileRes.data.files?.[0]?.id;
    if (!fileId) {
      const mediaBuffer = Buffer.from(JSON.stringify(DEFAULT_DB, null, 2));
      const created = await drive.files.create({
        requestBody: {
          name: STORE_DB_NAME,
          parents: [databaseFolderId],
          mimeType: 'application/json',
        },
        media: {
          mimeType: 'application/json',
          body: Readable.from(mediaBuffer),
        },
        fields: 'id, name',
      });
      fileId = created.data.id;
      await setPublicReadPermission(drive, fileId, { anyone: false });
    }
    config.storeDbFileId = fileId;
    updated = true;
  }

  if (updated) {
    await writePrivateConfig(config);
  }

  return config;
}

async function readPrivateConfig() {
  const exists = await fs.pathExists(privateConfigPath);
  if (!exists) {
    return { folders: {}, storeDbFileId: null };
  }
  try {
    const raw = await fs.readFile(privateConfigPath, 'utf8');
    const config = JSON.parse(raw);
    if (!config.folders) config.folders = {};
    return config;
  } catch (error) {
    console.warn('Failed to parse private config, recreating.', error);
    return { folders: {}, storeDbFileId: null };
  }
}

async function writePrivateConfig(config) {
  await fs.writeJson(privateConfigPath, config, { spaces: 2 });
}

export async function ensureDrive(drive) {
  return ensureStructure(drive);
}

export function buildDownloadUrl(fileId) {
  return `${PUBLIC_DOWNLOAD_BASE}?id=${encodeURIComponent(fileId)}&export=download`;
}

export async function setPublicReadPermission(drive, fileId, options = { anyone: true }) {
  if (options.anyone === false) return; // keep private
  try {
    await drive.permissions.create({
      fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });
  } catch (error) {
    if (error?.errors?.[0]?.reason === 'alreadyExists') {
      return;
    }
    throw error;
  }
}

async function getDriveInstance() {
  const { oauth2Client } = await createOAuthClient();
  return google.drive({ version: 'v3', auth: oauth2Client });
}

export async function ensureDriveReady() {
  const drive = await getDriveInstance();
  const config = await ensureDrive(drive);
  return { drive, config };
}

export async function readStoreDatabase(drive, fileId) {
  const res = await drive.files.get({
    fileId,
    alt: 'media',
  }, { responseType: 'stream' });

  const chunks = [];
  await new Promise((resolve, reject) => {
    res.data.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    res.data.on('end', resolve);
    res.data.on('error', reject);
  });

  try {
    const json = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return { ...DEFAULT_DB, ...json };
  } catch (error) {
    console.warn('Failed to parse store-db.json, resetting to default', error);
    return { ...DEFAULT_DB };
  }
}

export async function writeStoreDatabase(drive, fileId, data) {
  const content = JSON.stringify({ ...DEFAULT_DB, ...data }, null, 2);
  await drive.files.update({
    fileId,
    media: {
      mimeType: 'application/json',
      body: Buffer.from(content, 'utf8'),
    },
  });
  return JSON.parse(content);
}

export function assignItemId(item) {
  if (item.id) return item;
  return { ...item, id: nanoid(12) };
}

export function timestampItem(item) {
  const now = new Date().toISOString();
  return { ...item, updated: now }; // keep created? optional
}

export function sanitizeItem(item) {
  const allowed = {
    id: String(item.id || ''),
    name: item.name || '',
    description: item.description || '',
    creator: item.creator || '',
    tags: Array.isArray(item.tags) ? item.tags : [],
    icon: item.icon || '',
    preview: item.preview || '',
    zip_file: item.zip_file || '',
    download_url: item.download_url || '',
    platform: item.platform || 'PS4',
    updated: item.updated || new Date().toISOString(),
    type: item.type || 'store',
    category: item.category,
    fileType: item.fileType,
    allowedExtensions: item.allowedExtensions || [],
    download: item.download || {},
    consoleInstall: item.consoleInstall || {},
    installInstructions: item.installInstructions || {},
    externalGuideUrl: item.externalGuideUrl || '',
    youtubeGuideUrl: item.youtubeGuideUrl || '',
    youtubeVideos: Array.isArray(item.youtubeVideos) ? item.youtubeVideos : [],
    media: Array.isArray(item.media) ? item.media : [],
    readme: item.readme || null,
    driveFiles: item.driveFiles && typeof item.driveFiles === 'object' ? item.driveFiles : {},
  };
  return allowed;
}

export function formatDriveFileResponse(file) {
  if (!file) return null;
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    size: file.size ? Number(file.size) : undefined,
    downloadUrl: buildDownloadUrl(file.id),
    webViewLink: file.webViewLink,
    webContentLink: file.webContentLink,
    iconLink: file.iconLink,
    thumbnailLink: file.thumbnailLink,
  };
}

export async function uploadLocalFileToDrive(drive, filePath, options) {
  const { folderId, fileName, mimeType, makePublic = true } = options;
  const name = fileName || path.basename(filePath);
  const requestBody = {
    name,
    parents: folderId ? [folderId] : undefined,
  };
  const media = {
    mimeType: mimeType || undefined,
    body: fs.createReadStream(filePath),
  };
  const created = await drive.files.create({
    requestBody,
    media,
    fields: 'id, name, mimeType, size, webViewLink, webContentLink, iconLink, thumbnailLink',
  });
  if (makePublic) {
    await setPublicReadPermission(drive, created.data.id);
  }
  return formatDriveFileResponse(created.data);
}

export async function deleteDriveFile(drive, fileId) {
  if (!fileId) return;
  try {
    await drive.files.delete({ fileId });
  } catch (error) {
    if (error?.code === 404) return;
    throw error;
  }
}
