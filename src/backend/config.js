const DEFAULT_LOCAL_PORT = 4100;
const PRODUCTION_BASE_URL = 'https://vortex-prime-emu.com';

function readGlobal(name) {
  if (typeof globalThis !== 'undefined' && globalThis[name]) {
    return String(globalThis[name]);
  }
  return null;
}

function readMeta(name) {
  if (typeof document === 'undefined') return null;
  const el = document.querySelector(`meta[name="${name}"]`);
  return el?.content ? el.content.trim() : null;
}

function readEnv(name) {
  if (typeof process !== 'undefined' && process.env && process.env[name]) {
    return String(process.env[name]);
  }
  return null;
}

function readStored() {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage?.getItem('vortex-companion-base-url') || null;
  } catch (error) {
    return null;
  }
}

function resolveDefaultBase() {
  if (typeof window === 'undefined' || !window?.location) {
    return PRODUCTION_BASE_URL;
  }
  const { protocol, hostname } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//${hostname}:${DEFAULT_LOCAL_PORT}`;
  }
  return PRODUCTION_BASE_URL;
}

export function getCompanionBaseUrl() {
  const fromGlobal = readGlobal('__VORTEX_COMPANION_BASE_URL__');
  const fromMeta = readMeta('vortex-companion-base-url');
  const fromEnv = readEnv('VORTEX_COMPANION_BASE_URL');
  const fromStored = readStored();
  const value = fromGlobal || fromMeta || fromStored || fromEnv;
  if (value) {
    return value.replace(/\/$/, '');
  }
  return resolveDefaultBase();
}

export function buildApiUrl(path) {
  const base = getCompanionBaseUrl();
  if (!path.startsWith('/')) {
    return `${base}/${path}`;
  }
  return `${base}${path}`;
}

export async function fetchJson(path, options = {}) {
  const url = buildApiUrl(path);
  const response = await fetch(url, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch (error) {
      payload = null;
    }
    const message =
      payload?.message ||
      payload?.error ||
      text ||
      `Request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.url = url;
    if (payload) error.payload = payload;
    throw error;
  }
  if (response.status === 204) return null;
  return response.json();
}

export function openAuthWindow(path) {
  const url = buildApiUrl(path);
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener');
  }
  return url;
}

export function fetchCompanionStatus(options = {}) {
  return fetchJson('/api/status', options);
}
