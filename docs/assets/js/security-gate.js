const ALLOWED_HOSTS = new Set([
  "github.com",
  "raw.githubusercontent.com",
  "objects.githubusercontent.com",
  "archive.org",
  "reddit.com",
  "www.reddit.com",
]);

const INTERNAL_HOST_SUFFIX = ".vortex-prime-emu.com";
const SECURITY_PATH = "/security-check/";
const PARAM_NAME = "to";
const CURRENT_ORIGIN = window.location.origin;

function isAllowedExternal(targetUrl) {
  try {
    const parsed = targetUrl instanceof URL ? targetUrl : new URL(targetUrl);
    const host = parsed.hostname.toLowerCase();
    if (ALLOWED_HOSTS.has(host)) return true;
    return [...ALLOWED_HOSTS].some((allowed) => host.endsWith(`.${allowed}`));
  } catch (error) {
    return false;
  }
}

function encodeTarget(url) {
  try {
    return encodeURIComponent(url instanceof URL ? url.href : url);
  } catch (error) {
    return encodeURIComponent(String(url));
  }
}

function rewriteAnchor(anchor) {
  if (!anchor || anchor.dataset.securityChecked === "true") return;
  if (anchor.dataset.noGate === "true") {
    anchor.dataset.securityChecked = "true";
    return;
  }

  const href = anchor.getAttribute("href");
  if (!href) return;

  const normalized = href.trim();
  if (!normalized) return;

  if (
    normalized.startsWith("#") ||
    normalized.startsWith("mailto:") ||
    normalized.startsWith("tel:") ||
    normalized.startsWith("javascript:")
  ) {
    anchor.dataset.securityChecked = "true";
    return;
  }

  let targetUrl;
  try {
    targetUrl = new URL(normalized, CURRENT_ORIGIN);
  } catch (error) {
    anchor.dataset.securityChecked = "true";
    return;
  }

  if (targetUrl.pathname.startsWith(SECURITY_PATH)) {
    anchor.dataset.securityChecked = "true";
    return;
  }

  if (targetUrl.origin === CURRENT_ORIGIN || targetUrl.hostname.endsWith(INTERNAL_HOST_SUFFIX)) {
    anchor.dataset.securityChecked = "true";
    return;
  }

  if (!(targetUrl.protocol === "http:" || targetUrl.protocol === "https:")) {
    anchor.dataset.securityChecked = "true";
    return;
  }

  if (!isAllowedExternal(targetUrl)) {
    anchor.dataset.securityChecked = "true";
    return;
  }

  anchor.dataset.originalHref = targetUrl.href;
  anchor.href = `${SECURITY_PATH}?${PARAM_NAME}=${encodeTarget(targetUrl)}`;
  anchor.dataset.securityChecked = "true";
}

function processAnchors(root = document) {
  if (!root || typeof root.querySelectorAll !== "function") return;
  root.querySelectorAll("a[href]").forEach(rewriteAnchor);
}

function observeMutations() {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        if (node.matches?.("a[href]")) {
          rewriteAnchor(node);
        }
        processAnchors(node);
      });
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    processAnchors();
    observeMutations();
  });
} else {
  processAnchors();
  observeMutations();
}
