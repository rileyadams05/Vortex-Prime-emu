/**
 * Decode a query parameter that may have been encoded multiple times or base64 wrapped.
 * @param {string} value
 */
export function decodeQuery(value) {
  if (!value) return "";

  let decoded = value;
  try {
    decoded = decodeURIComponent(decoded);
  } catch (error) {
    // noop, keep original if decodeURIComponent fails
  }

  try {
    // Support basic base64 strings (with or without padding)
    const normalized = decoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    decoded = atob(padded);
  } catch (error) {
    // ignore when not base64
  }

  return decoded.trim();
}

/**
 * Check if the host is inside the allow-list (exact match or subdomain of allow-list entry).
 * @param {string} host
 * @param {Set<string>} allowList
 */
export function isAllowedHost(host, allowList) {
  if (!host) return false;
  const lower = host.toLowerCase();

  if (allowList.has(lower)) return true;

  for (const allowed of allowList) {
    if (lower === allowed) return true;
    if (lower.endsWith(`.${allowed}`)) return true;
  }

  return false;
}

/**
 * Attempt to open a destination in a new tab (in addition to navigation fallback).
 * @param {URL} target
 */
export function safeWindowOpen(target) {
  try {
    const ref = window.open(target.href, "_blank", "noopener,noreferrer");
    ref?.focus?.();
  } catch (error) {
    console.warn("Failed to open new window for", target.href, error);
  }
}
