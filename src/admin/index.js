import AdminBackend from "./portal.js";
import {
  uploadPackage,
  uploadMod,
  uploadImage,
  uploadReadme,
  saveStoreItem,
  deleteStoreItem,
  loadStoreItems,
  loadStoreMods,
  getBackendStatus,
} from "./upload-adapter.js";
import { createUploadFieldManager } from "./upload-manager.js";

const VortexUploadAdapter = {
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

if (typeof window !== "undefined") {
  window.AdminBackend = AdminBackend;
  window.VortexUploadManager = { createUploadFieldManager };
  window.VortexUploadAdapter = VortexUploadAdapter;
}

export { createUploadFieldManager };
export {
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
export const AdminUploadAdapter = VortexUploadAdapter;
export default AdminBackend;
