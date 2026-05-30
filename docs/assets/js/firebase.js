// src/firebase.js
var NOT_CONFIGURED_MESSAGE = "Firebase backend has been disabled for this project.";
function notConfigured(functionName = "use this Firebase helper") {
  const error = new Error(`${NOT_CONFIGURED_MESSAGE} Unable to ${functionName}.`);
  error.code = "BACKEND_NOT_CONFIGURED";
  throw error;
}
var app = null;
var auth = null;
var db = null;
var storage = null;
var googleProvider = null;
var analytics = null;
function signInWithPopup() {
  return notConfigured("sign in with Google");
}
function signOut() {
  return notConfigured("sign out");
}
function onAuthStateChanged() {
  return notConfigured("subscribe to auth changes");
}
function collection() {
  return notConfigured("access collections");
}
function doc() {
  return notConfigured("access documents");
}
function getDoc() {
  return notConfigured("load documents");
}
function getDocs() {
  return notConfigured("load documents");
}
function addDoc() {
  return notConfigured("create documents");
}
function setDoc() {
  return notConfigured("save documents");
}
function updateDoc() {
  return notConfigured("update documents");
}
function deleteDoc() {
  return notConfigured("delete documents");
}
function query() {
  return notConfigured("query collections");
}
function where() {
  return notConfigured("filter documents");
}
function orderBy() {
  return notConfigured("order documents");
}
function onSnapshot() {
  return notConfigured("observe collections");
}
function serverTimestamp() {
  return notConfigured("generate timestamps");
}
function Timestamp() {
  notConfigured("use Firestore timestamps");
}
function ref() {
  return notConfigured("reference storage objects");
}
function uploadBytes() {
  return notConfigured("upload bytes");
}
function uploadBytesResumable() {
  return notConfigured("upload bytes resumably");
}
function getDownloadURL() {
  return notConfigured("read download URLs");
}
function deleteObject() {
  return notConfigured("delete storage objects");
}
export {
  Timestamp,
  addDoc,
  analytics,
  app,
  auth,
  collection,
  db,
  deleteDoc,
  deleteObject,
  doc,
  getDoc,
  getDocs,
  getDownloadURL,
  googleProvider,
  onAuthStateChanged,
  onSnapshot,
  orderBy,
  query,
  ref,
  serverTimestamp,
  setDoc,
  signInWithPopup,
  signOut,
  storage,
  updateDoc,
  uploadBytes,
  uploadBytesResumable,
  where
};
//# sourceMappingURL=firebase.js.map
