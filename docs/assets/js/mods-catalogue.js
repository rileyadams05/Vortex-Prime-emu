const API_BASE = window.location.origin;
const CATALOGUE_URL = new URL("/mods/mods.json", window.location.origin).toString();

async function loadMods() {
  const response = await fetch(CATALOGUE_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`The community catalogue could not be loaded (HTTP ${response.status}).`);
  }
  const payload = await response.json();
  return Array.isArray(payload) ? payload : Array.isArray(payload.mods) ? payload.mods : [];
}

function getStatus() {
  return {
    configured: true,
    storage: "repository",
    message: "The catalogue is served as a static file from this website."
  };
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch (_) {}
    const serverMessage = payload && typeof payload === "object"
      ? (typeof payload.message === "string" ? payload.message : typeof payload.error === "string" ? payload.error : "")
      : "";
    throw new Error(serverMessage || `Request failed (HTTP ${response.status}).`);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function getAuthConfig() {
  return request("/api/auth/config");
}

async function loginWithCredential(credential) {
  if (!credential) throw new Error("Google credential is required.");
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ credential }),
  });
}

async function logout() {
  return request("/api/auth/logout", { method: "POST" }).catch(() => null);
}

async function submitPublicVideo() {
  throw new Error("Community tutorial submissions are paused.");
}

window.VortexModsBackend = {
  loadMods,
  getStatus,
  submitPublicVideo,
  getAuthConfig,
  loginWithCredential,
  logout,
};
