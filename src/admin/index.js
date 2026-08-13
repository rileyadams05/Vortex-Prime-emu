import AdminBackend from "./portal.js";
import {
  uploadMod,
  uploadImage,
  uploadReadme,
  saveStoreItem,
  deleteStoreItem,
  loadStoreMods,
  getBackendStatus,
} from "./upload-adapter.js";
import { createUploadFieldManager } from "./upload-manager.js";

const VortexUploadAdapter = {
  uploadMod,
  uploadImage,
  uploadReadme,
  saveStoreItem,
  deleteStoreItem,
  loadStoreMods,
  getBackendStatus,
};

if (typeof window !== "undefined") {
  window.AdminBackend = AdminBackend;
  window.VortexUploadManager = { createUploadFieldManager };
  window.VortexUploadAdapter = VortexUploadAdapter;
  window.dispatchEvent(new CustomEvent("vortex-admin-portal-loaded"));
}

export { createUploadFieldManager };
export {
  uploadMod,
  uploadImage,
  uploadReadme,
  saveStoreItem,
  deleteStoreItem,
  loadStoreMods,
  getBackendStatus,
};
export const AdminUploadAdapter = VortexUploadAdapter;
export default AdminBackend;
