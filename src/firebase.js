const NOT_CONFIGURED_MESSAGE = "Firebase backend has been disabled for this project.";

function notConfigured(functionName = "use this Firebase helper") {
  const error = new Error(`${NOT_CONFIGURED_MESSAGE} Unable to ${functionName}.`);
  error.code = "BACKEND_NOT_CONFIGURED";
  throw error;
}

export const app = null;
export const auth = null;
export const db = null;
export const storage = null;
export const googleProvider = null;
export const analytics = null;

export function signInWithPopup() {
  return notConfigured("sign in with Google");
}

export function signOut() {
  return notConfigured("sign out");
}

export function onAuthStateChanged() {
  return notConfigured("subscribe to auth changes");
}

export function collection() {
  return notConfigured("access collections");
}

export function doc() {
  return notConfigured("access documents");
}

export function getDoc() {
  return notConfigured("load documents");
}

export function getDocs() {
  return notConfigured("load documents");
}

export function addDoc() {
  return notConfigured("create documents");
}

export function setDoc() {
  return notConfigured("save documents");
}

export function updateDoc() {
  return notConfigured("update documents");
}

export function deleteDoc() {
  return notConfigured("delete documents");
}

export function query() {
  return notConfigured("query collections");
}

export function where() {
  return notConfigured("filter documents");
}

export function orderBy() {
  return notConfigured("order documents");
}

export function onSnapshot() {
  return notConfigured("observe collections");
}

export function serverTimestamp() {
  return notConfigured("generate timestamps");
}

export function Timestamp() {
  notConfigured("use Firestore timestamps");
}

export function ref() {
  return notConfigured("reference storage objects");
}

export function uploadBytes() {
  return notConfigured("upload bytes");
}

export function uploadBytesResumable() {
  return notConfigured("upload bytes resumably");
}

export function getDownloadURL() {
  return notConfigured("read download URLs");
}

export function deleteObject() {
  return notConfigured("delete storage objects");
}
