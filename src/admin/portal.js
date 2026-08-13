import { buildApiUrl, fetchJson } from "../backend/config.js";
import {
  refreshBackendStatus,
  ensureBackendConfigured,
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
let authStatePromise = null;

let authState = {
  user: null,
  isAdmin: false,
  status: "initialising",
  message: "Checking backend and authentication…",
  googleClientId: null,
};

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
  const configured = Boolean(status?.configured);
  if (!configured) {
    return {
      ...authState,
      user: null,
      isAdmin: false,
      status: "backend_not_configured",
      message: status?.message || NOT_CONFIGURED_MESSAGE,
    };
  }
  return {
    ...authState,
    status: authState.user ? "ready" : "requires_auth",
    message: authState.message || (authState.user ? "Upload backend ready." : "Sign in with Google to continue."),
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
    await refreshAuthState(force);
    const status = getBackendStatus();
    AdminBackend.isConfigured = Boolean(status.configured);
    const authInfo = buildAuthState();
    AdminBackend.status = authInfo.status;
    AdminBackend.message = authInfo.message;
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
  googleClientId: null,
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
  getGoogleClientId() {
    return authState.googleClientId;
  },
  getAuthState() {
    return { ...buildAuthState() };
  },
  async loginWithCredential(credential) {
    if (!credential) {
      throw new Error("Google credential is required.");
    }
    const response = await fetch(buildApiUrl("/api/auth/login"), {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ credential }),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText || "Login failed");
      throw new Error(text || "Google sign-in failed.");
    }
    await refreshAuthState(true);
    notifyAuth();
    return buildAuthState();
  },
  async logout() {
    await fetch(buildApiUrl("/api/auth/logout"), {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
    await refreshAuthState(true);
    notifyAuth();
  },
  async signInWithGoogle() {
    throw new Error("Google sign-in is handled by the page script.");
  },
  async signOut() {
    await AdminBackend.logout();
  },
  async fetchItems(mode) {
    await initialise();
    await ensureBackendConfigured();
    if (!authState.user) {
      throw new Error("Sign in with Google to view catalogue items.");
    }
    if (!authState.isAdmin) {
      throw new Error("Admin access required to manage catalogue entries.");
    }
    return adapterLoadStoreMods();
  },
  async saveItem(mode, item, currentUser) {
    await initialise();
    await ensureBackendConfigured();
    if (!authState.user) {
      throw new Error("Sign in with Google to upload content.");
    }
    if (!authState.isAdmin) {
      throw new Error("Admin privileges required to update catalogue entries.");
    }
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
    if (!authState.user) {
      throw new Error("Sign in with Google to manage catalogue content.");
    }
    if (!authState.isAdmin) {
      throw new Error("Admin privileges required to delete catalogue entries.");
    }
    await adapterDeleteStoreItem(mode, item);
  },
  isAdminEmail(email) {
    if (!email) return false;
    return Boolean(authState?.isAdmin && authState.user?.email === email);
  },
  getStatus() {
    return getBackendStatus();
  },
};

if (typeof window !== "undefined") {
  window.AdminBackend = AdminBackend;
}

async function refreshAuthState(force = false) {
  if (authStatePromise && !force) {
    return authStatePromise;
  }

  authStatePromise = (async () => {
    try {
      const data = await fetchJson("/api/auth/config", { credentials: "include" });
      const user = data?.user || null;
      authState = {
        user,
        isAdmin: Boolean(user?.role === "admin"),
        status: user ? "ready" : "requires_auth",
        message: user ? "Signed in with Google." : "Google sign-in required to upload.",
        googleClientId: data?.googleClientId || null,
      };
      AdminBackend.googleClientId = authState.googleClientId;
    } catch (error) {
      console.warn("Failed to refresh auth state", error);
      authState = {
        user: null,
        isAdmin: false,
        status: "auth_error",
        message: error?.message || "Unable to check Google sign-in status.",
        googleClientId: authState.googleClientId || null,
      };
    }
    return authState;
  })().finally(() => {
    authStatePromise = null;
  });

  return authStatePromise;
}

initialise().catch((error) => {
  console.error("Failed to initialise admin backend", error);
});

export default AdminBackend;
