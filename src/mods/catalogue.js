import {
  loadStoreMods as adapterLoadMods,
  getBackendStatus,
} from "../admin/upload-adapter.js";
import { buildApiUrl, fetchJson } from "../backend/config.js";

const NOT_CONFIGURED_MESSAGE = "Mods backend is not configured yet.";

async function getAuthConfig() {
  return fetchJson("/api/auth/config", { credentials: "include" });
}

async function loginWithCredential(credential) {
  if (!credential) throw new Error("Google credential is required.");
  const response = await fetch(buildApiUrl("/api/auth/login"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  });
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText || "Login failed");
    throw new Error(message || "Google sign-in failed.");
  }
  return response.json().catch(() => ({ ok: true }));
}

async function logout() {
  await fetch(buildApiUrl("/api/auth/logout"), {
    method: "POST",
    credentials: "include",
  }).catch(() => {});
}

async function loadMods() {
  try {
    return await adapterLoadMods();
  } catch (error) {
    const wrapped = new Error(error?.message || NOT_CONFIGURED_MESSAGE);
    wrapped.code = error?.code || "BACKEND_NOT_CONFIGURED";
    throw wrapped;
  }
}

function getStatus() {
  try {
    return getBackendStatus();
  } catch (error) {
    console.warn("Failed to read mods backend status", error);
    return { configured: false, message: NOT_CONFIGURED_MESSAGE };
  }
}

async function submitPublicVideo(itemId, url, title, submittedBy) {
  return fetchJson("/api/public/submit-video", {
    method: "POST",
    body: JSON.stringify({ itemId, url, title, submittedBy }),
  });
}

const VortexModsBackend = {
  loadMods,
  getStatus,
  submitPublicVideo,
  getAuthConfig,
  loginWithCredential,
  logout,
};

if (typeof window !== "undefined") window.VortexModsBackend = VortexModsBackend;

export default VortexModsBackend;
