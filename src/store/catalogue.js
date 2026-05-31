import {
  loadStoreItems as adapterLoadStoreItems,
  loadStoreMods as adapterLoadStoreMods,
  getBackendStatus,
} from "../admin/upload-adapter.js";
import { fetchJson } from "../backend/config.js";

const NOT_CONFIGURED_MESSAGE = "Store backend is not configured yet.";

async function loadStoreItems() {
  try {
    return await adapterLoadStoreItems();
  } catch (error) {
    const err = new Error(error?.message || NOT_CONFIGURED_MESSAGE);
    err.code = error?.code || "BACKEND_NOT_CONFIGURED";
    throw err;
  }
}

async function loadStoreMods() {
  try {
    return await adapterLoadStoreMods();
  } catch (error) {
    const err = new Error(error?.message || NOT_CONFIGURED_MESSAGE);
    err.code = error?.code || "BACKEND_NOT_CONFIGURED";
    throw err;
  }
}

function getStoreBackendStatus() {
  try {
    return getBackendStatus();
  } catch (error) {
    console.warn("Failed to read backend status", error);
    return { configured: false, message: NOT_CONFIGURED_MESSAGE };
  }
}

async function submitPublicVideo(itemId, url, title, submittedBy) {
  return fetchJson("/api/public/submit-video", {
    method: "POST",
    body: JSON.stringify({ itemId, url, title, submittedBy }),
  });
}

const VortexStoreBackend = {
  loadStoreItems,
  loadStoreMods,
  getStatus: getStoreBackendStatus,
  submitPublicVideo,
};

if (typeof window !== "undefined") {
  window.VortexStoreBackend = VortexStoreBackend;
}

export default VortexStoreBackend;
