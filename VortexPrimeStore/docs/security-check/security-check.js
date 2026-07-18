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
let googleClientId = null;
let googleSignInInitialized = false;

/**
 * Resolves API base URLs dynamically depending on the execution environment.
 * In local dev, handles proxying requests to the companion server on port 4100.
 */
function buildApiUrl(path) {
  return `https://vortex-prime-emu.com${path}`;
}

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
  console.log("[Security Gate] Running in PRODUCTION mode. Bypasses are strictly disabled.");

  // Real production authentication check
  try {
    const configUrl = buildApiUrl("/api/auth/config");
    const res = await fetch(configUrl, { credentials: "include" });
    if (res.status === 404) {
      authEndpointStatus = "missing";
      return false;
    }
    authEndpointStatus = "exists";
    if (res.ok) {
      const data = await res.json();
      if (data) {
        if (data.googleClientId) {
          googleClientId = data.googleClientId;
        }
        if (data.user) {
          return true;
        }
      }
    }
  } catch (err) {
    console.warn("[Security Gate] Failed to contact authentication service:", err);
    authEndpointStatus = "error";
  }

  return false;
}

/**
 * Initializes the Google Sign-in widget and triggers One-Tap.
 */
function initGoogleSignIn(clientId) {
  if (!clientId || googleSignInInitialized) return;
  if (!(window.google && window.google.accounts && window.google.accounts.id)) {
    setTimeout(() => initGoogleSignIn(clientId), 150);
    return;
  }
  
  googleSignInInitialized = true;
  window.google.accounts.id.initialize({
    client_id: clientId,
    auto_select: true,
    callback: async (response) => {
      try {
        const loginUrl = buildApiUrl("/api/auth/login");
        const res = await fetch(loginUrl, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credential: response.credential }),
        });
        if (res.ok) {
          // Re-run security gate verification
          runSecurityGate();
        } else {
          const text = await res.text().catch(() => "Login failed");
          alert("Google sign-in failed: " + text);
        }
      } catch (error) {
        console.error("Google sign-in failed:", error);
        alert("Google sign-in failed. Please try again.");
      }
    },
  });

  // Render official Google button in the slot
  const slot = document.getElementById("googleBtnSlot");
  if (slot) {
    slot.innerHTML = "";
    slot.style.display = "inline-flex";
    window.google.accounts.id.renderButton(slot, {
      theme: "filled_black",
      size: "large",
      shape: "pill",
      text: "signin_with",
    });
  }
  
  // Hide fallback custom button if official button is rendering
  const customBtn = document.getElementById("googleSignInBtn");
  if (customBtn) {
    customBtn.style.display = "none";
  }

  // Prompt One-Tap
  window.google.accounts.id.prompt();
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

  const spinner = document.getElementById("verification-spinner");
  const warningIcon = document.getElementById("warning-icon");
  const customBtn = document.getElementById("googleSignInBtn");
  const slot = document.getElementById("googleBtnSlot");

  // Show spinner, hide warning icon and buttons on start
  if (spinner) spinner.style.display = "block";
  if (warningIcon) warningIcon.style.display = "none";
  if (customBtn) customBtn.style.display = "none";
  if (slot) slot.style.display = "none";
  if (feedback) {
    feedback.textContent = "Verifying browser safety...";
    feedback.className = "challenge-feedback";
    feedback.style.color = "var(--text-muted)";
  }

  // 1. Check if user is logged in
  isLoggedIn = await checkLoginState();
  // Check if the production endpoint does not exist.
  if (authEndpointStatus === "missing" && !isLoggedIn) {
    if (spinner) spinner.style.display = "none";
    if (feedback) {
      feedback.textContent = "Authentication service endpoint does not exist on this server.";
      feedback.className = "challenge-feedback error";
      feedback.style.color = "#ff7b7b"; // danger color
    }
    if (continueBtn) continueBtn.disabled = true;
    return;
  }

  if (!isLoggedIn) {
    // Hide spinner, show warning icon and warning message styled in yellow
    if (spinner) spinner.style.display = "none";
    if (warningIcon) warningIcon.style.display = "inline";
    if (feedback) {
      feedback.textContent = "Please sign in with Google to continue.";
      feedback.className = "challenge-feedback warning";
      feedback.style.color = "var(--warning)"; // yellow warning color
    }
    if (continueBtn) continueBtn.disabled = true;

    // Trigger Google Sign-In prompt or display custom fallback button
    if (googleClientId) {
      initGoogleSignIn(googleClientId);
    } else {
      if (customBtn) customBtn.style.display = "inline-flex";
    }
    return;
  }

  // 2. Run Google reCAPTCHA v3 since the user is logged in
  reCaptchaPassed = await executeReCaptcha();

  // Hide spinner after verification complete
  if (spinner) spinner.style.display = "none";

  if (!reCaptchaPassed) {
    if (feedback) {
      feedback.textContent = "Verification failed. Please try again.";
      feedback.className = "challenge-feedback error";
      feedback.style.color = "#ff7b7b"; // danger color
    }
    if (continueBtn) continueBtn.disabled = true;
  } else {
    // Both checks pass
    if (feedback) {
      feedback.textContent = "Verification successful. You can now continue.";
      feedback.className = "challenge-feedback success";
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

  // Fallback custom sign-in button click handler
  const customBtn = document.getElementById("googleSignInBtn");
  customBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    if (window.google && window.google.accounts && window.google.accounts.id) {
      window.google.accounts.id.prompt();
    } else {
      alert("Google sign-in is still loading. Please try again in a moment.");
    }
  });
}

runSecurityGate();
attachActions();
