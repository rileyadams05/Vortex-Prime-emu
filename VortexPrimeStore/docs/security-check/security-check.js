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
const errorTemplate = /** @type {HTMLTemplateElement} */ (document.getElementById("error-template"));
const feedback = document.getElementById("challenge-feedback");

let resolvedTarget = null;
let solved = false;

function renderError(message) {
  const fragment = errorTemplate.content.cloneNode(true);
  const errorCard = fragment.querySelector(".error-card");
  const messageEl = fragment.getElementById("error-message");
  const backBtn = fragment.getElementById("error-back");

  if (messageEl) messageEl.textContent = message;
  if (backBtn) backBtn.addEventListener("click", () => window.history.length > 1 ? window.history.back() : window.location.assign("/"));

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

// Global callbacks for Google reCAPTCHA
function onCaptchaSuccess(token) {
  solved = true;
  if (continueBtn) continueBtn.disabled = !resolvedTarget;
  if (feedback) {
    feedback.textContent = "Verification successful! You can now continue.";
    feedback.classList.remove("error");
    feedback.classList.add("success");
  }
}

function onCaptchaExpired() {
  solved = false;
  if (continueBtn) continueBtn.disabled = true;
  if (feedback) {
    feedback.textContent = "CAPTCHA expired. Please solve it again.";
    feedback.classList.remove("success");
    feedback.classList.add("error");
  }
}

// Bind to window so the async reCAPTCHA script can find them
window.onCaptchaSuccess = onCaptchaSuccess;
window.onCaptchaExpired = onCaptchaExpired;

function attachActions() {
  continueBtn?.addEventListener("click", () => {
    if (!resolvedTarget || !solved) return;
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

prepareDestination();
attachActions();
