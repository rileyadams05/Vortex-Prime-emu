import { openAuthWindow } from "../backend/config.js";
import {
  refreshBackendStatus,
  ensureBackendConfigured,
  loadStoreItems as adapterLoadStoreItems,
  loadStoreMods as adapterLoadStoreMods,
  saveStoreItem as adapterSaveStoreItem,
  deleteStoreItem as adapterDeleteStoreItem,
  getBackendStatus,
} from "./upload-adapter.js";

const NOT_CONFIGURED_MESSAGE = "Upload backend is not configured yet.";

const readyCallbacks = new Set();
const authCallbacks = new Set();

let readyResolved = false;
let initialisePromise = null;

function invokeSafely(callback, payload) {
  if (typeof callback !== "function") return;
  try {
    callback(payload);
  } catch (error) {
    console.error("Admin backend callback failed", error);
  }
}

function buildAuthState() {
  const status = getBackendStatus();
  if (!status.configured) {
    return {
      user: null,
      isAdmin: false,
      status: "backend_not_configured",
      message: status.message || NOT_CONFIGURED_MESSAGE,
    };
  }
  return {
    user: {
      displayName: "Drive Admin",
      email: "drive-admin@vortex-prime.local",
      photoURL: null,
    },
    isAdmin: true,
    status: "ready",
    message: status.message || "Upload backend ready.",
  };
}

function notifyReady() {
  readyResolved = true;
  readyCallbacks.forEach((callback) => {
    queueMicrotask(() => invokeSafely(callback, AdminBackend));
  });
  readyCallbacks.clear();
}

function notifyAuth() {
  const payload = buildAuthState();
  authCallbacks.forEach((callback) => {
    queueMicrotask(() => invokeSafely(callback, payload));
  });
}

async function initialise(force = false) {
  if (initialisePromise && !force) {
    return initialisePromise;
  }

  initialisePromise = (async () => {
    await refreshBackendStatus(force);
    const status = getBackendStatus();
    AdminBackend.isConfigured = Boolean(status.configured);
    AdminBackend.status = status.configured ? "ready" : "backend_not_configured";
    AdminBackend.message = status.message || (status.configured ? "Upload backend ready." : NOT_CONFIGURED_MESSAGE);
    notifyAuth();
    notifyReady();
    return AdminBackend;
  })().finally(() => {
    initialisePromise = null;
  });

  return initialisePromise;
}

const AdminBackend = {
  isConfigured: false,
  status: "initialising",
  message: "Checking backend status…",
  async refresh() {
    return initialise(true);
  },
  onReady(callback) {
    if (typeof callback !== "function") return;
    if (readyResolved) {
      queueMicrotask(() => invokeSafely(callback, AdminBackend));
      return;
    }
    readyCallbacks.add(callback);
    initialise().catch((error) => {
      console.error("Admin backend initialisation failed", error);
    });
  },
  onAuthChanged(callback) {
    if (typeof callback !== "function") return () => {};
    authCallbacks.add(callback);
    queueMicrotask(() => invokeSafely(callback, buildAuthState()));
    initialise().catch((error) => {
      console.error("Admin backend initialisation failed", error);
    });
    return () => authCallbacks.delete(callback);
  },
  async signInWithGoogle() {
    const url = openAuthWindow("/auth/google/start");
    return url;
  },
  async signOut() {
    return;
  },
  async fetchItems(mode) {
    await initialise();
    await ensureBackendConfigured();
    return mode === "mods" ? adapterLoadStoreMods() : adapterLoadStoreItems();
  },
  async saveItem(mode, item, currentUser) {
    await initialise();
    await ensureBackendConfigured();
    const saved = await adapterSaveStoreItem(mode, item, currentUser);
    await refreshBackendStatus().catch(() => {});
    AdminBackend.isConfigured = true;
    AdminBackend.status = "ready";
    notifyAuth();
    return saved;
  },
  async deleteItem(mode, item) {
    await initialise();
    await ensureBackendConfigured();
    await adapterDeleteStoreItem(mode, item);
  },
  isAdminEmail(email) {
    if (!email) return false;
    return true;
  },
  getStatus() {
    return getBackendStatus();
  },
};

if (typeof window !== "undefined") {
  window.AdminBackend = AdminBackend;
}

initialise().catch((error) => {
  console.error("Failed to initialise admin backend", error);
});

export default AdminBackend;
