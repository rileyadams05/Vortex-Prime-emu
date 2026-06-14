import { decodeQuery, isAllowedHost, safeWindowOpen } from "../shared/security-utils.js";

const allowedHosts = new Set([
  "github.com",
  "raw.githubusercontent.com",
  "objects.githubusercontent.com",
  "archive.org",
  "reddit.com",
  "www.reddit.com",
]);

const params = new URLSearchParams(window.location.search);
const targetParam = params.get("to");

const card = document.getElementById("security-card");
const destinationHost = document.getElementById("destination-host");
const destinationUrl = document.getElementById("destination-url");
const continueBtn = document.getElementById("continue-btn");
const cancelBtn = document.getElementById("cancel-btn");
const feedback = document.getElementById("challenge-feedback");
const errorTemplate = /** @type {HTMLTemplateElement} */ (document.getElementById("error-template"));

const RECAPTCHA_SITE_KEY = "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI";

let resolvedTarget = null;
let isLoggedIn = false;
let reCaptchaPassed = false;
let authEndpointStatus = "unknown"; // "unknown", "exists", "missing", "error"

/**
 * Dynamically resolves the lock icon source to avoid broken image links
 * when paths vary between environments (local root server vs. GitHub Pages custom domain).
 */
function fixLockIcon() {
  const badgeImg = document.querySelector(".badge img");
  if (badgeImg) {
    const path = window.location.pathname;
    if (path.includes("/VortexPrimeStore/docs/")) {
      badgeImg.src = "/VortexPrimeStore/docs/assets/locked.png";
    } else if (path.includes("/docs/")) {
      badgeImg.src = "/docs/assets/locked.png";
    } else {
      // Custom domain (e.g. vortex-prime-emu.com) mapping docs/ to the root
      badgeImg.src = "/assets/locked.png";
    }
  }
}

function renderError(message) {
  const fragment = errorTemplate.content.cloneNode(true);
  const errorCard = fragment.querySelector(".error-card");
  const messageEl = fragment.getElementById("error-message");
  const backBtn = fragment.getElementById("error-back");

  if (messageEl) messageEl.textContent = message;
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.assign("/");
      }
    });
  }

  card?.replaceWith(errorCard);
}

function prepareDestination() {
  if (!targetParam) {
    renderError("Missing destination parameter.");
    return;
  }

  try {
    const decoded = decodeQuery(targetParam);
    const url = new URL(decoded);

    if (!isAllowedHost(url.hostname, allowedHosts)) {
      renderError("This destination hasn't been approved yet. Contact Vortex Prime maintainers to review the link.");
      return;
    }

    destinationHost.textContent = url.hostname;
    destinationUrl.textContent = url.href;
    resolvedTarget = url;
  } catch (error) {
    console.error("Failed to parse destination", error);
    renderError("The external link appears malformed. Please try again or contact support.");
  }
}

/**
 * Check if the user is authenticated.
 * Separates local testing behaviour from production.
 * Live production does NOT allow URL/localStorage parameters for authentication.
 */
async function checkLoginState() {
  const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  
  if (isLocal) {
    console.log("[Security Gate] Running in LOCAL testing mode.");
    // Allow URL parameter overrides only during local testing
    if (params.get("authed") === "1" || params.get("logged_in") === "1" || params.get("user")) {
      console.log("[Security Gate] Local test bypass active (URL parameter).");
      return true;
    }
    // Allow localStorage bypass overrides only during local testing
    try {
      if (localStorage.getItem("user") || localStorage.getItem("authed") === "true") {
        console.log("[Security Gate] Local test bypass active (localStorage).");
        return true;
      }
    } catch (e) {}
  } else {
    console.log("[Security Gate] Running in PRODUCTION mode. Bypasses are strictly disabled.");
  }

  // Real production authentication check
  try {
    const res = await fetch("/api/auth/config", { credentials: "include" });
    if (res.status === 404) {
      authEndpointStatus = "missing";
      return false;
    }
    authEndpointStatus = "exists";
    if (res.ok) {
      const data = await res.json();
      if (data && data.user) {
        return true;
      }
    }
  } catch (err) {
    console.warn("[Security Gate] Failed to contact authentication service:", err);
    authEndpointStatus = "error";
  }

  return false;
}

/**
 * Executes Google reCAPTCHA v3 verification.
 * @returns {Promise<boolean>}
 */
function executeReCaptcha() {
  return new Promise((resolve) => {
    if (typeof grecaptcha === "undefined") {
      console.error("reCAPTCHA library not loaded.");
      resolve(false);
      return;
    }

    grecaptcha.ready(() => {
      grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: "security_check" })
        .then((token) => {
          if (token) {
            resolve(true);
          } else {
            resolve(false);
          }
        })
        .catch((err) => {
          console.error("reCAPTCHA execution failed:", err);
          resolve(false);
        });
    });
  });
}

/**
 * Main entrance logic for the security check gate.
 * Requires BOTH: login status / authentication AND Google reCAPTCHA v3 verification.
 */
async function runSecurityGate() {
  fixLockIcon();
  prepareDestination();

  // 1. Check if user is logged in
  isLoggedIn = await checkLoginState();

  const spinner = document.getElementById("verification-spinner");
  const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

  // Check if endpoint does not exist and we are not locally bypassed
  if (authEndpointStatus === "missing" && (!isLocal || !isLoggedIn)) {
    if (spinner) spinner.style.display = "none";
    if (feedback) {
      feedback.textContent = "Authentication service endpoint does not exist on this server.";
      feedback.style.color = "#ff7b7b"; // danger color
    }
    if (continueBtn) continueBtn.disabled = true;
    return;
  }

  if (!isLoggedIn) {
    // Hide spinner and show sign in error message
    if (spinner) spinner.style.display = "none";
    if (feedback) {
      feedback.textContent = "Please sign in before continuing.";
      feedback.style.color = "#ff7b7b"; // danger color
    }
    if (continueBtn) continueBtn.disabled = true;
    return;
  }

  // 2. Run Google reCAPTCHA v3 since the user is logged in
  reCaptchaPassed = await executeReCaptcha();

  // Hide spinner after verification complete
  if (spinner) spinner.style.display = "none";

  if (!reCaptchaPassed) {
    if (feedback) {
      feedback.textContent = "Verification failed. Please try again.";
      feedback.style.color = "#ff7b7b"; // danger color
    }
    if (continueBtn) continueBtn.disabled = true;
  } else {
    // Both checks pass
    if (feedback) {
      feedback.textContent = "Verification successful. You can now continue.";
      feedback.style.color = "#22c55e"; // success color
    }
    if (continueBtn) {
      continueBtn.disabled = !resolvedTarget;
      continueBtn.focus({ preventScroll: true });
    }
  }
}

function attachActions() {
  continueBtn?.addEventListener("click", () => {
    if (!resolvedTarget || !isLoggedIn || !reCaptchaPassed) return;
    safeWindowOpen(resolvedTarget);
    window.location.assign(resolvedTarget.href);
  });

  cancelBtn?.addEventListener("click", () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.assign("/");
    }
  });
}

runSecurityGate();
attachActions();
