const API_BASE = "https://vortex-prime-emu.com";
const NOT_CONFIGURED_MESSAGE = "Mods backend is not configured yet.";

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
    const contentType = response.headers.get("content-type") || "";
    const serverMessage = payload && typeof payload === "object"
      ? (typeof payload.message === "string" ? payload.message : typeof payload.error === "string" ? payload.error : "")
      : "";
    const safeMessage = !contentType.includes("text/html") && serverMessage && !/<[a-z][\s\S]*>/i.test(serverMessage)
      ? serverMessage.slice(0, 240)
      : `The community catalogue is temporarily unavailable (HTTP ${response.status}). Please try again later.`;
    throw new Error(safeMessage);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function loadMods() {
  const items = await request("/api/catalogue/mods");
  return Array.isArray(items) ? items : [];
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

async function getStatus() {
  try {
    return await request("/api/status");
  } catch (error) {
    return { configured: false, message: error?.message || NOT_CONFIGURED_MESSAGE };
  }
}

async function submitPublicVideo(itemId, url, title, submittedBy) {
  return request("/api/public/submit-video", {
    method: "POST",
    body: JSON.stringify({ itemId, url, title, submittedBy }),
  });
}

window.VortexModsBackend = {
  loadMods,
  getStatus,
  submitPublicVideo,
  getAuthConfig,
  loginWithCredential,
  logout,
};
