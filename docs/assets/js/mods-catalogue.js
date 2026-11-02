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

async function submitPublicVideo() {
  throw new Error("Community tutorial submissions are paused.");
}

window.VortexModsBackend = { loadMods, getStatus, submitPublicVideo };
