// src/backend/config.js
var DEFAULT_LOCAL_PORT = 4100;
var PRODUCTION_BASE_URL = "https://vortex-prime-emu.com";
function readGlobal(name) {
  if (typeof globalThis !== "undefined" && globalThis[name]) {
    return String(globalThis[name]);
  }
  return null;
}
function readMeta(name) {
  if (typeof document === "undefined") return null;
  const el = document.querySelector(`meta[name="${name}"]`);
  return (el == null ? void 0 : el.content) ? el.content.trim() : null;
}
function readEnv(name) {
  if (typeof process !== "undefined" && process.env && process.env[name]) {
    return String(process.env[name]);
  }
  return null;
}
function readStored() {
  var _a;
  try {
    if (typeof window === "undefined") return null;
    return ((_a = window.localStorage) == null ? void 0 : _a.getItem("vortex-companion-base-url")) || null;
  } catch (error) {
    return null;
  }
}
function resolveDefaultBase() {
  if (typeof window === "undefined" || !(window == null ? void 0 : window.location)) {
    return PRODUCTION_BASE_URL;
  }
  const { protocol, hostname } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return `${protocol}//${hostname}:${DEFAULT_LOCAL_PORT}`;
  }
  return PRODUCTION_BASE_URL;
}
function getCompanionBaseUrl() {
  const fromGlobal = readGlobal("__VORTEX_COMPANION_BASE_URL__");
  const fromMeta = readMeta("vortex-companion-base-url");
  const fromEnv = readEnv("VORTEX_COMPANION_BASE_URL");
  const fromStored = readStored();
  const value = fromGlobal || fromMeta || fromStored || fromEnv;
  if (value) {
    return value.replace(/\/$/, "");
  }
  return resolveDefaultBase();
}
function buildApiUrl(path) {
  const base = getCompanionBaseUrl();
  if (!path.startsWith("/")) {
    return `${base}/${path}`;
  }
  return `${base}${path}`;
}
async function fetchJson(path, options = {}) {
  const url = buildApiUrl(path);
  const response = await fetch(url, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers || {}
    }
  });
  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch (error2) {
      payload = null;
    }
    const message = (payload == null ? void 0 : payload.message) || (payload == null ? void 0 : payload.error) || text || `Request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.url = url;
    if (payload) error.payload = payload;
    throw error;
  }
  if (response.status === 204) return null;
  return response.json();
}

// src/admin/upload-adapter.js
var NOT_CONFIGURED_MESSAGE = "Upload backend is not configured yet.";
var backendStatus = {
  configured: false,
  googleAuthorized: false,
  message: NOT_CONFIGURED_MESSAGE
};
var statusPromise = null;
function makeNotConfiguredError(action = "perform this operation") {
  const error = new Error(`${backendStatus.message || NOT_CONFIGURED_MESSAGE} Unable to ${action}.`);
  error.code = "BACKEND_NOT_CONFIGURED";
  return error;
}
function normalizeMode(mode) {
  return mode === "mods" ? "mods" : "store";
}
async function refreshBackendStatus(force = false) {
  if (statusPromise && !force) {
    return statusPromise;
  }
  statusPromise = (async () => {
    try {
      const status = await fetchJson("/api/status");
      backendStatus = {
        configured: Boolean(status == null ? void 0 : status.configured),
        googleAuthorized: Boolean(status == null ? void 0 : status.googleAuthorized),
        message: (status == null ? void 0 : status.message) || ((status == null ? void 0 : status.configured) ? "Upload backend ready." : NOT_CONFIGURED_MESSAGE),
        folders: (status == null ? void 0 : status.folders) || null,
        storeDbFileId: status == null ? void 0 : status.storeDbFileId
      };
    } catch (error) {
      backendStatus = {
        configured: false,
        googleAuthorized: false,
        message: (error == null ? void 0 : error.message) || NOT_CONFIGURED_MESSAGE,
        error
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
async function loadCatalogue(mode) {
  await ensureBackendConfigured();
  let list;
  try {
    list = await fetchJson(`/api/catalogue/${normalizeMode(mode)}`);
  } catch (error) {
    const status = await refreshBackendStatus(true).catch(() => null);
    if ((status == null ? void 0 : status.message) && error && typeof error === "object") {
      error.message = status.message;
    }
    throw error;
  }
  if (!Array.isArray(list)) return [];
  return list.map((entry) => ({
    ...entry,
    driveFiles: entry.driveFiles || {}
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

// src/store/catalogue.js
var NOT_CONFIGURED_MESSAGE2 = "Store backend is not configured yet.";
async function getAuthConfig() {
  return fetchJson("/api/auth/config", { credentials: "include" });
}
async function loginWithCredential(credential) {
  if (!credential) {
    throw new Error("Google credential is required.");
  }
  const response = await fetch(buildApiUrl("/api/auth/login"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential })
  });
  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText || "Login failed");
    throw new Error(text || "Google sign-in failed.");
  }
  return response.json().catch(() => ({ ok: true }));
}
async function logout() {
  await fetch(buildApiUrl("/api/auth/logout"), {
    method: "POST",
    credentials: "include"
  }).catch(() => {
  });
}
async function loadStoreItems2() {
  try {
    return await loadStoreItems();
  } catch (error) {
    const err = new Error((error == null ? void 0 : error.message) || NOT_CONFIGURED_MESSAGE2);
    err.code = (error == null ? void 0 : error.code) || "BACKEND_NOT_CONFIGURED";
    throw err;
  }
}
async function loadStoreMods2() {
  try {
    return await loadStoreMods();
  } catch (error) {
    const err = new Error((error == null ? void 0 : error.message) || NOT_CONFIGURED_MESSAGE2);
    err.code = (error == null ? void 0 : error.code) || "BACKEND_NOT_CONFIGURED";
    throw err;
  }
}
function getStoreBackendStatus() {
  try {
    return getBackendStatus();
  } catch (error) {
    console.warn("Failed to read backend status", error);
    return { configured: false, message: NOT_CONFIGURED_MESSAGE2 };
  }
}
async function submitPublicVideo(itemId, url, title, submittedBy) {
  return fetchJson("/api/public/submit-video", {
    method: "POST",
    body: JSON.stringify({ itemId, url, title, submittedBy })
  });
}
var VortexStoreBackend = {
  loadStoreItems: loadStoreItems2,
  loadStoreMods: loadStoreMods2,
  getStatus: getStoreBackendStatus,
  submitPublicVideo,
  getAuthConfig,
  loginWithCredential,
  logout
};
if (typeof window !== "undefined") {
  window.VortexStoreBackend = VortexStoreBackend;
}
var catalogue_default = VortexStoreBackend;
export {
  catalogue_default as default
};
//# sourceMappingURL=store-catalogue.js.map
