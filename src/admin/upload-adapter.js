import { buildApiUrl, fetchJson } from "../backend/config.js";

const NOT_CONFIGURED_MESSAGE = "Upload backend is not configured yet.";

let backendStatus = {
  configured: false,
  googleAuthorized: false,
  message: NOT_CONFIGURED_MESSAGE,
};

let statusPromise = null;

function makeNotConfiguredError(action = "perform this operation") {
  const error = new Error(`${backendStatus.message || NOT_CONFIGURED_MESSAGE} Unable to ${action}.`);
  error.code = "BACKEND_NOT_CONFIGURED";
  return error;
}

function normalizeMode(mode) {
  return mode === "mods" ? "mods" : "store";
}

function isBlob(file) {
  return typeof File !== "undefined" && file instanceof File
    ? true
    : typeof Blob !== "undefined" && file instanceof Blob;
}

async function refreshBackendStatus(force = false) {
  if (statusPromise && !force) {
    return statusPromise;
  }

  statusPromise = (async () => {
    try {
      const status = await fetchJson("/api/status");
      backendStatus = {
        configured: Boolean(status?.configured),
        googleAuthorized: Boolean(status?.googleAuthorized),
        message:
          status?.message ||
          (status?.configured ? "Upload backend ready." : NOT_CONFIGURED_MESSAGE),
        folders: status?.folders || null,
        storeDbFileId: status?.storeDbFileId,
      };
    } catch (error) {
      backendStatus = {
        configured: false,
        googleAuthorized: false,
        message: error?.message || NOT_CONFIGURED_MESSAGE,
        error,
      };
    }
    return backendStatus;
  })();

  try {
    return await statusPromise;
  } finally {
    statusPromise = null;
  }
}

async function ensureBackendConfigured() {
  if (!backendStatus.configured) {
    await refreshBackendStatus();
  }
  if (!backendStatus.configured) {
    throw makeNotConfiguredError();
  }
}

function safeParseJson(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

function safeReadResponseText(xhr) {
  try {
    return xhr.responseText;
  } catch (error) {
    return null;
  }
}

function uploadFileWithProgress(url, file, { metadata, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.withCredentials = true;
    xhr.responseType = "json";

    if (typeof onProgress === "function") {
      xhr.upload.onprogress = (event) => {
        try {
          const total = event.total || file?.size || 0;
          const loaded = event.loaded || 0;
          const progress = total > 0 ? Math.round((loaded / total) * 100) : 0;
          onProgress({ loaded, total, progress });
        } catch (err) {
          console.warn("Upload progress handler failed", err);
        }
      };
    }

    xhr.onerror = () => {
      reject(new Error("Upload failed due to a network error."));
    };

    xhr.onload = () => {
      let body = null;
      if (xhr.responseType === 'json') {
        body = xhr.response ?? null;
      } else if (!xhr.responseType || xhr.responseType === 'text') {
        body = safeParseJson(xhr.responseText) ?? xhr.responseText;
      } else {
        const fallbackText = safeReadResponseText(xhr);
        body = xhr.response ?? safeParseJson(fallbackText) ?? fallbackText;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body);
      } else {
        const fallbackText = typeof body === 'string' ? body : safeReadResponseText(xhr);
        const message = body?.error || body?.message || fallbackText || (xhr.status === 401 ? 'Sign in with Google to upload.' : `Upload failed with status ${xhr.status}.`);
        const error = new Error(message);
        error.status = xhr.status;
        error.payload = body;
        if (!error.payload && fallbackText) {
          error.payload = safeParseJson(fallbackText) || { raw: fallbackText };
        }
        reject(error);
      }
    };

    const formData = new FormData();
    const fileName = file?.name || "upload.bin";
    formData.append("file", file, fileName);
    if (metadata && Object.keys(metadata).length) {
      formData.append("metadata", JSON.stringify(metadata));
    }

    xhr.send(formData);
  });
}

async function uploadBinary(type, file, { metadata = {}, replaceFileId, makePublic = true, onProgress } = {}) {
  await ensureBackendConfigured();
  if (!file) {
    throw new Error("No file provided for upload.");
  }
  if (!isBlob(file)) {
    throw new Error("Uploads require a File or Blob object.");
  }

  const bodyMetadata = { ...metadata };
  if (makePublic === false) bodyMetadata.makePublic = false;
  if (replaceFileId) bodyMetadata.replaceFileId = replaceFileId;

  const url = buildApiUrl(`/api/uploads/${type}`);
  try {
    return await uploadFileWithProgress(url, file, { metadata: bodyMetadata, onProgress });
  } catch (error) {
    await refreshBackendStatus(true).catch(() => {});
    if (error && typeof error === "object") {
      if (error.status === 401) {
        error.message = "Sign in with Google to upload.";
      } else if (
        error.status === 403 &&
        (String(error.message).includes('storageQuotaExceeded') ||
          String(error.message).toLowerCase().includes('storage quota'))
      ) {
        error.message =
          'Google Drive upload failed because the backend is using a service account with no storage quota. Configure Drive OAuth refresh-token storage.';
      }
    }
    throw error;
  }
}

function cloneItem(pkg) {
  const clone = {
    ...pkg,
    tags: Array.isArray(pkg?.tags) ? [...pkg.tags] : [],
    youtubeVideos: Array.isArray(pkg?.youtubeVideos) ? [...pkg.youtubeVideos] : [],
    media: Array.isArray(pkg?.media) ? [...pkg.media] : [],
    installInstructions: {
      ...(pkg?.installInstructions || {}),
    },
    consoleInstall: {
      ...(pkg?.consoleInstall || {}),
    },
  };
  if (pkg?.readme && typeof pkg.readme === "object") {
    clone.readme = { ...pkg.readme };
  }
  clone.driveFiles = { ...(pkg?.driveFiles || {}) };
  return clone;
}

async function saveStoreItem(mode, pkg, _currentUser) {
  if (!pkg || typeof pkg !== "object") {
    throw new Error("Item payload is required.");
  }

  await ensureBackendConfigured();
  const normalizedMode = normalizeMode(mode);
  const item = cloneItem(pkg);
  const driveFiles = item.driveFiles;

  if (pkg.zip_file_file && isBlob(pkg.zip_file_file)) {
    const uploadType = normalizedMode === "mods" ? "mod" : "package";
    const info = await uploadBinary(uploadType, pkg.zip_file_file, {
      replaceFileId: driveFiles.package?.id,
      makePublic: true,
    });
    driveFiles.package = info;
    item.zip_file = info.name;
    item.download_url = info.downloadUrl;
    item.download = {
      enabled: true,
      url: info.downloadUrl,
      type: item.fileType || (normalizedMode === "mods" ? "archive" : "pkg"),
    };
  } else {
    if (!item.zip_file && driveFiles.package?.name) {
      item.zip_file = driveFiles.package.name;
    }
    if (!item.download_url && driveFiles.package?.downloadUrl) {
      item.download_url = driveFiles.package.downloadUrl;
    }
  }
  delete item.zip_file_file;

  if (pkg.icon_file && isBlob(pkg.icon_file)) {
    const info = await uploadBinary("image", pkg.icon_file, {
      replaceFileId: driveFiles.icon?.id,
      makePublic: true,
    });
    driveFiles.icon = info;
    item.icon = info.downloadUrl;
  } else if (driveFiles.icon?.downloadUrl) {
    item.icon = item.icon || driveFiles.icon.downloadUrl;
  }
  delete item.icon_file;

  if (pkg.preview_file && isBlob(pkg.preview_file)) {
    const info = await uploadBinary("preview", pkg.preview_file, {
      replaceFileId: driveFiles.preview?.id,
      makePublic: true,
    });
    driveFiles.preview = info;
    item.preview = info.downloadUrl;
  } else if (driveFiles.preview?.downloadUrl) {
    item.preview = item.preview || driveFiles.preview.downloadUrl;
  }
  delete item.preview_file;

  if (pkg.readme_file_file && isBlob(pkg.readme_file_file)) {
    const info = await uploadBinary("readme", pkg.readme_file_file, {
      replaceFileId: driveFiles.readme?.id,
      makePublic: true,
    });
    driveFiles.readme = info;
    const existing = item.readme && typeof item.readme === "object" ? { ...item.readme } : {};
    item.readme = {
      ...existing,
      filename: info.name,
      downloadUrl: info.downloadUrl,
      driveFile: info,
      content: existing.content ?? pkg.readme?.content ?? "",
    };
    if (!item.readme.format) {
      item.readme.format = info.name?.toLowerCase().endsWith(".txt") ? "text" : "markdown";
    }
  } else if (item.readme && driveFiles.readme?.downloadUrl) {
    item.readme = {
      ...item.readme,
      filename: item.readme.filename || driveFiles.readme.name,
      downloadUrl: driveFiles.readme.downloadUrl,
      driveFile: driveFiles.readme,
    };
  }
  delete item.readme_file_file;

  item.driveFiles = driveFiles;

  const payload = JSON.parse(JSON.stringify(item));

  const saved = await fetchJson(`/api/catalogue/${normalizedMode}`, {
    method: "POST",
    body: JSON.stringify({ item: payload }),
  });

  const mergedDriveFiles = {
    ...driveFiles,
    ...(saved?.driveFiles || {}),
  };

  return {
    ...item,
    ...saved,
    driveFiles: mergedDriveFiles,
  };
}

async function deleteStoreItem(mode, item) {
  await ensureBackendConfigured();
  const id = item?.id || item;
  if (!id) {
    throw new Error("An item id is required to delete an entry.");
  }
  await fetchJson(`/api/catalogue/${normalizeMode(mode)}/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

async function loadCatalogue(mode) {
  await ensureBackendConfigured();
  const list = await fetchJson(`/api/catalogue/${normalizeMode(mode)}`);
  if (!Array.isArray(list)) return [];
  return list.map((entry) => ({
    ...entry,
    driveFiles: entry.driveFiles || {},
  }));
}

async function loadStoreItems() {
  return loadCatalogue("store");
}

async function loadStoreMods() {
  return loadCatalogue("mods");
}

function getBackendStatus() {
  return { ...backendStatus };
}

function uploadPackage(file, metadata = {}, { onProgress } = {}) {
  return uploadBinary("package", file, {
    replaceFileId: metadata?.replaceFileId,
    makePublic: metadata?.makePublic !== false,
    onProgress,
  });
}

function uploadMod(file, metadata = {}, { onProgress } = {}) {
  return uploadBinary("mod", file, {
    replaceFileId: metadata?.replaceFileId,
    makePublic: metadata?.makePublic !== false,
    onProgress,
  });
}

function uploadImage(file, metadata = {}, { onProgress } = {}) {
  const type = metadata?.variant === "preview" ? "preview" : "image";
  return uploadBinary(type, file, {
    replaceFileId: metadata?.replaceFileId,
    makePublic: metadata?.makePublic !== false,
    onProgress,
  });
}

function uploadReadme(file, metadata = {}, { onProgress } = {}) {
  return uploadBinary("readme", file, {
    replaceFileId: metadata?.replaceFileId,
    makePublic: metadata?.makePublic !== false,
    onProgress,
  });
}

export {
  refreshBackendStatus,
  ensureBackendConfigured,
  uploadPackage,
  uploadMod,
  uploadImage,
  uploadReadme,
  saveStoreItem,
  deleteStoreItem,
  loadStoreItems,
  loadStoreMods,
  getBackendStatus,
};

export default {
  refreshBackendStatus,
  ensureBackendConfigured,
  uploadPackage,
  uploadMod,
  uploadImage,
  uploadReadme,
  saveStoreItem,
  deleteStoreItem,
  loadStoreItems,
  loadStoreMods,
  getBackendStatus,
};
