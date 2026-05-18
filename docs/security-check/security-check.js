import { decodeQuery, isAllowedHost, safeWindowOpen } from "../shared/security-utils.js";

const allowedHosts = new Set([
  "github.com",
  "raw.githubusercontent.com",
  "objects.githubusercontent.com",
  "archive.org",
]);

const ALTCHA_CHALLENGE_URL = "/security-check/api/challenge";
const ALTCHA_VERIFY_URL = "/security-check/api/verify";

const params = new URLSearchParams(window.location.search);
const targetParam = params.get("to");

const card = document.getElementById("security-card");
const destinationHost = document.getElementById("destination-host");
const destinationUrl = document.getElementById("destination-url");
const altchaStatus = document.getElementById("altcha-status");
const continueBtn = document.getElementById("continue-btn");
const cancelBtn = document.getElementById("cancel-btn");
const errorTemplate = /** @type {HTMLTemplateElement} */ (document.getElementById("error-template"));

const widget = /** @type {HTMLElement & { configure?: (options: Record<string, unknown>) => void }} */ (
  document.getElementById("altcha-widget")
);
let resolvedTarget = null;

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

function configureAltcha() {
  if (!widget) return;
  widget.setAttribute("challenge", ALTCHA_CHALLENGE_URL);
  widget.setAttribute("verifyurl", ALTCHA_VERIFY_URL);
  widget.configure?.({ challenge: ALTCHA_CHALLENGE_URL, verifyurl: ALTCHA_VERIFY_URL });
}

function attachAltchaHandlers() {
  if (!widget) return;

  widget.addEventListener("statechange", (event) => {
    const state = event.detail?.state;

    switch (state) {
      case "verified":
        altchaStatus.textContent = "Verification complete. You can continue.";
        continueBtn.disabled = !resolvedTarget;
        if (!continueBtn.disabled) continueBtn.focus({ preventScroll: true });
        break;
      case "error":
        altchaStatus.textContent = "Challenge failed. Refresh the challenge and try again.";
        continueBtn.disabled = true;
        break;
      case "expired":
        altchaStatus.textContent = "Challenge expired. Requesting a new one…";
        continueBtn.disabled = true;
        break;
      default:
        altchaStatus.textContent = "Solve the proof-of-work challenge to unlock the continue button.";
        continueBtn.disabled = true;
    }
  });

  widget.addEventListener("verified", () => {
    altchaStatus.textContent = "Verification complete. You can continue.";
    continueBtn.disabled = !resolvedTarget;
  });

  widget.addEventListener("code", () => {
    altchaStatus.textContent = "Enter the code challenge to continue.";
  });

  widget.addEventListener("error", () => {
    altchaStatus.textContent = "Encountered an issue with ALTCHA. Reload the page to try again.";
    continueBtn.disabled = true;
  });
}

function attachActions() {
  continueBtn.addEventListener("click", () => {
    if (!resolvedTarget) return;
    safeWindowOpen(resolvedTarget);
    window.location.assign(resolvedTarget.href);
  });

  cancelBtn.addEventListener("click", () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.assign("/");
    }
  });
}

prepareDestination();
configureAltcha();
attachAltchaHandlers();
attachActions();
